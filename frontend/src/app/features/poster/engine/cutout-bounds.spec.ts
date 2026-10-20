import { trimTransparentBounds } from './cutout-bounds';

/** Transparent canvas with opaque rectangles painted in. */
function canvasWith(
  width: number,
  height: number,
  rects: [number, number, number, number][],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x0, y0, w, h] of rects) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) data[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { data, width, height } as ImageData;
}

describe('trimTransparentBounds', () => {
  it('bounds the body with 2.5% padding', () => {
    const b = trimTransparentBounds(canvasWith(200, 200, [[50, 40, 41, 81]]));
    expect(b).toEqual({ x: 49, y: 38, w: 43, h: 85 });
  });

  it('ignores a detached spark far from the body', () => {
    const body: [number, number, number, number] = [50, 40, 41, 81];
    const withSpark = trimTransparentBounds(canvasWith(200, 200, [body, [190, 10, 2, 2]]));
    expect(withSpark).toEqual(trimTransparentBounds(canvasWith(200, 200, [body])));
  });

  it('keeps thin geometry that is attached to the body', () => {
    // A 1px-wide horn rising from the top of the body.
    const b = trimTransparentBounds(
      canvasWith(200, 200, [
        [50, 40, 41, 81],
        [70, 5, 1, 35],
      ]),
    );
    expect(b.y).toBeLessThanOrEqual(5);
  });

  it('keeps a large detached piece (e.g. a syandana split off by keying)', () => {
    const b = trimTransparentBounds(
      canvasWith(200, 200, [
        [50, 40, 41, 81],
        [150, 60, 20, 20],
      ]),
    );
    expect(b.x + b.w).toBeGreaterThanOrEqual(170);
  });

  it('includes the last row and column when there is no room to pad', () => {
    expect(trimTransparentBounds(canvasWith(10, 10, [[0, 0, 10, 10]]))).toEqual({
      x: 0,
      y: 0,
      w: 10,
      h: 10,
    });
  });

  it('returns the full image when nothing is visible', () => {
    expect(trimTransparentBounds(canvasWith(10, 8, []))).toEqual({ x: 0, y: 0, w: 10, h: 8 });
  });
});
