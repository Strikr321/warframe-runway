/** Color conversion and analysis helpers shared by the poster renderers. */

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function rgbaStr(hex: string, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function mixRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number,
): [number, number, number] {
  return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
}

export function rgbCss(c: [number, number, number], a = 1): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6),
    f = h * 6 - i,
    p = v * (1 - s),
    q = v * (1 - f * s),
    t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return [r * 255, g * 255, b * 255];
}

export function rgbToHsv(rgb: [number, number, number]): [number, number, number] {
  const r = rgb[0] / 255,
    g = rgb[1] / 255,
    b = rgb[2] / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = h / 6;
    if (h < 0) h += 1;
  }
  const s = max > 0 ? d / max : 0;
  return [h, s, max];
}

/**
 * The cutout's most prominent vivid hue: a hue histogram weighted by
 * saturation x value, rendered at its peak as a vivid color. Averaging
 * instead would mix energy colors with dark armor into muddy grey.
 */
export function dominantHueColor(imgData: ImageData): [number, number, number] {
  const { data } = imgData;
  const hist = new Float64Array(48);
  const satAtHue: number[] = new Array(48).fill(0);
  const valAtHue: number[] = new Array(48).fill(0);
  const countAtHue: number[] = new Array(48).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue;
    const r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const v = max;
    const s = max > 0 ? (max - min) / max : 0;
    if (s <= 0.28 || v <= 0.18 || v >= 0.97) continue;
    let h: number;
    if (max === min) h = 0;
    else if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h = h / 6;
    if (h < 0) h += 1;
    const bin = Math.min(47, Math.floor(h * 48));
    const w = s * v;
    hist[bin] += w;
    satAtHue[bin] += s * w;
    valAtHue[bin] += v * w;
    countAtHue[bin] += w;
  }
  let peak = 0;
  for (let i = 1; i < 48; i++) if (hist[i] > hist[peak]) peak = i;
  if (hist[peak] < 1e-6) return [140, 140, 160];
  const peakHue = (peak + 0.5) / 48;
  const medS = countAtHue[peak] > 0 ? satAtHue[peak] / countAtHue[peak] : 0.6;
  const medV = countAtHue[peak] > 0 ? valAtHue[peak] / countAtHue[peak] : 0.6;
  const vividS = Math.min(0.85, Math.max(0.55, medS * 1.3));
  const vividV = Math.min(0.95, Math.max(0.55, medV * 1.2));
  return hsvToRgb(peakHue, vividS, vividV);
}
