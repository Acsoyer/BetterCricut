type P = { x: number; y: number };

// Both quality modes share a subpixel noise floor. Detail means real shape
// variation, not horizontal/vertical pixel steps or interpolation noise.
export function cleanContourPoints(points: P[], pixelScale: number): P[] {
  const n = points.length,
    scale = Math.max(0.1, pixelScale);
  if (n < 40 * scale) return points;
  const anchors = new Set<number>(),
    distance = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const key of ["x", "y"] as const)
    for (const sign of [-1, 1]) {
      let best = 0;
      for (let i = 1; i < n; i++)
        if (points[i][key] * sign > points[best][key] * sign) best = i;
      anchors.add(best);
    }
  const window = Math.min(
    Math.floor(n / 8),
    Math.max(4, Math.round(scale * 6)),
  );
  const angles = points.map((p, i) => {
    const a = points[(i - window + n) % n],
      b = points[(i + window) % n],
      ax = p.x - a.x,
      ay = p.y - a.y,
      bx = b.x - p.x,
      by = b.y - p.y;
    return Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1),
        ),
      ),
    );
  });
  for (let i = 0; i < n; i++)
    if (angles[i] > 0.95) {
      let peak = true;
      for (let j = 1; j <= window; j++)
        if (
          angles[(i - j + n) % n] >= angles[i] ||
          angles[(i + j) % n] > angles[i]
        ) {
          peak = false;
          break;
        }
      if (peak) anchors.add(i);
    }
  const radius = Math.max(2, Math.round(scale * 3)),
    protectedPoints = new Set<number>(anchors);
  for (const a of anchors)
    if (angles[a] > 0.95)
      for (let d = -radius; d <= radius; d++)
        protectedPoints.add((a + d + n) % n);
  const filtered = points.map((p, i) => {
    if (protectedPoints.has(i)) return p;
    let x = 0,
      y = 0,
      total = 0;
    for (let d = -radius; d <= radius; d++) {
      const weight = radius + 1 - Math.abs(d),
        q = points[(i + d + n) % n];
      x += q.x * weight;
      y += q.y * weight;
      total += weight;
    }
    const q = { x: x / total, y: y / total },
      delta = distance(p, q),
      blend = Math.min(1, (0.6 * scale) / (delta || 1));
    return { x: p.x + (q.x - p.x) * blend, y: p.y + (q.y - p.y) * blend };
  });
  // Fixed, subpixel RDP cleanup bounds the input complexity even when a
  // difficult contour requires tighter fitting. Never fall back to fitting
  // every original raster sample at arbitrarily tiny error tolerances.
  const keep = new Uint8Array(n),
    sorted = [...anchors].sort((a, b) => a - b),
    tolerance = 0.18 * scale;
  for (let k = 0; k < sorted.length; k++) {
    const start = sorted[k],
      end = sorted[(k + 1) % sorted.length],
      indices = [start];
    for (let i = (start + 1) % n; i !== end; i = (i + 1) % n) indices.push(i);
    indices.push(end);
    const stack: Array<[number, number]> = [[0, indices.length - 1]];
    keep[start] = keep[end] = 1;
    while (stack.length) {
      const [lo, hi] = stack.pop()!,
        a = filtered[indices[lo]],
        b = filtered[indices[hi]],
        dx = b.x - a.x,
        dy = b.y - a.y,
        length = dx * dx + dy * dy;
      let error = tolerance * tolerance,
        split = -1;
      for (let j = lo + 1; j < hi; j++) {
        const p = filtered[indices[j]],
          t = length
            ? Math.max(
                0,
                Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length),
              )
            : 0;
        const e = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
        if (e > error) {
          error = e;
          split = j;
        }
      }
      if (split >= 0) {
        keep[indices[split]] = 1;
        stack.push([lo, split], [split, hi]);
      }
    }
  }
  return filtered.filter((_, i) => keep[i]);
}
