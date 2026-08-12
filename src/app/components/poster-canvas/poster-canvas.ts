import {
  Component, ElementRef, HostListener, ViewChild, computed, input, signal,
} from '@angular/core';
import { Attachments, CHANNELS, ChannelKey, ColorChannelState, LOADOUT_FIELDS } from '../../models/loadout.model';
import { LAYOUTS, LAYOUT_KEYS, PosterLayout } from '../../data/layouts.data';
import { PALETTES, PALETTE_NAMES } from '../../data/palettes.data';
import { PaletteGrid } from '../palette-grid/palette-grid';

interface SourceCrop { srcX: number; srcY: number; srcW: number; srcH: number; }
interface PosterColor { hex: string; label: string; }

/**
 * THE POSTER GENERATOR — Step 4b.
 * ================================
 * This is a leaf component: it receives the loadout's CONTENT
 * (frame, name, creator, attachments, colorState) as inputs from
 * Builder, but owns all of its OWN state itself — the uploaded
 * screenshot, crop/zoom/pan, chosen layout, background colors. None
 * of that is loadout data worth saving; it's ephemeral, one-time
 * rendering state, so it correctly lives here and nowhere else.
 *
 * Structure mirrors the prototype's own module breakdown almost
 * exactly (see the section comments below) — this was originally a
 * single 1,800-line script; here it's the same logic, organized the
 * same way, just reading component signals instead of
 * document.getElementById().
 */
@Component({
  selector: 'app-poster-canvas',
  imports: [PaletteGrid],
  templateUrl: './poster-canvas.html',
  styleUrl: './poster-canvas.css',
})
export class PosterCanvas {
  // ── Content coming down from Builder (read-only here) ──────
  frame = input.required<string>();
  name = input.required<string>();
  creator = input.required<string>();
  attachments = input.required<Attachments>();
  colorState = input.required<Record<ChannelKey, ColorChannelState>>();

  // ── DOM handles (canvas/image work needs real measurements —
  //    the one place in this app where direct DOM access is the
  //    right tool, not a shortcut around Angular) ──────────────
  @ViewChild('uploadZone') uploadZoneRef!: ElementRef<HTMLDivElement>;
  @ViewChild('previewImg') previewImgRef!: ElementRef<HTMLImageElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imgControls') imgControlsRef!: ElementRef<HTMLDivElement>;
  @ViewChild('posterCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  // ── Image + crop/zoom/pan state ─────────────────────────────
  imageDataUrl = signal<string | null>(null);
  imageNaturalWidth = signal(0);
  imageNaturalHeight = signal(0);
  imgZoom = signal(100);
  imgPanX = signal(0);
  imgPanY = signal(0);
  imgCrop = signal(100);
  dragOver = signal(false);

  hasImage = computed(() => this.imageDataUrl() !== null);

  // ── Auto-detected mode (new) ──────────────────────────────────
  // null = no image yet. true = real alpha transparency found (a
  // background-removed cutout) -> full-bleed rendering. false = fully
  // opaque (a raw screenshot) -> the existing crop/mask rendering.
  // A person can override this via modeOverride; when set, it wins
  // over the detected value.
  detectedTransparent = signal<boolean | null>(null);
  modeOverride = signal<boolean | null>(null);
  isTransparentMode = computed(() => this.modeOverride() ?? this.detectedTransparent());

  toggleModeOverride() {
    this.modeOverride.set(!this.isTransparentMode());
  }

  // ── Monochrome background removal (new) ─────────────────────
  // When an opaque screenshot turns out to have a solid-color
  // backdrop (Captura green screen, or any uniform color), we key it
  // out ONCE at upload time and keep BOTH versions, so the person can
  // flip between the keyed cutout and the untouched original.
  // bgRemovalOn = the keyed version is currently active. Keying at
  // upload (not at render) means everything downstream —
  // detectTransparency semantics, trimTransparentBounds,
  // dominantHueColor, all four layouts — inherits it unchanged; the
  // same "fix it in one place" pattern as LoadoutService.
  originalImageDataUrl = signal<string | null>(null);
  keyedImageDataUrl = signal<string | null>(null);
  bgRemovalOn = signal(false);
  removedBgHex = signal<string | null>(null);

  /** Flip between the keyed cutout and the original screenshot. */
  toggleBgRemoval() {
    const keyed = this.keyedImageDataUrl();
    const original = this.originalImageDataUrl();
    if (!keyed || !original) return;
    const turnOn = !this.bgRemovalOn();
    this.bgRemovalOn.set(turnOn);
    this.imageDataUrl.set(turnOn ? keyed : original);
    this.detectedTransparent.set(turnOn); // keyed -> transparent engine, original -> photo mode
    this.modeOverride.set(null);
    setTimeout(() => this.updatePreview(), 0);
  }

  // Preview positioning — recomputed imperatively (see updatePreview())
  // because it depends on the live pixel size of the upload zone,
  // something only the real DOM can tell us.
  previewStyle = signal<{ width: string; height: string; left: string; top: string }>({ width: '0', height: '0', left: '0', top: '0' });
  cropOverlay = signal<{ leftDark: number; rightDarkLeft: number; rightDarkWidth: number; lineLeft: number; lineRight: number; zoneH: number } | null>(null);

  // ── Layout + poster background ──────────────────────────────
  layoutKeys = LAYOUT_KEYS;
  layouts = LAYOUTS;
  selectedLayoutKey = signal<string>('left-classic');
  selectedLayout = computed<PosterLayout>(() => this.layouts[this.selectedLayoutKey()]);

  posterColor1 = signal<PosterColor | null>(null);
  posterColor2 = signal<PosterColor | null>(null);

  colorPickerTarget = signal<1 | 2 | null>(null); // which swatch opened the modal
  pickerPaletteName = signal('Tenno');
  paletteNames = PALETTE_NAMES;
  pickerCells = computed(() => PALETTES[this.pickerPaletteName()]);

  // ── Output / status ──────────────────────────────────────────
  posterReady = signal(false);
  toast = signal('');

  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private showToast(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2500);
  }

  // ═══════════════════════════════════════════════════════════
  // IMAGE UPLOAD
  // ═══════════════════════════════════════════════════════════

  onZoneClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.img-controls')) return;
    this.fileInputRef.nativeElement.click();
  }

  onDragOver(e: DragEvent) { e.preventDefault(); this.dragOver.set(true); }
  onDragLeave() { this.dragOver.set(false); }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.loadImage(file);
  }

  onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.loadImage(file);
  }

  // Clipboard paste works anywhere on the page while the Builder is open —
  // matches the prototype's global paste listener.
  @HostListener('document:paste', ['$event'])
  onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) this.loadImage(file);
        return;
      }
    }
  }

  private loadImage(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        this.imageNaturalWidth.set(img.naturalWidth);
        this.imageNaturalHeight.set(img.naturalHeight);
        this.resetSliders();
        this.modeOverride.set(null); // a new image gets a fresh auto-detection, not the last image's override

        // Clear any previous image's keying state — these belong to
        // the OLD upload; carrying them over would let a stale
        // "use original" restore the wrong picture.
        this.originalImageDataUrl.set(null);
        this.keyedImageDataUrl.set(null);
        this.bgRemovalOn.set(false);
        this.removedBgHex.set(null);

        const transparent = this.detectTransparency(img);
        if (transparent) {
          this.imageDataUrl.set(dataUrl);
          this.detectedTransparent.set(true);
          this.showToast('Cutout detected — full-bleed render');
        } else {
          // Opaque — but is it a solid-color backdrop we can key out?
          const keyed = this.tryRemoveMonochromeBackground(img);
          if (keyed) {
            this.originalImageDataUrl.set(dataUrl);
            this.keyedImageDataUrl.set(keyed.dataUrl);
            this.removedBgHex.set(keyed.hex);
            this.bgRemovalOn.set(true);
            this.imageDataUrl.set(keyed.dataUrl);
            this.detectedTransparent.set(true); // it IS transparent now
            this.showToast('Solid background removed — full-bleed render');
          } else {
            this.imageDataUrl.set(dataUrl);
            this.detectedTransparent.set(false);
            this.showToast('Screenshot loaded — adjust zoom & pan below');
          }
        }
        // Wait a tick for the preview <img> to actually exist in the DOM
        setTimeout(() => this.updatePreview(), 0);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Reads the image's real alpha channel to decide which rendering
   * pipeline fits — not just "is this a PNG" (opaque PNGs are common),
   * but "does a meaningful fraction of it actually vary in opacity."
   * A handful of stray semi-transparent pixels (compression artifacts,
   * anti-aliased edges) shouldn't flip an otherwise-opaque screenshot
   * into full-bleed mode, so this requires a real proportion, not just
   * any non-255 pixel at all.
   */
  private detectTransparency(img: HTMLImageElement): boolean {
    const cv = document.createElement('canvas');
    // Sampling at a small fixed size is enough to answer "is there
    // real transparency" without reading a full-resolution image.
    const sw = 120, sh = Math.max(1, Math.round(120 * img.naturalHeight / img.naturalWidth));
    cv.width = sw; cv.height = sh;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;
    let nonOpaque = 0;
    const total = sw * sh;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) nonOpaque++;
    }
    return (nonOpaque / total) > 0.03; // >3% of the image has real transparency
  }

  // ═══════════════════════════════════════════════════════════
  // MONOCHROME BACKGROUND REMOVAL
  // Runs once at upload; produces a transparent PNG that flows
  // through the existing transparent-mode pipeline unchanged.
  // Constants verified by rendering against a real green-screen
  // Captura shot (key detected at rgb(0,195,117), 91.5% of the
  // image keyed out), not guessed — including the boundary-erosion
  // pass, which exists because the first version left a visible
  // dark-green halo that only showed up at 3x zoom on a dark
  // composite. Caught by rendering, not by compilation.
  // ═══════════════════════════════════════════════════════════

  /**
   * Samples a thin border ring and decides whether it's a uniform
   * backdrop. Uses "fraction of samples near the mean" rather than
   * pure std-dev, so a limb or syandana poking into the border doesn't
   * veto an otherwise-obvious green screen. Verified: 100% uniformity
   * on a real Captura green screen; a normal busy in-game scene fails
   * the 92% bar.
   */
  private detectMonochromeBackground(
    data: Uint8ClampedArray, width: number, height: number,
  ): [number, number, number] | null {
    const margin = Math.max(2, Math.round(Math.min(width, height) * 0.02));
    const step = 4;
    const samples: [number, number, number][] = [];
    const push = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 250) return; // real transparency -> not this path
      samples.push([data[i], data[i + 1], data[i + 2]]);
    };
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < margin; x += step) push(x, y);
      for (let x = width - margin; x < width; x += step) push(x, y);
    }
    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < margin; y += step) push(x, y);
      for (let y = height - margin; y < height; y += step) push(x, y);
    }
    if (samples.length < 50) return null;

    const mean: [number, number, number] = [0, 0, 0];
    for (const s of samples) { mean[0] += s[0]; mean[1] += s[1]; mean[2] += s[2]; }
    mean[0] /= samples.length; mean[1] /= samples.length; mean[2] /= samples.length;

    let near = 0;
    for (const s of samples) {
      const d = Math.hypot(s[0] - mean[0], s[1] - mean[1], s[2] - mean[2]);
      if (d < 30) near++;
    }
    return (near / samples.length) >= 0.92 ? mean : null;
  }

  /**
   * Keys the backdrop out of the pixel data in place.
   *
   * SATURATED keys (green screen etc.) get chroma UNMIXING, not binary
   * keying. Model: observed = alpha*foreground + (1-alpha)*key. Each
   * pixel's backdrop fraction is estimated from how much of the key's
   * channel signature it carries (Vlahos-style), then the key's
   * contribution is SUBTRACTED from the color and the alpha reduced to
   * match. This is what handles semi-transparent content — ephemera
   * smoke and cape frays captured with green showing THROUGH them.
   * Binary keying (round 1) left those as solid green-tinted patches
   * around Harrow's crown: the pixels weren't green enough to remove
   * but were too green to keep. Unmixing turns them back into purple
   * smoke at partial alpha. Verified by rendering against the real
   * green-screen Harrow (86.2% fully removed, 1.9% unmixed) and
   * comparing crown/cape crops against the original at 2x.
   *
   * Known limit, accepted deliberately: a pixel where the key blended
   * into a hue on the FAR side of it (green into blue -> cyan) is
   * mathematically indistinguishable from genuinely cyan foreground —
   * single-color keying is underdetermined there; compositors solve it
   * with garbage mattes, not math. At poster scale these read as rim
   * lighting, which Harrow's ephemera genuinely has anyway.
   *
   * NEUTRAL keys (white/grey/black backdrops) have no channel
   * signature to unmix against, so they fall back to distance keying
   * with a smoothstep feather; dark keys get tighter tolerances so
   * near-black armor is never mistaken for a near-black backdrop.
   */
  private keyOutBackground(
    data: Uint8ClampedArray, width: number, height: number,
    key: [number, number, number],
  ): number {
    const maxC = Math.max(key[0], key[1], key[2]);
    const minC = Math.min(key[0], key[1], key[2]);
    const isDark = maxC < 64;
    const isSaturated = (maxC - minC) > 40;
    const total = width * height;

    if (isSaturated) {
      // ── Chroma unmixing ──
      const domIdx = key.indexOf(maxC);
      const others = [0, 1, 2].filter(c => c !== domIdx);
      // The key's signature: how much its dominant channel exceeds the rest
      const keyExcess = key[domIdx] - Math.max(key[others[0]], key[others[1]]);
      let full = 0;
      for (let i = 0; i < data.length; i += 4) {
        const excess = data[i + domIdx] - Math.max(data[i + others[0]], data[i + others[1]]);
        if (excess <= 0) continue; // no detectable key contribution
        const f = excess / keyExcess; // backdrop fraction this pixel carries
        if (f >= 0.98) {
          data[i + 3] = 0; full++; // effectively pure backdrop
          continue;
        }
        if (f < 0.04) continue; // noise floor — leave untouched
        const alpha = 1 - f;
        // Solve observed = alpha*fg + f*key  ->  fg = (observed - f*key)/alpha
        for (let c = 0; c < 3; c++) {
          const fg = (data[i + c] - f * key[c]) / alpha;
          data[i + c] = Math.max(0, Math.min(255, Math.round(fg)));
        }
        data[i + 3] = Math.round(data[i + 3] * alpha);
      }
      return full / total;
    }

    // ── Neutral key: distance keying with smoothstep feather ──
    const T1 = isDark ? 25 : 55;   // fully removed inside this distance
    const T2 = isDark ? 55 : 110;  // fully kept beyond this distance
    let removed = 0;
    for (let i = 0; i < data.length; i += 4) {
      const d = Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]);
      if (d <= T1) {
        data[i + 3] = 0; removed++;
      } else if (d < T2) {
        const t = (d - T1) / (T2 - T1);
        const a = t * t * (3 - 2 * t); // smoothstep
        data[i + 3] = Math.min(data[i + 3], Math.round(a * 255));
      }
    }
    return removed / total;
  }

  /**
   * Orchestrator: full-res scan -> detect -> key -> re-encode.
   * Returns null when there's no uniform backdrop (a normal
   * screenshot) or when keying removed implausibly little — a
   * defensive floor, since a real backdrop is a meaningful share of
   * the image (91.5% on the verified test shot).
   */
  private tryRemoveMonochromeBackground(
    img: HTMLImageElement,
  ): { dataUrl: string; hex: string } | null {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, cv.width, cv.height);

    const key = this.detectMonochromeBackground(imgData.data, cv.width, cv.height);
    if (!key) return null;

    const removedFrac = this.keyOutBackground(imgData.data, cv.width, cv.height, key);
    if (removedFrac < 0.15) return null; // barely anything keyed -> probably not a backdrop

    ctx.putImageData(imgData, 0, 0);
    const hex = '#' + key.map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
    return { dataUrl: cv.toDataURL('image/png'), hex };
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.imageDataUrl()) this.updatePreview();
  }

  resetSliders() {
    this.imgZoom.set(100);
    this.imgPanX.set(0);
    this.imgPanY.set(0);
    this.imgCrop.set(100);
    this.updatePreview();
  }

  onSliderChange() {
    this.updatePreview();
  }

  /**
   * Positions the live preview <img> and crop-overlay rectangles.
   * Same math as the prototype's updatePreview() — this is the part
   * that genuinely needs real pixel measurements from the DOM, so it
   * stays imperative rather than a pure computed().
   */
  private updatePreview() {
    if (!this.imageNaturalWidth() || !this.uploadZoneRef) return;
    const zone = this.uploadZoneRef.nativeElement;
    const controls = this.imgControlsRef?.nativeElement;
    const controlsH = controls && this.hasImage() ? controls.offsetHeight : 0;
    const zoneW = zone.clientWidth;
    const zoneH = zone.clientHeight - controlsH;
    if (zoneH <= 0) return;

    const baseScale = zoneH / this.imageNaturalHeight();
    const scale = baseScale * (this.imgZoom() / 100);
    const drawW = this.imageNaturalWidth() * scale;
    const drawH = this.imageNaturalHeight() * scale;
    const cx = (zoneW - drawW) / 2 + this.imgPanX();
    const cy = (zoneH - drawH) / 2 + this.imgPanY();

    this.previewStyle.set({
      width: `${drawW}px`, height: `${drawH}px`, left: `${cx}px`, top: `${cy}px`,
    });

    const keepFraction = Math.max(0.1, this.imgCrop() / 100);
    const visibleW = zoneW * keepFraction;
    const visLeft = (zoneW - visibleW) / 2;
    const visRight = (zoneW + visibleW) / 2;

    this.cropOverlay.set({
      leftDark: Math.max(0, visLeft),
      rightDarkLeft: visRight,
      rightDarkWidth: Math.max(0, zoneW - visRight),
      lineLeft: visLeft,
      lineRight: visRight,
      zoneH,
    });
  }

  /**
   * Reconstructs the crop rectangle in the SOURCE image's own pixel
   * coordinates, using the exact same scale/pan math as the preview.
   * This is what makes "what you see is what you get" true: the
   * poster crops exactly what the preview showed.
   */
  private computeSourceCrop(img: HTMLImageElement): SourceCrop | null {
    const zone = this.uploadZoneRef.nativeElement;
    const controls = this.imgControlsRef?.nativeElement;
    const controlsH = controls && this.hasImage() ? controls.offsetHeight : 0;
    const zoneW = zone.clientWidth;
    const zoneH = zone.clientHeight - controlsH;
    if (zoneH <= 0) return null;

    const baseScale = zoneH / img.height;
    const scale = baseScale * (this.imgZoom() / 100);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const cx = (zoneW - drawW) / 2 + this.imgPanX();
    const cy = (zoneH - drawH) / 2 + this.imgPanY();

    const keepFraction = Math.max(0.1, this.imgCrop() / 100);
    const cropVisW = zoneW * keepFraction;
    const cropLeft = (zoneW - cropVisW) / 2;

    return {
      srcX: (cropLeft - cx) / scale,
      srcY: (0 - cy) / scale,
      srcW: cropVisW / scale,
      srcH: zoneH / scale,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LAYOUT PICKER
  // ═══════════════════════════════════════════════════════════

  selectLayout(key: string) {
    this.selectedLayoutKey.set(key);
  }

  // ═══════════════════════════════════════════════════════════
  // POSTER BACKGROUND COLOR PICKER (reuses PaletteGrid)
  // ═══════════════════════════════════════════════════════════

  openColorPicker(target: 1 | 2) {
    this.colorPickerTarget.set(target);
    this.pickerPaletteName.set('Tenno');
  }

  closeColorPicker() {
    this.colorPickerTarget.set(null);
  }

  onPickerPaletteSelect(e: Event) {
    this.pickerPaletteName.set((e.target as HTMLSelectElement).value);
  }

  pickPosterColor(cell: { row: number; col: number; hex: string }) {
    const label = `${this.pickerPaletteName()} ${String.fromCharCode(65 + cell.col)}${cell.row + 1}`;
    const target = this.colorPickerTarget();
    if (target === 1) this.posterColor1.set({ hex: cell.hex, label });
    else if (target === 2) this.posterColor2.set({ hex: cell.hex, label });
    this.closeColorPicker();
  }

  /** Which color sits at the edges vs. the glow peak — same two slots regardless of mode. */
  bgSwapped = signal(false);
  toggleBgSwap() {
    this.bgSwapped.update(v => !v);
  }

  /** Clears any manual color pick(s), returning to auto-detection. */
  resetBgToAuto() {
    this.posterColor1.set(null);
    this.posterColor2.set(null);
    this.bgSwapped.set(false);
  }

  // ═══════════════════════════════════════════════════════════
  // POSTER RENDERER — the canvas drawing engine.
  // Same modular breakdown as the prototype: one function per
  // visual piece, composed by generatePoster() at the bottom.
  // ═══════════════════════════════════════════════════════════

  private hexToRgb(hex: string): [number, number, number] {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  private rgbaStr(hex: string, alpha = 1): string {
    const [r, g, b] = this.hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ═══════════════════════════════════════════════════════════
  // NEW ENGINE — full-bleed compositing for background-removed
  // cutouts. Ported from a Python/PIL prototype built and approved
  // against real screenshots before any of this was written as
  // TypeScript — the algorithm itself isn't a guess.
  // ═══════════════════════════════════════════════════════════

  private mixRgb(c1: [number,number,number], c2: [number,number,number], t: number): [number,number,number] {
    return [c1[0]+(c2[0]-c1[0])*t, c1[1]+(c2[1]-c1[1])*t, c1[2]+(c2[2]-c1[2])*t];
  }
  private rgbCss(c: [number,number,number], a = 1): string {
    return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
  }

  /**
   * Trims excess transparent padding around a cutout, using its real
   * alpha channel — the same bounding-box scan as the Python version.
   */
  private trimTransparentBounds(imgData: ImageData): { x: number; y: number; w: number; h: number } {
    const { data, width, height } = imgData;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = data[(y * width + x) * 4 + 3];
        if (a > 10) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return { x: 0, y: 0, w: width, h: height }; // fully empty — bail safely
    const padX = Math.round((maxX - minX) * 0.025), padY = Math.round((maxY - minY) * 0.025);
    const x = Math.max(0, minX - padX), y = Math.max(0, minY - padY);
    const w = Math.min(width, maxX + padX) - x, h = Math.min(height, maxY + padY) - y;
    return { x, y, w, h };
  }

  /**
   * Same technique as the Python prototype: build a hue histogram
   * weighted by saturation*value (so vivid, bright pixels count for
   * more), find the peak hue, then represent it vividly rather than
   * literally averaging — averaging a teal energy color with black
   * armor produces muddy grey, not teal.
   */
  private dominantHueColor(imgData: ImageData): [number, number, number] {
    const { data } = imgData;
    const hist = new Float64Array(48);
    const satAtHue: number[] = new Array(48).fill(0);
    const valAtHue: number[] = new Array(48).fill(0);
    const countAtHue: number[] = new Array(48).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i+3];
      if (a < 200) continue;
      const r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      const v = max;
      const s = max > 0 ? (max-min)/max : 0;
      if (s <= 0.28 || v <= 0.18 || v >= 0.97) continue;
      let h = 0;
      if (max === min) h = 0;
      else if (max === r) h = ((g-b)/(max-min)) % 6;
      else if (max === g) h = (b-r)/(max-min) + 2;
      else h = (r-g)/(max-min) + 4;
      h = h/6; if (h < 0) h += 1;
      const bin = Math.min(47, Math.floor(h*48));
      const w = s*v;
      hist[bin] += w; satAtHue[bin] += s*w; valAtHue[bin] += v*w; countAtHue[bin] += w;
    }
    let peak = 0;
    for (let i = 1; i < 48; i++) if (hist[i] > hist[peak]) peak = i;
    if (hist[peak] < 1e-6) return [140,140,160];
    const peakHue = (peak + 0.5) / 48;
    const medS = countAtHue[peak] > 0 ? satAtHue[peak]/countAtHue[peak] : 0.6;
    const medV = countAtHue[peak] > 0 ? valAtHue[peak]/countAtHue[peak] : 0.6;
    const vividS = Math.min(0.85, Math.max(0.55, medS*1.3));
    const vividV = Math.min(0.95, Math.max(0.55, medV*1.2));
    return this.hsvToRgb(peakHue, vividS, vividV);
  }

  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h*6), f = h*6-i, p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
    let r=0,g=0,b=0;
    switch (i%6) {
      case 0: r=v;g=t;b=p; break; case 1: r=q;g=v;b=p; break; case 2: r=p;g=v;b=t; break;
      case 3: r=p;g=q;b=v; break; case 4: r=t;g=p;b=v; break; case 5: r=v;g=p;b=q; break;
    }
    return [r*255, g*255, b*255];
  }

  private rgbToHsv(rgb: [number,number,number]): [number, number, number] {
    const r = rgb[0]/255, g = rgb[1]/255, b = rgb[2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    let h = 0;
    if (d > 0) {
      if (max === r) h = ((g-b)/d) % 6;
      else if (max === g) h = (b-r)/d + 2;
      else h = (r-g)/d + 4;
      h = h/6; if (h < 0) h += 1;
    }
    const s = max > 0 ? d/max : 0;
    return [h, s, max];
  }

  /**
   * Guarantees the glow slot reads as genuinely bright regardless of
   * what color feeds it — a flat "mix 12% toward white" only works
   * if the input is already fairly bright/saturated (gold, purple,
   * red all pass through fine). It silently fails for a deliberately
   * DARK input (the "dark neutral" landing here via the swap toggle),
   * since 12% of near-black is still near-black. Flooring the actual
   * HSV value/saturation fixes this for every case, not just the ones
   * already tested — dark inputs get genuinely lifted, already-bright
   * inputs are left alone (their value is already above the floor).
   */
  private richenForGlow(rgb: [number,number,number]): [number,number,number] {
    const [h, s, v] = this.rgbToHsv(rgb);
    return this.hsvToRgb(h, Math.max(s, 0.18), Math.max(v, 0.62));
  }

  /**
   * The bell-curve atmospheric gradient + glow + vignette.
   * A genuine there-and-back flow between exactly two color slots:
   * `edgeColor` anchors BOTH the top and bottom, `glowColor` is the
   * bright peak in the middle — the same shape as light falling off
   * from a source, which is what makes this read as atmosphere rather
   * than a decorative stripe. Every mode (auto, single color, two
   * colors) is just a different choice of what fills these two slots;
   * there's only one flow, not six different ones.
   */
  private drawAtmosphereBg(ctx: CanvasRenderingContext2D, W: number, H: number, edgeColor: [number,number,number], glowColor: [number,number,number]) {
    const deepEdge = this.mixRgb(edgeColor, [8,5,6], 0.85);
    const richGlow = this.richenForGlow(glowColor);
    // Centered at the true vertical midpoint — a there-and-back flow
    // that peaks off-center reads as lopsided on a bare background,
    // even though the same math looked fine once a character was
    // composited on top and drew the eye toward that area instead.
    const bandCenter = 0.5, bandWidth = 0.22;

    // Vertical bell-curve gradient — deepEdge at t=0 AND t=1, richGlow
    // at the peak. Built from many sampled stops on a native
    // CanvasGradient so it's continuous, not 1750 rounded 1px strips.
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    const STOPS = 32;
    for (let i = 0; i <= STOPS; i++) {
      const t = i / STOPS;
      const glow = Math.exp(-((t-bandCenter)**2)/(2*bandWidth**2));
      bgGrad.addColorStop(t, this.rgbCss(this.mixRgb(deepEdge, richGlow, glow)));
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Soft radial glow — a NATIVE radial gradient, not blurred discrete
    // shapes. ctx.filter('blur') is a fast approximation, not a true
    // Gaussian, and at large radii it doesn't fully smooth away the
    // boundaries between stacked shapes — that's what was showing up
    // as visible concentric rings. A gradient has no boundaries to
    // begin with; it's continuous math, so there's nothing to blur.
    const gcx = W*0.5, gcy = H*0.38, maxRad = 620;
    const glowGrad = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, maxRad);
    glowGrad.addColorStop(0,    this.rgbCss(richGlow, 0.22));
    glowGrad.addColorStop(0.3,  this.rgbCss(richGlow, 0.17));
    glowGrad.addColorStop(0.6,  this.rgbCss(richGlow, 0.09));
    glowGrad.addColorStop(1,    this.rgbCss(richGlow, 0));
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, H);

    // Vignette — same approach: a radial gradient, transparent center,
    // darkening toward the far corners, rather than a blurred rectangle.
    const vigGrad = ctx.createRadialGradient(W/2, H*0.45, H*0.35, W/2, H*0.45, H*0.85);
    vigGrad.addColorStop(0, this.rgbCss(deepEdge, 0));
    vigGrad.addColorStop(1, this.rgbCss(deepEdge, 0.65));
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);

    return deepEdge;
  }

  private drawGoldFrame(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const outer = 22, inner = 32;
    ctx.strokeStyle = 'rgba(200,160,90,.65)'; ctx.lineWidth = 2;
    ctx.strokeRect(outer, outer, W-outer*2, H-outer*2);
    ctx.strokeStyle = 'rgba(200,160,90,.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(inner, inner, W-inner*2, H-inner*2);
    const dsize = 7, dcx = (outer+inner)/2;
    for (const [x,y] of [[dcx,dcx],[W-dcx,dcx],[dcx,H-dcx],[W-dcx,H-dcx]] as [number,number][]) {
      ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4);
      ctx.fillStyle = 'rgb(200,160,90)';
      ctx.fillRect(-dsize,-dsize,dsize*2,dsize*2);
      ctx.restore();
    }
  }

  /** Centered header text with manual letter-tracking (works in every browser, not just ones with ctx.letterSpacing). */
  private drawTrackedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, tracking: number) {
    const widths = Array.from(text).map(ch => ctx.measureText(ch).width);
    const total = widths.reduce((a,b) => a+b, 0) + tracking*(text.length-1);
    let x = cx - total/2;
    for (let i = 0; i < text.length; i++) {
      ctx.fillText(text[i], x, y);
      x += widths[i] + tracking;
    }
  }

  /**
   * Shared setup for every transparent-mode layout: loads the image,
   * reads its pixel data once, trims the silhouette bounds, extracts
   * the accent color, and paints the atmosphere background. Every
   * layout starts from exactly this same state.
   */
  private async setupTransparentCanvas(): Promise<{
    ctx: CanvasRenderingContext2D; W: number; H: number; rawImg: HTMLImageElement;
    bounds: { x: number; y: number; w: number; h: number };
    accent: [number, number, number]; deep: [number, number, number];
  }> {
    await document.fonts.ready;
    const cv = this.canvasRef.nativeElement;
    const ctx = cv.getContext('2d')!;
    const W = 1400, H = 1750;
    cv.width = W; cv.height = H;

    const rawImg = await this.loadImgEl(this.imageDataUrl()!);
    const scanCv = document.createElement('canvas');
    scanCv.width = rawImg.naturalWidth; scanCv.height = rawImg.naturalHeight;
    const scanCtx = scanCv.getContext('2d', { willReadFrequently: true })!;
    scanCtx.drawImage(rawImg, 0, 0);
    const fullData = scanCtx.getImageData(0, 0, scanCv.width, scanCv.height);

    const bounds = this.trimTransparentBounds(fullData);
    const autoAccent = this.dominantHueColor(fullData);

    // Background color has exactly two slots — edge (both top and
    // bottom) and glow (the bright peak) — regardless of mode:
    //   Auto:        edge = dark neutral,  glow = auto-detected
    //   One color:   edge = dark neutral,  glow = your color
    //   Two colors:  edge = color1,        glow = color2
    // `bgSwapped` flips which value lands in which slot — one toggle
    // covers every mode, since it's the same two slots either way.
    const DARK_NEUTRAL: [number,number,number] = [12, 6, 8];
    const c1 = this.posterColor1();
    const c2 = this.posterColor2();

    let edgeSlot: [number,number,number], glowSlot: [number,number,number];
    if (c1 && c2) {
      edgeSlot = this.hexToRgb(c1.hex); glowSlot = this.hexToRgb(c2.hex);
    } else if (c1) {
      edgeSlot = DARK_NEUTRAL; glowSlot = this.hexToRgb(c1.hex);
    } else {
      edgeSlot = DARK_NEUTRAL; glowSlot = autoAccent;
    }
    if (this.bgSwapped()) { const tmp = edgeSlot; edgeSlot = glowSlot; glowSlot = tmp; }
    const accent = glowSlot; // the "accent" used elsewhere (text tinting etc.) follows whatever's glowing

    const deep = this.drawAtmosphereBg(ctx, W, H, edgeSlot, glowSlot);
    return { ctx, W, H, rawImg, bounds, accent, deep };
  }

  /**
   * Header title/subtitle/divider, positioned from REAL measured text
   * metrics rather than a guessed baseline — this is the exact bug
   * that once put "WARFRAME" overlapping the frame border. One
   * implementation used by every layout means that bug can only ever
   * need fixing once, not four times.
   */
  private drawComputedHeader(ctx: CanvasRenderingContext2D, W: number, lightTxt: [number,number,number], accentLight: [number,number,number]): number {
    const FRAME_INNER = 32, TITLE_TOP_MARGIN = 20;
    ctx.textAlign = 'left';
    ctx.font = '600 58px Cinzel, serif';
    const titleAscent = ctx.measureText('WARFRAME').actualBoundingBoxAscent || 42;
    const titleBaseline = FRAME_INNER + TITLE_TOP_MARGIN + titleAscent;
    const subBaseline = titleBaseline + 66;
    const dividerY = subBaseline + 20;

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.rgbCss(lightTxt);
    this.drawTrackedText(ctx, 'WARFRAME', W/2, titleBaseline, 6);
    ctx.font = '16px Cinzel, serif';
    ctx.fillStyle = this.rgbCss(accentLight);
    this.drawTrackedText(ctx, 'FASHION CARD', W/2, subBaseline, 10);
    ctx.strokeStyle = this.rgbCss(accentLight, 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W*0.34, dividerY); ctx.lineTo(W*0.66, dividerY); ctx.stroke();
    return dividerY;
  }

  /** "Contain" fit — same guarantee regardless of a character's proportions: never overflow EITHER dimension. */
  private fitContain(bounds: {w:number;h:number}, maxH: number, maxW: number): { targetW: number; targetH: number } {
    const scale = Math.min(maxH / bounds.h, maxW / bounds.w);
    return { targetW: Math.round(bounds.w * scale), targetH: Math.round(bounds.h * scale) };
  }

  private drawContactShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, targetW: number, targetH: number) {
    ctx.save();
    ctx.filter = 'blur(22px)';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx+targetW*0.5, cy+targetH*0.995, targetW*0.38, targetH*0.03, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  private getFieldsAndColors() {
    const att = this.attachments();
    const fields = LOADOUT_FIELDS.map(f => ({ label: f.label.toUpperCase(), value: att[f.key]?.trim() || '—' }));
    const state = this.colorState();
    const colorRows = CHANNELS.map(ch => ({ label: ch.name.toUpperCase(), value: state[ch.key].label || '—', hex: state[ch.key].hex }));
    return { fields, colorRows };
  }

  /**
   * Draws one column of attachment/color rows, spaced to exactly fill
   * [topY, bottomY] regardless of how many entries it holds — this is
   * what makes a single 16-entry column (Classic Left/Right) and a
   * split pair of 8-entry columns (Split) both look intentional
   * instead of one being sparse or one being cramped.
   */
  private drawTextColumn(
    ctx: CanvasRenderingContext2D,
    opts: {
      x: number; align: 'left' | 'right'; topY: number; bottomY: number;
      fields: { label: string; value: string }[];
      colors: { label: string; value: string; hex: string }[];
      lightTxt: [number,number,number]; dimTxt: [number,number,number]; accentLight: [number,number,number];
      labelSize?: number; valueSize?: number; pillSize?: number;
    },
  ) {
    const labelSize = opts.labelSize ?? 15, valueSize = opts.valueSize ?? 27, pillSize = opts.pillSize ?? 23;
    const dividerGap = 40;
    const hasBoth = opts.fields.length > 0 && opts.colors.length > 0;
    const total = opts.fields.length + opts.colors.length;
    const perEntry = total > 0 ? (opts.bottomY - opts.topY - (hasBoth ? dividerGap : 0)) / total : 0;
    const { x, align } = opts;

    ctx.textAlign = align;
    let y = opts.topY;
    for (const f of opts.fields) {
      ctx.font = `${labelSize}px Cinzel, serif`; ctx.fillStyle = this.rgbCss(opts.accentLight);
      ctx.fillText(f.label, x, y);
      ctx.font = `${valueSize}px "Cormorant Garamond", serif`; ctx.fillStyle = this.rgbCss(opts.lightTxt);
      ctx.fillText(f.value, x, y+29);
      y += perEntry;
    }
    if (hasBoth) {
      y += dividerGap*0.3;
      ctx.strokeStyle = this.rgbCss(opts.dimTxt, 0.5); ctx.lineWidth = 1;
      ctx.beginPath();
      if (align === 'right') { ctx.moveTo(x-220, y); ctx.lineTo(x, y); }
      else { ctx.moveTo(x, y); ctx.lineTo(x+220, y); }
      ctx.stroke();
      y += dividerGap*0.7;
    }
    for (const c of opts.colors) {
      const text = `${c.label}  ${c.value}`;
      ctx.font = `${pillSize}px "Cormorant Garamond", serif`;
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = c.hex;
      if (align === 'right') {
        const pillX = x - tw - 44;
        ctx.beginPath(); ctx.roundRect(pillX, y+4, 32, 15, 7); ctx.fill();
        ctx.fillStyle = this.rgbCss(opts.lightTxt); ctx.textAlign = 'right';
        ctx.fillText(text, x, y+19);
      } else {
        ctx.beginPath(); ctx.roundRect(x, y+4, 32, 15, 7); ctx.fill();
        ctx.fillStyle = this.rgbCss(opts.lightTxt); ctx.textAlign = 'left';
        ctx.fillText(text, x+44, y+19);
      }
      y += perEntry;
    }
    ctx.textAlign = 'left';
  }

  private drawSignature(
    ctx: CanvasRenderingContext2D, x: number, y: number, align: 'left' | 'center',
    lightTxt: [number,number,number], dimTxt: [number,number,number], accentLight: [number,number,number],
  ) {
    ctx.textAlign = align === 'center' ? 'center' : 'left';
    ctx.font = '600 54px Cinzel, serif'; ctx.fillStyle = this.rgbCss(lightTxt);
    ctx.fillText((this.frame() || 'WARFRAME').toUpperCase(), x, y);
    ctx.font = '26px "Cormorant Garamond", serif'; ctx.fillStyle = this.rgbCss(dimTxt);
    ctx.fillText(`By ${this.creator() || 'Tenno'}`, x, y+60);
    ctx.font = 'italic 23px "Cormorant Garamond", serif'; ctx.fillStyle = this.rgbCss(accentLight);
    ctx.fillText(this.name() || '', x, y+87);
    ctx.textAlign = 'left';
  }

  /**
   * LAYOUT: Classic Left, transparent mode.
   * Full-bleed character (no mask, no rectangle — the alpha channel
   * IS the silhouette), atmospheric background sampled from the
   * character's own colors, a single right-side text column sized to
   * the real number of filled-in fields, gold outer frame.
   */
  private async generateClassicLeftTransparent() {
    const { ctx, W, H, rawImg, bounds, accent, deep } = await this.setupTransparentCanvas();
    const lightTxt: [number,number,number] = [232,226,214];
    const dimTxt = this.mixRgb(lightTxt, deep, 0.45);
    const accentLight = this.mixRgb(accent, [255,255,255], 0.45);

    const HEADER_BOTTOM = this.drawComputedHeader(ctx, W, lightTxt, accentLight);
    const SIG_TOP_MARGIN = 220, FRAME_SAFE_MARGIN = 68, TOP_CLEARANCE = 90;
    const BOTTOM_MARGIN = Math.round(H*0.058);

    const maxH = (H - BOTTOM_MARGIN) - (HEADER_BOTTOM + TOP_CLEARANCE);
    const maxW = W - FRAME_SAFE_MARGIN * 2;
    const { targetW, targetH } = this.fitContain(bounds, maxH, maxW);
    const cx = Math.round((W - targetW)/2);
    const cy = H - targetH - BOTTOM_MARGIN;

    this.drawContactShadow(ctx, cx, cy, targetW, targetH);
    ctx.drawImage(rawImg, bounds.x, bounds.y, bounds.w, bounds.h, cx, cy, targetW, targetH);

    const { fields, colorRows } = this.getFieldsAndColors();
    this.drawTextColumn(ctx, {
      x: W-60, align: 'right', topY: HEADER_BOTTOM+40, bottomY: H-SIG_TOP_MARGIN,
      fields, colors: colorRows, lightTxt, dimTxt, accentLight,
    });
    this.drawSignature(ctx, 60, H-202, 'left', lightTxt, dimTxt, accentLight);

    this.drawGoldFrame(ctx, W, H);
    this.posterReady.set(true);
    this.showToast('Poster generated!');
  }

  /** LAYOUT: Classic Right — mirror of Classic Left; text column moves to the left, character stays centered. */
  private async generateClassicRightTransparent() {
    const { ctx, W, H, rawImg, bounds, accent, deep } = await this.setupTransparentCanvas();
    const lightTxt: [number,number,number] = [232,226,214];
    const dimTxt = this.mixRgb(lightTxt, deep, 0.45);
    const accentLight = this.mixRgb(accent, [255,255,255], 0.45);

    const HEADER_BOTTOM = this.drawComputedHeader(ctx, W, lightTxt, accentLight);
    const SIG_TOP_MARGIN = 220, FRAME_SAFE_MARGIN = 68, TOP_CLEARANCE = 90;
    const BOTTOM_MARGIN = Math.round(H*0.058);

    const maxH = (H - BOTTOM_MARGIN) - (HEADER_BOTTOM + TOP_CLEARANCE);
    const maxW = W - FRAME_SAFE_MARGIN * 2;
    const { targetW, targetH } = this.fitContain(bounds, maxH, maxW);
    const cx = Math.round((W - targetW)/2);
    const cy = H - targetH - BOTTOM_MARGIN;

    this.drawContactShadow(ctx, cx, cy, targetW, targetH);
    ctx.drawImage(rawImg, bounds.x, bounds.y, bounds.w, bounds.h, cx, cy, targetW, targetH);

    const { fields, colorRows } = this.getFieldsAndColors();
    this.drawTextColumn(ctx, {
      x: 60, align: 'left', topY: HEADER_BOTTOM+40, bottomY: H-SIG_TOP_MARGIN,
      fields, colors: colorRows, lightTxt, dimTxt, accentLight,
    });
    this.drawSignature(ctx, 60, H-202, 'left', lightTxt, dimTxt, accentLight);

    this.drawGoldFrame(ctx, W, H);
    this.posterReady.set(true);
    this.showToast('Poster generated!');
  }

  /** LAYOUT: Split — character centered, attachments left column, colors right column. */
  private async generateSplitTransparent() {
    const { ctx, W, H, rawImg, bounds, accent, deep } = await this.setupTransparentCanvas();
    const lightTxt: [number,number,number] = [232,226,214];
    const dimTxt = this.mixRgb(lightTxt, deep, 0.45);
    const accentLight = this.mixRgb(accent, [255,255,255], 0.45);

    const HEADER_BOTTOM = this.drawComputedHeader(ctx, W, lightTxt, accentLight);
    const FRAME_SAFE_MARGIN = 68, TOP_CLEARANCE = 90;
    // Reserves gap + the signature block's real span + a bottom safe
    // margin — not a separate guessed constant that could silently
    // disagree with where the character actually ends up.
    const BOTTOM_MARGIN = 185;

    const maxH = (H - BOTTOM_MARGIN) - (HEADER_BOTTOM + TOP_CLEARANCE);
    const maxW = W - FRAME_SAFE_MARGIN * 2;
    const { targetW, targetH } = this.fitContain(bounds, maxH, maxW);
    const cx = Math.round((W - targetW)/2);
    const cy = H - targetH - BOTTOM_MARGIN;
    const charBottom = cy + targetH;

    this.drawContactShadow(ctx, cx, cy, targetW, targetH);
    ctx.drawImage(rawImg, bounds.x, bounds.y, bounds.w, bounds.h, cx, cy, targetW, targetH);

    // Each side only carries 8 entries instead of 16 shared — spacing
    // naturally comes out more generous, matching the approved mockup.
    const { fields, colorRows } = this.getFieldsAndColors();
    const textTop = HEADER_BOTTOM + 40, textBottom = charBottom - 20;
    this.drawTextColumn(ctx, { x: 60, align: 'left', topY: textTop, bottomY: textBottom, fields, colors: [], lightTxt, dimTxt, accentLight });
    this.drawTextColumn(ctx, { x: W-60, align: 'right', topY: textTop, bottomY: textBottom, fields: [], colors: colorRows, lightTxt, dimTxt, accentLight });

    // Derived from the character's REAL bottom edge (25px gap + the
    // ~40px ascent to the name's baseline), not a fixed H-offset that
    // could end up touching the character depending on how tall it
    // scaled — this is exactly the bug that let this touch at 0px
    // clearance before.
    const sigY = charBottom + 25 + 40;
    this.drawSignature(ctx, W/2, sigY, 'center', lightTxt, dimTxt, accentLight);

    this.drawGoldFrame(ctx, W, H);
    this.posterReady.set(true);
    this.showToast('Poster generated!');
  }

  /** LAYOUT: Showcase — dominant character, signature bottom-left, two-column band across the very bottom. */
  private async generateShowcaseTransparent() {
    const { ctx, W, H, rawImg, bounds, accent, deep } = await this.setupTransparentCanvas();
    const lightTxt: [number,number,number] = [232,226,214];
    const dimTxt = this.mixRgb(lightTxt, deep, 0.45);
    const accentLight = this.mixRgb(accent, [255,255,255], 0.45);

    const HEADER_BOTTOM = this.drawComputedHeader(ctx, W, lightTxt, accentLight);
    // TOP_CLEARANCE matches the value used everywhere else (90, not a
    // smaller "should be fine here" guess) — the character is
    // top-anchored and large here too, so the same "24px reads as
    // touching" lesson from Classic Left applies exactly the same way.
    const FRAME_SAFE_MARGIN = 68, TOP_CLEARANCE = 90;
    // SIG_H sized to the signature block's REAL measured extent (name
    // ascent ~40 + 87 to the loadout baseline + ~6 descent = ~133px)
    // plus real margin on both sides — the previous 148 was 5px too
    // tight against the band divider below it, caught by rendering
    // and checking the actual numbers rather than trusting a guess.
    const SIG_H = 175, BAND_H = Math.round(H*0.27);
    const reservedBottom = SIG_H + BAND_H;

    const maxH = H - reservedBottom - (HEADER_BOTTOM + TOP_CLEARANCE);
    const maxW = W - FRAME_SAFE_MARGIN * 2;
    const { targetW, targetH } = this.fitContain(bounds, maxH, maxW);
    const cx = Math.round((W - targetW)/2);
    const cy = HEADER_BOTTOM + TOP_CLEARANCE;

    this.drawContactShadow(ctx, cx, cy, targetW, targetH);
    ctx.drawImage(rawImg, bounds.x, bounds.y, bounds.w, bounds.h, cx, cy, targetW, targetH);

    const sigY = (H - reservedBottom) + 55;
    this.drawSignature(ctx, 68, sigY, 'left', lightTxt, dimTxt, accentLight);

    const bandTop = H - BAND_H;
    ctx.strokeStyle = this.rgbCss(dimTxt, 0.5); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, bandTop-6); ctx.lineTo(W-60, bandTop-6); ctx.stroke();

    const { fields, colorRows } = this.getFieldsAndColors();
    const bandBottom = H - 30;
    this.drawTextColumn(ctx, {
      x: 60, align: 'left', topY: bandTop+16, bottomY: bandBottom, fields, colors: [], lightTxt, dimTxt, accentLight,
      labelSize: 13, valueSize: 21, pillSize: 19,
    });
    this.drawTextColumn(ctx, {
      x: W/2+30, align: 'left', topY: bandTop+16, bottomY: bandBottom, fields: [], colors: colorRows, lightTxt, dimTxt, accentLight,
      labelSize: 13, valueSize: 21, pillSize: 19,
    });

    this.drawGoldFrame(ctx, W, H);
    this.posterReady.set(true);
    this.showToast('Poster generated!');
  }

  private drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const c1 = this.posterColor1()?.hex ?? '#3a0808';
    const c2 = this.posterColor2()?.hex ?? '#080202';

    const angle = 180 * Math.PI / 180; // fixed - the angle slider was removed; this old function is superseded by drawAtmosphereBg anyway
    const mx = W / 2, my = H / 2;
    const len = Math.max(W, H);
    const x1 = mx - Math.sin(angle) * len / 2;
    const y1 = my - Math.cos(angle) * len / 2;
    const x2 = mx + Math.sin(angle) * len / 2;
    const y2 = my + Math.cos(angle) * len / 2;

    const bg = ctx.createLinearGradient(x1, y1, x2, y2);
    bg.addColorStop(0, this.rgbaStr(c1, 1));
    bg.addColorStop(0.30, this.rgbaStr(c1, 1));
    bg.addColorStop(0.70, this.rgbaStr(c2, 1));
    bg.addColorStop(1, this.rgbaStr(c2, 1));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.45, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  private drawDecorations(ctx: CanvasRenderingContext2D, W: number, H: number, MARGIN: number) {
    const outerInset = 18;
    const innerInset = 25;
    const diamondCenter = (outerInset + innerInset) / 2;

    ctx.strokeStyle = 'rgba(200,149,42,.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(outerInset, outerInset, W - outerInset * 2, H - outerInset * 2);
    ctx.strokeStyle = 'rgba(200,149,42,.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(innerInset, innerInset, W - innerInset * 2, H - innerInset * 2);

    const diamondSize = 5;
    const corners: [number, number][] = [
      [diamondCenter, diamondCenter], [W - diamondCenter, diamondCenter],
      [diamondCenter, H - diamondCenter], [W - diamondCenter, H - diamondCenter],
    ];
    corners.forEach(([x, y]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#c8952a';
      ctx.fillRect(-diamondSize, -diamondSize, diamondSize * 2, diamondSize * 2);
      ctx.restore();
    });
  }

  private drawHeader(ctx: CanvasRenderingContext2D, W: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(240,192,80,.6)';
    ctx.shadowBlur = 25;
    ctx.font = 'bold 58px "Cinzel Decorative", serif';
    ctx.fillStyle = '#f0c050';
    ctx.textAlign = 'center';
    ctx.fillText('WARFRAME', W / 2, 82);
    ctx.restore();

    ctx.font = '14px Cinzel, serif';
    ctx.fillStyle = '#c8952a';
    ctx.textAlign = 'center';
    ctx.fillText('FASHION FRAME', W / 2, 108);

    const dg = ctx.createLinearGradient(100, 0, W - 100, 0);
    dg.addColorStop(0, 'transparent');
    dg.addColorStop(0.5, '#c8952a');
    dg.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.moveTo(100, 120);
    ctx.lineTo(W - 100, 120);
    ctx.strokeStyle = dg;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** Draws the cropped screenshot with soft-rounded, feathered edges. */
  private drawMaskedImage(
    ctx: CanvasRenderingContext2D, img: HTMLImageElement, crop: SourceCrop,
    destX: number, destY: number, destW: number, destH: number,
    preMaskDraw?: (ox: CanvasRenderingContext2D, w: number, h: number) => void,
  ) {
    const offCv = document.createElement('canvas');
    offCv.width = destW; offCv.height = destH;
    const ox = offCv.getContext('2d')!;

    const edgePct = 0.04;
    const edgeW = Math.round(destW * edgePct);
    const edgeH = Math.round(destH * edgePct);
    const cornerR = Math.max(edgeW, edgeH);

    const maskCv = document.createElement('canvas');
    maskCv.width = destW; maskCv.height = destH;
    const mCtx = maskCv.getContext('2d')!;

    mCtx.fillStyle = '#fff';
    mCtx.beginPath();
    mCtx.moveTo(cornerR, 0);
    mCtx.lineTo(destW - cornerR, 0);
    mCtx.quadraticCurveTo(destW, 0, destW, cornerR);
    mCtx.lineTo(destW, destH - cornerR);
    mCtx.quadraticCurveTo(destW, destH, destW - cornerR, destH);
    mCtx.lineTo(cornerR, destH);
    mCtx.quadraticCurveTo(0, destH, 0, destH - cornerR);
    mCtx.lineTo(0, cornerR);
    mCtx.quadraticCurveTo(0, 0, cornerR, 0);
    mCtx.closePath();
    mCtx.fill();

    mCtx.globalCompositeOperation = 'destination-out';
    const fades: { grad: CanvasGradient; rect: [number, number, number, number] }[] = [
      { grad: mCtx.createLinearGradient(0, 0, edgeW, 0), rect: [0, 0, edgeW, destH] },
      { grad: mCtx.createLinearGradient(destW - edgeW, 0, destW, 0), rect: [destW - edgeW, 0, edgeW, destH] },
      { grad: mCtx.createLinearGradient(0, 0, 0, edgeH), rect: [0, 0, destW, edgeH] },
      { grad: mCtx.createLinearGradient(0, destH - edgeH, 0, destH), rect: [0, destH - edgeH, destW, edgeH] },
    ];
    fades.forEach((f, i) => {
      f.grad.addColorStop(0, i < 2 ? (i === 0 ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)') : (i === 2 ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)'));
      f.grad.addColorStop(1, i < 2 ? (i === 0 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)') : (i === 2 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)'));
      mCtx.fillStyle = f.grad;
      mCtx.fillRect(...f.rect);
    });

    ox.drawImage(img, crop.srcX, crop.srcY, crop.srcW, crop.srcH, 0, 0, destW, destH);
    if (preMaskDraw) preMaskDraw(ox, destW, destH);

    ox.globalCompositeOperation = 'destination-in';
    ox.drawImage(maskCv, 0, 0);
    ox.globalCompositeOperation = 'source-over';

    ctx.drawImage(offCv, destX, destY);
  }

  private drawLoadoutSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, forcedRowH?: number) {
    const att = this.attachments();
    const fields = LOADOUT_FIELDS.map(f => ({ label: f.label, val: att[f.key] || '—' }));

    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillStyle = 'rgba(200,149,42,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('LOADOUT', x, y + 14);

    ctx.beginPath();
    ctx.moveTo(x, y + 20); ctx.lineTo(x + w, y + 20);
    ctx.strokeStyle = 'rgba(200,149,42,0.3)'; ctx.lineWidth = 1; ctx.stroke();

    const contentTop = y + 28;
    const contentH = h - 28;
    const rowH = forcedRowH || Math.max(36, Math.floor(contentH / fields.length));

    fields.forEach((f, i) => {
      const fy = contentTop + i * rowH;
      ctx.font = 'bold 12px Cinzel, serif';
      ctx.fillStyle = '#c8952a';
      ctx.textAlign = 'left';
      ctx.fillText(f.label.toUpperCase(), x, fy + 12);

      ctx.font = '13px Raleway, sans-serif';
      ctx.fillStyle = '#d4c9a8';
      let val = f.val;
      while (ctx.measureText(val).width > w - 4 && val.length > 3) val = val.slice(0, -1);
      if (val !== f.val) val += '…';
      ctx.fillText(val, x, fy + 26);

      if (i < fields.length - 1) {
        ctx.beginPath();
        ctx.moveTo(x, fy + rowH - 2); ctx.lineTo(x + w, fy + rowH - 2);
        ctx.strokeStyle = 'rgba(200,149,42,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      }
    });
  }

  private drawColorsSection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, forcedRowH?: number) {
    const swatchR = 8;
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.fillStyle = 'rgba(200,149,42,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('COLOR PALETTE', x, y + 14);

    ctx.beginPath();
    ctx.moveTo(x, y + 20); ctx.lineTo(x + w, y + 20);
    ctx.strokeStyle = 'rgba(200,149,42,0.3)'; ctx.lineWidth = 1; ctx.stroke();

    const contentTop = y + 28;
    const contentH = h - 28;
    const chRowH = forcedRowH || Math.max(36, Math.floor(contentH / CHANNELS.length));
    const state = this.colorState();

    CHANNELS.forEach((ch, i) => {
      const cy = contentTop + i * chRowH;
      const s = state[ch.key];

      ctx.beginPath();
      ctx.arc(x + swatchR + 1, cy + 12, swatchR, 0, Math.PI * 2);
      ctx.fillStyle = s.hex;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();

      const textOffX = swatchR * 2 + 8;
      ctx.font = 'bold 12px Cinzel, serif';
      ctx.fillStyle = '#c8952a';
      ctx.textAlign = 'left';
      ctx.fillText(ch.name.toUpperCase(), x + textOffX, cy + 10);

      ctx.font = '11px Raleway, sans-serif';
      ctx.fillStyle = '#907060';
      ctx.fillText(s.label || '—', x + textOffX, cy + 24);

      if (i < CHANNELS.length - 1) {
        ctx.beginPath();
        ctx.moveTo(x, cy + chRowH - 2); ctx.lineTo(x + w, cy + chRowH - 2);
        ctx.strokeStyle = 'rgba(200,149,42,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      }
    });
  }

  private drawInfoPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const loadoutH = h * 0.52;
    this.drawLoadoutSection(ctx, x, y, w, loadoutH);
    const colorsY = y + loadoutH + 10;
    const colorsH = h - loadoutH - 10;
    this.drawColorsSection(ctx, x, colorsY, w, colorsH);
  }

  private drawInfoPanelSplit(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const gap = 30;
    const halfW = Math.floor((w - gap) / 2);
    const numRows = Math.max(LOADOUT_FIELDS.length, CHANNELS.length);
    const contentH = h - 28;
    const sharedRowH = Math.max(32, Math.floor(contentH / numRows));
    this.drawLoadoutSection(ctx, x, y, halfW, h, sharedRowH);
    this.drawColorsSection(ctx, x + halfW + gap, y, halfW, h, sharedRowH);
  }

  private drawNameBar(ctx: CanvasRenderingContext2D, W: number, MARGIN: number, nameBarTop: number, align: string) {
    const creator = this.creator() || 'Tenno';
    const loadoutName = this.name();
    const frameName = this.frame().toUpperCase();
    const isCompact = align === 'middle' || align === 'bottom-center';

    const dg = ctx.createLinearGradient(MARGIN, 0, W - MARGIN, 0);
    if (isCompact) {
      dg.addColorStop(0, 'rgba(200,149,42,0.3)'); dg.addColorStop(0.05, '#c8952a');
      dg.addColorStop(0.95, '#c8952a'); dg.addColorStop(1, 'rgba(200,149,42,0.3)');
    } else {
      dg.addColorStop(0, '#c8952a'); dg.addColorStop(0.5, 'rgba(200,149,42,0.4)'); dg.addColorStop(1, 'transparent');
    }
    ctx.beginPath();
    ctx.moveTo(MARGIN, nameBarTop - 4); ctx.lineTo(W - MARGIN, nameBarTop - 4);
    ctx.strokeStyle = dg; ctx.lineWidth = isCompact ? 1.5 : 1; ctx.stroke();

    const textAlign = align === 'bottom-right' ? 'right' : (align === 'bottom-center' || align === 'middle') ? 'center' : 'left';
    const textX = align === 'bottom-right' ? W - MARGIN - 10 : (align === 'bottom-center' || align === 'middle') ? W / 2 : MARGIN + 10;

    const nameSize = isCompact ? 40 : 48;
    const nameY = nameBarTop + (isCompact ? 32 : 40);
    const byY = nameBarTop + (isCompact ? 50 : 58);
    const loadoutY = nameBarTop + (isCompact ? 66 : 74);

    ctx.save();
    ctx.shadowColor = 'rgba(240,192,80,.5)'; ctx.shadowBlur = 15;
    ctx.font = `bold ${nameSize}px Cinzel, serif`;
    ctx.fillStyle = '#f0c050';
    ctx.textAlign = textAlign as CanvasTextAlign;
    ctx.fillText(frameName, textX, nameY);
    ctx.restore();

    ctx.font = '14px Raleway, sans-serif';
    ctx.fillStyle = 'rgba(200,170,120,0.85)';
    ctx.textAlign = textAlign as CanvasTextAlign;
    ctx.fillText('By ' + creator, textX + (textAlign === 'left' ? 4 : 0), byY);

    if (loadoutName) {
      ctx.font = 'italic 14px Raleway, sans-serif';
      ctx.fillStyle = 'rgba(220,190,130,0.65)';
      ctx.fillText(loadoutName, textX + (textAlign === 'left' ? 4 : 0), loadoutY);
    }
  }

  /** Name bar burned into the bottom-left of the image itself (Showcase layout). */
  private drawNameBarOverlay(ctx: CanvasRenderingContext2D, destW: number, destH: number) {
    const creator = this.creator() || 'Tenno';
    const loadoutName = this.name();
    const frameName = this.frame().toUpperCase();

    const overlayH = Math.min(destH * 0.35, 160);
    const overlayY = destH - overlayH;
    const grad = ctx.createLinearGradient(0, overlayY, 0, destH);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.3, 'rgba(0,0,0,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, overlayY, destW, overlayH);

    const padLeft = 30, padBottom = 42;
    const bottomEdge = destH - padBottom;
    let currentY = bottomEdge;

    if (loadoutName) {
      ctx.font = 'italic 13px Raleway, sans-serif';
      ctx.fillStyle = 'rgba(220,190,130,0.75)';
      ctx.textAlign = 'left';
      ctx.fillText(loadoutName, padLeft + 2, currentY);
      currentY -= 19;
    }

    ctx.font = '13px Raleway, sans-serif';
    ctx.fillStyle = 'rgba(200,170,120,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('By ' + creator, padLeft + 2, currentY);
    currentY -= 10;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12;
    ctx.font = 'bold 38px Cinzel, serif';
    ctx.fillStyle = '#f0c050';
    ctx.textAlign = 'left';
    ctx.fillText(frameName, padLeft, currentY);
    ctx.restore();
  }

  private drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.strokeStyle = 'rgba(200,149,42,.25)'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.font = '18px Cinzel, serif';
    ctx.fillStyle = 'rgba(200,149,42,.35)';
    ctx.textAlign = 'center';
    ctx.fillText('[ Upload Screenshot ]', x + w / 2, y + h / 2);
  }

  // ── Sizing helpers ───────────────────────────────────────────
  private computePosterImageSize(crop: SourceCrop, maxH: number, minW: number, maxW: number) {
    const cropAspect = crop.srcW / crop.srcH;
    let w = Math.round(maxH * cropAspect);
    let h = maxH;
    if (w > maxW) { w = maxW; h = Math.round(w / cropAspect); }
    if (w < minW) { w = minW; h = Math.round(w / cropAspect); }
    if (h > maxH) h = maxH;
    return { w, h };
  }

  private computeSideSplit(cropAspect: number) {
    const imgFrac = Math.min(0.72, Math.max(0.35, 0.25 + cropAspect * 0.5));
    return { imageFraction: imgFrac, infoFraction: 1.0 - imgFrac };
  }

  private computeCenterSplit(cropAspect: number) {
    const centerFrac = Math.min(0.68, Math.max(0.42, 0.30 + cropAspect * 0.35));
    const sideFrac = (1.0 - centerFrac) / 2;
    return { centerFraction: centerFrac, sideFraction: sideFrac };
  }

  private computePosterHeight(crop: SourceCrop | null, renderCfg: PosterLayout['render'], usableW: number, imgTop: number, MARGIN: number): number {
    const cropAspect = crop ? crop.srcW / crop.srcH : 0.6;

    if (renderCfg.infoPosition === 'below') {
      const maxImgWidthFrac = Math.min(0.80, Math.max(0.55, cropAspect * 0.75));
      const imgDisplayW = Math.round(usableW * maxImgWidthFrac);
      const imgDisplayH = Math.round(imgDisplayW / cropAspect);
      return imgTop + imgDisplayH + 14 + 280 + MARGIN;
    } else if (renderCfg.infoPosition === 'split') {
      const splits = this.computeCenterSplit(cropAspect);
      const centerMaxW = Math.round(usableW * splits.centerFraction);
      const imgDisplayH = Math.round(centerMaxW / cropAspect);
      const clampedH = Math.min(650, Math.max(350, imgDisplayH));
      return imgTop + clampedH + 8 + 80 + MARGIN;
    } else {
      const splits = this.computeSideSplit(cropAspect);
      const imgW = Math.round(usableW * splits.imageFraction) - 10;
      const imgDisplayH = Math.round(imgW / cropAspect);
      const clampedH = Math.min(650, Math.max(350, imgDisplayH));
      return imgTop + clampedH + 8 + 80 + MARGIN;
    }
  }

  // ── Main orchestrator ────────────────────────────────────────
  async generatePoster() {
    // NEW ENGINE: all 4 layouts now handle transparent-mode (a
    // background-removed cutout — whether it arrived that way or had
    // its solid backdrop keyed out at upload). Non-transparent mode
    // (a raw screenshot) still runs the original pipeline below,
    // unchanged, for all 4 — that's the next piece of work, not this
    // one.
    if (this.isTransparentMode() && this.imageDataUrl()) {
      switch (this.selectedLayoutKey()) {
        case 'left-classic':  return this.generateClassicLeftTransparent();
        case 'right-classic': return this.generateClassicRightTransparent();
        case 'center-split':  return this.generateSplitTransparent();
        case 'center-showcase': return this.generateShowcaseTransparent();
      }
    }

    // Wait for fonts so the very first render doesn't fall back to
    // the system default before Cinzel finishes loading.
    await document.fonts.ready;

    const cv = this.canvasRef.nativeElement;
    const ctx = cv.getContext('2d')!;
    const W = 900, MARGIN = 30, headerH = 120, imgTop = headerH + 10;
    const usableW = W - MARGIN * 2;
    const MIN_INFO_W = 160;
    const layout = this.selectedLayout();
    const renderCfg = layout.render;

    const finish = () => { this.posterReady.set(true); this.showToast('Poster generated!'); };

    const dataUrl = this.imageDataUrl();

    if (renderCfg.infoPosition === 'below') {
      // ── SHOWCASE ──
      if (dataUrl) {
        const img = await this.loadImgEl(dataUrl);
        const crop = this.computeSourceCrop(img);
        if (!crop) return finish();
        const cropAspect = crop.srcW / crop.srcH;
        const H = this.computePosterHeight(crop, renderCfg, usableW, imgTop, MARGIN);
        cv.width = W; cv.height = H;

        const infoH = 280, gap = 14;
        const infoY = H - MARGIN - infoH;
        const availImgH = infoY - gap - imgTop;
        const maxImgWidthFrac = Math.min(0.80, Math.max(0.55, cropAspect * 0.75));
        const imgDisplayW = Math.min(Math.round(usableW * maxImgWidthFrac), Math.round(availImgH * cropAspect));
        const imgDisplayH = Math.min(availImgH, Math.round(imgDisplayW / cropAspect));
        const imgX = MARGIN + (usableW - imgDisplayW) / 2;

        this.drawBackground(ctx, W, H);
        this.drawDecorations(ctx, W, H, MARGIN);
        this.drawHeader(ctx, W);
        this.drawMaskedImage(ctx, img, crop, imgX, imgTop, imgDisplayW, imgDisplayH, (ox, w, h) => this.drawNameBarOverlay(ox, w, h));

        const divY = imgTop + imgDisplayH + gap / 2;
        this.drawDivider(ctx, MARGIN, W - MARGIN, divY);
        this.drawInfoPanelSplit(ctx, MARGIN + 10, infoY, usableW - 20, infoH);
        this.drawDecorations(ctx, W, H, MARGIN);
      } else {
        const H = 1020;
        cv.width = W; cv.height = H;
        const infoH = 280, gap = 14;
        const infoY = H - MARGIN - infoH;
        const availImgH = infoY - gap - imgTop;
        const imgW = Math.round(usableW * 0.65);
        const imgX = MARGIN + (usableW - imgW) / 2;

        this.drawBackground(ctx, W, H);
        this.drawDecorations(ctx, W, H, MARGIN);
        this.drawHeader(ctx, W);
        this.drawPlaceholder(ctx, imgX, imgTop, imgW, availImgH);
        this.drawDivider(ctx, MARGIN, W - MARGIN, imgTop + availImgH + gap / 2);
        this.drawInfoPanelSplit(ctx, MARGIN + 10, infoY, usableW - 20, infoH);
      }

    } else if (renderCfg.infoPosition === 'split') {
      // ── CENTER SPLIT ──
      if (dataUrl) {
        const img = await this.loadImgEl(dataUrl);
        const crop = this.computeSourceCrop(img);
        if (!crop) return finish();
        const cropAspect = crop.srcW / crop.srcH;
        const splits = this.computeCenterSplit(cropAspect);
        const H = this.computePosterHeight(crop, renderCfg, usableW, imgTop, MARGIN);
        cv.width = W; cv.height = H;

        const nameY = H - MARGIN - 80;
        const mainH = nameY - 8 - imgTop;
        const gap = 15;
        const centerW = Math.round(usableW * splits.centerFraction);
        const sideW = Math.round((usableW - centerW - gap * 2) / 2);
        const size = this.computePosterImageSize(crop, mainH, Math.round(centerW * 0.5), centerW);
        const imgX = MARGIN + (usableW - size.w) / 2;

        this.drawBackground(ctx, W, H);
        this.drawDecorations(ctx, W, H, MARGIN);
        this.drawHeader(ctx, W);
        this.drawMaskedImage(ctx, img, crop, imgX, imgTop, size.w, size.h);

        const leftX = MARGIN + 5, leftW = imgX - leftX - gap;
        if (leftW > 50) this.drawLoadoutSection(ctx, leftX, imgTop + 20, leftW, size.h - 40);
        const rightX = imgX + size.w + gap, rightW = (W - MARGIN) - rightX - 5;
        if (rightW > 50) this.drawColorsSection(ctx, rightX, imgTop + 20, rightW, size.h - 40);

        this.drawNameBar(ctx, W, MARGIN, nameY, renderCfg.namePosition);
        this.drawDecorations(ctx, W, H, MARGIN);
      } else {
        const H = 1120;
        cv.width = W; cv.height = H;
        const mainH = (H - MARGIN) - 80 - 8 - imgTop;
        const gap = 15;
        const centerW = Math.round(usableW * 0.52);
        const imgW = Math.round(centerW * 0.8);
        const imgX = MARGIN + (usableW - imgW) / 2;

        this.drawBackground(ctx, W, H);
        this.drawDecorations(ctx, W, H, MARGIN);
        this.drawHeader(ctx, W);
        this.drawPlaceholder(ctx, imgX, imgTop, imgW, mainH);
        const leftX = MARGIN + 5, leftW = imgX - leftX - gap;
        if (leftW > 50) this.drawLoadoutSection(ctx, leftX, imgTop + 20, leftW, mainH - 40);
        const rightX = imgX + imgW + gap, rightW = (W - MARGIN) - rightX - 5;
        if (rightW > 50) this.drawColorsSection(ctx, rightX, imgTop + 20, rightW, mainH - 40);
        this.drawNameBar(ctx, W, MARGIN, imgTop + mainH + 4, renderCfg.namePosition);
      }

    } else {
      // ── LEFT / RIGHT ──
      const isRight = renderCfg.imageAlign === 'right';
      const gap = 20;
      if (dataUrl) {
        const img = await this.loadImgEl(dataUrl);
        const crop = this.computeSourceCrop(img);
        if (!crop) return finish();
        const cropAspect = crop.srcW / crop.srcH;
        const splits = this.computeSideSplit(cropAspect);
        const H = this.computePosterHeight(crop, renderCfg, usableW, imgTop, MARGIN);
        cv.width = W; cv.height = H;

        const nameY = H - MARGIN - 80;
        const mainH = nameY - 8 - imgTop;
        let imgW = Math.round(usableW * splits.imageFraction) - gap / 2;
        let infoW = usableW - imgW - gap;
        if (infoW < MIN_INFO_W) { infoW = MIN_INFO_W; imgW = usableW - infoW - gap; }
        const size = this.computePosterImageSize(crop, mainH, Math.round(imgW * 0.6), imgW);
        const imgX = isRight ? (W - MARGIN - size.w) : MARGIN;
        const infoX = isRight ? MARGIN : (MARGIN + size.w + gap);
        infoW = usableW - size.w - gap;

        this.drawBackground(ctx, W, H);
        this.drawDecorations(ctx, W, H, MARGIN);
        this.drawHeader(ctx, W);
        this.drawMaskedImage(ctx, img, crop, imgX, imgTop, size.w, size.h);
        this.drawInfoPanel(ctx, infoX, imgTop + 10, infoW, mainH - 20);
        this.drawNameBar(ctx, W, MARGIN, nameY, renderCfg.namePosition);
        this.drawDecorations(ctx, W, H, MARGIN);
      } else {
        const H = 1120;
        cv.width = W; cv.height = H;
        const mainH = (H - MARGIN) - 80 - 8 - imgTop;
        let imgW = Math.round(usableW * 0.55);
        let infoW = usableW - imgW - gap;
        if (infoW < MIN_INFO_W) { infoW = MIN_INFO_W; imgW = usableW - infoW - gap; }
        const imgX = isRight ? (W - MARGIN - imgW) : MARGIN;
        const infoX = isRight ? MARGIN : (MARGIN + imgW + gap);

        this.drawBackground(ctx, W, H);
        this.drawDecorations(ctx, W, H, MARGIN);
        this.drawHeader(ctx, W);
        this.drawPlaceholder(ctx, imgX, imgTop, imgW, mainH);
        this.drawInfoPanel(ctx, infoX, imgTop + 10, infoW, mainH - 20);
        this.drawNameBar(ctx, W, MARGIN, imgTop + mainH + 4, renderCfg.namePosition);
      }
    }

    finish();
  }

  private drawDivider(ctx: CanvasRenderingContext2D, xStart: number, xEnd: number, y: number) {
    const dg = ctx.createLinearGradient(xStart, 0, xEnd, 0);
    dg.addColorStop(0, 'rgba(200,149,42,0.3)'); dg.addColorStop(0.05, '#c8952a');
    dg.addColorStop(0.95, '#c8952a'); dg.addColorStop(1, 'rgba(200,149,42,0.3)');
    ctx.beginPath(); ctx.moveTo(xStart, y); ctx.lineTo(xEnd, y);
    ctx.strokeStyle = dg; ctx.lineWidth = 1.5; ctx.stroke();
  }

  private loadImgEl(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════

  download() {
    const canvas = this.canvasRef.nativeElement;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (this.frame() || 'warframe').toLowerCase().replace(/\s+/g, '-') + '-fashion-frame.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.showToast('Downloading...');
    }, 'image/png');
  }

  copyPosterToClipboard() {
    const canvas = this.canvasRef.nativeElement;
    try {
      canvas.toBlob((blob) => {
        if (!blob) { this.showToast('Copy not available — use Download'); return; }
        if (navigator.clipboard && (window as any).ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            .then(() => this.showToast('Poster copied to clipboard!'))
            .catch(() => this.showToast('Copy blocked — use Download instead'));
        } else {
          this.showToast('Clipboard not supported — use Download');
        }
      }, 'image/png');
    } catch {
      this.showToast('Copy not available — use Download instead');
    }
  }

  copyLoadoutText() {
    const att = this.attachments();
    const state = this.colorState();
    const lines = [
      '{',
      `  ${this.frame()}${this.name() ? ' — ' + this.name() : ''}`,
      `  By: ${this.creator() || 'Tenno'}`,
      '',
      '  Loadout',
      ...LOADOUT_FIELDS.map(f => `  ${f.label}: ${att[f.key] || '—'}`),
      '  ─────────────────',
      '  Color Palette',
      ...CHANNELS.map(ch => `  ${ch.name}: ${state[ch.key].label || '—'}`),
      '}',
    ];
    const text = lines.join('\n');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => this.showToast('Loadout copied!')).catch(() => this.fallbackCopy(text));
    } else {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showToast('Loadout copied!');
    } catch {
      this.showToast('Copy failed — try selecting text manually');
    }
    document.body.removeChild(ta);
  }
}
