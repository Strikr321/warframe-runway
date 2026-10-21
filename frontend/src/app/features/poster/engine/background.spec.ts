import { backgroundColorAt, resolveBackground } from './background';
import { Rgb, lightnessOf, oklabToOklch, rgbToOklab } from './oklab';

const hueOf = (c: Rgb) => oklabToOklch(rgbToOklab(c))[2];
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const RED: Rgb = [200, 30, 40];
const TEAL: Rgb = [20, 190, 185];
const PURPLE: Rgb = [150, 60, 210];

describe('resolveBackground', () => {
  it('two colors: color 1 on top and color 2 at the bottom, each keeping its hue', () => {
    const p = resolveBackground({ color1: RED, color2: TEAL, autoColor: PURPLE, swapped: false });
    expect(p.mode).toBe('blend');
    expect(hueDistance(hueOf(p.top), hueOf(RED))).toBeLessThan(4);
    expect(hueDistance(hueOf(p.bottom), hueOf(TEAL))).toBeLessThan(4);
  });

  it('two colors: both get an equal share of the height', () => {
    const p = resolveBackground({ color1: RED, color2: TEAL, autoColor: PURPLE, swapped: false });
    // The top third is still color 1 and the bottom third color 2; the crossover is centered.
    expect(backgroundColorAt(p, 0.3)).toEqual(p.top);
    expect(backgroundColorAt(p, 0.7)).toEqual(p.bottom);
    const quarter = backgroundColorAt(p, 0.25),
      threeQuarters = backgroundColorAt(p, 0.75);
    expect(hueDistance(hueOf(quarter), hueOf(RED))).toBeLessThan(4);
    expect(hueDistance(hueOf(threeQuarters), hueOf(TEAL))).toBeLessThan(4);
  });

  it('two colors: swap trades top and bottom', () => {
    const normal = resolveBackground({
      color1: RED,
      color2: TEAL,
      autoColor: PURPLE,
      swapped: false,
    });
    const swapped = resolveBackground({
      color1: RED,
      color2: TEAL,
      autoColor: PURPLE,
      swapped: true,
    });
    expect(swapped.top).toEqual(normal.bottom);
    expect(swapped.bottom).toEqual(normal.top);
  });

  it('keeps every tone dark enough for light text, even for a very light pick', () => {
    const p = resolveBackground({
      color1: [250, 250, 240],
      color2: [255, 255, 120],
      autoColor: PURPLE,
      swapped: false,
    });
    for (let t = 0; t <= 1; t += 0.1)
      expect(lightnessOf(backgroundColorAt(p, t))).toBeLessThanOrEqual(0.5);
  });

  it('darkens a pick by lightness, so a red edge stays red instead of turning brown', () => {
    const p = resolveBackground({ color1: RED, color2: null, autoColor: PURPLE, swapped: false });
    expect(p.mode).toBe('atmosphere');
    expect(lightnessOf(p.top)).toBeLessThan(0.2);
    expect(hueDistance(hueOf(p.top), hueOf(RED))).toBeLessThan(6);
    expect(hueDistance(hueOf(p.glow), hueOf(RED))).toBeLessThan(4);
  });

  it('uses the auto-detected color when nothing is picked, peaking in the middle', () => {
    const p = resolveBackground({ color1: null, color2: null, autoColor: PURPLE, swapped: false });
    expect(hueDistance(hueOf(p.glow), hueOf(PURPLE))).toBeLessThan(4);
    expect(lightnessOf(backgroundColorAt(p, 0.5))).toBeGreaterThan(
      lightnessOf(backgroundColorAt(p, 0)),
    );
  });
});
