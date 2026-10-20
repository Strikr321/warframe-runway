import { PosterInput, SourceCrop } from './poster-input';
import { PosterLayout } from '../../../data/layouts.data';
import { CHANNELS } from '../../../data/channels.data';
import { LOADOUT_FIELDS } from '../../../data/loadout-fields.data';
import { rgbaStr } from './color';
import { drawDivider, loadImgEl } from './draw-helpers';

/**
 * Legacy renderer for opaque screenshots: a cropped, edge-feathered
 * image beside text panels on a two-color gradient. Superseded by
 * CutoutPosterRenderer for cutouts; to be folded into it (roadmap 4d).
 */
export class PhotoPosterRenderer {
  constructor(private readonly canvas: HTMLCanvasElement, private readonly input: PosterInput) {}

  async render(): Promise<void> {
    // Fonts must be loaded or the first render falls back to the system font.
    await document.fonts.ready;

    const cv = this.canvas;
    const ctx = cv.getContext('2d')!;
    const W = 900, MARGIN = 30, headerH = 120, imgTop = headerH + 10;
    const usableW = W - MARGIN * 2;
    const MIN_INFO_W = 160;
    const layout = this.input.layout;
    const renderCfg = layout.render;

    const dataUrl = this.input.imageDataUrl;

    if (renderCfg.infoPosition === 'below') {
      // ── SHOWCASE ──
      if (dataUrl) {
        const img = await loadImgEl(dataUrl);
        const crop = this.input.crop;
        if (!crop) return;
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
        drawDivider(ctx, MARGIN, W - MARGIN, divY);
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
        drawDivider(ctx, MARGIN, W - MARGIN, imgTop + availImgH + gap / 2);
        this.drawInfoPanelSplit(ctx, MARGIN + 10, infoY, usableW - 20, infoH);
      }

    } else if (renderCfg.infoPosition === 'split') {
      // ── CENTER SPLIT ──
      if (dataUrl) {
        const img = await loadImgEl(dataUrl);
        const crop = this.input.crop;
        if (!crop) return;
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
        const img = await loadImgEl(dataUrl);
        const crop = this.input.crop;
        if (!crop) return;
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
  }

  private drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const c1 = this.input.posterColor1?.hex ?? '#3a0808';
    const c2 = this.input.posterColor2?.hex ?? '#080202';

    const angle = 180 * Math.PI / 180; // vertical
    const mx = W / 2, my = H / 2;
    const len = Math.max(W, H);
    const x1 = mx - Math.sin(angle) * len / 2;
    const y1 = my - Math.cos(angle) * len / 2;
    const x2 = mx + Math.sin(angle) * len / 2;
    const y2 = my + Math.cos(angle) * len / 2;

    const bg = ctx.createLinearGradient(x1, y1, x2, y2);
    bg.addColorStop(0, rgbaStr(c1, 1));
    bg.addColorStop(0.30, rgbaStr(c1, 1));
    bg.addColorStop(0.70, rgbaStr(c2, 1));
    bg.addColorStop(1, rgbaStr(c2, 1));
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
    const att = this.input.attachments;
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
    const state = this.input.colorState;

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
    const creator = this.input.creator || 'Tenno';
    const loadoutName = this.input.name;
    const frameName = this.input.frame.toUpperCase();
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
    const creator = this.input.creator || 'Tenno';
    const loadoutName = this.input.name;
    const frameName = this.input.frame.toUpperCase();

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
}
