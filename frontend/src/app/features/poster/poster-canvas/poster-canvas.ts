import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  input,
  signal,
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
 * Poster generator UI: image upload and background removal, crop controls,
 * layout and color pickers, and export. Rendering lives in ../engine; this
 * component snapshots its state into a PosterInput and hands it off.
 *
 * Upload, crop, and poster colors are deliberately not part of the saved
 * loadout; they are one-off rendering state.
 */
@Component({
  selector: 'app-poster-canvas',
  imports: [PaletteGrid],
  templateUrl: './poster-canvas.html',
  styleUrl: './poster-canvas.css',
})
export class PosterCanvas {
  // ── Loadout content from Builder ───────────────────────────
  frame = input.required<string>();
  name = input.required<string>();
  creator = input.required<string>();
  attachments = input.required<Attachments>();
  colorState = input.required<Record<ChannelKey, ColorChannelState>>();

  // ── DOM handles (preview positioning needs real pixel sizes) ──
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

  // ── Render mode ───────────────────────────────────────────────
  // detectedTransparent: null = no image, true = cutout (full-bleed engine),
  // false = opaque screenshot (photo engine). modeOverride wins when set.
  detectedTransparent = signal<boolean | null>(null);
  modeOverride = signal<boolean | null>(null);
  isTransparentMode = computed(() => this.modeOverride() ?? this.detectedTransparent());

  toggleModeOverride() {
    this.modeOverride.set(!this.isTransparentMode());
  }

  // ── Background removal ────────────────────────────────────────
  // A solid backdrop is keyed out once at upload; both versions are kept
  // so the user can flip back to the original.
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

  // Set by updatePreview() from the upload zone's live pixel size.
  previewStyle = signal<{ width: string; height: string; left: string; top: string }>({
    width: '0',
    height: '0',
    left: '0',
    top: '0',
  });
  cropOverlay = signal<{
    leftDark: number;
    rightDarkLeft: number;
    rightDarkWidth: number;
    lineLeft: number;
    lineRight: number;
    zoneH: number;
  } | null>(null);

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
    if ((e.target as HTMLElement).closest('.img-controls, .mode-badge')) return;
    this.fileInputRef.nativeElement.click();
  }

  /** Enter/Space on the zone itself (not on the sliders or buttons inside it) opens the file picker. */
  onZoneKey(e: Event) {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    this.fileInputRef.nativeElement.click();
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(true);
  }
  onDragLeave() {
    this.dragOver.set(false);
  }
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

  // Paste works anywhere on the page while the Builder is open.
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

        // Reset keying state so "use original" can't restore the previous upload.
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
          // Opaque: try keying out a solid backdrop.
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
        // Wait a tick for the preview <img> to render.
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

  /** Positions the preview <img> and crop overlay; needs live DOM measurements. */
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
      width: `${drawW}px`,
      height: `${drawH}px`,
      left: `${cx}px`,
      top: `${cy}px`,
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

  /** The preview's visible crop, mapped back to source-image pixels (same math as updatePreview). */
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
  // POSTER BACKGROUND COLORS
  // ═══════════════════════════════════════════════════════════

  openColorPicker(target: 1 | 2) {
    this.colorPickerTarget.set(target);
    this.pickerPaletteName.set('Tenno');
  }

  closeColorPicker() {
    this.colorPickerTarget.set(null);
  }

  onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) this.closeColorPicker();
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

  /** Swaps which color sits at the edges and which glows. */
  bgSwapped = signal(false);
  toggleBgSwap() {
    this.bgSwapped.update((v) => !v);
  }

  /** Back to the auto-detected glow color. */
  resetBgToAuto() {
    this.posterColor1.set(null);
    this.posterColor2.set(null);
    this.bgSwapped.set(false);
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

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

  /** Everything the renderers need, captured once so the engine never reads component state. */
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
      crop: imageDataUrl
        ? this.computeSourceCrop(this.imageNaturalWidth(), this.imageNaturalHeight())
        : null,
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
      a.download =
        (this.frame() || 'warframe').toLowerCase().replace(/\s+/g, '-') + '-fashion-frame.png';
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
        if (!blob) {
          this.showToast('Copy not available — use Download');
          return;
        }
        if (navigator.clipboard && 'ClipboardItem' in window) {
          navigator.clipboard
            .write([new ClipboardItem({ 'image/png': blob })])
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
      ...LOADOUT_FIELDS.map((f) => `  ${f.label}: ${att[f.key] || '—'}`),
      '  ─────────────────',
      '  Color Palette',
      ...CHANNELS.map((ch) => `  ${ch.name}: ${state[ch.key].label || '—'}`),
      '}',
    ];
    const text = lines.join('\n');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => this.showToast('Loadout copied!'))
        .catch(() => this.fallbackCopy(text));
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
