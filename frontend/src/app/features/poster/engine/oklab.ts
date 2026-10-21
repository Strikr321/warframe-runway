/**
 * Perceptual color math (OKLab / OKLCH, Björn Ottosson 2020; the space CSS Color 4 uses for
 * gradient interpolation). Blending in OKLab looks even to the eye, unlike sRGB, where e.g. red
 * to teal passes through muddy grey. OKLCH changes lightness without shifting hue, so a color
 * can be made darker or brighter and still read as "the same color".
 */

export type Rgb = [number, number, number]; // sRGB, 0–255
export type Oklab = [number, number, number]; // L 0–1, a, b
export type Oklch = [number, number, number]; // L 0–1, C ≥ 0, h in degrees

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.sign(v) * Math.abs(v) ** (1 / 2.4) - 0.055);

export function rgbToOklab([r8, g8, b8]: Rgb): Oklab {
  const r = toLinear(r8),
    g = toLinear(g8),
    b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Unclamped: channels outside 0–255 mean the color is outside the sRGB gamut. */
function oklabToRgbRaw([L, a, b]: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -0.5 && c <= 255.5);
const clamp255 = (rgb: Rgb): Rgb => rgb.map((c) => Math.min(255, Math.max(0, c))) as Rgb;

export function oklabToRgb(lab: Oklab): Rgb {
  return clamp255(oklabToRgbRaw(lab));
}

export function oklabToOklch([L, a, b]: Oklab): Oklch {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), h < 0 ? h + 360 : h];
}

export function oklchToOklab([L, C, h]: Oklch): Oklab {
  const rad = (h * Math.PI) / 180;
  return [L, C * Math.cos(rad), C * Math.sin(rad)];
}

/**
 * OKLCH → sRGB, keeping lightness and hue and reducing chroma until the color is displayable
 * (the gamut-mapping approach CSS Color 4 recommends), instead of clipping channels, which
 * shifts hue.
 */
export function oklchToRgb([L, C, h]: Oklch): Rgb {
  if (inGamut(oklabToRgbRaw(oklchToOklab([L, C, h])))) return oklabToRgb(oklchToOklab([L, C, h]));
  let lo = 0,
    hi = C;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToRgbRaw(oklchToOklab([L, mid, h])))) lo = mid;
    else hi = mid;
  }
  return oklabToRgb(oklchToOklab([L, lo, h]));
}

/** Perceptually even blend; t = 0 gives `a`, t = 1 gives `b`. */
export function mixOklab(a: Rgb, b: Rgb, t: number): Rgb {
  // Exact endpoints: a round trip through OKLab would otherwise drift by float error.
  if (t <= 0) return a;
  if (t >= 1) return b;
  const A = rgbToOklab(a),
    B = rgbToOklab(b);
  return oklabToRgb([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Same hue at a chosen lightness, with chroma kept within [minC, maxC]. */
export function retone(rgb: Rgb, lightness: number, minC: number, maxC: number): Rgb {
  const [, C, h] = oklabToOklch(rgbToOklab(rgb));
  return oklchToRgb([lightness, Math.min(maxC, Math.max(minC, C)), h]);
}

export function lightnessOf(rgb: Rgb): number {
  return rgbToOklab(rgb)[0];
}
