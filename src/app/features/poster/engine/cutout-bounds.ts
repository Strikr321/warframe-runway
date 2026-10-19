/**
 * Trims excess transparent padding around a cutout — but bounded by
 * CONNECTED COMPONENTS, not by every last visible pixel. Why: a
 * one-sided ephemera (Mesa's Conquera) leaves tiny opaque sparks and
 * faint wisps drifting far from the body. Counting any alpha>10
 * pixel let a single 59px spark drag the box edge 150px right,
 * off-centering the whole poster (box center 1123 vs the body's real
 * 1086 on the verified Mesa shot). Alternatives measured and
 * rejected: a higher alpha threshold misses opaque sparks; trimming
 * by alpha-mass percentile clips thin-but-solid geometry (Ash's horn
 * tips). Connectivity is the property that actually separates them:
 * horns are thin but ATTACHED, sparks are islands. So: label
 * components (4-neighbor BFS), keep every component at least 0.5% the
 * size of the largest (protects real pieces if keying ever splits
 * one), and take the union of their bounds. Verified across Mesa,
 * Harrow, and Ash: Mesa recenters, the other two are unchanged.
 */
export function trimTransparentBounds(imgData: ImageData): { x: number; y: number; w: number; h: number } {
  const { data, width, height } = imgData;
  const total = width * height;

  const mask = new Uint8Array(total);
  let any = false;
  for (let p = 0; p < total; p++) {
    if (data[p * 4 + 3] > 10) { mask[p] = 1; any = true; }
  }
  if (!any) return { x: 0, y: 0, w: width, h: height }; // fully empty — bail safely

  const label = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  const comps: { n: number; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  for (let start = 0; start < total; start++) {
    if (!mask[start] || label[start] >= 0) continue;
    const id = comps.length;
    let head = 0, tail = 0;
    queue[tail++] = start; label[start] = id;
    const c = { n: 0, minX: width, maxX: 0, minY: height, maxY: 0 };
    while (head < tail) {
      const p = queue[head++]; c.n++;
      const x = p % width, y = (p / width) | 0;
      if (x < c.minX) c.minX = x; if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y;
      if (x > 0 && mask[p - 1] && label[p - 1] < 0) { label[p - 1] = id; queue[tail++] = p - 1; }
      if (x < width - 1 && mask[p + 1] && label[p + 1] < 0) { label[p + 1] = id; queue[tail++] = p + 1; }
      if (y > 0 && mask[p - width] && label[p - width] < 0) { label[p - width] = id; queue[tail++] = p - width; }
      if (y < height - 1 && mask[p + width] && label[p + width] < 0) { label[p + width] = id; queue[tail++] = p + width; }
    }
    comps.push(c);
  }

  let largest = 0;
  for (const c of comps) if (c.n > largest) largest = c.n;
  const keepMin = largest * 0.005;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (const c of comps) {
    if (c.n < keepMin) continue;
    if (c.minX < minX) minX = c.minX; if (c.maxX > maxX) maxX = c.maxX;
    if (c.minY < minY) minY = c.minY; if (c.maxY > maxY) maxY = c.maxY;
  }

  const padX = Math.round((maxX - minX) * 0.025), padY = Math.round((maxY - minY) * 0.025);
  const x = Math.max(0, minX - padX), y = Math.max(0, minY - padY);
  const w = Math.min(width, maxX + padX) - x, h = Math.min(height, maxY + padY) - y;
  return { x, y, w, h };
}
