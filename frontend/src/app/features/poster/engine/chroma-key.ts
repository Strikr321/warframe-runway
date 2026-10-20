/**
 * Background detection and removal for uploaded screenshots.
 *
 * Runs once at upload and produces a transparent PNG, so every downstream
 * step (bounds trimming, color analysis, all layouts) works unchanged.
 * Thresholds were tuned against real Captura green-screen shots
 * (key detected at rgb(0,195,117), ~91% of the frame keyed out).
 */

/**
 * True when more than 3% of the image is non-opaque, i.e. it is already a
 * cutout. A proportion, not "any alpha", so stray anti-aliased pixels don't count.
 */
export function detectTransparency(img: HTMLImageElement): boolean {
  const cv = document.createElement('canvas');
  // A 120px-wide sample is enough to answer this.
  const sw = 120,
    sh = Math.max(1, Math.round((120 * img.naturalHeight) / img.naturalWidth));
  cv.width = sw;
  cv.height = sh;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;
  let nonOpaque = 0;
  const total = sw * sh;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) nonOpaque++;
  }
  return nonOpaque / total > 0.03; // >3% of the image has real transparency
}

/**
 * Returns the backdrop color if a thin border ring is uniform (>= 92% of
 * samples near the mean), else null. A fraction rather than std-dev, so a
 * limb or syandana crossing the border doesn't veto a real green screen.
 */
export function detectMonochromeBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number] | null {
  const margin = Math.max(2, Math.round(Math.min(width, height) * 0.02));
  const step = 4;
  const samples: [number, number, number][] = [];
  const push = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 250) return; // real transparency -> not this path
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < margin; x += step) push(x, y);
    for (let x = width - margin; x < width; x += step) push(x, y);
  }
  for (let x = 0; x < width; x += step) {
    for (let y = 0; y < margin; y += step) push(x, y);
    for (let y = height - margin; y < height; y += step) push(x, y);
  }
  if (samples.length < 50) return null;

  const mean: [number, number, number] = [0, 0, 0];
  for (const s of samples) {
    mean[0] += s[0];
    mean[1] += s[1];
    mean[2] += s[2];
  }
  mean[0] /= samples.length;
  mean[1] /= samples.length;
  mean[2] /= samples.length;

  let near = 0;
  for (const s of samples) {
    const d = Math.hypot(s[0] - mean[0], s[1] - mean[1], s[2] - mean[2]);
    if (d < 30) near++;
  }
  return near / samples.length >= 0.92 ? mean : null;
}

/**
 * Keys the backdrop out of the pixel data in place; returns the fraction
 * of pixels fully removed.
 *
 * Saturated keys (green screen) use chroma unmixing rather than binary
 * keying. Model: observed = alpha*fg + (1-alpha)*key. Each pixel's backdrop
 * fraction comes from how much of the key's dominant-channel excess it
 * carries (Vlahos-style); that share of the key is subtracted and alpha
 * reduced to match. This recovers semi-transparent smoke and cape edges
 * that binary keying leaves as green-tinted patches.
 *
 * Known limit: key blended into a hue beyond it (green into blue = cyan) is
 * indistinguishable from real cyan foreground; at poster scale it reads as
 * rim light.
 *
 * Neutral keys (white/grey/black) have no channel signature, so they use
 * distance keying with a smoothstep feather, tighter for dark keys so
 * near-black armor survives.
 */
export function keyOutBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  key: [number, number, number],
): number {
  const maxC = Math.max(key[0], key[1], key[2]);
  const minC = Math.min(key[0], key[1], key[2]);
  const isDark = maxC < 64;
  const isSaturated = maxC - minC > 40;
  const total = width * height;

  if (isSaturated) {
    // ── Chroma unmixing ──
    const domIdx = key.indexOf(maxC);
    const others = [0, 1, 2].filter((c) => c !== domIdx);
    // The key's signature: how much its dominant channel exceeds the rest
    const keyExcess = key[domIdx] - Math.max(key[others[0]], key[others[1]]);
    let full = 0;
    for (let i = 0; i < data.length; i += 4) {
      const excess = data[i + domIdx] - Math.max(data[i + others[0]], data[i + others[1]]);
      if (excess <= 0) continue; // no detectable key contribution
      const f = excess / keyExcess; // backdrop fraction this pixel carries
      if (f >= 0.98) {
        data[i + 3] = 0;
        full++; // effectively pure backdrop
        continue;
      }
      if (f < 0.04) continue; // noise floor — leave untouched
      const alpha = 1 - f;
      // Solve observed = alpha*fg + f*key  ->  fg = (observed - f*key)/alpha
      for (let c = 0; c < 3; c++) {
        const fg = (data[i + c] - f * key[c]) / alpha;
        data[i + c] = Math.max(0, Math.min(255, Math.round(fg)));
      }
      data[i + 3] = Math.round(data[i + 3] * alpha);
    }
    return full / total;
  }

  // ── Neutral key: distance keying with smoothstep feather ──
  const T1 = isDark ? 25 : 55; // fully removed inside this distance
  const T2 = isDark ? 55 : 110; // fully kept beyond this distance
  let removed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]);
    if (d <= T1) {
      data[i + 3] = 0;
      removed++;
    } else if (d < T2) {
      const t = (d - T1) / (T2 - T1);
      const a = t * t * (3 - 2 * t); // smoothstep
      data[i + 3] = Math.min(data[i + 3], Math.round(a * 255));
    }
  }
  return removed / total;
}

/**
 * Detect and key out a solid backdrop at full resolution. Returns null for
 * a normal screenshot, or if keying removed under 15% of the image (too
 * little to be a real backdrop).
 */
export function tryRemoveMonochromeBackground(
  img: HTMLImageElement,
): { dataUrl: string; hex: string } | null {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, cv.width, cv.height);

  const key = detectMonochromeBackground(imgData.data, cv.width, cv.height);
  if (!key) return null;

  const removedFrac = keyOutBackground(imgData.data, cv.width, cv.height, key);
  if (removedFrac < 0.15) return null; // barely anything keyed -> probably not a backdrop

  ctx.putImageData(imgData, 0, 0);
  const hex = '#' + key.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
  return { dataUrl: cv.toDataURL('image/png'), hex };
}
