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
  gradientAngle = signal(180);

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
        this.imageDataUrl.set(dataUrl);
        this.resetSliders();
        this.showToast('Screenshot loaded — adjust zoom & pan below');
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

  onGradientAngleChange(e: Event) {
    this.gradientAngle.set(parseInt((e.target as HTMLInputElement).value, 10));
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

  private drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const c1 = this.posterColor1()?.hex ?? '#3a0808';
    const c2 = this.posterColor2()?.hex ?? '#080202';

    const angle = (this.gradientAngle() ?? 180) * Math.PI / 180;
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
