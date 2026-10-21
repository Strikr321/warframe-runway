import {
  Rgb,
  lightnessOf,
  mixOklab,
  oklabToOklch,
  oklabToRgb,
  oklchToRgb,
  retone,
  rgbToOklab,
} from './oklab';

const expectRgbClose = (actual: Rgb, expected: Rgb, tolerance = 1) =>
  actual.forEach((c, i) => expect(Math.abs(c - expected[i])).toBeLessThanOrEqual(tolerance));

describe('oklab', () => {
  it('matches the published reference values', () => {
    // Björn Ottosson's reference: sRGB red ≈ oklab(0.62796, 0.22486, 0.12585)
    const [L, a, b] = rgbToOklab([255, 0, 0]);
    expect(L).toBeCloseTo(0.62796, 4);
    expect(a).toBeCloseTo(0.22486, 4);
    expect(b).toBeCloseTo(0.12585, 4);
    expect(rgbToOklab([255, 255, 255])[0]).toBeCloseTo(1, 4);
    expect(rgbToOklab([0, 0, 0])[0]).toBeCloseTo(0, 4);
  });

  it('round-trips sRGB through OKLab', () => {
    for (const rgb of [
      [200, 40, 50],
      [30, 190, 180],
      [12, 6, 8],
      [240, 192, 80],
    ] as Rgb[]) {
      expectRgbClose(oklabToRgb(rgbToOklab(rgb)), rgb);
    }
  });

  it('blends red and teal without passing through grey', () => {
    const red: Rgb = [200, 30, 40],
      teal: Rgb = [20, 180, 175];
    const mid = mixOklab(red, teal, 0.5);
    const rgbMid = red.map((c, i) => (c + teal[i]) / 2) as Rgb;
    // The perceptual midpoint keeps more lightness than the naive sRGB average.
    expect(lightnessOf(mid)).toBeGreaterThan(lightnessOf(rgbMid));
    expectRgbClose(mixOklab(red, teal, 0), red);
    expectRgbClose(mixOklab(red, teal, 1), teal);
  });

  it('retones to the requested lightness while keeping the hue', () => {
    const teal: Rgb = [20, 200, 190];
    const dark = retone(teal, 0.3, 0, 0.2);
    expect(lightnessOf(dark)).toBeCloseTo(0.3, 2);
    const hueBefore = oklabToOklch(rgbToOklab(teal))[2];
    const hueAfter = oklabToOklch(rgbToOklab(dark))[2];
    expect(Math.abs(hueAfter - hueBefore)).toBeLessThan(3);
  });

  it('maps out-of-gamut colors into sRGB by reducing chroma, not clipping hue', () => {
    const rgb = oklchToRgb([0.7, 0.4, 30]); // far too saturated for sRGB at this lightness
    rgb.forEach((c) => {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(255);
    });
    expect(lightnessOf(rgb)).toBeCloseTo(0.7, 2);
  });
});
