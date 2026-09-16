import { cutMaskTopology } from "./cut-contour";

// Preserve fractional alpha instead of repeatedly turning it into a hard
// binary staircase. A compact kernel and steep transfer keep edges crisp.
export function smoothAlphaCoverage(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data),
    before = new Uint8Array(w * h),
    after = new Uint8Array(w * h);
  const weights = [1, 6, 1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x,
        q = p * 4;
      before[p] = data[q + 3] >= 128 ? 1 : 0;
      let alpha = 0,
        red = 0,
        green = 0,
        blue = 0,
        total = 0,
        minAlpha = 255,
        maxAlpha = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(w - 1, x + dx)),
            ny = Math.max(0, Math.min(h - 1, y + dy));
          const k = (ny * w + nx) * 4,
            weight = weights[dx + 1] * weights[dy + 1],
            a = data[k + 3] / 255;
          alpha += a * weight;
          minAlpha = Math.min(minAlpha, data[k + 3]);
          maxAlpha = Math.max(maxAlpha, data[k + 3]);
          // Never revive background RGB hidden under transparent pixels.
          if (data[k + 3] >= 96) {
            const aw = a * weight;
            red += data[k] * aw;
            green += data[k + 1] * aw;
            blue += data[k + 2] * aw;
            total += aw;
          }
        }
      const t = Math.max(0, Math.min(1, (alpha / 64 - 0.08) / 0.84));
      out[q + 3] =
        maxAlpha - minAlpha < 32
          ? data[q + 3]
          : Math.round(t * t * (3 - 2 * t) * 255);
      after[p] = out[q + 3] >= 128 ? 1 : 0;
      if (data[q + 3] === 0 && out[q + 3] > 0 && total) {
        out[q] = red / total;
        out[q + 1] = green / total;
        out[q + 2] = blue / total;
      }
    }
  const a = cutMaskTopology(before, w, h),
    b = cutMaskTopology(after, w, h);
  return a.pieces === b.pieces && a.holes === b.holes
    ? out
    : new Uint8ClampedArray(data);
}
