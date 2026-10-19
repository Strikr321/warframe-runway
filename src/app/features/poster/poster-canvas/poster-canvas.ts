import {
  Component, ElementRef, HostListener, ViewChild, computed, inject, input, signal,
} from '@angular/core';
import { Attachments, ChannelKey, ColorChannelState } from '../../../core/models/loadout.model';
import { CHANNELS } from '../../../data/channels.data';
import { LOADOUT_FIELDS } from '../../../data/loadout-fields.data';
import { LAYOUTS, LAYOUT_KEYS, PosterLayout } from '../../../data/layouts.data';
import { PALETTES, PALETTE_NAMES } from '../../../data/palettes.data';
import { PaletteGrid } from '../../../shared/palette-grid/palette-grid';
import { ToastService } from '../../../shared/toast/toast.service';
import { PosterColor, PosterInput, SourceCrop } from '../engine/poster-input';
import { CutoutPosterRenderer } from '../engine/cutout-renderer';
import { PhotoPosterRenderer } from '../engine/photo-renderer';
import { detectTransparency, tryRemoveMonochromeBackground } from '../engine/chroma-key';

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

  private toast = inject(ToastService);
  private showToast(msg: string) {
    this.toast.show(msg);
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

        const transparent = detectTransparency(img);
        if (transparent) {
          this.imageDataUrl.set(dataUrl);
          this.detectedTransparent.set(true);
          this.showToast('Cutout detected — full-bleed render');
        } else {
          // Opaque — but is it a solid-color backdrop we can key out?
          const keyed = tryRemoveMonochromeBackground(img);
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
  private computeSourceCrop(imgW: number, imgH: number): SourceCrop | null {
    const zone = this.uploadZoneRef.nativeElement;
    const controls = this.imgControlsRef?.nativeElement;
    const controlsH = controls && this.hasImage() ? controls.offsetHeight : 0;
    const zoneW = zone.clientWidth;
    const zoneH = zone.clientHeight - controlsH;
    if (zoneH <= 0) return null;

    const baseScale = zoneH / imgH;
    const scale = baseScale * (this.imgZoom() / 100);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
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

  // ── Sizing helpers ───────────────────────────────────────────

  async generatePoster() {
    const canvas = this.canvasRef.nativeElement;
    const input = this.snapshotInput();
    if (this.isTransparentMode() && input.imageDataUrl) {
      await new CutoutPosterRenderer(canvas, input).render();
    } else {
      await new PhotoPosterRenderer(canvas, input).render();
    }
    this.posterReady.set(true);
    this.showToast('Poster generated!');
  }

  /** Freezes everything the renderers need, so the engine never touches component state. */
  private snapshotInput(): PosterInput {
    const imageDataUrl = this.imageDataUrl();
    return {
      frame: this.frame(),
      name: this.name(),
      creator: this.creator(),
      attachments: this.attachments(),
      colorState: this.colorState(),
      layoutKey: this.selectedLayoutKey(),
      layout: this.selectedLayout(),
      imageDataUrl,
      crop: imageDataUrl ? this.computeSourceCrop(this.imageNaturalWidth(), this.imageNaturalHeight()) : null,
      posterColor1: this.posterColor1(),
      posterColor2: this.posterColor2(),
      bgSwapped: this.bgSwapped(),
    };
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
