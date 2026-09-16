type Point = { x: number; y: number };
export function polygonArea(points: Point[]) {
  return points.reduce((sum, p, i) => { const next = points[(i + 1) % points.length]; return sum + p.x * next.y - next.x * p.y; }, 0) / 2;
}
export function containsPoint(points: Point[], point: Point) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside = !inside;
  }
  return inside;
}
// Sampling is used only to identify holes and their area. Retained SVG commands
// are copied verbatim: no rasterization, fitting, rounding or frame changes.
export function fillVectorGaps(raw: string, widthCm: number, heightCm: number, limitMm: number | "all") {
  if (limitMm !== "all" && limitMm <= 0) return raw;
  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid SVG");
  const root = doc.documentElement;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none";
  const live = document.importNode(root, true) as unknown as SVGSVGElement;
  host.append(live); document.body.append(host);
  try {
    const bounds = live.getBoundingClientRect();
    for (const path of Array.from(live.querySelectorAll("path"))) {
      const d = path.getAttribute("d") ?? "";
      const parts = d.match(/[Mm][^Mm]*/g);
      // Relative moveto depends on the preceding subpath's position. Fail safe
      // rather than detach or rewrite native geometry with that dependency.
      if (!parts || parts.length < 2 || parts.some(p => p[0] !== "M" || !/[zZ]\s*$/.test(p))) continue;
      const matrix = path.getCTM();
      if (!matrix) continue;
      const entries = parts.map(part => {
        const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
        probe.setAttribute("d", part);
        const length = probe.getTotalLength(), count = Math.min(12000, Math.max(64, Math.ceil(length * 2)));
        const points = Array.from({ length: count }, (_, i) => {
          const point = probe.getPointAtLength(length * i / count);
          return { x: matrix.a*point.x+matrix.c*point.y+matrix.e, y: matrix.b*point.x+matrix.d*point.y+matrix.f };
        });
        return { part, points, area: polygonArea(points) };
      });
      const evenOdd = getComputedStyle(path).fillRule === "evenodd";
      const selected = entries.filter(entry => {
        const parents = entries.filter(other => other !== entry && Math.abs(other.area) > Math.abs(entry.area) && containsPoint(other.points, entry.points[0]));
        const hole = evenOdd ? parents.length % 2 === 1 : parents.length > 0 && parents.reduce((sum, p) => sum + Math.sign(p.area), Math.sign(entry.area)) === 0;
        const areaMm = Math.abs(entry.area) / Math.max(bounds.width*bounds.height, 1e-12) * widthCm*heightCm*100;
        return hole && (limitMm === "all" || areaMm <= limitMm*limitMm);
      });
      if (!selected.length) continue;
      path.setAttribute("d", entries.filter(entry => !selected.some(hole => hole === entry || Math.abs(hole.area) > Math.abs(entry.area) && containsPoint(hole.points, entry.points[0]))).map(entry => entry.part).join(""));
    }
    return new XMLSerializer().serializeToString(live);
  } finally { host.remove(); }
}
