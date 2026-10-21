import { dominantHueColor, hexToRgb, hsvToRgb, mixRgb, rgbToHsv } from './color';

/** Builds an ImageData-shaped object from a list of RGBA pixels. */
function imageOf(pixels: [number, number, number, number][]): ImageData {
  return {
    data: new Uint8ClampedArray(pixels.flat()),
    width: pixels.length,
    height: 1,
  } as ImageData;
}

describe('color', () => {
  it('parses hex into RGB', () => {
    expect(hexToRgb('#c8a030')).toEqual([200, 160, 48]);
  });

  it('round-trips through HSV', () => {
    const rgb: [number, number, number] = [200, 60, 120];
    const [h, s, v] = rgbToHsv(rgb);
    hsvToRgb(h, s, v).forEach((c, i) => expect(c).toBeCloseTo(rgb[i], 6));
  });

  it('mixes linearly between two colors', () => {
    expect(mixRgb([0, 0, 0], [100, 200, 50], 0.5)).toEqual([50, 100, 25]);
  });

  describe('dominantHueColor', () => {
    it('picks the vivid hue instead of averaging it with dark armor', () => {
      const armor: [number, number, number, number] = [30, 30, 34, 255];
      const teal: [number, number, number, number] = [20, 180, 170, 255];
      const img = imageOf([...Array(80).fill(armor), ...Array(20).fill(teal)]);
      const [h] = rgbToHsv(dominantHueColor(img));
      expect(h).toBeCloseTo(rgbToHsv([20, 180, 170])[0], 1);
    });

    it('ignores transparent pixels', () => {
      const hidden: [number, number, number, number] = [255, 0, 0, 0];
      const blue: [number, number, number, number] = [30, 60, 220, 255];
      const [h] = rgbToHsv(dominantHueColor(imageOf([...Array(50).fill(hidden), blue])));
      expect(h).toBeCloseTo(rgbToHsv([30, 60, 220])[0], 1);
    });

    it('falls back to a neutral when nothing is vivid', () => {
      expect(dominantHueColor(imageOf([[40, 40, 40, 255]]))).toEqual([140, 140, 160]);
    });
  });
});
