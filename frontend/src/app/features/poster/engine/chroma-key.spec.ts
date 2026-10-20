import { detectMonochromeBackground, keyOutBackground } from './chroma-key';

type Rgb = [number, number, number];
const GREEN: Rgb = [0, 195, 117];
const ORANGE: Rgb = [255, 122, 32];

/** A width x height opaque image filled with `bg`, with `fg` painted in a centered square. */
function scene(size: number, bg: Rgb, fg: Rgb, fgSize: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  const start = (size - fgSize) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inFg = x >= start && x < start + fgSize && y >= start && y < start + fgSize;
      data.set([...(inFg ? fg : bg), 255], (y * size + x) * 4);
    }
  }
  return data;
}

const pixel = (data: Uint8ClampedArray, size: number, x: number, y: number) =>
  Array.from(data.slice((y * size + x) * 4, (y * size + x) * 4 + 4));

describe('detectMonochromeBackground', () => {
  it('finds a uniform green-screen border', () => {
    const key = detectMonochromeBackground(scene(200, GREEN, ORANGE, 100), 200, 200);
    expect(key).not.toBeNull();
    key!.forEach((c, i) => expect(c).toBeCloseTo(GREEN[i], 0));
  });

  it('still detects the backdrop when the subject crosses part of the border', () => {
    // Subject wider than the image: it covers the left and right border strips' middles.
    const data = scene(200, GREEN, ORANGE, 0);
    for (let y = 90; y < 100; y++)
      for (let x = 0; x < 200; x++) data.set([...ORANGE, 255], (y * 200 + x) * 4);
    expect(detectMonochromeBackground(data, 200, 200)).not.toBeNull();
  });

  it('rejects a busy, non-uniform border', () => {
    const data = new Uint8ClampedArray(200 * 200 * 4);
    for (let i = 0; i < data.length; i += 4)
      data.set([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256, 255], i);
    expect(detectMonochromeBackground(data, 200, 200)).toBeNull();
  });
});

describe('keyOutBackground', () => {
  it('removes a saturated backdrop and keeps the subject untouched', () => {
    const data = scene(100, GREEN, ORANGE, 40);
    const removed = keyOutBackground(data, 100, 100, GREEN);
    expect(pixel(data, 100, 2, 2)[3]).toBe(0);
    expect(pixel(data, 100, 50, 50)).toEqual([...ORANGE, 255]);
    expect(removed).toBeCloseTo(1 - (40 * 40) / (100 * 100), 2);
  });

  it('unmixes a semi-transparent pixel instead of keeping it green-tinted', () => {
    // Half red smoke over the green backdrop.
    const mixed: Rgb = [100, 118, 79];
    const data = new Uint8ClampedArray([...mixed, 255]);
    keyOutBackground(data, 1, 1, GREEN);
    const [r, g, b, a] = Array.from(data);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(255);
    expect(g - Math.max(r, b)).toBeLessThanOrEqual(0); // no green excess left
  });

  it('distance-keys a neutral backdrop with a feathered edge', () => {
    const WHITE: Rgb = [250, 250, 250];
    const data = new Uint8ClampedArray([...WHITE, 255, 200, 200, 200, 255, 20, 20, 20, 255]);
    keyOutBackground(data, 3, 1, WHITE);
    const alphas = [data[3], data[7], data[11]];
    expect(alphas[0]).toBe(0); // backdrop
    expect(alphas[1]).toBeGreaterThan(0); // feathered
    expect(alphas[1]).toBeLessThan(255);
    expect(alphas[2]).toBe(255); // dark subject kept
  });
});
