import type paper from "paper";
type Stroke = { tool: string; brush: number; points: { x: number; y: number }[] };
export function editableVectorPaths(item: paper.Item): paper.PathItem[] {
  const paths: paper.PathItem[]=[];
  const visit=(node: paper.Item) => {
    if(node.clipMask) return;
    if(node.className === "Path" || node.className === "CompoundPath") { paths.push(node as paper.PathItem); return; }
    if(node.className === "Shape") { paths.push((node as paper.Shape).toPath(false)); return; }
    for(const child of node.children ?? []) visit(child);
  };
  visit(item);return paths;
}
export async function localVectorEdit(raw: string, width: number, height: number, strokes: Stroke[], color: string, smoothed?: string) {
  const library = (await import("paper")).default;
  const scope = new library.PaperScope(); scope.setup(new scope.Size(width,height));
  const importShape = (source: string, padded: boolean) => {
    scope.activate();
    const doc=new DOMParser().parseFromString(source,"image/svg+xml"), root=doc.documentElement;
    root.setAttribute("width",String(width*(padded?1.2:1))); root.setAttribute("height",String(height*(padded?1.2:1)));
    const item=scope.project.importSVG(root as unknown as SVGElement,{insert:false,applyMatrix:true});
    if(padded) item.translate(new scope.Point(-width*.1,-height*.1));
    const paths=editableVectorPaths(item);
    if(!paths.length) throw new Error("No editable vector paths found");
    let combined=paths[0];
    for(const path of paths.slice(1)) combined=combined.unite(path,{insert:false});
    combined.strokeColor=null; return combined;
  };
  try {
    let shape=importShape(raw,false);
    const disk=(p: {x:number;y:number},radius:number) => new scope.Path.Circle({center:[p.x*width,p.y*height],radius,insert:false});
    const region=(stroke: Stroke) => {
      const radius=stroke.brush/200*Math.min(width,height);
      if(stroke.tool === "rectangle") {
        const a=stroke.points[0], b=stroke.points.at(-1)!;
        return new scope.Path.Rectangle({from:[Math.min(a.x,b.x)*width,Math.min(a.y,b.y)*height],to:[Math.max(a.x,b.x)*width,Math.max(a.y,b.y)*height],insert:false});
      }
      if(stroke.tool === "lasso") return new scope.Path({segments:stroke.points.map(p=>[p.x*width,p.y*height]),closed:true,insert:false});
      let area: paper.PathItem=disk(stroke.points[0],radius);
      for(let i=1;i<stroke.points.length;i++) {
        const a=stroke.points[i-1], b=stroke.points[i], dx=(b.x-a.x)*width, dy=(b.y-a.y)*height, length=Math.hypot(dx,dy);
        if(length>0) {
          const nx=-dy/length*radius, ny=dx/length*radius;
          const quad=new scope.Path({segments:[[a.x*width+nx,a.y*height+ny],[b.x*width+nx,b.y*height+ny],[b.x*width-nx,b.y*height-ny],[a.x*width-nx,a.y*height-ny]],closed:true,insert:false});
          area=area.unite(quad,{insert:false}).unite(disk(b,radius),{insert:false});
        }
      }
      return area;
    };
    for(const stroke of strokes) {
      scope.activate();
      if(!stroke.points.length || stroke.tool === "smooth") continue;
      const area=region(stroke);
      shape=stroke.tool === "bridge" ? shape.unite(area,{insert:false}) : shape.subtract(area,{insert:false});
      await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
    if(smoothed) {
      const corrected=importShape(smoothed,true);
      for(const stroke of strokes.filter(s=>s.tool === "smooth" && s.points.length)) {
        const area=region(stroke);
        shape=shape.subtract(area,{insert:false}).unite(corrected.intersect(area,{insert:false}),{insert:false});
      }
    }
    // Boolean operations split only intersected curves; untouched Bezier
    // segments retain their original handles. No whole-contour simplification.
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width*1.2}" height="${height*1.2}" viewBox="${-width*.1} ${-height*.1} ${width*1.2} ${height*1.2}"><path fill="${color}" fill-rule="${shape.fillRule}" d="${(shape as paper.PathItem & { getPathData(matrix: undefined, precision: number): string }).getPathData(undefined, 12)}"/></svg>`;
  } finally { (scope as paper.PaperScope & { remove(): void }).remove(); }
}

export function reframeVector(raw: string, left: number, top: number, width: number, height: number) {
  const doc=new DOMParser().parseFromString(raw,"image/svg+xml"), root=doc.documentElement;
  const box=(root.getAttribute("viewBox") ?? "0 0 1 1").trim().split(/[ ,]+/).map(Number);
  root.setAttribute("viewBox",`${box[0]+box[2]*left} ${box[1]+box[3]*top} ${box[2]*width} ${box[3]*height}`);
  root.setAttribute("width",String(Number(root.getAttribute("width"))*width)); root.setAttribute("height",String(Number(root.getAttribute("height"))*height));
  return new XMLSerializer().serializeToString(root);
}
