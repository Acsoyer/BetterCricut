export type GapPoint = { x: number; y: number };
// Inspect M/L/C/Z geometry directly rather than repeatedly asking the browser
// to traverse the entire Bezier path for thousands of length queries.
// These samples are never used to write the output path.
export function sampleGapContour(part: string, tolerance = .05): GapPoint[] | null {
  if (/[a-bd-kno-z]/i.test(part.replace(/[MmLlCcZzEe]/g, ""))) return null;
  const tokens = part.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const points: GapPoint[] = [];
  let index = 0, command = "", current = { x: 0, y: 0 };
  const number = () => Number(tokens[index++]);
  const midpoint = (a: GapPoint, b: GapPoint) => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 });
  const cubic = (a: GapPoint, b: GapPoint, c: GapPoint, d: GapPoint, depth: number) => {
    const dx = d.x-a.x, dy = d.y-a.y, length = Math.hypot(dx,dy);
    const distance = (p: GapPoint) => length ? Math.abs(dx*(a.y-p.y)-(a.x-p.x)*dy)/length : Math.hypot(p.x-a.x,p.y-a.y);
    const excess = Math.hypot(b.x-a.x,b.y-a.y)+Math.hypot(c.x-b.x,c.y-b.y)+Math.hypot(d.x-c.x,d.y-c.y)-length;
    if (depth >= 14 || Math.max(distance(b),distance(c),excess) <= tolerance) { points.push(d); return; }
    const ab=midpoint(a,b), bc=midpoint(b,c), cd=midpoint(c,d), abc=midpoint(ab,bc), bcd=midpoint(bc,cd), center=midpoint(abc,bcd);
    cubic(a,ab,abc,center,depth+1); cubic(center,bcd,cd,d,depth+1);
  };
  while (index < tokens.length) {
    if (/^[a-z]$/i.test(tokens[index])) command=tokens[index++];
    if (command === "Z" || command === "z") { command=""; continue; }
    // Unsupported commands use the bounded, cooperative browser fallback.
    if (!["M","L","C"].includes(command)) return null;
    const needed=command === "C"?6:2;
    if (index+needed>tokens.length || tokens.slice(index,index+needed).some(v=>!Number.isFinite(Number(v)))) return null;
    if (command === "C") {
      const b={x:number(),y:number()}, c={x:number(),y:number()}, d={x:number(),y:number()};
      cubic(current,b,c,d,0); current=d;
    } else { current={x:number(),y:number()}; points.push(current); if(command === "M") command="L"; }
  }
  return points.length >= 3 ? points : null;
}

export function gapBounds(points: GapPoint[]) {
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for(const p of points) { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); }
  return {minX,minY,maxX,maxY};
}
