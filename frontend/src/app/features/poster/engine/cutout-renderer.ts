import { PosterInput } from './poster-input';
import { hexToRgb, mixRgb, rgbCss, dominantHueColor } from './color';
import {
  drawGoldFrame,
  drawTrackedText,
  drawContactShadow,
  fitText,
  loadImgEl,
} from './draw-helpers';
import { BackgroundPalette, drawPosterBackground, resolveBackground } from './background';
import { trimTransparentBounds } from './cutout-bounds';
import { ColorRow, FieldRow, posterRows } from './poster-content';
import {
  FRAME_SAFE,
  MAX_COLUMN_FRACTION,
  POSTER_EDGE,
  Rect,
  characterLane,
  placeCharacter,
  rowPitch,
} from './layout-geometry';

type Rgb = [number, number, number];

interface TextStyle {
  labelSize: number;
  valueSize: number;
  pillSize: number;
  maxPitch: number;
}

const COLUMN_STYLE: TextStyle = { labelSize: 15, valueSize: 27, pillSize: 23, maxPitch: 72 };
const BAND_STYLE: TextStyle = { labelSize: 13, valueSize: 21, pillSize: 19, maxPitch: 46 };
const PILL_W = 44; // swatch pill plus its gap before the text
const DIVIDER_GAP = 40; // between the attachment rows and the color rows in one column
const LIGHT_TEXT: Rgb = [232, 226, 214];

interface Canvas {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  rawImg: HTMLImageElement;
  bounds: Rect;
  palette: BackgroundPalette;
  text: { light: Rgb; dim: Rgb; accent: Rgb };
  rows: { fields: FieldRow[]; colors: ColorRow[] };
}

/**
 * Renders a background-removed cutout full-bleed over a generated background, in any of the 4
 * layouts. The character is always placed in the lane left free by the text columns.
 */
export class CutoutPosterRenderer {
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly input: PosterInput,
  ) {}

  render(): Promise<void> {
    switch (this.input.layoutKey) {
      case 'right-classic':
        return this.classic('right');
      case 'center-split':
        return this.split();
      case 'center-showcase':
        return this.showcase();
      default:
        return this.classic('left');
    }
  }

  /** Shared setup: size the canvas, trim the cutout, resolve colors, paint the background. */
  private async setup(): Promise<Canvas> {
    await document.fonts.ready;
    const ctx = this.canvas.getContext('2d')!;
    const W = 1400,
      H = 1750;
    this.canvas.width = W;
    this.canvas.height = H;

    const rawImg = await loadImgEl(this.input.imageDataUrl!);
    const scan = document.createElement('canvas');
    scan.width = rawImg.naturalWidth;
    scan.height = rawImg.naturalHeight;
    const scanCtx = scan.getContext('2d', { willReadFrequently: true })!;
    scanCtx.drawImage(rawImg, 0, 0);
    const pixels = scanCtx.getImageData(0, 0, scan.width, scan.height);

    const palette = resolveBackground({
      color1: this.input.posterColor1 ? hexToRgb(this.input.posterColor1.hex) : null,
      color2: this.input.posterColor2 ? hexToRgb(this.input.posterColor2.hex) : null,
      autoColor: dominantHueColor(pixels),
      swapped: this.input.bgSwapped,
    });
    drawPosterBackground(ctx, W, H, palette);

    return {
      ctx,
      W,
      H,
      rawImg,
      bounds: trimTransparentBounds(pixels),
      palette,
      text: {
        light: LIGHT_TEXT,
        dim: mixRgb(LIGHT_TEXT, palette.deep, 0.45),
        accent: mixRgb(palette.accent, [255, 255, 255], 0.45),
      },
      rows: posterRows(this.input),
    };
  }

  // ── Layouts ───────────────────────────────────────────────

  /**
   * Classic Left / Right: one text column on the `column` side with the signature under it, and
   * the character in the remaining width.
   */
  private async classic(characterSide: 'left' | 'right') {
    const c = await this.setup();
    const { ctx, W, H } = c;
    const headerBottom = this.drawHeader(c);
    const columnSide = characterSide === 'left' ? 'right' : 'left';
    // The signature sits under the column, so the column is at least as wide as it.
    const columnW = Math.min(
      Math.max(
        this.measureColumn(c, c.rows.fields, c.rows.colors, COLUMN_STYLE),
        this.measureSignature(c),
      ),
      Math.ceil(W * MAX_COLUMN_FRACTION),
    );
    const bottomMargin = Math.round(H * 0.058);
    const lane =
      characterSide === 'left' ? characterLane(W, 0, columnW) : characterLane(W, columnW, 0);
    const box = placeCharacter(
      c.bounds,
      lane,
      H - bottomMargin - (headerBottom + 90),
      H - bottomMargin,
    );
    this.drawCharacter(c, box);

    const columnX = columnSide === 'right' ? W - POSTER_EDGE : POSTER_EDGE;
    this.drawTextColumn(c, {
      x: columnX,
      align: columnSide,
      width: columnW,
      topY: headerBottom + 40,
      bottomY: H - 220,
      fields: c.rows.fields,
      colors: c.rows.colors,
      style: COLUMN_STYLE,
    });
    this.drawSignature(c, columnX, H - 202, columnSide, columnW);
    drawGoldFrame(ctx, W, H);
  }

  /** Split: attachments on the left, colors on the right, signature centered below the character. */
  private async split() {
    const c = await this.setup();
    const { ctx, W, H } = c;
    const headerBottom = this.drawHeader(c);
    const leftW = this.measureColumn(c, c.rows.fields, [], COLUMN_STYLE);
    const rightW = this.measureColumn(c, [], c.rows.colors, COLUMN_STYLE);
    // Room for the signature block below the character plus a safe margin.
    const bottomY = H - 185;
    const box = placeCharacter(
      c.bounds,
      characterLane(W, leftW, rightW),
      bottomY - (headerBottom + 90),
      bottomY,
    );
    this.drawCharacter(c, box);

    const textTop = headerBottom + 40,
      textBottom = bottomY - 20;
    const common = { topY: textTop, bottomY: textBottom, style: COLUMN_STYLE };
    this.drawTextColumn(c, {
      ...common,
      x: POSTER_EDGE,
      align: 'left',
      width: leftW,
      fields: c.rows.fields,
      colors: [],
    });
    this.drawTextColumn(c, {
      ...common,
      x: W - POSTER_EDGE,
      align: 'right',
      width: rightW,
      fields: [],
      colors: c.rows.colors,
    });

    // From the character's actual bottom edge: 25px gap + ~40px ascent to the baseline.
    this.drawSignature(c, W / 2, bottomY + 65, 'center');
    drawGoldFrame(ctx, W, H);
  }

  /** Showcase: large character, signature bottom-left, two-column band along the bottom. */
  private async showcase() {
    const c = await this.setup();
    const { ctx, W, H } = c;
    const headerBottom = this.drawHeader(c);
    // SIG_H: the signature block's measured extent (~133px) plus margin on both sides.
    const SIG_H = 175,
      BAND_H = Math.round(H * 0.27);
    const reservedBottom = SIG_H + BAND_H;
    const top = headerBottom + 90;
    const box = placeCharacter(
      c.bounds,
      characterLane(W, 0, 0),
      H - reservedBottom - top,
      H - reservedBottom,
    );
    // Showcase anchors the character to the top of its area rather than the bottom.
    this.drawCharacter(c, { ...box, y: top });

    this.drawSignature(c, FRAME_SAFE, H - reservedBottom + 55, 'left');

    const bandTop = H - BAND_H;
    ctx.strokeStyle = rgbCss(c.text.dim, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(POSTER_EDGE, bandTop - 6);
    ctx.lineTo(W - POSTER_EDGE, bandTop - 6);
    ctx.stroke();

    const half = W / 2 - POSTER_EDGE - 30;
    const common = {
      topY: bandTop + 16,
      bottomY: H - 30,
      align: 'left' as const,
      width: half,
      style: BAND_STYLE,
    };
    this.drawTextColumn(c, { ...common, x: POSTER_EDGE, fields: c.rows.fields, colors: [] });
    this.drawTextColumn(c, { ...common, x: W / 2 + 30, fields: [], colors: c.rows.colors });
    drawGoldFrame(ctx, W, H);
  }

  // ── Pieces ────────────────────────────────────────────────

  /** Title, subtitle and divider positioned from measured text metrics. Returns the header's bottom y. */
  private drawHeader({ ctx, W, text }: Canvas): number {
    const FRAME_INNER = 32,
      TITLE_TOP_MARGIN = 20;
    ctx.textAlign = 'left';
    ctx.font = '600 58px Cinzel, serif';
    const titleAscent = ctx.measureText('WARFRAME').actualBoundingBoxAscent || 42;
    const titleBaseline = FRAME_INNER + TITLE_TOP_MARGIN + titleAscent;
    const subBaseline = titleBaseline + 66;
    const dividerY = subBaseline + 20;

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgbCss(text.light);
    drawTrackedText(ctx, 'WARFRAME', W / 2, titleBaseline, 6);
    ctx.font = '16px Cinzel, serif';
    ctx.fillStyle = rgbCss(text.accent);
    drawTrackedText(ctx, 'FASHION CARD', W / 2, subBaseline, 10);
    ctx.strokeStyle = rgbCss(text.accent, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.34, dividerY);
    ctx.lineTo(W * 0.66, dividerY);
    ctx.stroke();
    return dividerY;
  }

  private drawCharacter({ ctx, rawImg, bounds }: Canvas, box: Rect) {
    drawContactShadow(ctx, box.x, box.y, box.w, box.h);
    ctx.drawImage(rawImg, bounds.x, bounds.y, bounds.w, bounds.h, box.x, box.y, box.w, box.h);
  }

  /** Width a text column needs for these rows, capped so the character keeps most of the poster. */
  private measureColumn(
    { ctx, W }: Canvas,
    fields: FieldRow[],
    colors: ColorRow[],
    s: TextStyle,
  ): number {
    if (!fields.length && !colors.length) return 0;
    let width = 0;
    ctx.font = `${s.labelSize}px Cinzel, serif`;
    for (const f of fields) width = Math.max(width, ctx.measureText(f.label).width);
    ctx.font = `${s.valueSize}px "Cormorant Garamond", serif`;
    for (const f of fields) width = Math.max(width, ctx.measureText(f.value).width);
    ctx.font = `${s.pillSize}px "Cormorant Garamond", serif`;
    for (const r of colors)
      width = Math.max(width, ctx.measureText(`${r.label}  ${r.value}`).width + PILL_W);
    return Math.ceil(Math.min(width, W * MAX_COLUMN_FRACTION));
  }

  /** Attachment rows, then color rows, from `topY` down; text is shortened to fit `width`. */
  private drawTextColumn(
    { ctx, text }: Canvas,
    o: {
      x: number;
      align: 'left' | 'right';
      width: number;
      topY: number;
      bottomY: number;
      fields: FieldRow[];
      colors: ColorRow[];
      style: TextStyle;
    },
  ) {
    const { x, align, width, style: s } = o;
    const hasBoth = o.fields.length > 0 && o.colors.length > 0;
    const pitch = rowPitch(
      o.bottomY - o.topY - (hasBoth ? DIVIDER_GAP : 0),
      o.fields.length + o.colors.length,
      s.maxPitch,
    );

    ctx.textAlign = align;
    let y = o.topY;
    for (const f of o.fields) {
      ctx.font = `${s.labelSize}px Cinzel, serif`;
      ctx.fillStyle = rgbCss(text.accent);
      ctx.fillText(fitText(ctx, f.label, width), x, y);
      ctx.font = `${s.valueSize}px "Cormorant Garamond", serif`;
      ctx.fillStyle = rgbCss(text.light);
      ctx.fillText(fitText(ctx, f.value, width), x, y + 29);
      y += pitch;
    }
    if (hasBoth) {
      y += DIVIDER_GAP * 0.3;
      ctx.strokeStyle = rgbCss(text.dim, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(align === 'right' ? x - width : x, y);
      ctx.lineTo(align === 'right' ? x : x + width, y);
      ctx.stroke();
      y += DIVIDER_GAP * 0.7;
    }
    for (const r of o.colors) {
      ctx.font = `${s.pillSize}px "Cormorant Garamond", serif`;
      const label = fitText(ctx, `${r.label}  ${r.value}`, width - PILL_W);
      const textW = ctx.measureText(label).width;
      const pillX = align === 'right' ? x - textW - PILL_W : x;
      ctx.fillStyle = r.hex;
      ctx.beginPath();
      ctx.roundRect(pillX, y + 4, 32, 15, 7);
      ctx.fill();
      ctx.fillStyle = rgbCss(text.light);
      ctx.fillText(label, align === 'right' ? x : x + PILL_W, y + 19);
      y += pitch;
    }
    ctx.textAlign = 'left';
  }

  /** The signature's three lines, each with its font and offset from the first baseline. */
  private signatureLines(): { text: string; font: string; dy: number }[] {
    return [
      {
        text: (this.input.frame || 'WARFRAME').toUpperCase(),
        font: '600 54px Cinzel, serif',
        dy: 0,
      },
      {
        text: `By ${this.input.creator || 'Tenno'}`,
        font: '26px "Cormorant Garamond", serif',
        dy: 60,
      },
      { text: this.input.name || '', font: 'italic 23px "Cormorant Garamond", serif', dy: 87 },
    ];
  }

  private measureSignature({ ctx }: Canvas): number {
    let width = 0;
    for (const line of this.signatureLines()) {
      ctx.font = line.font;
      width = Math.max(width, ctx.measureText(line.text).width);
    }
    return Math.ceil(width);
  }

  /** Frame name, creator and loadout name, anchored at x; lines are shortened to `maxWidth`. */
  private drawSignature(
    { ctx, text }: Canvas,
    x: number,
    y: number,
    align: 'left' | 'right' | 'center',
    maxWidth = Infinity,
  ) {
    const colors = [text.light, text.dim, text.accent];
    ctx.textAlign = align;
    this.signatureLines().forEach((line, i) => {
      ctx.font = line.font;
      ctx.fillStyle = rgbCss(colors[i]);
      ctx.fillText(fitText(ctx, line.text, maxWidth), x, y + line.dy);
    });
    ctx.textAlign = 'left';
  }
}
