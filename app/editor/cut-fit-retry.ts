// Increase the permitted curve count fourfold after every unsuccessful fit.
// A finite raster has finite detail: exact boundary paths are the terminal
// success case, rather than an unbounded UI-blocking retry loop.
export function cutFitRetryPlan(initialSegments: number) {
  return [
    1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.35, 0.25, 0.125, 0.0625, 0.03125, 0.015625,
  ].map((scale, index) => ({
    scale,
    budget: Math.max(4, initialSegments) * 4 ** index,
  }));
}

// Trace only exposed pixel boundaries, never rectangle runs with internal
// cutting edges. Right-turn priority keeps diagonally touching pieces apart.
export function losslessCutMaskSvg(
  mask: Uint8Array,
  width: number,
  height: number,
  pad = 0,
) {
  type Edge = { end: number; dir: number; used: boolean };
  const stride = width + 1,
    edges = new Map<number, Edge[]>();
  const add = (start: number, end: number, dir: number) => {
    const list = edges.get(start) || [];
    list.push({ end, dir, used: false });
    edges.set(start, list);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p]) continue;
      const a = y * stride + x,
        b = a + 1,
        c = b + stride,
        d = a + stride;
      if (!y || !mask[p - width]) add(a, b, 0);
      if (x === width - 1 || !mask[p + 1]) add(b, c, 1);
      if (y === height - 1 || !mask[p + width]) add(c, d, 2);
      if (!x || !mask[p - 1]) add(d, a, 3);
    }
  const coord = (p: number) =>
      `${(p % stride) + pad} ${Math.floor(p / stride) + pad}`,
    paths: string[] = [];
  for (const [start, list] of edges)
    for (const seed of list) {
      if (seed.used) continue;
      const points = [start];
      let current = seed,
        previousDir = -1;
      while (!current.used) {
        current.used = true;
        if (previousDir === current.dir && points.length > 1)
          points[points.length - 1] = current.end;
        else points.push(current.end);
        previousDir = current.dir;
        if (current.end === start) break;
        const available = (edges.get(current.end) || []).filter((e) => !e.used);
        const next = [1, 0, 3, 2]
          .map((turn) =>
            available.find((e) => e.dir === (current.dir + turn) % 4),
          )
          .find(Boolean);
        if (!next) throw new Error("An incomplete pixel boundary was found");
        current = next;
      }
      if (points.at(-1) !== start)
        throw new Error("An open pixel boundary was found");
      paths.push(
        `M ${coord(start)} ` +
          points
            .slice(1)
            .map((p, i) => `C ${coord(points[i])} ${coord(p)} ${coord(p)}`)
            .join(" ") +
          " Z",
      );
    }
  return `<svg xmlns="http://www.w3.org/2000/svg"><path fill="black" fill-rule="evenodd" d="${paths.join(" ")}"/></svg>`;
}
