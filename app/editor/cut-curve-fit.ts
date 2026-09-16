import type { Path } from "@cadit-app/potrace-ts";
import type { CutContourProfile } from "./cut-contour";
import { cleanContourPoints } from "./cut-contour-denoise";

type P = { x: number; y: number };
type Cubic = [P, P, P, P];
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: P, n: number): P => ({ x: a.x * n, y: a.y * n });
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y;
const norm = (a: P): P => mul(a, 1 / (Math.hypot(a.x, a.y) || 1));
const distance = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
export function cubicPoint(c: Cubic, t: number): P {
  const u = 1 - t;
  return add(
    add(mul(c[0], u * u * u), mul(c[1], 3 * u * u * t)),
    add(mul(c[2], 3 * u * t * t), mul(c[3], t * t * t)),
  );
}

// Fit the actual bitmap contour, not Potrace's already stair-stepped cubics.
// Chord-parameter least squares with bounded error; recursive splits retain
// real detail rather than replacing everything with a heavily blurred mask.
export function fitContourSpan(
  points: P[],
  tolerance: number,
  depth = 0,
): Cubic[] {
  const first = points[0],
    last = points[points.length - 1],
    n = points.length;
  let minX = first.x,
    maxX = first.x,
    minY = first.y,
    maxY = first.y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const u = [0];
  for (let i = 1; i < n; i++)
    u[i] = u[i - 1] + distance(points[i], points[i - 1]);
  const length = u[n - 1] || 1;
  for (let i = 1; i < n; i++) u[i] /= length;
  let curve: Cubic = [first, first, last, last],
    error = 0,
    split = Math.floor(n / 2);
  for (let iteration = 0; iteration < 5; iteration++) {
    let aa = 0,
      ab = 0,
      bb = 0,
      ax = 0,
      ay = 0,
      bx = 0,
      by = 0;
    for (let i = 0; i < n; i++) {
      const t = u[i],
        s = 1 - t,
        b0 = s * s * s,
        b1 = 3 * s * s * t,
        b2 = 3 * s * t * t,
        b3 = t * t * t;
      const r = sub(points[i], add(mul(first, b0), mul(last, b3)));
      aa += b1 * b1;
      ab += b1 * b2;
      bb += b2 * b2;
      ax += b1 * r.x;
      ay += b1 * r.y;
      bx += b2 * r.x;
      by += b2 * r.y;
    }
    const det = aa * bb - ab * ab;
    if (det > 1e-12) {
      curve = [
        first,
        { x: (ax * bb - bx * ab) / det, y: (ay * bb - by * ab) / det },
        { x: (bx * aa - ax * ab) / det, y: (by * aa - ay * ab) / det },
        last,
      ];
    } else
      curve = [
        first,
        add(first, mul(sub(last, first), 1 / 3)),
        add(first, mul(sub(last, first), 2 / 3)),
        last,
      ];
    // Keep extrema inside the source contour bounds: no viewport clipping
    // may flatten an otherwise curved edge.
    for (const p of [curve[1], curve[2]]) {
      p.x = Math.max(minX, Math.min(maxX, p.x));
      p.y = Math.max(minY, Math.min(maxY, p.y));
    }
    error = 0;
    split = Math.floor(n / 2);
    for (let i = 1; i < n - 1; i++) {
      const e = distance(cubicPoint(curve, u[i]), points[i]);
      if (e > error) {
        error = e;
        split = i;
      }
    }
    if (error <= tolerance || n <= 2) return [curve];
    // Chord distance on pixel stairs is not curve distance. Refine parameters
    // onto the fitted curve before concluding that another node is necessary.
    const refined = [...u];
    for (let i = 1; i < n - 1; i++) {
      const t = u[i],
        v = 1 - t,
        d = sub(cubicPoint(curve, t), points[i]);
      const d1 = add(
        add(
          mul(sub(curve[1], curve[0]), 3 * v * v),
          mul(sub(curve[2], curve[1]), 6 * v * t),
        ),
        mul(sub(curve[3], curve[2]), 3 * t * t),
      );
      const d2 = add(
        mul(add(sub(curve[2], mul(curve[1], 2)), curve[0]), 6 * v),
        mul(add(sub(curve[3], mul(curve[2], 2)), curve[1]), 6 * t),
      );
      const denominator = dot(d1, d1) + dot(d, d2);
      if (Math.abs(denominator) > 1e-10)
        refined[i] = Math.max(
          u[i - 1],
          Math.min(u[i + 1], t - dot(d, d1) / denominator),
        );
    }
    for (let i = 1; i < n - 1; i++) u[i] = refined[i];
  }
  // A depth guard must not silently accept a distorted curve.
  if (depth >= 32)
    return points
      .slice(1)
      .map(
        (p, i) =>
          [
            points[i],
            add(points[i], mul(sub(p, points[i]), 1 / 3)),
            add(points[i], mul(sub(p, points[i]), 2 / 3)),
            p,
          ] as Cubic,
      );
  return [
    ...fitContourSpan(points.slice(0, split + 1), tolerance, depth + 1),
    ...fitContourSpan(points.slice(split), tolerance, depth + 1),
  ];
}

export function fitClosedContour(points: P[], tolerance: number): Cubic[] {
  const n = points.length;
  if (n < 4) return [];
  const anchors = new Set<number>();
  // Extrema fix placement/bounds and avoid an arbitrary seam on a smooth arc.
  for (const key of ["x", "y"] as const)
    for (const sign of [-1, 1]) {
      let best = 0;
      for (let i = 1; i < n; i++)
        if (points[i][key] * sign > points[best][key] * sign) best = i;
      anchors.add(best);
    }
  const window = Math.min(
    Math.floor(n / 8),
    Math.max(3, Math.round(tolerance * 6)),
  );
  const turns = points.map((p, i) => {
    const a = norm(sub(p, points[(i - window + n) % n])),
      b = norm(sub(points[(i + window) % n], p));
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  });
  // Preserve genuine corners, but not one-pixel horizontal/vertical steps.
  for (let i = 0; i < n; i++)
    if (turns[i] > 0.95) {
      let peak = true;
      for (let j = 1; j <= window; j++)
        if (
          turns[(i - j + n) % n] >= turns[i] ||
          turns[(i + j) % n] > turns[i]
        ) {
          peak = false;
          break;
        }
      if (peak) anchors.add(i);
    }
  const sorted = [...anchors].sort((a, b) => a - b),
    curves: Cubic[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i],
      end = sorted[(i + 1) % sorted.length],
      span: P[] = [points[start]];
    for (let j = (start + 1) % n; j !== end; j = (j + 1) % n)
      span.push(points[j]);
    span.push(points[end]);
    curves.push(...fitContourSpan(span, tolerance));
  }
  return curves;
}

function contourCrosses(curves: Cubic[]): boolean {
  const line: P[] = [];
  for (const c of curves) {
    const length =
        distance(c[0], c[1]) + distance(c[1], c[2]) + distance(c[2], c[3]),
      steps = Math.max(4, Math.min(64, Math.ceil(length / 4)));
    for (let i = 0; i < steps; i++) line.push(cubicPoint(c, i / steps));
  }
  const buckets = new Map<string, number[]>(),
    n = line.length;
  const cross = (a: P, b: P, c: P) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < n; i++) {
    const a = line[i],
      b = line[(i + 1) % n],
      checked = new Set<number>();
    for (
      let x = Math.floor(Math.min(a.x, b.x) / 16);
      x <= Math.floor(Math.max(a.x, b.x) / 16);
      x++
    )
      for (
        let y = Math.floor(Math.min(a.y, b.y) / 16);
        y <= Math.floor(Math.max(a.y, b.y) / 16);
        y++
      ) {
        const key = `${x},${y}`,
          list = buckets.get(key) || [];
        for (const j of list) {
          if (checked.has(j) || i - j <= 1 || (i === n - 1 && j === 0))
            continue;
          checked.add(j);
          const c = line[j],
            d = line[(j + 1) % n];
          if (
            cross(a, b, c) * cross(a, b, d) < -1e-9 &&
            cross(c, d, a) * cross(c, d, b) < -1e-9
          )
            return true;
        }
        list.push(i);
        buckets.set(key, list);
      }
  }
  return false;
}

const FIT_ERROR = { smooth: 1.6, detailed: 0.55 };
export function detailedRecoveryScales() {
  const fine = FIT_ERROR.detailed,
    coarse = FIT_ERROR.smooth;
  return [
    0.7,
    0.85,
    1,
    1.15,
    1.3,
    coarse,
    coarse * 0.9,
    coarse * 0.8,
    coarse * 0.7,
  ].map((error) => error / fine);
}

export function fittedCutSvg(
  paths: Path[],
  profile: CutContourProfile,
  pixelScale = 1,
  toleranceScale = 1,
): string {
  // Tolerance is expressed in original image pixels, not upsampled pixels.
  const tolerance = FIT_ERROR[profile] * pixelScale * toleranceScale;
  const num = (n: number) => Number(n.toFixed(3)),
    coord = (p: P) => `${num(p.x)} ${num(p.y)}`;
  const d = paths
    .map((path) => {
      const contour = cleanContourPoints(path.points, pixelScale);
      let curves = fitClosedContour(contour, tolerance);
      for (const factor of [0.85, 0.7, 0.5, 0.25]) {
        if (!contourCrosses(curves)) break;
        curves = fitClosedContour(contour, tolerance * factor);
      }
      if (contourCrosses(curves))
        return `M ${contour.map(coord).join(" L ")} Z`;
      if (!curves.length)
        throw new Error("An incomplete cut contour was traced");
      return (
        `M ${coord(curves[0][0])} ` +
        curves
          .map((c) => `C ${coord(c[1])} ${coord(c[2])} ${coord(c[3])}`)
          .join(" ") +
        " Z"
      );
    })
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg"><path fill="black" fill-rule="evenodd" d="${d}"/></svg>`;
}
