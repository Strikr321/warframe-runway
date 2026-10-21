import {
  COLUMN_GAP,
  FRAME_SAFE,
  POSTER_EDGE,
  characterLane,
  placeCharacter,
  rowPitch,
} from './layout-geometry';

describe('layout geometry', () => {
  const W = 1400;

  it('keeps the character clear of a right-hand text column', () => {
    const lane = characterLane(W, 0, 320);
    const columnLeftEdge = W - POSTER_EDGE - 320;
    const box = placeCharacter({ w: 900, h: 1200 }, lane, 1300, 1600);
    expect(box.x).toBeGreaterThanOrEqual(FRAME_SAFE);
    expect(box.x + box.w).toBeLessThanOrEqual(columnLeftEdge - COLUMN_GAP);
  });

  it('keeps a wide cutout between two columns (Split layout)', () => {
    const lane = characterLane(W, 260, 340);
    const box = placeCharacter({ w: 1600, h: 1000 }, lane, 1300, 1500);
    expect(box.x).toBeGreaterThanOrEqual(POSTER_EDGE + 260 + COLUMN_GAP);
    expect(box.x + box.w).toBeLessThanOrEqual(W - POSTER_EDGE - 340 - COLUMN_GAP);
  });

  it('uses the full width when there is no text column', () => {
    expect(characterLane(W, 0, 0)).toEqual({ x0: FRAME_SAFE, x1: W - FRAME_SAFE });
  });

  it('never overflows the height and stands on the given baseline', () => {
    const box = placeCharacter({ w: 400, h: 2000 }, characterLane(W, 0, 0), 1200, 1650);
    expect(box.h).toBeLessThanOrEqual(1200);
    expect(box.y + box.h).toBe(1650);
  });

  it('spaces a short list at the maximum pitch instead of spreading it over the poster', () => {
    expect(rowPitch(1200, 2, 72)).toBe(72);
    expect(rowPitch(1200, 24, 72)).toBe(50);
    expect(rowPitch(1200, 0, 72)).toBe(0);
  });
});
