import { PosterInput } from './poster-input';
import { CHANNELS } from '../../../data/channels.data';
import { LOADOUT_FIELDS } from '../../../data/loadout-fields.data';
import { hexToRgb, mixRgb, rgbCss, dominantHueColor } from './color';
import { drawGoldFrame, drawTrackedText, fitContain, drawContactShadow, loadImgEl } from './draw-helpers';
import { drawAtmosphereBg } from './background';
import { trimTransparentBounds } from './cutout-bounds';

/**
 * Renders a background-removed cutout full-bleed over a generated
 * atmospheric background, in any of the 4 layouts.
 */
export class CutoutPosterRenderer {
  constructor(private readonly canvas: HTMLCanvasElement, private readonly input: PosterInput) {}

  render(): Promise<void> {
    switch (this.input.layoutKey) {
      case 'right-classic':   return this.generateClassicRightTransparent();
      case 'center-split':    return this.generateSplitTransparent();
      case 'center-showcase': return this.generateShowcaseTransparent();
      default:                return this.generateClassicLeftTransparent();
    }
  }

  /** Shared setup for every layout: size the canvas, trim the cutout, pick colors, paint the background. */
  private async setupTransparentCanvas(): Promise<{
    ctx: CanvasRenderingContext2D; W: number; H: number; rawImg: HTMLImageElement;
    bounds: { x: number; y: number; w: number; h: number };
    accent: [number, number, number]; deep: [number, number, number];
  }> {
    await document.fonts.ready;
    const cv = this.canvas;
    const ctx = cv.getContext('2d')!;
    const W = 1400, H = 1750;
    cv.width = W; cv.height = H;

    const rawImg = await loadImgEl(this.input.imageDataUrl!);
    const scanCv = document.createElement('canvas');
    scanCv.width = rawImg.naturalWidth; scanCv.height = rawImg.naturalHeight;
    const scanCtx = scanCv.getContext('2d', { willReadFrequently: true })!;
    scanCtx.drawImage(rawImg, 0, 0);
    const fullData = scanCtx.getImageData(0, 0, scanCv.width, scanCv.height);

    const bounds = trimTransparentBounds(fullData);
    const autoAccent = dominantHueColor(fullData);

    // Two slots, edge and glow:
    //   Auto:        edge = dark neutral,  glow = auto-detected
    //   One color:   edge = dark neutral,  glow = color1
    //   Two colors:  edge = color1,        glow = color2
    // bgSwapped flips the slots in every mode.
    const DARK_NEUTRAL: [number,number,number] = [12, 6, 8];
    const c1 = this.input.posterColor1;
    const c2 = this.input.posterColor2;

    let edgeSlot: [number,number,number], glowSlot: [number,number,number];
    if (c1 && c2) {
      edgeSlot = hexToRgb(c1.hex); glowSlot = hexToRgb(c2.hex);
    } else if (c1) {
      edgeSlot = DARK_NEUTRAL; glowSlot = hexToRgb(c1.hex);
    } else {
      edgeSlot = DARK_NEUTRAL; glowSlot = autoAccent;
    }
    if (this.input.bgSwapped) { const tmp = edgeSlot; edgeSlot = glowSlot; glowSlot = tmp; }
    const accent = glowSlot; // the "accent" used elsewhere (text tinting etc.) follows whatever's glowing

    const deep = drawAtmosphereBg(ctx, W, H, edgeSlot, glowSlot);
    return { ctx, W, H, rawImg, bounds, accent, deep };
  }

  /** Title, subtitle and divider positioned from measured text metrics. Returns the header's bottom y. */
  private drawComputedHeader(ctx: CanvasRenderingContext2D, W: number, lightTxt: [number,number,number], accentLight: [number,number,number]): number {
    const FRAME_INNER = 32, TITLE_TOP_MARGIN = 20;
    ctx.textAlign = 'left';
    ctx.font = '600 58px Cinzel, serif';
    const titleAscent = ctx.measureText('WARFRAME').actualBoundingBoxAscent || 42;
    const titleBaseline = FRAME_INNER + TITLE_TOP_MARGIN + titleAscent;
    const subBaseline = titleBaseline + 66;
    const dividerY = subBaseline + 20;

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgbCss(lightTxt);
    drawTrackedText(ctx, 'WARFRAME', W/2, titleBaseline, 6);
    ctx.font = '16px Cinzel, serif';
    ctx.fillStyle = rgbCss(accentLight);
    drawTrackedText(ctx, 'FASHION CARD', W/2, subBaseline, 10);
    ctx.strokeStyle = rgbCss(accentLight, 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W*0.34, dividerY); ctx.lineTo(W*0.66, dividerY); ctx.stroke();
    return dividerY;
  }

  private getFieldsAndColors() {
    const att = this.input.attachments;
    const fields = LOADOUT_FIELDS.map(f => ({ label: f.label.toUpperCase(), value: att[f.key]?.trim() || '—' }));
    const state = this.input.colorState;
    const colorRows = CHANNELS.map(ch => ({ label: ch.name.toUpperCase(), value: state[ch.key].label || '—', hex: state[ch.key].hex }));
    return { fields, colorRows };
  }

  /** One column of attachment and/or color rows, spaced to exactly fill [topY, bottomY]. */
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
      ctx.font = `${labelSize}px Cinzel, serif`; ctx.fillStyle = rgbCss(opts.accentLight);
      ctx.fillText(f.label, x, y);
      ctx.font = `${valueSize}px "Cormorant Garamond", serif`; ctx.fillStyle = rgbCss(opts.lightTxt);
      ctx.fillText(f.value, x, y+29);
      y += perEntry;
    }
    if (hasBoth) {
      y += dividerGap*0.3;
      ctx.strokeStyle = rgbCss(opts.dimTxt, 0.5); ctx.lineWidth = 1;
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
        ctx.fillStyle = rgbCss(opts.lightTxt); ctx.textAlign = 'right';
        ctx.fillText(text, x, y+19);
      } else {
        ctx.beginPath(); ctx.roundRect(x, y+4, 32, 15, 7); ctx.fill();
        ctx.fillStyle = rgbCss(opts.lightTxt); ctx.textAlign = 'left';
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
    ctx.font = '600 54px Cinzel, serif'; ctx.fillStyle = rgbCss(lightTxt);
    ctx.fillText((this.input.frame || 'WARFRAME').toUpperCase(), x, y);
    ctx.font = '26px "Cormorant Garamond", serif'; ctx.fillStyle = rgbCss(dimTxt);
    ctx.fillText(`By ${this.input.creator || 'Tenno'}`, x, y+60);
    ctx.font = 'italic 23px "Cormorant Garamond", serif'; ctx.fillStyle = rgbCss(accentLight);
    ctx.fillText(this.input.name || '', x, y+87);
    ctx.textAlign = 'left';
  }

  /** Classic Left: character centered, one text column on the right. */
  private async generateClassicLeftTransparent() {
    const { ctx, W, H, rawImg, bounds, accent, deep } = await this.setupTransparentCanvas();
    const lightTxt: [number,number,number] = [232,226,214];
    const dimTxt = mixRgb(lightTxt, deep, 0.45);
    const accentLight = mixRgb(accent, [255,255,255], 0.45);

    const HEADER_BOTTOM = this.drawComputedHeader(ctx, W, lightTxt, accentLight);
    const SIG_TOP_MARGIN = 220, FRAME_SAFE_MARGIN = 68, TOP_CLEARANCE = 90;
    const BOTTOM_MARGIN = Math.round(H*0.058);

    const maxH = (H - BOTTOM_MARGIN) - (HEADER_BOTTOM + TOP_CLEARANCE);
    const maxW = W - FRAME_SAFE_MARGIN * 2;
    const { targetW, targetH } = fitContain(bounds, maxH, maxW);
    const cx = Math.round((W - targetW)/2);
    const cy = H - targetH - BOTTOM_MARGIN;

    drawContactShadow(ctx, cx, cy, targetW, targetH);
    ctx.drawImage(rawImg, bounds.x, bounds.y, bounds.w, bounds.h, cx, cy, targetW, targetH);

    const { fields, colorRows } = this.getFieldsAndColors();
    this.drawTextColumn(ctx, {
      x: W-60, align: 'right', topY: HEADER_BOTTOM+40, bottomY: H-SIG_TOP_MARGIN,
      fields, colors: colorRows, lightTxt, dimTxt, accentLight,
    });
    this.drawSignature(ctx, 60, H-202, 'left', lightTxt, dimTxt, accentLight);

    drawGoldFrame(ctx, W, H);
  }

  /** Classic Right: mirror of Classic Left, text column on the left. */
  private async generateClassicRightTransparent() {
    const { ctx, W, H, rawImg, bounds, accent, deep } = await this.setupTransparentCanvas();
    const lightTxt: [number,number,number] = [232,226,214];
    const dimTxt = mixRgb(lightTxt, deep, 0.45);
    const accentLight = mixRgb(accent, [255,255,255], 0.45);

    const HEADER_BOTTOM = this.drawComputedHeader(ctx, W, lightTxt, accentLight);
    const SIG_TOP_MARGIN = 220, FRAME_SAFE_MARGIN = 68, TOP_CLEARANCE = 90;
    const BOTTOM_MARGIN = Math.round(H*0.058);

    const maxH = (H - BOTTOM_MARGIN) - (HEADER_BOTTOM + TOP_CLEARANCE);
    const maxW = W - FRAME_SAFE_MARGIN * 2;
    const { targetW, targetH } = fitContain(bounds, maxH, maxW);
    const cx = Math.round((W - targetW)/2);
    const cy = H - targetH - BOTTOM_MARGIN;

    drawContactShadow(ctx, cx, cy, targetW, targetH);
    ctx.drawImage(rawImg, bounds.x, bounds.y, bounds.w, bounds.h, cx, cy, targetW, targetH);

    const { fields, colorRows } = this.getFieldsAndColors();
    this.drawTextColumn(ctx, {
      x: 60, align: 'left', topY: HEADER_BOTTOM+40, bottomY: H-SIG_TOP_MARGIN,
      fields, colors: colorRows, lightTxt, dimTxt, accentLight,
    });
    this.drawSignature(ctx, 60, H-202, 'left', lightTxt, dimTxt, accentLight);

    drawGoldFrame(ctx, W, H);
  }

  /** Split: attachments on the left, colors on the right, signature below the character. */
  private async generateSplitTransparent() {
    const { ctx, W, H, rawImg, bounds, accent, deep } = await this.setupTransparentCanvas();
    const lightTxt: [number,number,number] = [232,226,214];
    const dimTxt = mixRgb(lightTxt, deep, 0.45);
    const accentLight = mixRgb(accent, [255,255,255], 0.45);

    const HEADER_BOTTOM = this.drawComputedHeader(ctx, W, lightTxt, accentLight);
    const FRAME_SAFE_MARGIN = 68, TOP_CLEARANCE = 90;
    // Room for the signature block below the character plus a safe margin.
    const BOTTOM_MARGIN = 185;

    const maxH = (H - BOTTOM_MARGIN) - (HEADER_BOTTOM + TOP_CLEARANCE);
    const maxW = W - FRAME_SAFE_MARGIN * 2;
    const { targetW, targetH } = fitContain(bounds, maxH, maxW);
    const cx = Math.round((W - targetW)/2);
    const cy = H - targetH - BOTTOM_MARGIN;
    const charBottom = cy + targetH;

    drawContactShadow(ctx, cx, cy, targetW, targetH);
    ctx.drawImage(rawImg, bounds.x, bounds.y, bounds.w, bounds.h, cx, cy, targetW, targetH);

    const { fields, colorRows } = this.getFieldsAndColors();
    const textTop = HEADER_BOTTOM + 40, textBottom = charBottom - 20;
    this.drawTextColumn(ctx, { x: 60, align: 'left', topY: textTop, bottomY: textBottom, fields, colors: [], lightTxt, dimTxt, accentLight });
    this.drawTextColumn(ctx, { x: W-60, align: 'right', topY: textTop, bottomY: textBottom, fields: [], colors: colorRows, lightTxt, dimTxt, accentLight });

    // From the character's actual bottom edge: 25px gap + ~40px ascent to the baseline.
    const sigY = charBottom + 25 + 40;
    this.drawSignature(ctx, W/2, sigY, 'center', lightTxt, dimTxt, accentLight);

    drawGoldFrame(ctx, W, H);
  }

  /** Showcase: large character, signature bottom-left, two-column band along the bottom. */
  private async generateShowcaseTransparent() {
    const { ctx, W, H, rawImg, bounds, accent, deep } = await this.setupTransparentCanvas();
    const lightTxt: [number,number,number] = [232,226,214];
    const dimTxt = mixRgb(lightTxt, deep, 0.45);
    const accentLight = mixRgb(accent, [255,255,255], 0.45);

    const HEADER_BOTTOM = this.drawComputedHeader(ctx, W, lightTxt, accentLight);
    const FRAME_SAFE_MARGIN = 68, TOP_CLEARANCE = 90;
    // SIG_H: signature block's measured extent (~133px) plus margin on both sides.
    const SIG_H = 175, BAND_H = Math.round(H*0.27);
    const reservedBottom = SIG_H + BAND_H;

    const maxH = H - reservedBottom - (HEADER_BOTTOM + TOP_CLEARANCE);
    const maxW = W - FRAME_SAFE_MARGIN * 2;
    const { targetW, targetH } = fitContain(bounds, maxH, maxW);
    const cx = Math.round((W - targetW)/2);
    const cy = HEADER_BOTTOM + TOP_CLEARANCE;

    drawContactShadow(ctx, cx, cy, targetW, targetH);
    ctx.drawImage(rawImg, bounds.x, bounds.y, bounds.w, bounds.h, cx, cy, targetW, targetH);

    const sigY = (H - reservedBottom) + 55;
    this.drawSignature(ctx, 68, sigY, 'left', lightTxt, dimTxt, accentLight);

    const bandTop = H - BAND_H;
    ctx.strokeStyle = rgbCss(dimTxt, 0.5); ctx.lineWidth = 1;
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

    drawGoldFrame(ctx, W, H);
  }
}
