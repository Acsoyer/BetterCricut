export type CutContourProfile = "detailed" | "smooth";

export const cutContourOptions = (profile?: CutContourProfile) => ({
  turnpolicy: "minority" as const,
  turdsize: 0,
  alphamax: 1,
  optcurve: true,
  opttolerance:
    profile === "smooth" ? 1.5 : profile === "detailed" ? 0.5 : 0.12,
});

// Count connected foreground pieces and enclosed holes before accepting any
// display/creation cleanup. Thin islands and letter counters must not vanish.
export function cutMaskTopology(
  mask: Uint8Array,
  width: number,
  height: number,
) {
  const seen = new Uint8Array(mask.length),
    queue = new Int32Array(mask.length);
  let pieces = 0,
    holes = 0;
  for (let seed = 0; seed < mask.length; seed++) {
    if (seen[seed]) continue;
    const foreground = mask[seed];
    let head = 0,
      tail = 1,
      edge = false;
    queue[0] = seed;
    seen[seed] = 1;
    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = Math.floor(p / width);
      if (!x || !y || x === width - 1 || y === height - 1) edge = true;
      for (const n of [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ]) {
        if (n >= 0 && !seen[n] && mask[n] === foreground) {
          seen[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    if (foreground) pieces++;
    else if (!edge) holes++;
  }
  return { pieces, holes };
}

export function prepareCutContour(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  profile?: CutContourProfile,
) {
  const original = new Uint8Array(width * height);
  for (let p = 0; p < original.length; p++)
    original[p] = data[p * 4 + 3] >= (profile ? 128 : 96) ? 1 : 0;
  if (!profile) return original;
  let alpha = Float32Array.from(original, (_, p) => data[p * 4 + 3] / 255),
    passes = 2;
  const strength = 1;
  while (passes--) {
    const next = new Float32Array(alpha.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < width && ny < height)
              sum +=
                alpha[ny * width + nx] *
                (dx === 0 ? 2 : 1) *
                (dy === 0 ? 2 : 1);
          }
        next[p] = alpha[p] * (1 - strength) + (sum / 16) * strength;
      }
    alpha = next;
  }
  // Calibrate the smoothed isocontour to the original foreground coverage.
  // This removes an outward bias without an unconditional erosion that could
  // destroy thin strokes. The topology guard below still has the final say.
  const originalArea = original.reduce((sum, value) => sum + value, 0);
  let threshold = .5;
  const count = (level: number) => alpha.reduce((sum, value) => sum + (value >= level ? 1 : 0), 0);
  if (count(threshold) > originalArea) {
    let low = .5, high = .65;
    if (count(high) > originalArea) return original;
    for (let step = 0; step < 12; step++) {
      const middle = (low + high) / 2;
      if (count(middle) > originalArea) low = middle;
      else high = middle;
    }
    threshold = high;
  }
  const cleaned = Uint8Array.from(alpha, (value) => (value >= threshold ? 1 : 0));
  const before = cutMaskTopology(original, width, height),
    after = cutMaskTopology(cleaned, width, height);
  return before.pieces === after.pieces && before.holes === after.holes
    ? cleaned
    : original;
}
