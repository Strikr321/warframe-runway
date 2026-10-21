import { rgbCss } from './color';
import { Rgb, lightnessOf, mixOklab, retone } from './oklab';

/**
 * How the poster background is painted, decided from the user's picks before any drawing.
 *
 * - `atmosphere` (auto, or one color): a deep tone of the hue at the top and bottom rising to a
 *   bright glow in the middle, like light falling off from a source.
 * - `blend` (two colors): color 1 at the top flowing into color 2 at the bottom, each holding
 *   an equal share of the height, as the picker labels promise.
 *
 * All tones are derived in OKLCH, so darkening changes lightness only: a picked red stays red
 * (just deeper) instead of turning brown, and blends are interpolated in OKLab.
 */
export interface BackgroundPalette {
  mode: 'atmosphere' | 'blend';
  top: Rgb;
  bottom: Rgb;
  /** The atmosphere peak, and the soft halo drawn behind the character in both modes. */
  glow: Rgb;
  /** Darkest tone, for the vignette and for dimming secondary text. */
  deep: Rgb;
  /** Tints titles and labels. */
  accent: Rgb;
}

// OKLCH lightness/chroma ranges, tuned so light text stays readable on every background.
const DEEP = { L: 0.15, minC: 0, maxC: 0.07 };
const GLOW = { L: 0.6, minC: 0.09, maxC: 0.19 };
const BLEND = { minL: 0.3, maxL: 0.46, minC: 0, maxC: 0.16 };

const deepOf = (c: Rgb) => retone(c, DEEP.L, DEEP.minC, DEEP.maxC);
const glowOf = (c: Rgb) => retone(c, GLOW.L, GLOW.minC, GLOW.maxC);
const blendToneOf = (c: Rgb) =>
  retone(c, Math.min(BLEND.maxL, Math.max(BLEND.minL, lightnessOf(c))), BLEND.minC, BLEND.maxC);

export function resolveBackground(picks: {
  color1: Rgb | null;
  color2: Rgb | null;
  /** The cutout's dominant vivid color, used when nothing is picked. */
  autoColor: Rgb;
  /** Two colors: top and bottom trade places. One color / auto: the glow and the edges trade. */
  swapped: boolean;
}): BackgroundPalette {
  const { color1, color2, autoColor, swapped } = picks;

  if (color1 && color2) {
    const [top, bottom] = (swapped ? [color2, color1] : [color1, color2]).map(blendToneOf);
    const middle = mixOklab(top, bottom, 0.5);
    const glow = glowOf(middle);
    return { mode: 'blend', top, bottom, glow, deep: deepOf(middle), accent: glow };
  }

  const hue = color1 ?? color2 ?? autoColor;
  const deep = deepOf(hue);
  const glow = glowOf(hue);
  return swapped
    ? {
        mode: 'atmosphere',
        top: blendToneOf(hue),
        bottom: blendToneOf(hue),
        glow: deep,
        deep,
        accent: glow,
      }
    : { mode: 'atmosphere', top: deep, bottom: deep, glow, deep, accent: glow };
}

/** Vertical gradient color at height t (0 = top, 1 = bottom). Exported for tests. */
export function backgroundColorAt(p: BackgroundPalette, t: number): Rgb {
  if (p.mode === 'blend') {
    // Hold each color over its own third, then cross over smoothly through the middle third.
    const u = Math.min(1, Math.max(0, (t - 1 / 3) * 3));
    return mixOklab(p.top, p.bottom, u * u * (3 - 2 * u));
  }
  const edge = t < 0.5 ? p.top : p.bottom;
  const glowAmount = Math.exp(-((t - 0.5) ** 2) / (2 * 0.22 ** 2));
  return mixOklab(edge, p.glow, glowAmount);
}

export function drawPosterBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  p: BackgroundPalette,
): void {
  // Sampled stops on a native gradient, so the canvas interpolates smoothly between them.
  const STOPS = 32;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  for (let i = 0; i <= STOPS; i++)
    grad.addColorStop(i / STOPS, rgbCss(backgroundColorAt(p, i / STOPS)));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Soft halo behind the character. Radial gradients rather than blurred shapes:
  // ctx.filter blur leaves visible rings at large radii.
  const halo = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, 640);
  const haloStrength = p.mode === 'blend' ? 0.14 : 0.22;
  halo.addColorStop(0, rgbCss(p.glow, haloStrength));
  halo.addColorStop(0.35, rgbCss(p.glow, haloStrength * 0.7));
  halo.addColorStop(1, rgbCss(p.glow, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const vignette = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, H * 0.85);
  vignette.addColorStop(0, rgbCss(p.deep, 0));
  vignette.addColorStop(1, rgbCss(p.deep, 0.6));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}
