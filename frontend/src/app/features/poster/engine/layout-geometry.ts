/** Poster layout math, kept free of canvas calls so it can be unit tested. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Lane {
  x0: number;
  x1: number;
}

export const POSTER_EDGE = 60; // text columns start this far from the poster edge
export const FRAME_SAFE = 68; // the character never comes closer to the edge than this
export const COLUMN_GAP = 36; // space between a text column and the character
export const MAX_COLUMN_FRACTION = 0.27; // a text column never takes more than this of the width

/**
 * Horizontal room for the character between optional text columns. A column of width 0 means
 * "no column on that side", so the character gets the full width there.
 */
export function characterLane(W: number, leftColumnW: number, rightColumnW: number): Lane {
  return {
    x0: leftColumnW > 0 ? POSTER_EDGE + leftColumnW + COLUMN_GAP : FRAME_SAFE,
    x1: rightColumnW > 0 ? W - POSTER_EDGE - rightColumnW - COLUMN_GAP : W - FRAME_SAFE,
  };
}

/**
 * Scales the cutout to fit inside the lane and `maxH` (never overflowing either), centers it in
 * the lane and stands it on `bottomY`.
 */
export function placeCharacter(
  cutout: { w: number; h: number },
  lane: Lane,
  maxH: number,
  bottomY: number,
): Rect {
  const scale = Math.min(maxH / cutout.h, (lane.x1 - lane.x0) / cutout.w);
  const w = Math.round(cutout.w * scale),
    h = Math.round(cutout.h * scale);
  return { x: Math.round(lane.x0 + (lane.x1 - lane.x0 - w) / 2), y: bottomY - h, w, h };
}

/** Row pitch for a text column: fills the space, but never spreads a short list thin. */
export function rowPitch(available: number, rows: number, max: number): number {
  return rows > 0 ? Math.min(max, available / rows) : 0;
}
