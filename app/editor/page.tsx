"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs, react-hooks/purity */
import {
  ChangeEvent,
  PointerEvent as RPointer,
  WheelEvent as RWheel,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlignVerticalJustifyCenter,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlertTriangle,
  ChevronDown,
  Copy,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  FileImage,
  ImagePlus,
  GripVertical,
  Grid3X3,
  Link as LinkIcon,
  Link2Off,
  Maximize2,
  Palette,
  Pipette,
  Plus,
  RotateCw,
  Ruler,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  User,
  FolderOpen,
  Image as ImageIcon,
  LogOut,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getSVG, traceCanvas } from "@cadit-app/potrace-ts";
import {
  faStar,faHeart,faArrowRight,faBolt,faBurst,faCloud,faMoon,faSun,faDiamond,
  faShield,faDroplet,faLeaf,faCrown,faBell,faGift,faTag,faBookmark,
  faLocationPin,faComment,faPuzzlePiece,
} from "@fortawesome/free-solid-svg-icons";
const PORTRAIT = { w: 21, h: 29.7 },
  PPCM = 34,
  DPI = 150,
  DARK = "#3c4144";
const COLORS = [
  "#EF9999",
  "#CF93DA",
  "#9DA8DB",
  "#90CAF8",
  "#A5D6A7",
  "#FEF59C",
  "#FFCC80",
  "#F53636",
  "#9928B1",
  "#3F51B5",
  "#2296F3",
  "#4DAF50",
  "#FFEC3C",
  "#FF9702",
  "#B71B1B",
  "#49148B",
  "#1B237E",
  "#0E47A0",
  "#1D5E21",
  "#FAC02E",
  "#E65002",
  "#FFFFFF",
  "#CCCCCC",
  "#999999",
  "#666666",
  "#333333",
  "#000000",
  "#8E5609",
];
const CUSTOM_SHAPES = [
  ["Star",faStar],["Heart",faHeart],["Arrow",faArrowRight],["Bolt",faBolt],["Burst",faBurst],
  ["Cloud",faCloud],["Moon",faMoon],["Sun",faSun],["Diamond",faDiamond],["Shield",faShield],
  ["Drop",faDroplet],["Leaf",faLeaf],["Crown",faCrown],["Bell",faBell],["Gift",faGift],
  ["Tag",faTag],["Bookmark",faBookmark],["Pin",faLocationPin],["Bubble",faComment],["Puzzle",faPuzzlePiece],
] as const;
const nativeShapeSvg = (viewBox:string, body:string, color:string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="${viewBox}" preserveAspectRatio="none" fill="${color}" stroke="#141715" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision" style="paint-order:stroke fill">${body}</svg>`)}`;
const shapeSource = (name:string,color:string) => {
  if(name==="circle") return nativeShapeSvg("-3 -3 106 106",`<ellipse cx="50" cy="50" rx="49" ry="49"/>`,color);
  if(name==="rectangle") return nativeShapeSvg("-3 -3 106 106",`<rect x="1" y="1" width="98" height="98"/>`,color);
  if(name==="triangle") return nativeShapeSvg("-3 -3 106 106",`<path d="M50 1 99 99H1Z"/>`,color);
  const found=CUSTOM_SHAPES.find(([label])=>label===name),icon=found?.[1];
  if(!icon)return "";const [w,h,, ,path]=icon.icon,paths=Array.isArray(path)?path.map(d=>`<path d="${d}"/>`).join(""):`<path d="${path}"/>`;
  const pad=Math.max(w,h)*.025;
  return nativeShapeSvg(`${-pad} ${-pad} ${w+pad*2} ${h+pad*2}`,paths,color);
};
type Kind = "original" | "nobg" | "stroke" | "acetate" | "vector";
type LayerStep = {
  id: string;
  type: "remove-bg" | "cutout" | "stroke" | "fill-gaps" | "acetate" | "edit-image" | "optimize-alpha";
  label: string;
  locked?: boolean;
  snapshot: Pick<
    Layer,
    | "src"
    | "x"
    | "y"
    | "w"
    | "h"
    | "kind"
    | "color"
    | "strokeCm"
    | "fillGapsMm"
    | "acetateOn"
  >;
};
type Layer = {
  id: string;
  name: string;
  src: string;
  originalSrc: string;
  visible: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  naturalW: number;
  naturalH: number;
  kind: Kind;
  strokeCm: number;
  fillGapsMm: number;
  invalid: boolean;
  rotation: number;
  color: string;
  parentId?: string;
  innerSrc?: string;
  steps: LayerStep[];
  activeStep: number;
  acetateOn: boolean;
};
type SavedProject = {
  id: string;
  name: string;
  updated_at: string;
  data: { layers: Layer[]; landscape: boolean; pageMode?: PageMode; safeMargin: number };
};
type PageMode = "portrait" | "landscape" | "full";
type Drag = {
  mode: string;
  sx: number;
  sy: number;
  start: Layer[];
  box: { x: number; y: number; w: number; h: number };
  angle0?: number;
  cx?: number;
  cy?: number;
} | null;
type BgPoint = { x: number; y: number; mode: "remove" | "keep" };
type BgStroke = {
  id: string;
  mode: "remove" | "keep";
  brush: number;
  bleed: number;
  reach: number | null;
  points: Omit<BgPoint, "mode">[];
};
type EraseColor = { color: string | null; sensitivity: number };
type BgEditor = {
  layerId: string;
  source: string;
  strokes: BgStroke[];
  mode: "remove" | "keep";
  brush: number;
  sensitivity: number;
  connectedReach: number;
  alphaView: boolean;
  zoom: number;
  panX: number;
  panY: number;
  speckles: number;
  edgeRefine: number;
  edgeSmooth: number;
  optimizeAlpha: boolean;
  eraseColors: EraseColor[];
  pickingColor: number | null;
};
type ImageEditTool = "crop" | "erase" | "lasso";
type ImageEditStroke = { id:string; tool:Exclude<ImageEditTool,"crop">; brush:number; points:{x:number;y:number}[] };
type ImageEditState = { source:string; offsetX:number; offsetY:number; widthScale:number; heightScale:number };
type ImageEditor = ImageEditState & { layerId:string; crop:{left:number;top:number;right:number;bottom:number}; upscale:1|2|3; tool:ImageEditTool; brush:number; strokes:ImageEditStroke[]; history:ImageEditState[] };
type EditTool = "bridge" | "erase" | "lasso" | "rectangle" | "smooth";
type EditStroke = { id: string; tool: EditTool; brush: number; points: { x: number; y: number }[] };
type CutoutEditor = {
  layerId: string;
  source: string;
  color: string;
  tool: EditTool;
  brush: number;
  strokes: EditStroke[];
  crop: { left: number; top: number; right: number; bottom: number };
  zoom: number;
  panX: number;
  panY: number;
};
const uid = () => Math.random().toString(36).slice(2, 10),
  clean = (n: string) => n.replace(/\.[^/.]+$/, "") || "Layer",
  fmt = (n: number) =>
    n.toLocaleString("tr-TR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const save = (url: string, name: string) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  if (url.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const getImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = no;
    i.src = src;
  });
async function removeBg(src: string, tolerance = 46) {
  const img = await getImage(src),
    max = 1400,
    s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)),
    w = Math.max(1, Math.round(img.naturalWidth * s)),
    h = Math.max(1, Math.round(img.naturalHeight * s)),
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h),
    p = [0, (w - 1) * 4, (h - 1) * w * 4, (w * h - 1) * 4],
    cornerAlpha = p.reduce((sum, q) => sum + d.data[q + 3], 0) / p.length,
    bg = p
      .reduce(
        (a, q) => [
          a[0] + d.data[q],
          a[1] + d.data[q + 1],
          a[2] + d.data[q + 2],
        ],
        [0, 0, 0],
      )
      .map((v) => v / 4);
  const alreadyTransparent = cornerAlpha < 80;
  for (let i = 0; i < w * h; i++) {
    const q = i * 4,
      dist = Math.hypot(
        d.data[q] - bg[0],
        d.data[q + 1] - bg[1],
        d.data[q + 2] - bg[2],
      );
    // Cricut geometry must be binary: never leave a semi-transparent fringe.
    d.data[q + 3] = alreadyTransparent
      ? d.data[q + 3] < 128 ? 0 : 255
      : dist <= tolerance + 12 ? 0 : 255;
  }
  // Remove tiny disconnected foreground islands (halo dust) while preserving
  // every meaningful connected part of the artwork.
  const seen = new Uint8Array(w * h),
    minIslandArea = Math.max(6, Math.round((w * h) / 180000)),
    queue = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || d.data[start * 4 + 3] === 0) continue;
    let head = 0,
      tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const at = queue[head++],
        px = at % w,
        py = (at / w) | 0,
        neighbors = [at - 1, at + 1, at - w, at + w];
      for (let n = 0; n < 4; n++) {
        const next = neighbors[n];
        if (
          next < 0 || next >= w * h || seen[next] ||
          (n === 0 && px === 0) || (n === 1 && px === w - 1) ||
          (n === 2 && py === 0) || (n === 3 && py === h - 1) ||
          d.data[next * 4 + 3] === 0
        ) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
    if (tail <= minIslandArea)
      for (let i = 0; i < tail; i++) d.data[queue[i] * 4 + 3] = 0;
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL();
}
async function optimizeAlphaChannel(src:string){
  const img=await getImage(src),c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;
  const x=c.getContext("2d")!;x.drawImage(img,0,0);const data=x.getImageData(0,0,c.width,c.height),count=c.width*c.height,
    source=new Uint8ClampedArray(data.data),alpha=new Uint8Array(count);
  for(let i=0;i<count;i++)alpha[i]=source[i*4+3]>=128?1:0;
  // A conservative majority pass removes one-pixel edge chatter without rounding real corners.
  const settled=new Uint8Array(alpha);
  for(let py=1;py<c.height-1;py++)for(let px=1;px<c.width-1;px++){
    const at=py*c.width+px;let opaque=0;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++)if(ox||oy)opaque+=alpha[at+oy*c.width+ox];
    if(alpha[at]&&opaque<=2)settled[at]=0;
    else if(!alpha[at]&&opaque>=6)settled[at]=1;
  }
  const walkComponents=(foreground:boolean,maxArea:number,fill:number)=>{
    const seen=new Uint8Array(count),queue=new Int32Array(count);
    for(let start=0;start<count;start++){
      if(seen[start]||Boolean(settled[start])!==foreground)continue;
      let head=0,tail=0,touchesEdge=false;queue[tail++]=start;seen[start]=1;
      while(head<tail){const at=queue[head++],px=at%c.width,py=(at/c.width)|0;if(px===0||py===0||px===c.width-1||py===c.height-1)touchesEdge=true;
        const ns=[at-1,at+1,at-c.width,at+c.width];for(let n=0;n<4;n++){const next=ns[n];if(next<0||next>=count||seen[next]||(n===0&&px===0)||(n===1&&px===c.width-1)||Boolean(settled[next])!==foreground)continue;seen[next]=1;queue[tail++]=next;}}
      const removable=foreground?tail<=maxArea:!touchesEdge&&tail<=maxArea;if(removable)for(let i=0;i<tail;i++)settled[queue[i]]=fill;
    }
  };
  const islandLimit=Math.min(180,Math.max(12,Math.round(count/50000))),holeLimit=Math.min(260,Math.max(18,Math.round(count/35000)));
  walkComponents(true,islandLimit,0);walkComponents(false,holeLimit,1);
  for(let i=0;i<count;i++){const q=i*4;if(settled[i]){data.data[q]=source[q];data.data[q+1]=source[q+1];data.data[q+2]=source[q+2];data.data[q+3]=255}else data.data[q+3]=0;}
  x.putImageData(data,0,0);return c.toDataURL("image/png");
}
async function featherAlphaInside(src:string){
  const img=await getImage(src),c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;
  const x=c.getContext("2d")!;x.drawImage(img,0,0);const data=x.getImageData(0,0,c.width,c.height),source=new Uint8ClampedArray(data.data),w=c.width,h=c.height;
  // Keep transparent pixels transparent so no removed background colour can bleed back in.
  // Only the first opaque pixel along the inside edge receives a one-pixel alpha ramp.
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
    const at=py*w+px,q=at*4;if(source[q+3]<128){data.data[q+3]=0;continue}
    let opaque=0,total=0;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
      const nx=px+ox,ny=py+oy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
      total++;if(source[(ny*w+nx)*4+3]>=128)opaque++;
    }
    data.data[q+3]=opaque===total?255:Math.max(72,Math.round(255*opaque/total));
  }
  x.putImageData(data,0,0);return c.toDataURL("image/png");
}
async function refineBackground(
  src: string,
  tolerance: number,
  strokes: BgStroke[],
  speckles = 0,
  edgeRefine = 0,
  eraseColors: EraseColor[] = [],
  edgeSmooth = 0,
  optimizeAlpha = false,
) {
  const original = await getImage(src),
    base = original,
    c = document.createElement("canvas");
  c.width = base.naturalWidth;
  c.height = base.naturalHeight;
  const x = c.getContext("2d")!;
  x.drawImage(base, 0, 0, c.width, c.height);
  const result = x.getImageData(0, 0, c.width, c.height),
    sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = c.width;
  sourceCanvas.height = c.height;
  const sx = sourceCanvas.getContext("2d")!;
  sx.drawImage(original, 0, 0, c.width, c.height);
  const source = sx.getImageData(0, 0, c.width, c.height),
    sourceData = source.data,
    floodSeen = new Uint16Array(c.width * c.height),
    floodQueue = new Int32Array(c.width * c.height);
  for (const entry of eraseColors) {
    if (!entry.color) continue;
    const rgb = entry.color.match(/[a-f\d]{2}/gi)?.map((part) => parseInt(part, 16));
    if (rgb?.length === 3) for (let q = 0; q < result.data.length; q += 4) {
      const distance = Math.hypot(sourceData[q] - rgb[0], sourceData[q + 1] - rgb[1], sourceData[q + 2] - rgb[2]);
      if (distance <= entry.sensitivity * 2.2) result.data[q + 3] = 0;
    }
  }
  let floodGeneration = 0;
  const floodApply = (seedX: number, seedY: number, mode:"remove"|"keep", bleed:number, reach:number|null) => {
    const startX = clamp(Math.round(seedX), 0, c.width - 1),
      startY = clamp(Math.round(seedY), 0, c.height - 1),
      start = startY * c.width + startX,
      q0 = start * 4,
      target = [sourceData[q0], sourceData[q0 + 1], sourceData[q0 + 2]];
    floodGeneration++;
    if (floodGeneration >= 65535) { floodSeen.fill(0); floodGeneration = 1; }
    let head = 0, tail = 0;
    floodQueue[tail++] = start;
    floodSeen[start] = floodGeneration;
    while (head < tail) {
      const at = floodQueue[head++], q = at * 4,
        px = at % c.width, py = (at / c.width) | 0,
        dist = Math.hypot(sourceData[q] - target[0], sourceData[q + 1] - target[1], sourceData[q + 2] - target[2]);
      if (dist > Math.max(2, bleed * 2.2)) continue;
      if (reach !== null && Math.hypot(px - startX, py - startY) > reach * Math.max(c.width,c.height)) continue;
      if(mode==="remove") result.data[q+3]=0;
      else {result.data[q] = sourceData[q]; result.data[q + 1] = sourceData[q + 1]; result.data[q + 2] = sourceData[q + 2]; result.data[q + 3] = 255;}
      const ns = [at - 1, at + 1, at - c.width, at + c.width];
      for (let n = 0; n < 4; n++) {
        const next = ns[n];
        if (next < 0 || next >= floodSeen.length || floodSeen[next] === floodGeneration || (n === 0 && px === 0) || (n === 1 && px === c.width - 1) || (n === 2 && py === 0) || (n === 3 && py === c.height - 1)) continue;
        floodSeen[next] = floodGeneration; floodQueue[tail++] = next;
      }
    }
  };
  for (const stroke of strokes) {
    const radius = Math.max(2, (stroke.brush / 200) * Math.min(c.width, c.height));
    const mask=document.createElement("canvas");mask.width=c.width;mask.height=c.height;const mx=mask.getContext("2d")!;
    mx.strokeStyle="#fff";mx.fillStyle="#fff";mx.lineWidth=radius*2;mx.lineCap="round";mx.lineJoin="round";
    if(stroke.points.length===1){const p=stroke.points[0];mx.beginPath();mx.arc(p.x*c.width,p.y*c.height,radius,0,Math.PI*2);mx.fill();}
    else {mx.beginPath();stroke.points.forEach((p,index)=>index?mx.lineTo(p.x*c.width,p.y*c.height):mx.moveTo(p.x*c.width,p.y*c.height));mx.stroke();}
    const painted=mx.getImageData(0,0,c.width,c.height).data;
    for(let at=0;at<c.width*c.height;at++){if(painted[at*4+3]<64)continue;const q=at*4;if(stroke.mode==="remove")result.data[q+3]=0;else{result.data[q]=sourceData[q];result.data[q+1]=sourceData[q+1];result.data[q+2]=sourceData[q+2];result.data[q+3]=255;}}
    if(stroke.bleed>0){const stride=Math.max(1,Math.ceil(stroke.points.length/12));for(let i=0;i<stroke.points.length;i+=stride){const p=stroke.points[i];floodApply(p.x*c.width,p.y*c.height,stroke.mode,stroke.bleed,stroke.reach);}}
  }
  // Final output is strictly binary, including manually refined areas.
  for (let q = 3; q < result.data.length; q += 4)
    result.data[q] = result.data[q] < 128 ? 0 : 255;
  // Fill small enclosed transparent components. This restores tiny white
  // details removed with the background while leaving the outer background open.
  if (speckles > 0) {
    const seen = new Uint8Array(c.width * c.height),
      queue = new Int32Array(c.width * c.height),
      maxArea = Math.round(speckles);
    for (let start = 0; start < seen.length; start++) {
      if (seen[start] || result.data[start * 4 + 3] !== 0) continue;
      let head = 0, tail = 0, touchesEdge = false;
      queue[tail++] = start; seen[start] = 1;
      while (head < tail) {
        const at = queue[head++], px = at % c.width, py = (at / c.width) | 0;
        if (px === 0 || py === 0 || px === c.width - 1 || py === c.height - 1) touchesEdge = true;
        const ns = [at - 1, at + 1, at - c.width, at + c.width];
        for (let n = 0; n < 4; n++) {
          const next = ns[n];
          if (next < 0 || next >= seen.length || seen[next] || (n === 0 && px === 0) || (n === 1 && px === c.width - 1) || result.data[next * 4 + 3] !== 0) continue;
          seen[next] = 1; queue[tail++] = next;
        }
      }
      if (!touchesEdge && tail <= maxArea)
        for (let i = 0; i < tail; i++) {
          const q = queue[i] * 4;
          result.data[q] = sourceData[q];
          result.data[q + 1] = sourceData[q + 1];
          result.data[q + 2] = sourceData[q + 2];
          result.data[q + 3] = 255;
        }
    }
  }
  const edgeSteps=Math.min(16,Math.abs(Math.round(edgeRefine)));
  for(let pass=0;pass<edgeSteps;pass++){
    const before=new Uint8ClampedArray(result.data), remove=edgeRefine>0;
    for(let py=1;py<c.height-1;py++)for(let px=1;px<c.width-1;px++){
      const at=py*c.width+px,q=at*4,opaque=before[q+3]>=128;
      const neighbor=[at-1,at+1,at-c.width,at+c.width].some(n=>before[n*4+3]>=128);
      const transparentNeighbor=[at-1,at+1,at-c.width,at+c.width].some(n=>before[n*4+3]<128);
      if(remove&&opaque&&transparentNeighbor)result.data[q+3]=0;
      if(!remove&&!opaque&&neighbor){result.data[q]=sourceData[q];result.data[q+1]=sourceData[q+1];result.data[q+2]=sourceData[q+2];result.data[q+3]=255;}
    }
  }
  if(edgeSmooth>0){
    const radius=Math.max(1,Math.round(edgeSmooth)),w=c.width,h=c.height,alpha=new Float32Array(w*h),horizontal=new Float32Array(w*h),smoothed=new Float32Array(w*h);
    for(let i=0;i<w*h;i++)alpha[i]=result.data[i*4+3]/255;
    for(let py=0;py<h;py++){let sum=0;for(let px=-radius;px<=radius;px++)sum+=alpha[py*w+clamp(px,0,w-1)];for(let px=0;px<w;px++){horizontal[py*w+px]=sum/(radius*2+1);sum-=alpha[py*w+clamp(px-radius,0,w-1)];sum+=alpha[py*w+clamp(px+radius+1,0,w-1)];}}
    for(let px=0;px<w;px++){let sum=0;for(let py=-radius;py<=radius;py++)sum+=horizontal[clamp(py,0,h-1)*w+px];for(let py=0;py<h;py++){smoothed[py*w+px]=sum/(radius*2+1);sum-=horizontal[clamp(py-radius,0,h-1)*w+px];sum+=horizontal[clamp(py+radius+1,0,h-1)*w+px];}}
    for(let i=0;i<w*h;i++){const q=i*4;if(smoothed[i]>=.5){result.data[q]=sourceData[q];result.data[q+1]=sourceData[q+1];result.data[q+2]=sourceData[q+2];result.data[q+3]=255}else result.data[q+3]=0;}
  }
  x.putImageData(result, 0, 0);
  const output=c.toDataURL("image/png");
  return optimizeAlpha?optimizeAlphaChannel(output):output;
}
async function silhouette(src: string, color = DARK, opacity = 255) {
  const img = await getImage(src),
    c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.globalAlpha = opacity / 255;
  x.fillRect(0, 0, c.width, c.height);
  if (opacity === 255) {
    const data = x.getImageData(0,0,c.width,c.height), original = new Uint8ClampedArray(data.data), border = Math.max(1,Math.round(Math.min(c.width,c.height)/700));
    for(let py=0;py<c.height;py++) for(let px=0;px<c.width;px++){
      const q=(py*c.width+px)*4; if(original[q+3]<128) continue;
      let edge=false;
      for(let oy=-border;oy<=border&&!edge;oy++) for(let ox=-border;ox<=border;ox++){
        const nx=px+ox,ny=py+oy; if(nx<0||ny<0||nx>=c.width||ny>=c.height||original[(ny*c.width+nx)*4+3]<128){edge=true;break;}
      }
      if(edge){data.data[q]=20;data.data[q+1]=23;data.data[q+2]=21;data.data[q+3]=255;}
    }
    x.putImageData(data,0,0);
  }
  return c.toDataURL();
}

async function marqueeTouchesVisiblePixels(layer: Layer, area: { x: number; y: number; w: number; h: number }) {
  const img = await getImage(layer.src), limit = 280;
  const ratio = Math.min(1, limit / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * ratio));
  c.height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const context = c.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(img, 0, 0, c.width, c.height);
  const pixels = context.getImageData(0, 0, c.width, c.height).data;
  const radians = (layer.rotation * Math.PI) / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const centerX = layer.x + layer.w / 2, centerY = layer.y + layer.h / 2;
  for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
    if (pixels[(py * c.width + px) * 4 + 3] < 96) continue;
    const localX = layer.x + ((px + .5) / c.width) * layer.w;
    const localY = layer.y + ((py + .5) / c.height) * layer.h;
    const dx = localX - centerX, dy = localY - centerY;
    const worldX = centerX + dx * cos - dy * sin, worldY = centerY + dx * sin + dy * cos;
    if (worldX >= area.x && worldX <= area.x + area.w && worldY >= area.y && worldY <= area.y + area.h) return true;
  }
  return false;
}
async function smoothVectorCutout(src: string, color: string) {
  const img = await getImage(src), longest = Math.max(img.naturalWidth, img.naturalHeight),
    supersample = clamp(1800 / Math.max(longest, 1), 2, 6), pad = Math.ceil(supersample * 3),
    mask = document.createElement("canvas"), traced = document.createElement("canvas");
  mask.width = Math.max(1, Math.round(img.naturalWidth * supersample));
  mask.height = Math.max(1, Math.round(img.naturalHeight * supersample));
  const mx = mask.getContext("2d")!;
  mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = "high";
  mx.filter = `blur(${Math.max(.45, supersample * .18)}px)`;
  mx.drawImage(img, 0, 0, mask.width, mask.height); mx.filter = "none";
  const pixels = mx.getImageData(0, 0, mask.width, mask.height);
  traced.width = mask.width + pad * 2; traced.height = mask.height + pad * 2;
  const tx = traced.getContext("2d")!; tx.fillStyle = "#fff"; tx.fillRect(0, 0, traced.width, traced.height);
  const binary = tx.createImageData(mask.width, mask.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const solid = pixels.data[i + 3] >= 128;
    binary.data[i] = binary.data[i + 1] = binary.data[i + 2] = solid ? 0 : 255; binary.data[i + 3] = 255;
  }
  tx.putImageData(binary, pad, pad);
  const paths = traceCanvas(traced, { turnpolicy: "minority", turdsize: Math.max(2, Math.round(supersample * supersample * .45)), alphamax: .82, optcurve: true, opttolerance: .32 });
  if (!paths.length) throw new Error("The cutout contour is empty");
  const doc = new DOMParser().parseFromString(getSVG(paths, 1, "fill"), "image/svg+xml"), root = doc.documentElement;
  root.setAttribute("width", String(traced.width)); root.setAttribute("height", String(traced.height));
  root.setAttribute("viewBox", `0 0 ${traced.width} ${traced.height}`); root.setAttribute("preserveAspectRatio", "none");
  root.setAttribute("shape-rendering", "geometricPrecision");
  root.querySelectorAll("path").forEach((path) => { path.setAttribute("fill", color); path.setAttribute("fill-rule", "evenodd"); path.setAttribute("stroke", "#141715"); path.setAttribute("stroke-width", "1.15"); path.setAttribute("stroke-linecap", "round"); path.setAttribute("stroke-linejoin", "round"); path.setAttribute("vector-effect", "non-scaling-stroke"); path.setAttribute("paint-order", "stroke fill"); });
  return `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`;
}
async function vTracerCutout(src: string, color: string) {
  const img = await getImage(src), longest = Math.max(img.naturalWidth, img.naturalHeight), scale = clamp(1100 / Math.max(longest, 1), 1, 3), canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high"; context.drawImage(img, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const foreground = pixels.data[i + 3] >= 128;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = foreground ? 0 : 255;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Cutout mask could not be prepared")), "image/png"));
  const buffer = await blob.arrayBuffer(), worker = new Worker("/vtracer/worker.js");
  const tracedSvg = await new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => { worker.terminate(); reject(new Error("VTracer could not finish this image within three minutes")); }, 180000);
    worker.onmessage = (event) => { window.clearTimeout(timeout); worker.terminate(); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.svg); };
    worker.onerror = (event) => { window.clearTimeout(timeout); worker.terminate(); reject(new Error(event.message || "VTracer worker failed")); };
    worker.postMessage({ buffer }, [buffer]);
  });
  const doc = new DOMParser().parseFromString(tracedSvg, "image/svg+xml"), output = doc.documentElement as unknown as SVGSVGElement;
  if (output.tagName.toLowerCase() !== "svg" || output.querySelector("parsererror")) throw new Error("VTracer returned an invalid SVG");
  const outputWidth = Number(output.getAttribute("width")) || canvas.width, outputHeight = Number(output.getAttribute("height")) || canvas.height;
  output.setAttribute("preserveAspectRatio", "none"); output.setAttribute("viewBox", `0 0 ${outputWidth} ${outputHeight}`);
  output.setAttribute("shape-rendering", "geometricPrecision");
  output.querySelectorAll("path").forEach((path) => { path.setAttribute("fill", color); path.setAttribute("stroke", "#141715"); path.setAttribute("stroke-width", "1.1"); path.setAttribute("stroke-linecap", "round"); path.setAttribute("stroke-linejoin", "round"); path.setAttribute("vector-effect", "non-scaling-stroke"); path.setAttribute("paint-order", "stroke fill"); });
  return `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(output))}`;
}
async function renderCutoutEdit(editor: CutoutEditor, applyCrop = false) {
  const img = await getImage(editor.source), c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d")!; x.drawImage(img, 0, 0);
  for (const stroke of editor.strokes) {
    if (!stroke.points.length) continue;
    if (stroke.tool === "smooth") continue;
    x.save(); x.lineCap = "round"; x.lineJoin = "round";
    x.lineWidth = Math.max(2, stroke.brush / 100 * Math.min(c.width, c.height));
    if (stroke.tool === "bridge") { x.globalCompositeOperation = "source-over"; x.strokeStyle = editor.color; x.fillStyle = editor.color; }
    else { x.globalCompositeOperation = "destination-out"; x.strokeStyle = "#000"; x.fillStyle = "#000"; }
    x.beginPath();
    x.moveTo(stroke.points[0].x * c.width, stroke.points[0].y * c.height);
    for (const p of stroke.points.slice(1)) x.lineTo(p.x * c.width, p.y * c.height);
    if (stroke.tool === "rectangle" && stroke.points.length > 1) {
      const a=stroke.points[0], z=stroke.points.at(-1)!;
      x.fillRect(Math.min(a.x,z.x)*c.width,Math.min(a.y,z.y)*c.height,Math.abs(z.x-a.x)*c.width,Math.abs(z.y-a.y)*c.height);
    }
    else if (stroke.tool === "lasso" && stroke.points.length > 2) { x.closePath(); x.fill(); }
    else if (stroke.points.length === 1) { const p = stroke.points[0]; x.arc(p.x*c.width,p.y*c.height,x.lineWidth/2,0,Math.PI*2); x.fill(); }
    else x.stroke();
    x.restore();
  }
  for (const stroke of editor.strokes.filter((item) => item.tool === "smooth" && item.points.length)) {
    const mask = document.createElement("canvas"), softened = document.createElement("canvas");
    mask.width = softened.width = c.width; mask.height = softened.height = c.height;
    const maskContext = mask.getContext("2d")!, softContext = softened.getContext("2d")!;
    maskContext.lineCap = "round"; maskContext.lineJoin = "round"; maskContext.strokeStyle = "#fff";
    maskContext.lineWidth = Math.max(4, stroke.brush / 100 * Math.min(c.width, c.height));
    maskContext.beginPath(); maskContext.moveTo(stroke.points[0].x * c.width, stroke.points[0].y * c.height);
    for (const point of stroke.points.slice(1)) maskContext.lineTo(point.x * c.width, point.y * c.height);
    if (stroke.points.length === 1) maskContext.lineTo(stroke.points[0].x * c.width + .01, stroke.points[0].y * c.height);
    maskContext.stroke();
    softContext.filter = `blur(${Math.max(1.2, maskContext.lineWidth * .045)}px)`; softContext.drawImage(c, 0, 0); softContext.filter = "none";
    const current = x.getImageData(0, 0, c.width, c.height), blurred = softContext.getImageData(0, 0, c.width, c.height), selected = maskContext.getImageData(0, 0, c.width, c.height);
    for (let q = 0; q < current.data.length; q += 4) if (selected.data[q + 3] > 20) {
      const alpha = blurred.data[q + 3] >= 128 ? 255 : 0;
      current.data[q] = parseInt(editor.color.slice(1, 3), 16); current.data[q + 1] = parseInt(editor.color.slice(3, 5), 16); current.data[q + 2] = parseInt(editor.color.slice(5, 7), 16); current.data[q + 3] = alpha;
    }
    x.putImageData(current, 0, 0);
  }
  if (!applyCrop) return { src: c.toDataURL(), left: 0, top: 0, width: 1, height: 1 };
  const l = clamp(editor.crop.left / 100, 0, .9), t = clamp(editor.crop.top / 100, 0, .9),
    r = clamp(editor.crop.right / 100, 0, Math.max(0,.95-l)), b = clamp(editor.crop.bottom / 100, 0, Math.max(0,.95-t)),
    out = document.createElement("canvas"), sx = Math.round(l*c.width), sy = Math.round(t*c.height),
    sw = Math.max(1, Math.round(c.width*(1-l-r))), sh = Math.max(1, Math.round(c.height*(1-t-b)));
  out.width = sw; out.height = sh; out.getContext("2d")!.drawImage(c,sx,sy,sw,sh,0,0,sw,sh);
  const trimmed = await trimTransparent(out.toDataURL());
  return { src: trimmed.src, left: l + (1-l-r)*trimmed.left, top: t + (1-t-b)*trimmed.top, width: (1-l-r)*trimmed.width, height: (1-t-b)*trimmed.height };
}
async function bakeRotation(layer: Layer) {
  if (!layer.rotation) return layer;
  const img = await getImage(layer.src),
    angle = (layer.rotation * Math.PI) / 180,
    outW = Math.ceil(
      Math.abs(img.width * Math.cos(angle)) +
        Math.abs(img.height * Math.sin(angle)),
    ),
    outH = Math.ceil(
      Math.abs(img.width * Math.sin(angle)) +
        Math.abs(img.height * Math.cos(angle)),
    ),
    canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const context = canvas.getContext("2d")!;
  context.translate(outW / 2, outH / 2);
  context.rotate(angle);
  context.drawImage(img, -img.width / 2, -img.height / 2);
  const trimmed = await trimTransparent(canvas.toDataURL()),
    rb = rotatedBounds(layer);
  return {
    ...layer,
    src: trimmed.src,
    x: rb.x + rb.w * trimmed.left,
    y: rb.y + rb.h * trimmed.top,
    w: rb.w * trimmed.width,
    h: rb.h * trimmed.height,
    rotation: 0,
  };
}
async function strokeImage(
  src: string,
  strokeCm: number,
  wCm: number,
  color: string,
  fillGapsMm = 0,
) {
  const cleaned = await removeBg(src),
    img = await getImage(cleaned),
    s = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight)),
    iw = Math.max(1, Math.round(img.naturalWidth * s)),
    ih = Math.max(1, Math.round(img.naturalHeight * s)),
    r = Math.max(
      0,
      Math.min(72, Math.round((strokeCm / Math.max(wCm, 0.1)) * iw)),
    ),
    c = document.createElement("canvas"),
    mask = document.createElement("canvas");
  c.width = iw + r * 2;
  c.height = ih + r * 2;
  mask.width = iw;
  mask.height = ih;
  const mx = mask.getContext("2d")!,
    x = c.getContext("2d")!;
  mx.drawImage(img, 0, 0, iw, ih);
  mx.globalCompositeOperation = "source-in";
  mx.fillStyle = "#000";
  mx.fillRect(0, 0, iw, ih);
  const outer = color.startsWith("#") ? color : DARK;
  x.fillStyle = outer;
  const steps = Math.max(32, Math.min(96, Math.ceil(r * 2.4)));
  for (let n = 0; n < steps; n++) {
    const a = (n / steps) * Math.PI * 2;
    x.drawImage(mask, r + Math.cos(a) * r, r + Math.sin(a) * r);
  }
  x.globalCompositeOperation = "source-in";
  x.fillStyle = outer;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = "source-over";
  x.drawImage(mask, r, r);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = outer;
  x.fillRect(0, 0, c.width, c.height);
  if (fillGapsMm > 0) {
    const data = x.getImageData(0, 0, c.width, c.height),
      seen = new Uint8Array(c.width * c.height),
      limit = Math.max(
        1,
        Math.round(
          (fillGapsMm / 10 / Math.max(wCm + strokeCm * 2, 0.1)) * c.width,
        ),
      ),
      maxGapArea = limit * limit;
    for (let seed = 0; seed < seen.length; seed++) {
      if (seen[seed] || data.data[seed * 4 + 3] >= 245) continue;
      const stack = [seed],
        pixels: number[] = [];
      seen[seed] = 1;
      let minX = c.width,
        maxX = 0,
        minY = c.height,
        maxY = 0,
        edge = false;
      while (stack.length) {
        const q = stack.pop()!,
          qx = q % c.width,
          qy = Math.floor(q / c.width);
        pixels.push(q);
        minX = Math.min(minX, qx);
        maxX = Math.max(maxX, qx);
        minY = Math.min(minY, qy);
        maxY = Math.max(maxY, qy);
        if (qx === 0 || qy === 0 || qx === c.width - 1 || qy === c.height - 1)
          edge = true;
        for (const n of [q - 1, q + 1, q - c.width, q + c.width])
          if (
            n >= 0 &&
            n < seen.length &&
            !seen[n] &&
            data.data[n * 4 + 3] < 245 &&
            Math.abs((n % c.width) - qx) <= 1
          ) {
            seen[n] = 1;
            stack.push(n);
          }
      }
      if (!edge && pixels.length <= maxGapArea)
        for (const q of pixels) {
          const k = q * 4;
          data.data[k] = parseInt(outer.slice(1, 3), 16);
          data.data[k + 1] = parseInt(outer.slice(3, 5), 16);
          data.data[k + 2] = parseInt(outer.slice(5, 7), 16);
          data.data[k + 3] = 255;
        }
    }
    x.putImageData(data, 0, 0);
  }
  return await silhouette(c.toDataURL(), outer, 255);
}
async function trimTransparent(src: string) {
  const img = await getImage(src),
    c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  let minX = c.width,
    minY = c.height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < c.height; y++)
    for (let q = 0; q < c.width; q++)
      if (d.data[(y * c.width + q) * 4 + 3] > 8) {
        minX = Math.min(minX, q);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, q);
        maxY = Math.max(maxY, y);
      }
  if (maxX < minX) return { src, left: 0, top: 0, width: 1, height: 1 };
  const w = maxX - minX + 1,
    h = maxY - minY + 1,
    out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(c, minX, minY, w, h, 0, 0, w, h);
  return {
    src: out.toDataURL(),
    left: minX / c.width,
    top: minY / c.height,
    width: w / c.width,
    height: h / c.height,
  };
}
const lighten = (hex: string, amount = 0.34) => {
  const n = parseInt(hex.slice(1), 16),
    r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  return `#${[r, g, b]
    .map((v) =>
      Math.round(v + (255 - v) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};
const bounds = (ls: Layer[]) => {
  if (!ls.length) return { x: 0, y: 0, w: 0, h: 0 };
  const bs = ls.map((l) => rotatedBounds(l)),
    x = Math.min(...bs.map((l) => l.x)),
    y = Math.min(...bs.map((l) => l.y)),
    r = Math.max(...bs.map((l) => l.x + l.w)),
    b = Math.max(...bs.map((l) => l.y + l.h));
  return { x, y, w: r - x, h: b - y };
};
const rotatedBounds = (l: Layer) => {
  const a = (l.rotation * Math.PI) / 180,
    w = Math.abs(l.w * Math.cos(a)) + Math.abs(l.h * Math.sin(a)),
    h = Math.abs(l.w * Math.sin(a)) + Math.abs(l.h * Math.cos(a));
  return { x: l.x + l.w / 2 - w / 2, y: l.y + l.h / 2 - h / 2, w, h };
};
const snapshot = (l: Layer): LayerStep["snapshot"] => ({
  src: l.src,
  x: l.x,
  y: l.y,
  w: l.w,
  h: l.h,
  kind: l.kind,
  color: l.color,
  strokeCm: l.strokeCm,
  fillGapsMm: l.fillGapsMm,
  acetateOn: l.acetateOn,
});
export default function Home() {
  const [layers, setLayers] = useState<Layer[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [zoom, setZoom] = useState(0.82),
    [zoomEditing,setZoomEditing]=useState(false),
    [zoomDraft,setZoomDraft]=useState("82"),
    [calibration,setCalibration]=useState(1),
    [calibrationDraft,setCalibrationDraft]=useState(1),
    [calibrationOpen,setCalibrationOpen]=useState(false),
    [locked, setLocked] = useState(true),
    [alignOpen, setAlignOpen] = useState(false),
    [colorOpen, setColorOpen] = useState(false),
    [working, setWorking] = useState(false),
    [vTracerStartedAt, setVTracerStartedAt] = useState<number | null>(null),
    [vTracerElapsed, setVTracerElapsed] = useState(0),
    [notice, setNotice] = useState(""),
    [drag, setDrag] = useState<Drag>(null),
    [cycle, setCycle] = useState({ key: "", index: 0 }),
    [strokeDraft, setStrokeDraft] = useState(0.5),
    [fillGapsDraft, setFillGapsDraft] = useState(0),
    [widthDraft, setWidthDraft] = useState("0.0"),
    [heightDraft, setHeightDraft] = useState("0.0"),
    [pageMode, setPageMode] = useState<PageMode>("portrait"),
    [pageSetupOpen, setPageSetupOpen] = useState(false),
    [safeMargin, setSafeMargin] = useState(1),
    [safeOpen, setSafeOpen] = useState(false),
    [gridVisible, setGridVisible] = useState(true),
    [bgMenuOpen, setBgMenuOpen] = useState(false),
    [shapeOpen, setShapeOpen] = useState(false),
    [shapeTool, setShapeTool] = useState<string | null>(null),
    [dragLayer, setDragLayer] = useState<string | null>(null),
    [editingName, setEditingName] = useState<string | null>(null),
    [marquee, setMarquee] = useState<{
      x: number;
      y: number;
      w: number;
      h: number;
    } | null>(null),
    [bgEditor, setBgEditor] = useState<BgEditor | null>(null),
    [bgPreview, setBgPreview] = useState<string>(""),
    [bgRendering, setBgRendering] = useState(false),
    [bgActiveStroke, setBgActiveStroke] = useState<string | null>(null),
    [bgCursor, setBgCursor] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false }),
    [bgImageSize, setBgImageSize] = useState({ w: 0, h: 0 }),
    [cutEditor, setCutEditor] = useState<CutoutEditor | null>(null),
    [cutPreview, setCutPreview] = useState(""),
    [cutImageSize, setCutImageSize] = useState({ w: 0, h: 0 }),
    [cutActiveStroke, setCutActiveStroke] = useState<string | null>(null),
    [cutCursor, setCutCursor] = useState<{x:number;y:number;visible:boolean}>({x:0,y:0,visible:false}),
    [imageEditor,setImageEditor]=useState<ImageEditor|null>(null),
    [imageEditorSize,setImageEditorSize]=useState({w:0,h:0}),
    [rulerOrigin, setRulerOrigin] = useState({ x: 0, y: 0 }),
    [session, setSession] = useState<Session | null>(null),
    [projects, setProjects] = useState<SavedProject[]>([]),
    [projectsOpen, setProjectsOpen] = useState(false),
    [saveAsMode, setSaveAsMode] = useState(false),
    [accountOpen, setAccountOpen] = useState(false),
    [currentProjectId, setCurrentProjectId] = useState<string | null>(null),
    [projectName, setProjectName] = useState("Untitled Project");
  const fileRef = useRef<HTMLInputElement>(null),
    stageRef = useRef<HTMLDivElement>(null),
    canvasRef = useRef<HTMLDivElement>(null),
    menuRef = useRef<HTMLElement>(null),
    clipboard = useRef<Layer[]>([]),
    history = useRef<Layer[][]>([]),
    lastLayers = useRef<Layer[]>([]),
    lastChange = useRef(0),
    undoing = useRef(false),
    bgDrawing = useRef<string | null>(null),
    bgPanDrag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null),
    cutDrawing = useRef<string | null>(null),
    cutPanDrag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null),
    bgPreviewRef = useRef<HTMLDivElement>(null),
    cutPreviewRef = useRef<HTMLDivElement>(null),
    cropDrag = useRef<{mode:string;x:number;y:number;crop:CutoutEditor["crop"];rect:DOMRect}|null>(null),
    imageCropDrag = useRef<{mode:string;x:number;y:number;crop:ImageEditor["crop"];rect:DOMRect}|null>(null),
    imageDrawing = useRef<string|null>(null),
    pan = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const landscape = pageMode === "landscape",
    A4 = pageMode === "full" ? {w:100,h:100} : landscape ? { w: PORTRAIT.h, h: PORTRAIT.w } : PORTRAIT,
    SAFE = { x: safeMargin, y: safeMargin, w: A4.w - safeMargin * 2, h: A4.h - safeMargin * 2 },
    picked = layers.filter((l) => selected.includes(l.id)),
    one = picked.length === 1 ? picked[0] : null,
    box = bounds(picked),
    displayBox =
      one && drag?.mode === "rotate"
        ? { x: one.x, y: one.y, w: one.w, h: one.h }
        : one && one.rotation
          ? rotatedBounds(one)
          : box,
    scale = PPCM * zoom * calibration,
    vectorsOnly =
      picked.length > 0 &&
      picked.every((l) => ["stroke", "vector"].includes(l.kind));
  const mutate = (id: string, fn: (l: Layer) => Layer) =>
    setLayers((v) => v.map((l) => (l.id === id ? fn(l) : l)));
  const refreshProjects = async () => {
    const { data, error } = await supabase.from("projects").select("id,name,updated_at,data").order("updated_at", { ascending: false });
    if (error) { setNotice("Projects could not be loaded"); return; }
    setProjects((data || []) as SavedProject[]);
  };
  const saveProject = async (asNew = false) => {
    if (!session?.user) return setNotice("Sign in to save a project");
    setWorking(true);
    const payload = { name: projectName.trim() || "Untitled Project", data: { layers, landscape, pageMode, safeMargin }, user_id: session.user.id, updated_at: new Date().toISOString() };
    const query = currentProjectId && !asNew
      ? supabase.from("projects").update(payload).eq("id", currentProjectId).select("id,name,updated_at,data").single()
      : supabase.from("projects").insert(payload).select("id,name,updated_at,data").single();
    const { data, error } = await query;
    setWorking(false);
    if (error || !data) return setNotice("Project could not be saved");
    setCurrentProjectId(data.id); setProjectName(data.name); await refreshProjects(); setProjectsOpen(false); setSaveAsMode(false); setNotice(asNew ? "Project saved as a new copy" : "Project saved");
  };
  const openProject = (project: SavedProject) => {
    setLayers(project.data.layers || []); setPageMode(project.data.pageMode || (project.data.landscape ? "landscape" : "portrait")); setSafeMargin(project.data.safeMargin ?? 1);
    setSelected([]); setCurrentProjectId(project.id); setProjectName(project.name); history.current = []; setProjectsOpen(false); setNotice(`${project.name} opened`);
  };
  const deleteProject = async (id: string) => {
    const previous=projects;setProjects(items=>items.filter(project=>project.id!==id));
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {setProjects(previous);return setNotice("Project could not be deleted");}
    if (currentProjectId === id) { setCurrentProjectId(null); setProjectName("Untitled Project"); }
    await refreshProjects(); setNotice("Project deleted");
  };
  const newProject = () => {
    setLayers([]); setSelected([]); setCurrentProjectId(null); setProjectName("Untitled Project");
    setPageMode("portrait"); setSafeMargin(1); history.current=[]; setProjectsOpen(false);
    window.setTimeout(centerDocument,40); setNotice("New project created");
  };
  useEffect(() => {
    const stored=Number(localStorage.getItem("better-cricut-screen-calibration"));
    if(Number.isFinite(stored)&&stored>=.5&&stored<=2){setCalibration(stored);setCalibrationDraft(stored)}
  },[]);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) void refreshProjects(); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (next) void refreshProjects(); else setProjects([]); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!bgEditor) return;
    let cancelled = false;
    setBgRendering(true);
    const timer = window.setTimeout(() => {
      void refineBackground(
        bgEditor.source,
        bgEditor.sensitivity,
        bgEditor.strokes,
        bgEditor.speckles,
        bgEditor.edgeRefine,
        bgEditor.eraseColors,
        bgEditor.edgeSmooth,
        bgEditor.optimizeAlpha,
      ).then((src) => {
        if (!cancelled) {
          setBgPreview(src);
          setBgRendering(false);
        }
      }).catch(() => { if (!cancelled) { setBgRendering(false); setNotice("Preview could not be updated"); } });
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bgEditor?.source, bgEditor?.strokes, bgEditor?.speckles, bgEditor?.edgeRefine, bgEditor?.eraseColors, bgEditor?.edgeSmooth, bgEditor?.optimizeAlpha]);
  useEffect(() => {
    if (!cutEditor) return;
    let cancelled = false;
    const timer = window.setTimeout(() => void renderCutoutEdit(cutEditor).then((r) => { if (!cancelled) setCutPreview(r.src); }), 80);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [cutEditor?.source, cutEditor?.strokes, cutEditor?.color]);
  useEffect(() => {
    if (undoing.current) {
      undoing.current = false;
      lastLayers.current = layers;
      return;
    }
    if (lastLayers.current !== layers) {
      const now = performance.now();
      if (now - lastChange.current > 300) {
        history.current.push(lastLayers.current.map((l) => ({ ...l })));
        if (history.current.length > 60) history.current.shift();
      }
      lastChange.current = now;
      lastLayers.current = layers;
    }
  }, [layers]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), /VTracer|Smooth Cutout/i.test(notice) ? 15000 : 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (vTracerStartedAt === null) { setVTracerElapsed(0); return; }
    const update = () => setVTracerElapsed(Math.floor((Date.now() - vTracerStartedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [vTracerStartedAt]);
  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    undoing.current = true;
    setLayers(previous);
    setSelected([]);
    setNotice("Undone");
  };
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".wrap")) {
        setAlignOpen(false);
        setColorOpen(false);
        setSafeOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (one && ["stroke", "vector"].includes(one.kind)) {
      if (one.kind === "stroke") setStrokeDraft(one.strokeCm);
      setFillGapsDraft(one.fillGapsMm || 0);
    }
  }, [one?.id, one?.strokeCm]);
  useEffect(() => {
    setWidthDraft(box.w.toFixed(1));
    setHeightDraft(box.h.toFixed(1));
  }, [selected.join(":"), box.w, box.h]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "=", "-", "0"].includes(e.key)) {
        e.preventDefault();
        setZoom((z) =>
          e.key === "0" ? 1 : clamp(z + (e.key === "-" ? -0.1 : 0.1), 0.2, 4),
        );
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (imageEditor) { undoImageStage(); return; }
        if (bgEditor) {
          setBgEditor((value) => value && value.strokes.length ? {...value,strokes:value.strokes.slice(0,-1)} : value);
          return;
        }
        undo();
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !(e.target as HTMLElement).matches("input,textarea")
      ) {
        e.preventDefault();
        setLayers((v) => v.filter((l) => !selected.includes(l.id)));
        setSelected([]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected,bgEditor,imageEditor]);
  useEffect(() => {
    const stopBrowserZoom = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
    };
    window.addEventListener("wheel", stopBrowserZoom, { passive: false });
    return () => window.removeEventListener("wheel", stopBrowserZoom);
  }, []);
  const editorWheel=(e:RWheel<HTMLDivElement>)=>{
    e.preventDefault();const stage=stageRef.current,canvas=canvasRef.current;if(!stage||!canvas)return;
    if(e.ctrlKey){stage.scrollTop+=e.deltaY;stage.scrollLeft+=e.deltaX;updateRulers();return}
    const clientX=e.clientX,clientY=e.clientY,before=canvas.getBoundingClientRect(),oldScale=scale,
      worldX=(clientX-before.left)/oldScale,worldY=(clientY-before.top)/oldScale,
      nextZoom=clamp(zoom*Math.exp(-e.deltaY*.0015),.2,4);
    if(Math.abs(nextZoom-zoom)<.0001)return;
    setZoom(nextZoom);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const currentStage=stageRef.current,currentCanvas=canvasRef.current;if(!currentStage||!currentCanvas)return;
      const after=currentCanvas.getBoundingClientRect(),nextScale=PPCM*nextZoom*calibration;
      currentStage.scrollLeft+=after.left+worldX*nextScale-clientX;
      currentStage.scrollTop+=after.top+worldY*nextScale-clientY;
      updateRulers();
    }));
  };
  const updateRulers = () =>
    requestAnimationFrame(() => {
      if (!stageRef.current || !canvasRef.current) return;
      const s = stageRef.current.getBoundingClientRect(),
        c = canvasRef.current.getBoundingClientRect();
      setRulerOrigin({ x: c.left - s.left, y: c.top - s.top });
    });
  const centerDocument = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
    stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
    updateRulers();
  };
  useEffect(() => { updateRulers(); }, [zoom, pageMode, safeMargin]);
  useEffect(() => {
    const timer=window.setTimeout(()=>pageMode==="full"?stageRef.current?.scrollTo({left:0,top:0}):centerDocument(),40);
    return()=>window.clearTimeout(timer);
  },[pageMode]);
  const visibleInsertionPoint = (w:number,h:number) => {
    const stage=stageRef.current, canvas=canvasRef.current;
    if(!stage||!canvas) return {x:SAFE.x+(SAFE.w-w)/2,y:SAFE.y+(SAFE.h-h)/2};
    const s=stage.getBoundingClientRect(),c=canvas.getBoundingClientRect();
    return {
      x:clamp((s.left+s.width/2-c.left)/scale-w/2,SAFE.x,Math.max(SAFE.x,SAFE.x+SAFE.w-w)),
      y:clamp((s.top+s.height/2-c.top)/scale-h/2,SAFE.y,Math.max(SAFE.y,SAFE.y+SAFE.h-h)),
    };
  };
  const importFiles = async (files: File[]) => {
    for (const f of files) {
      if (!/image\/(jpeg|png|svg\+xml|webp)/.test(f.type)) continue;
      const src = await new Promise<string>((ok) => {
          const r = new FileReader();
          r.onload = () => ok(String(r.result));
          r.readAsDataURL(f);
        }),
        img = await getImage(src),
        ratio = img.naturalWidth / img.naturalHeight;
      let w = Math.min(10, SAFE.w),
        h = w / ratio;
      if (h > SAFE.h) {
        h = SAFE.h;
        w = h * ratio;
      }
      const id = uid(), place=visibleInsertionPoint(w,h);
      setLayers((v) =>
        v.concat({
          id,
          name: clean(f.name),
          src,
          originalSrc: src,
          visible: true,
          x: place.x,
          y: place.y,
          w,
          h,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
          kind: "original",
          strokeCm: 0.5,
          fillGapsMm: 0,
          invalid: false,
          rotation: 0,
          color: DARK,
          steps: [],
          activeStep: -1,
          acetateOn: false,
        }),
      );
      setSelected([id]);
    }
  };
  const add = async (e: ChangeEvent<HTMLInputElement>) => {
    await importFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };
  const fitEditorImage = (img: HTMLImageElement, host?: HTMLDivElement | null) => {
    const maxW = Math.max(180, Math.min((host?.clientWidth || window.innerWidth * .58) - 48, 700));
    const maxH = Math.max(180, (host?.clientHeight || window.innerHeight * .65) - 48);
    const target = Math.min(maxW, maxH), longest = Math.max(img.naturalWidth, img.naturalHeight);
    const ratio = target / longest;
    return { w: Math.max(1, Math.round(img.naturalWidth * ratio)), h: Math.max(1, Math.round(img.naturalHeight * ratio)) };
  };
  const noBackground = () => {
    if (!one) return;
    setBgPreview("");
    setBgImageSize({ w: 0, h: 0 });
    setBgEditor({
      layerId: one.id,
      source: one.src,
      strokes: [],
      mode: "remove",
      brush: 3,
      sensitivity: 0,
      connectedReach: 0,
      alphaView: false,
      zoom: 1,
      panX: 0,
      panY: 0,
      speckles: 0,
      edgeRefine: 0,
      edgeSmooth: 0,
      optimizeAlpha: false,
      eraseColors: [{ color: null, sensitivity: 30 }],
      pickingColor: null,
    });
  };
  const quickBackground = async (chosen?:Layer|null) => {
    const targets=chosen?[chosen]:picked;if(!targets.length){setNotice("Select at least one image first");return}setBgMenuOpen(false);setNotice("Removing background…");setWorking(true);
    try{
      const results=await Promise.all(targets.map(async target=>{const refined=await removeBg(target.src),t=await trimTransparent(refined),next={...target,src:t.src,x:target.x+target.w*t.left,y:target.y+target.h*t.top,w:target.w*t.width,h:target.h*t.height,kind:"nobg" as Kind};const step:LayerStep={id:uid(),type:"remove-bg",label:"Remove Background",snapshot:snapshot(next)};return {...next,steps:[...target.steps,step],activeStep:target.steps.length}}));
      const byId=new Map(results.map(l=>[l.id,l]));setLayers(items=>items.map(l=>byId.get(l.id)||l));setNotice(`${results.length} background${results.length>1?"s":""} removed`);
    }catch{setNotice("Background removal could not be applied");}finally{setWorking(false)}
  };
  const applyBackgroundPreset=async(type:"image"|"rim"|"text")=>{
    if(!one)return setNotice("Select one image first");setBgMenuOpen(false);setWorking(true);setNotice("Applying background removal preset…");
    try{let strokes:BgStroke[]=[],colors:EraseColor[]=[],edgeRefine=0,edgeSmooth=2;
      if(type==="text"){const img=await getImage(one.src),sample=document.createElement("canvas");sample.width=img.naturalWidth;sample.height=img.naturalHeight;const sx=sample.getContext("2d")!;sx.drawImage(img,0,0);const p=sx.getImageData(0,0,1,1).data,color=`#${[p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,"0")).join("")}`;colors=[{color,sensitivity:30}];edgeSmooth=1}else{strokes=[{id:uid(),mode:"remove",brush:4,bleed:10,reach:null,points:[{x:.005,y:.005}]}];if(type==="rim"){edgeRefine=-8;edgeSmooth=8}}
      let refined=await refineBackground(one.src,0,strokes,0,edgeRefine,colors,edgeSmooth,true);if(type!=="text")refined=await featherAlphaInside(refined);const t=await trimTransparent(refined),next={...one,src:t.src,x:one.x+one.w*t.left,y:one.y+one.h*t.top,w:one.w*t.width,h:one.h*t.height,kind:"nobg" as Kind},label=type==="image"?"Image Remove Background":type==="rim"?"Image Background + Rim":"Text Background Removal",step:LayerStep={id:uid(),type:"remove-bg",label,snapshot:snapshot(next)};mutate(one.id,()=>({...next,steps:[...one.steps,step],activeStep:one.steps.length}));setNotice(`${label} applied`)
    }catch{setNotice("Background removal preset could not be applied")}finally{setWorking(false)}
  };
  const optimizeSelectedAlpha=async()=>{
    if(!one||!["nobg","vector","stroke","acetate"].includes(one.kind)){setNotice("Select one background-removed image or Cutout first");return}
    setBgMenuOpen(false);setWorking(true);setNotice("Optimizing alpha channel…");
    try{const cleaned=await optimizeAlphaChannel(one.src),trimmed=await trimTransparent(cleaned),next={...one,src:trimmed.src,x:one.x+one.w*trimmed.left,y:one.y+one.h*trimmed.top,w:one.w*trimmed.width,h:one.h*trimmed.height},step:LayerStep={id:uid(),type:"optimize-alpha",label:"Optimize Alpha",snapshot:snapshot(next)};mutate(one.id,()=>({...next,steps:[...one.steps,step],activeStep:one.steps.length}));setNotice("Alpha channel optimized for cleaner Cricut cutting paths")}
    catch{setNotice("Alpha channel could not be optimized")}
    finally{setWorking(false)}
  };
  const commitBackground = async () => {
    if (!bgEditor) return;
    const target = layers.find((l) => l.id === bgEditor.layerId);
    if (!target) return;
    setWorking(true);
    try {
      const refined = !bgRendering && bgPreview ? bgPreview : await refineBackground(
        bgEditor.source, 0, bgEditor.strokes, bgEditor.speckles, bgEditor.edgeRefine, bgEditor.eraseColors, bgEditor.edgeSmooth, bgEditor.optimizeAlpha,
      );
      const t = await trimTransparent(refined);
      const next = {
        ...target,
        src: t.src,
        x: target.x + target.w * t.left,
        y: target.y + target.h * t.top,
        w: target.w * t.width,
        h: target.h * t.height,
        kind: "nobg" as Kind,
      };
      const step: LayerStep = {
        id: uid(),
        type: "remove-bg",
        label: "Remove Background",
        snapshot: snapshot(next),
      };
      mutate(target.id, () => ({
        ...next,
        steps: [...target.steps, step],
        activeStep: target.steps.length,
      }));
      setBgEditor(null);
      setNotice("Background removed, including enclosed background areas");
    } catch {
      setNotice("Background removal could not be applied. Please try again.");
    } finally {
      setWorking(false);
    }
  };
  const bgPointFromEvent = (e: RPointer<HTMLImageElement>) => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };
  const startBackgroundStroke = async (e: RPointer<HTMLImageElement>) => {
    if (!bgEditor || e.button !== 0) return;
    const id = uid();
    bgDrawing.current = id;
    setBgActiveStroke(id);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (bgEditor.pickingColor !== null) {
      const point = bgPointFromEvent(e), img = await getImage(bgEditor.source), sample = document.createElement("canvas");
      sample.width = img.naturalWidth; sample.height = img.naturalHeight;
      const context = sample.getContext("2d")!; context.drawImage(img,0,0);
      const pixel = context.getImageData(Math.min(sample.width-1,Math.floor(point.x*sample.width)),Math.min(sample.height-1,Math.floor(point.y*sample.height)),1,1).data;
      const color = `#${[pixel[0],pixel[1],pixel[2]].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
      const colors=[...bgEditor.eraseColors]; colors[bgEditor.pickingColor]={...colors[bgEditor.pickingColor],color};
      if(colors.every(entry=>entry.color)&&colors.length<6) colors.push({color:null,sensitivity:30});
      setBgEditor({...bgEditor,eraseColors:colors,pickingColor:null}); return;
    }
    const target=layers.find(layer=>layer.id===bgEditor.layerId);
    const reach=bgEditor.connectedReach>=51?null:(bgEditor.connectedReach/10)/Math.max(target?.w||1,target?.h||1);
    const stroke: BgStroke = { id, mode: bgEditor.mode, brush: bgEditor.brush, bleed:bgEditor.sensitivity, reach, points: [bgPointFromEvent(e)] };
    setBgEditor({ ...bgEditor, strokes: [...bgEditor.strokes, stroke] });
  };
  const moveBackgroundStroke = (e: RPointer<HTMLImageElement>) => {
    const cursor = bgPointFromEvent(e);
    setBgCursor({ ...cursor, visible: true });
    if (!bgDrawing.current || e.buttons !== 1) return;
    const point = cursor, id = bgDrawing.current;
    setBgEditor((v) => {
      if (!v) return v;
      return { ...v, strokes: v.strokes.map((s) => {
        if (s.id !== id) return s;
        const last = s.points[s.points.length - 1];
        if (last && Math.hypot(point.x - last.x, point.y - last.y) < Math.max(.0025, s.brush / 600)) return s;
        return { ...s, points: [...s.points, point] };
      }) };
    });
  };
  const endBackgroundStroke = () => {
    bgDrawing.current = null;
    setBgActiveStroke(null);
  };
  const zoomBackground = (e: RWheel<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (!bgEditor) return;
    setBgEditor({ ...bgEditor, zoom: clamp(bgEditor.zoom * (e.deltaY < 0 ? 1.12 : .89), .6, 5) });
  };
  const startBackgroundPan = (e: RPointer<HTMLDivElement>) => {
    e.stopPropagation();
    if (!bgEditor || e.button !== 1) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    bgPanDrag.current = { x: e.clientX, y: e.clientY, panX: bgEditor.panX, panY: bgEditor.panY };
  };
  const moveBackgroundPan = (e: RPointer<HTMLDivElement>) => {
    if (!bgEditor || !bgPanDrag.current) return;
    const p = bgPanDrag.current;
    setBgEditor({ ...bgEditor, panX: p.panX + e.clientX - p.x, panY: p.panY + e.clientY - p.y });
  };
  const endBackgroundPan = () => { bgPanDrag.current = null; };
  const zoomCutout = (e: RWheel<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (!cutEditor) return;
    setCutEditor({ ...cutEditor, zoom: clamp(cutEditor.zoom * (e.deltaY < 0 ? 1.12 : .89), .5, 4) });
  };
  const startCutoutPan = (e: RPointer<HTMLDivElement>) => {
    if (!cutEditor || e.button !== 1) return;
    e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
    cutPanDrag.current = { x: e.clientX, y: e.clientY, panX: cutEditor.panX, panY: cutEditor.panY };
  };
  const moveCutoutPan = (e: RPointer<HTMLDivElement>) => {
    if (!cutEditor || !cutPanDrag.current) return;
    const start = cutPanDrag.current;
    setCutEditor({ ...cutEditor, panX: start.panX + e.clientX - start.x, panY: start.panY + e.clientY - start.y });
  };
  const endCutoutPan = () => { cutPanDrag.current = null; };
  const openCutoutEditor = () => {
    if (!one || !["vector", "stroke"].includes(one.kind)) return;
    setCutPreview(one.src);
    setCutImageSize({ w: 0, h: 0 });
    setCutEditor({ layerId: one.id, source: one.src, color: one.color, tool: "bridge", brush: 3, strokes: [], crop: { left: 0, top: 0, right: 0, bottom: 0 }, zoom: 1, panX: 0, panY: 0 });
  };
  const cutPoint = (e: RPointer<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: clamp((e.clientX-r.left)/r.width,0,1), y: clamp((e.clientY-r.top)/r.height,0,1) };
  };
  const startCutEdit = (e: RPointer<HTMLImageElement>) => {
    if (!cutEditor || e.button !== 0) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    const id = uid(); cutDrawing.current = id; setCutActiveStroke(id);
    const stroke: EditStroke = { id, tool: cutEditor.tool, brush: cutEditor.brush, points: [cutPoint(e)] };
    setCutEditor({ ...cutEditor, strokes: [...cutEditor.strokes, stroke] });
  };
  const moveCutEdit = (e: RPointer<HTMLImageElement>) => {
    const cursor=cutPoint(e); setCutCursor({...cursor,visible:true});
    if (!cutDrawing.current || e.buttons !== 1) return;
    const id = cutDrawing.current, p = cursor;
    setCutEditor((v) => v ? { ...v, strokes: v.strokes.map((s) => {
      if (s.id !== id) return s; const last=s.points.at(-1);
      return last && Math.hypot(p.x-last.x,p.y-last.y)<.003 ? s : { ...s, points:[...s.points,p] };
    }) } : v);
  };
  const endCutEdit = () => { cutDrawing.current = null; setCutActiveStroke(null); };
  const startCropDrag = (e:RPointer<HTMLButtonElement>,mode:string) => {
    if(!cutEditor)return; e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);
    const rect=e.currentTarget.closest(".cut-image-wrap")!.getBoundingClientRect();
    cropDrag.current={mode,x:e.clientX,y:e.clientY,crop:{...cutEditor.crop},rect};
  };
  const moveCropDrag = (e:RPointer<HTMLButtonElement>) => {
    const d=cropDrag.current;if(!d||!cutEditor)return;e.preventDefault();
    const dx=(e.clientX-d.x)/d.rect.width*100,dy=(e.clientY-d.y)/d.rect.height*100,c={...d.crop};
    if(d.mode.includes("w"))c.left=clamp(d.crop.left+dx,0,Math.min(90,95-c.right));
    if(d.mode.includes("e"))c.right=clamp(d.crop.right-dx,0,Math.min(90,95-c.left));
    if(d.mode.includes("n"))c.top=clamp(d.crop.top+dy,0,Math.min(90,95-c.bottom));
    if(d.mode.includes("s"))c.bottom=clamp(d.crop.bottom-dy,0,Math.min(90,95-c.top));
    setCutEditor({...cutEditor,crop:c});
  };
  const endCropDrag=()=>{cropDrag.current=null};
  const applyCutoutEdit = async () => {
    if (!cutEditor) return;
    const target = layers.find((l) => l.id === cutEditor.layerId); if (!target) return;
    setWorking(true);
    try {
      const result = await renderCutoutEdit(cutEditor, true), baked = await silhouette(result.src,target.color,255), next: Layer = {
        ...target, src: baked, originalSrc: baked, kind: "vector", strokeCm: 0, fillGapsMm: 0,
        parentId: undefined, innerSrc: undefined, acetateOn: false, invalid: false,
        x: target.x + target.w*result.left, y: target.y + target.h*result.top,
        w: target.w*result.width, h: target.h*result.height, steps: [], activeStep: 0,
      };
      const step: LayerStep = { id: uid(), type: "cutout", label: "Cutout", locked: true, snapshot: snapshot(next) };
      next.steps=[step]; mutate(target.id,()=>next); setCutEditor(null); setNotice("Cutout edits baked into the layer");
    } finally { setWorking(false); }
  };
  const openImageEditor=()=>{if(!one||["vector","stroke","acetate"].includes(one.kind))return;setImageEditorSize({w:0,h:0});setImageEditor({layerId:one.id,source:one.src,crop:{left:0,top:0,right:0,bottom:0},upscale:1,tool:"crop",brush:4,strokes:[],history:[],offsetX:0,offsetY:0,widthScale:1,heightScale:1})};
  const imageEditPoint=(e:RPointer<HTMLImageElement>)=>{const r=e.currentTarget.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)}};
  const startImageEdit=(e:RPointer<HTMLImageElement>)=>{if(!imageEditor||imageEditor.tool==="crop"||e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const id=uid(),stroke:ImageEditStroke={id,tool:imageEditor.tool,brush:imageEditor.brush,points:[imageEditPoint(e)]};imageDrawing.current=id;setImageEditor({...imageEditor,strokes:[...imageEditor.strokes,stroke]})};
  const moveImageEdit=(e:RPointer<HTMLImageElement>)=>{if(!imageDrawing.current||!imageEditor||e.buttons!==1)return;const p=imageEditPoint(e),id=imageDrawing.current;setImageEditor(v=>v?{...v,strokes:v.strokes.map(s=>s.id!==id?s:{...s,points:[...s.points,p]})}:v)};
  const renderImageStage=async(editor:ImageEditor)=>{const img=await getImage(editor.source),work=document.createElement("canvas");work.width=img.naturalWidth;work.height=img.naturalHeight;const wx=work.getContext("2d")!;wx.drawImage(img,0,0);wx.globalCompositeOperation="destination-out";for(const stroke of editor.strokes){if(!stroke.points.length)continue;wx.beginPath();if(stroke.tool==="lasso"){stroke.points.forEach((p,i)=>i?wx.lineTo(p.x*work.width,p.y*work.height):wx.moveTo(p.x*work.width,p.y*work.height));wx.closePath();wx.fill()}else{wx.lineWidth=Math.max(2,stroke.brush/100*Math.min(work.width,work.height));wx.lineCap="round";wx.lineJoin="round";stroke.points.forEach((p,i)=>i?wx.lineTo(p.x*work.width,p.y*work.height):wx.moveTo(p.x*work.width,p.y*work.height));if(stroke.points.length===1){const p=stroke.points[0];wx.arc(p.x*work.width,p.y*work.height,wx.lineWidth/2,0,Math.PI*2);wx.fill()}else wx.stroke()}}const c=editor.crop,l=clamp(c.left/100,0,.9),t=clamp(c.top/100,0,.9),r=clamp(c.right/100,0,.9-l),b=clamp(c.bottom/100,0,.9-t),sx=Math.round(work.width*l),sy=Math.round(work.height*t),sw=Math.max(1,Math.round(work.width*(1-l-r))),sh=Math.max(1,Math.round(work.height*(1-t-b))),out=document.createElement("canvas");out.width=sw;out.height=sh;out.getContext("2d")!.drawImage(work,sx,sy,sw,sh,0,0,sw,sh);return{src:out.toDataURL("image/png"),l,t,w:1-l-r,h:1-t-b,naturalW:sw,naturalH:sh}};
  const commitImageStage=async()=>{if(!imageEditor||(!imageEditor.strokes.length&&!Object.values(imageEditor.crop).some(Boolean)))return;const before:ImageEditState={source:imageEditor.source,offsetX:imageEditor.offsetX,offsetY:imageEditor.offsetY,widthScale:imageEditor.widthScale,heightScale:imageEditor.heightScale},rendered=await renderImageStage(imageEditor);setImageEditor(v=>v?{...v,source:rendered.src,strokes:[],crop:{left:0,top:0,right:0,bottom:0},history:[...v.history,before],offsetX:v.offsetX+v.widthScale*rendered.l,offsetY:v.offsetY+v.heightScale*rendered.t,widthScale:v.widthScale*rendered.w,heightScale:v.heightScale*rendered.h}:v)};
  const undoImageStage=()=>setImageEditor(v=>{if(!v||!v.history.length)return v;const prior=v.history[v.history.length-1];return{...v,...prior,history:v.history.slice(0,-1),strokes:[],crop:{left:0,top:0,right:0,bottom:0}}});
  const endImageEdit=()=>{imageDrawing.current=null;void commitImageStage()};
  const applyImageEdit=async(createLayer=false)=>{
    if(!imageEditor)return;const target=layers.find(l=>l.id===imageEditor.layerId);if(!target)return;setWorking(true);
    try{if(imageEditor.strokes.length||Object.values(imageEditor.crop).some(Boolean))await commitImageStage();const current=imageEditor.strokes.length||Object.values(imageEditor.crop).some(Boolean)?await renderImageStage(imageEditor):{src:imageEditor.source,naturalW:(await getImage(imageEditor.source)).naturalWidth,naturalH:(await getImage(imageEditor.source)).naturalHeight};const img=await getImage(current.src),out=document.createElement("canvas"),factor=imageEditor.upscale;out.width=img.naturalWidth*factor;out.height=img.naturalHeight*factor;const x=out.getContext("2d")!;x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";x.drawImage(img,0,0,out.width,out.height);const src=out.toDataURL("image/png"),edited={...target,src,originalSrc:src,x:target.x+target.w*imageEditor.offsetX,y:target.y+target.h*imageEditor.offsetY,w:target.w*imageEditor.widthScale,h:target.h*imageEditor.heightScale,naturalW:out.width,naturalH:out.height};const step:LayerStep={id:uid(),type:"edit-image",label:"Edit Image",snapshot:snapshot(edited)};edited.steps=[...target.steps,step];edited.activeStep=edited.steps.length-1;if(createLayer){const clone={...edited,id:uid(),name:`${target.name}_Edit`};setLayers(items=>{const at=items.findIndex(v=>v.id===target.id);const next=[...items];next.splice(at+1,0,clone);return next});setSelected([clone.id])}else mutate(target.id,()=>edited);setImageEditor(null);setNotice(createLayer?"Edited result created as a separate layer":`Image edited at ${out.width} × ${out.height} px`)}finally{setWorking(false)}
  };
  const startImageCrop=(e:RPointer<HTMLButtonElement>,mode:string)=>{if(!imageEditor)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);imageCropDrag.current={mode,x:e.clientX,y:e.clientY,crop:{...imageEditor.crop},rect:e.currentTarget.closest(".image-edit-wrap")!.getBoundingClientRect()}};
  const moveImageCrop=(e:RPointer<HTMLButtonElement>)=>{const d=imageCropDrag.current;if(!d||!imageEditor)return;const dx=(e.clientX-d.x)/d.rect.width*100,dy=(e.clientY-d.y)/d.rect.height*100,c={...d.crop};if(d.mode.includes("w"))c.left=clamp(d.crop.left+dx,0,Math.min(90,95-c.right));if(d.mode.includes("e"))c.right=clamp(d.crop.right-dx,0,Math.min(90,95-c.left));if(d.mode.includes("n"))c.top=clamp(d.crop.top+dy,0,Math.min(90,95-c.bottom));if(d.mode.includes("s"))c.bottom=clamp(d.crop.bottom-dy,0,Math.min(90,95-c.top));setImageEditor({...imageEditor,crop:c})};
  const endImageCrop=()=>{imageCropDrag.current=null;void commitImageStage()};
  const addStroke = async (cmOverride?: number) => {
    if (!one || one.kind !== "vector") {
      setNotice("Stroke can only be applied to a Cutout layer");
      return;
    }
    setWorking(true);
    try {
      const cm = cmOverride ?? strokeDraft,
        src = await strokeImage(
          one.src,
          cm,
          one.w,
          lighten(one.color),
          fillGapsDraft,
        ),
        x = one.x - cm,
        y = one.y - cm,
        w = one.w + cm * 2,
        h = one.h + cm * 2,
        invalid =
          x < SAFE.x ||
          y < SAFE.y ||
          x + w > SAFE.x + SAFE.w ||
          y + h > SAFE.y + SAFE.h;
      const id = uid(),
        strokeLayer: Layer = {
          ...one,
          id,
          name: `${one.name.replace(/_Stroke$/, "")}_Stroke`,
          src,
          innerSrc: one.src,
          kind: "stroke",
          strokeCm: cm,
          fillGapsMm: fillGapsDraft,
          parentId: one.id,
          x,
          y,
          w,
          h,
          invalid,
          visible: true,
          color: lighten(one.color),
          steps: [],
          activeStep: 0,
          acetateOn: false,
        };
      strokeLayer.steps = [
        ...one.steps,
        {
          id: uid(),
          type: "stroke",
          label: `Stroke · ${cm.toFixed(1)} cm`,
          snapshot: snapshot(strokeLayer),
        },
      ];
      strokeLayer.activeStep = strokeLayer.steps.length - 1;
      setLayers((v) => {
        const index = v.findIndex((l) => l.id === one.id),
          next = [...v];
        next.splice(Math.max(0, index), 0, strokeLayer);
        return next;
      });
      setSelected([id]);
      setNotice(
        invalid
          ? "Stroke extends outside the safe area"
          : "Stroke applied as a new layer below the Cutout",
      );
    } finally {
      setWorking(false);
    }
  };
  const updateStroke = async () => {
    if (!one || one.kind !== "stroke") return;
    setWorking(true);
    try {
      const parent = layers.find((l) => l.id === one.parentId),
        base = parent || one,
        old = one.strokeCm,
        cm = strokeDraft,
        newW = Math.max(0.2, one.w + 2 * (cm - old)),
        newH = Math.max(0.2, one.h + 2 * (cm - old)),
        x = one.x - (cm - old),
        y = one.y - (cm - old),
        previewColor = one.color,
        src = await strokeImage(
          base.src,
          cm,
          base.w,
          previewColor,
          fillGapsDraft,
        ),
        invalid =
          x < SAFE.x ||
          y < SAFE.y ||
          x + newW > SAFE.x + SAFE.w ||
          y + newH > SAFE.y + SAFE.h;
      mutate(one.id, (l) => {
        const next = {
          ...l,
          src,
          strokeCm: cm,
          fillGapsMm: fillGapsDraft,
          x,
          y,
          w: newW,
          h: newH,
          invalid,
          color: previewColor,
        };
        const steps = [...l.steps],
          index = steps.findIndex((s) => s.type === "stroke");
        const step: LayerStep = {
          id: steps[index]?.id || uid(),
          type: "stroke",
          label: `Stroke · ${cm.toFixed(1)} cm`,
          snapshot: snapshot(next),
        };
        if (index >= 0) steps[index] = step;
        else steps.push(step);
        return { ...next, steps, activeStep: steps.length - 1 };
      });
      setNotice(
        invalid ? "Stroke extends outside the safe area" : "Stroke updated",
      );
    } finally {
      setWorking(false);
    }
  };
  const applyGapPreview = async () => {
    if (!one || !["vector", "stroke"].includes(one.kind)) return;
    setWorking(true);
    try {
      const parent =
          one.kind === "stroke"
            ? layers.find((l) => l.id === one.parentId)
            : undefined,
        base = parent || one,
        cm = one.kind === "stroke" ? one.strokeCm : 0,
        preservedColor = one.color,
        src = await strokeImage(
          base.src,
          cm,
          base.w,
          preservedColor,
          fillGapsDraft,
        );
      mutate(one.id, (l) => {
        const next = {
            ...l,
            src,
            fillGapsMm: fillGapsDraft,
            color: preservedColor,
          },
          steps = l.steps.filter((s) => s.type !== "fill-gaps");
        if (fillGapsDraft > 0)
          steps.push({
            id: uid(),
            type: "fill-gaps",
            label: `Fill Gaps · ${Math.round(fillGapsDraft)} mm`,
            snapshot: snapshot(next),
          });
        return { ...next, steps, activeStep: steps.length - 1 };
      });
      setNotice(
        fillGapsDraft > 0
          ? "Gap Fill preview applied"
          : "Gap Fill preview removed",
      );
    } finally {
      setWorking(false);
    }
  };
  const makeGapsPermanent = async () => {
    if (!one || !["stroke", "vector"].includes(one.kind))
      return;
    setWorking(true);
    try {
      const solid = await silhouette(one.src, one.color, 255),
        trimmed = await trimTransparent(solid),
        finalLayer: Layer = {
          ...one,
          name: one.name.replace(/_Stroke$/, ""),
          src: trimmed.src,
          originalSrc: trimmed.src,
          kind: "vector",
          strokeCm: 0,
          fillGapsMm: 0,
          parentId: undefined,
          innerSrc: undefined,
          x: one.x + one.w * trimmed.left,
          y: one.y + one.h * trimmed.top,
          w: one.w * trimmed.width,
          h: one.h * trimmed.height,
          visible: true,
          invalid: false,
        };
      const cutoutStep: LayerStep = {
        id: uid(),
        type: "cutout",
        label: "Cutout",
        locked: true,
        snapshot: snapshot(finalLayer),
      };
      finalLayer.steps = [cutoutStep];
      finalLayer.activeStep = 0;
      mutate(one.id, () => finalLayer);
      setFillGapsDraft(0);
      setNotice("Cutout baked. Editable modifiers were merged into the shape");
    } finally {
      setWorking(false);
    }
  };
  const acetate = async () => {
    if (!one || !["vector", "stroke"].includes(one.kind)) return;
    mutate(one.id, (l) => {
      const enabled = !l.acetateOn,
        steps = l.steps.filter((s) => s.type !== "acetate");
      const next = { ...l, acetateOn: enabled };
      if (enabled)
        steps.push({
          id: uid(),
          type: "acetate",
          label: "Acetate",
          snapshot: snapshot(next),
        });
      return { ...next, steps, activeStep: steps.length - 1 };
    });
    setNotice(
      one.acetateOn ? "Acetate preview disabled" : "Acetate preview enabled",
    );
  };
  const cutout = async () => {
    if (!one) return;
    setWorking(true);
    try {
      const color = COLORS[Math.floor(Math.random() * 21)],
        t = await trimTransparent(await silhouette(await removeBg(one.src), color, 255)),
        next = {
          ...one,
          src: t.src,
          x: one.x + one.w * t.left,
          y: one.y + one.h * t.top,
          w: one.w * t.width,
          h: one.h * t.height,
          color,
          kind: "vector" as Kind,
        };
      const step: LayerStep = {
        id: uid(),
        type: "cutout",
        label: "Cutout",
        snapshot: snapshot(next),
      };
      mutate(one.id, () => ({
        ...next,
        steps: [...one.steps, step],
        activeStep: one.steps.length,
      }));
      setNotice("Cutout created and ready for SVG export");
    } finally {
      setWorking(false);
    }
  };
  const smoothCutoutV1 = async () => {
    if (!one || ["vector", "stroke", "acetate"].includes(one.kind)) return;
    setBgMenuOpen(false); setVTracerStartedAt(Date.now()); setWorking(true);
    try {
      const refined = await refineBackground(one.src, 46, [], 12, 0), trimmed = await trimTransparent(refined),
        color = COLORS[Math.floor(Math.random() * 21)], solid = await silhouette(trimmed.src, color, 255),
        vectorSrc = await vTracerCutout(solid, color),
        noBgLayer: Layer = { ...one, src: trimmed.src, x: one.x + one.w * trimmed.left, y: one.y + one.h * trimmed.top, w: one.w * trimmed.width, h: one.h * trimmed.height, kind: "nobg" },
        finalLayer: Layer = { ...noBgLayer, name: `${one.name.replace(/_(NoBG|Cutout|SmoothCutout)$/i, "")}_SmoothCutout`, src: vectorSrc, color, kind: "vector" };
      const removeStep: LayerStep = { id: uid(), type: "remove-bg", label: "Remove Background", snapshot: snapshot(noBgLayer) },
        cutoutStep: LayerStep = { id: uid(), type: "cutout", label: "Smooth Cutout v3", snapshot: snapshot(finalLayer) };
      mutate(one.id, () => ({ ...finalLayer, steps: [...one.steps, removeStep, cutoutStep], activeStep: one.steps.length + 1 }));
      setNotice("Smooth Cutout v3 created with VTracer");
    } catch (error) { setNotice(`Smooth Cutout could not be created: ${error instanceof Error ? error.message : "Unknown error"}`); }
    finally { setWorking(false); setVTracerStartedAt(null); }
  };
  const applyColor = async (color: string) => {
    if (!vectorsOnly) return;
    setWorking(true);
    try {
      for (const item of picked) {
        const base = layers.find((l) => l.id === item.parentId) || item;
        const src =
          item.kind === "stroke"
            ? await strokeImage(
                base.src,
                item.strokeCm,
                base.w,
                color,
                item.fillGapsMm || 0,
              )
            : await silhouette(
                item.src,
                color,
                item.kind === "acetate" ? 77 : 255,
              );
        mutate(item.id, (l) => ({ ...l, src, color }));
        if (item.kind === "vector")
          for (const child of layers.filter(
            (l) => l.kind === "stroke" && l.parentId === item.id,
          )) {
            const strokeSrc = await strokeImage(
              src,
              child.strokeCm,
              item.w,
              lighten(color),
              child.fillGapsMm || 0,
            );
            mutate(child.id, (l) => ({
              ...l,
              src: strokeSrc,
              color: lighten(color),
            }));
          }
      }
      setColorOpen(false);
    } finally {
      setWorking(false);
    }
  };
  const choose = (e: RPointer, l: Layer) => {
    e.stopPropagation();
    if (e.shiftKey || e.ctrlKey || e.metaKey)
      setSelected((v) =>
        v.includes(l.id) ? v.filter((x) => x !== l.id) : [...v, l.id],
      );
    else if (!selected.includes(l.id)) setSelected([l.id]);
  };
  const startDrag = (e: RPointer, mode: string) => {
    e.stopPropagation();
    if (!picked.length) return;
    const rect = (
        e.currentTarget as HTMLElement
      ).parentElement?.getBoundingClientRect(),
      cx = rect ? rect.left + rect.width / 2 : e.clientX,
      cy = rect ? rect.top + rect.height / 2 : e.clientY;
    setDrag({
      mode,
      sx: e.clientX,
      sy: e.clientY,
      start: picked.map((l) => ({ ...l })),
      box:
        mode === "rotate" && one
          ? { x: one.x, y: one.y, w: one.w, h: one.h }
          : { ...box },
      cx,
      cy,
      angle0: Math.atan2(e.clientY - cy, e.clientX - cx),
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const pointerMove = (e: RPointer) => {
    if (pan.current && stageRef.current) {
      stageRef.current.scrollLeft = pan.current.l - (e.clientX - pan.current.x);
      stageRef.current.scrollTop = pan.current.t - (e.clientY - pan.current.y);
      return;
    }
    if (!drag) return;
    const dx = (e.clientX - drag.sx) / scale,
      dy = (e.clientY - drag.sy) / scale,
      b = drag.box;
    if (drag.mode === "marquee") {
      setMarquee({
        x: Math.min(b.x, b.x + dx),
        y: Math.min(b.y, b.y + dy),
        w: Math.abs(dx),
        h: Math.abs(dy),
      });
      return;
    }
    if(drag.mode==="draw-shape"){
      const source=drag.start[0],lockedShape=e.shiftKey,
        rawW=Math.abs(dx),rawH=Math.abs(dy),size=Math.max(rawW,rawH),nw=Math.max(.1,lockedShape?size:rawW),nh=Math.max(.1,lockedShape?size:rawH),
        nx=dx<0?drag.box.x-nw:drag.box.x,ny=dy<0?drag.box.y-nh:drag.box.y;
      setLayers(v=>v.map(l=>l.id===source.id?{...l,x:clamp(nx,SAFE.x,SAFE.x+SAFE.w-nw),y:clamp(ny,SAFE.y,SAFE.y+SAFE.h-nh),w:Math.min(nw,SAFE.w),h:Math.min(nh,SAFE.h)}:l));
      return;
    }
    if (drag.mode === "rotate") {
      const a = Math.atan2(
          e.clientY - (drag.cy || 0),
          e.clientX - (drag.cx || 0),
        ),
        raw = ((a - (drag.angle0 || 0)) * 180) / Math.PI,
        step = e.ctrlKey ? 5 : 1,
        delta = Math.round(raw / step) * step,
        rad = (delta * Math.PI) / 180,
        cx = b.x + b.w / 2,
        cy = b.y + b.h / 2;
      setLayers((v) =>
        v.map((l) => {
          const s = drag.start.find((q) => q.id === l.id);
          if (!s) return l;
          const ox = s.x + s.w / 2 - cx,
            oy = s.y + s.h / 2 - cy,
            ncx = cx + ox * Math.cos(rad) - oy * Math.sin(rad),
            ncy = cy + ox * Math.sin(rad) + oy * Math.cos(rad);
          return {
            ...l,
            x: ncx - s.w / 2,
            y: ncy - s.h / 2,
            rotation: s.rotation + delta,
          };
        }),
      );
      return;
    }
    if (drag.mode === "move") {
      const allowedDx=clamp(dx,Math.max(...drag.start.map(s=>SAFE.x-s.x)),Math.min(...drag.start.map(s=>SAFE.x+SAFE.w-s.w-s.x))),
        allowedDy=clamp(dy,Math.max(...drag.start.map(s=>SAFE.y-s.y)),Math.min(...drag.start.map(s=>SAFE.y+SAFE.h-s.h-s.y)));
      setLayers((v) =>
        v.map((l) => {
          const s = drag.start.find((q) => q.id === l.id);
          return s
            ? {
                ...l,
                x: s.x + allowedDx,
                y: s.y + allowedDy,
              }
            : l;
        }),
      );
      return;
    }
    const left = drag.mode.includes("w"),
      top = drag.mode.includes("n"),
      corner = drag.mode.length === 2;
    const horizontal = drag.mode.includes("e") || drag.mode.includes("w"),
      vertical = drag.mode.includes("n") || drag.mode.includes("s");
    let nw = horizontal ? b.w + (left ? -dx : dx) : b.w,
      nh = vertical ? b.h + (top ? -dy : dy) : b.h;
    if (corner && e.shiftKey) {
      const r = b.w / b.h;
      if (Math.abs(dx) > Math.abs(dy)) nh = nw / r;
      else nw = nh * r;
    }
    nw = clamp(nw, 0.3, SAFE.w);
    nh = clamp(nh, 0.3, SAFE.h);
    const sx = nw / b.w,
      sy = nh / b.h,
      nx = clamp(left ? b.x + b.w - nw : b.x, SAFE.x, SAFE.x + SAFE.w - nw),
      ny = clamp(top ? b.y + b.h - nh : b.y, SAFE.y, SAFE.y + SAFE.h - nh);
    setLayers((v) =>
      v.map((l) => {
        const s = drag.start.find((q) => q.id === l.id);
        return s
          ? {
              ...l,
              x: nx + (s.x - b.x) * sx,
              y: ny + (s.y - b.y) * sy,
              w: s.w * sx,
              h: s.h * sy,
            }
          : l;
      }),
    );
  };
  const canvasDown = (e: RPointer) => {
    e.stopPropagation();
    if (e.button === 1 && stageRef.current) {
      e.preventDefault();
      pan.current = {
        x: e.clientX,
        y: e.clientY,
        l: stageRef.current.scrollLeft,
        t: stageRef.current.scrollTop,
      };
      return;
    }
    const r = e.currentTarget.getBoundingClientRect(),
      x = (e.clientX - r.left) / scale,
      y = (e.clientY - r.top) / scale,
      h = [...layers]
        .reverse()
        .filter(
          (l) =>
            l.visible &&
            x >= l.x &&
            x <= l.x + l.w &&
            y >= l.y &&
            y <= l.y + l.h,
        );
    if (shapeTool && e.button === 0) {
      e.preventDefault();
      const id=uid(),color=COLORS[Math.floor(Math.random()*21)],src=shapeSource(shapeTool,color),layer:Layer={
        id,name:shapeTool,src,originalSrc:src,visible:true,x,y,w:.1,h:.1,naturalW:1600,naturalH:1600,
        kind:"vector",strokeCm:0,fillGapsMm:0,invalid:false,rotation:0,color,steps:[],activeStep:0,acetateOn:false,
      };
      const step:LayerStep={id:uid(),type:"cutout",label:"Cutout",locked:true,snapshot:snapshot(layer)};layer.steps=[step];
      setLayers(v=>[...v,layer]);setSelected([id]);setDrag({mode:"draw-shape",sx:e.clientX,sy:e.clientY,start:[layer],box:{x,y,w:0,h:0}});
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);return;
    }
    if (!h.length) {
      setSelected([]);
      setMarquee({ x, y, w: 0, h: 0 });
      setDrag({
        mode: "marquee",
        sx: e.clientX,
        sy: e.clientY,
        start: [],
        box: { x, y, w: 0, h: 0 },
      });
      return;
    }
    const key = h.map((v) => v.id).join(":"),
      i = key === cycle.key ? (cycle.index + 1) % h.length : 0;
    setCycle({ key, index: i });
    const target = h[i];
    if (e.shiftKey || e.ctrlKey || e.metaKey)
      setSelected((v) =>
        v.includes(target.id)
          ? v.filter((q) => q !== target.id)
          : [...v, target.id],
      );
    else setSelected([target.id]);
    const moving = selected.includes(target.id) ? picked : [target];
    setDrag({
      mode: "move",
      sx: e.clientX,
      sy: e.clientY,
      start: moving.map((l) => ({ ...l })),
      box: bounds(moving),
    });
  };
  const stageDown = (e: RPointer<HTMLDivElement>) => {
    if (!stageRef.current) return;
    if (e.button === 1) {
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
      pan.current = { x: e.clientX, y: e.clientY, l: stageRef.current.scrollLeft, t: stageRef.current.scrollTop };
      return;
    }
    if(e.button!==0||(e.target as HTMLElement).closest("button,.viewport-rulers,.canvas"))return;
    const canvas=canvasRef.current;if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/scale,y=(e.clientY-rect.top)/scale;
    setSelected([]);setMarquee({x,y,w:0,h:0});setDrag({mode:"marquee",sx:e.clientX,sy:e.clientY,start:[],box:{x,y,w:0,h:0}});
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const endPointer = async () => {
    if (marquee && marquee.w > 0.05 && marquee.h > 0.05) {
      const candidates = layers.filter((l) => {
        const b = rotatedBounds(l);
        return l.visible && b.x < marquee.x + marquee.w && b.x + b.w > marquee.x && b.y < marquee.y + marquee.h && b.y + b.h > marquee.y;
      });
      const hits = await Promise.all(candidates.map(async (layer) => (await marqueeTouchesVisiblePixels(layer, marquee)) ? layer.id : null));
      setSelected(hits.filter((id): id is string => Boolean(id)));
    }
    if (drag?.mode === "rotate") {
      const rotatedIds = new Set(drag.start.map((l) => l.id));
      const current = layers.filter((l) => rotatedIds.has(l.id));
      const baked = await Promise.all(current.map(bakeRotation));
      setLayers((items) =>
        items.map((l) => baked.find((b) => b.id === l.id) || l),
      );
    }
    if (drag?.mode === "draw-shape") setShapeTool(null);
    setMarquee(null);
    setDrag(null);
    pan.current = null;
  };
  const dimension = (key: "w" | "h", val: number) => {
    if (!picked.length || !isFinite(val)) return;
    const ratio = box.w / box.h;
    const w = key === "w" ? val : locked ? val * ratio : box.w,
      h = key === "h" ? val : locked ? val / ratio : box.h,
      wScale = w / box.w,
      hScale = h / box.h;
    setLayers((v) =>
      v.map((l) => {
        if (!selected.includes(l.id)) return l;
        return {
          ...l,
          x: box.x + (l.x - box.x) * wScale,
          y: box.y + (l.y - box.y) * hScale,
          w: l.w * wScale,
          h: l.h * hScale,
        };
      }),
    );
  };
  const commitDimension = (key: "w" | "h", value: string) => {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) dimension(key, parsed);
    else if (key === "w") setWidthDraft(box.w.toFixed(1));
    else setHeightDraft(box.h.toFixed(1));
  };
  const align = (mode: string) => {
    if (picked.length < 2) return;
    const b = bounds(picked);
    setLayers((v) =>
      v.map((l) => {
        if (!selected.includes(l.id)) return l;
        const left = mode.includes("left"),
          right = mode.includes("right"),
          top = mode.includes("top"),
          bottom = mode.includes("bottom"),
          center = mode === "center",
          horizontalCenter = center || mode === "hcenter",
          verticalCenter = center || mode === "vcenter";
        return {
          ...l,
          x: left
            ? b.x
            : right
              ? b.x + b.w - l.w
              : horizontalCenter
                ? b.x + (b.w - l.w) / 2
                : l.x,
          y: top
            ? b.y
            : bottom
              ? b.y + b.h - l.h
              : verticalCenter
                ? b.y + (b.h - l.h) / 2
                : l.y,
        };
      }),
    );
  };
  const showStep = (layer: Layer, index: number) => {
    const step = layer.steps[index];
    if (!step) return;
    mutate(layer.id, (l) => ({ ...l, ...step.snapshot, activeStep: index }));
  };
  const removeStep = (layer: Layer, index: number) => {
    const step = layer.steps[index];
    if (!step || step.locked) return;
    const steps = layer.steps.slice(0, index),
      previous = steps.at(-1)?.snapshot;
    mutate(layer.id, (l) => ({
      ...l,
      ...(previous || {
        src: l.originalSrc,
        kind: "original" as Kind,
        color: DARK,
        strokeCm: 0,
        fillGapsMm: 0,
        acetateOn: false,
      }),
      steps,
      activeStep: steps.length - 1,
    }));
    setNotice("The selected step and all following steps were removed");
  };
  const duplicate = async () => {
    const copies: Layer[] = [];
    for (const l of picked) {
      let color = l.color,
        src = l.src;
      if (l.kind === "vector") {
        const i = Math.max(0, COLORS.indexOf(l.color));
        color = COLORS[(i + 2) % COLORS.length];
        src = await silhouette(l.src, color, 255);
      }
      copies.push({
        ...l,
        id: uid(),
        name: `${l.name}_Copy`,
        src,
        color,
        x: clamp(l.x + 0.4, SAFE.x, SAFE.x + SAFE.w - l.w),
        y: clamp(l.y + 0.4, SAFE.y, SAFE.y + SAFE.h - l.h),
      });
    }
    setLayers((v) => v.concat(copies));
    setSelected(copies.map((l) => l.id));
  };
  const copy = () => {
      clipboard.current = picked.map((l) => ({ ...l }));
    },
    paste = () => {
      const copies = clipboard.current.map((l) => ({
        ...l,
        id: uid(),
        name: `${l.name}_Copy`,
        x: clamp(l.x + 0.4, 1, 20 - l.w),
        y: clamp(l.y + 0.4, 1, 28.7 - l.h),
      }));
      setLayers((v) => v.concat(copies));
      setSelected(copies.map((l) => l.id));
    },
    removeSelected = () => {
      setLayers((v) => v.filter((l) => !selected.includes(l.id)));
      setSelected([]);
    },
    cut = () => {
      copy();
      removeSelected();
    };
  const renderCanvas = async (l: Layer, colored = true, multiplier = 1) => {
    const w = Math.round((l.w / 2.54) * DPI * multiplier),
      h = Math.round((l.h / 2.54) * DPI * multiplier),
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d")!,
      img = await getImage(l.src);
    x.drawImage(img, 0, 0, w, h);
    if (!colored || ["stroke", "acetate", "vector"].includes(l.kind)) {
      x.globalCompositeOperation = "source-in";
      x.fillStyle = DARK;
      x.globalAlpha = 1;
      x.fillRect(0, 0, w, h);
    }
    return c;
  };
  const canExport = picked.length > 0 && picked.every((l) => !l.invalid),
    canSVG =
      picked.length > 0 &&
      picked.every((l) => ["vector", "stroke"].includes(l.kind) && !l.invalid),
    exportPNG = async () => {
      if (!canExport) return;
      for (const layer of picked) {
        const c = await renderCanvas(layer, true, 3),
          b = await new Promise<Blob | null>((resolve) =>
            c.toBlob(resolve, "image/png"),
          );
        if (b) save(URL.createObjectURL(b), `${layer.name}_PNG_Cricut.png`);
      }
    },
    exportSVG = async () => {
      if (!canSVG) return;
      setWorking(true);
      try {
        for (const layer of picked) {
          if (layer.src.startsWith("data:image/svg+xml,")) {
            const raw = decodeURIComponent(layer.src.slice(layer.src.indexOf(",") + 1));
            const nativeDoc = new DOMParser().parseFromString(raw, "image/svg+xml");
            const nativeRoot = nativeDoc.documentElement;
            nativeRoot.setAttribute("width", `${layer.w}cm`);
            nativeRoot.setAttribute("height", `${layer.h}cm`);
            nativeRoot.setAttribute("fill", DARK);
            nativeRoot.setAttribute("stroke", DARK);
            nativeRoot.querySelectorAll("path,rect,ellipse,circle,polygon").forEach((node) => {
              node.setAttribute("fill", DARK);
              node.setAttribute("stroke", DARK);
            });
            save(URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(nativeRoot)], { type: "image/svg+xml" })), `${layer.name}_SVG_Cricut.svg`);
            continue;
          }
          // Export uses a temporary baked copy. The editable layer and all of
          // its parametric modifiers remain untouched in the project.
          const bakedSrc = await silhouette(layer.src, DARK, 255),
            bakedLayer: Layer = { ...layer, src: bakedSrc, kind: "vector", acetateOn: false },
            source = await renderCanvas(bakedLayer, false, 3),
            input = document.createElement("canvas");
          input.width = source.width;
          input.height = source.height;
          const context = input.getContext("2d")!;
          context.fillStyle = "#fff";
          context.fillRect(0, 0, input.width, input.height);
          context.drawImage(source, 0, 0);
          const paths = traceCanvas(input, {
            turnpolicy: "minority",
            turdsize: 3,
            alphamax: 1,
            optcurve: true,
            opttolerance: 0.18,
          });
          let svg = getSVG(paths, 1, "fill");
          const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
          doc
            .querySelectorAll("path")
            .forEach((path) => path.setAttribute("fill", DARK));
          const root = doc.documentElement;
          root.setAttribute("width", `${layer.w}cm`);
          root.setAttribute("height", `${layer.h}cm`);
          root.setAttribute("viewBox", `0 0 ${input.width} ${input.height}`);
          root.setAttribute("preserveAspectRatio", "none");
          svg = new XMLSerializer().serializeToString(root);
          save(
            URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
            `${layer.name}_SVG_Cricut.svg`,
          );
        }
        setNotice("Potrace SVG ready");
      } catch (error) {
        setNotice(
          `SVG could not be created: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setWorking(false);
      }
    };
  const exportPDF = async () => {
    if (layers.some((l) => l.visible && l.invalid))
      return setNotice("Resolve the safe area issue before exporting");
    setWorking(true);
    try {
      const { jsPDF } = await import("jspdf"),
        c = document.createElement("canvas");
      c.width = Math.round((A4.w / 2.54) * DPI);
      c.height = Math.round((A4.h / 2.54) * DPI);
      const x = c.getContext("2d")!;
      x.fillStyle = "white";
      x.fillRect(0, 0, c.width, c.height);
      for (const l of layers.filter((v) => v.visible)) {
        const img = await getImage(l.src),
          cx = ((l.x + l.w / 2) / A4.w) * c.width,
          cy = ((l.y + l.h / 2) / A4.h) * c.height;
        x.save();
        x.translate(cx, cy);
        x.rotate((l.rotation * Math.PI) / 180);
        x.drawImage(
          img,
          ((-l.w / A4.w) * c.width) / 2,
          ((-l.h / A4.h) * c.height) / 2,
          (l.w / A4.w) * c.width,
          (l.h / A4.h) * c.height,
        );
        x.restore();
      }
      const pdf = new jsPDF({
        unit: "cm",
        format: pageMode === "full" ? [100,100] : "a4",
        orientation: landscape ? "landscape" : "portrait",
      });
      pdf.addImage(c.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, A4.w, A4.h);
      pdf.save(pageMode === "full" ? "Cricut_100x100cm_150DPI.pdf" : "Cricut_A4_150DPI.pdf");
    } finally {
      setWorking(false);
    }
  };
  const rulers = useMemo(
      () => ({
        x: Array.from({ length: Math.ceil(A4.w) + 1 }, (_, i) => i),
        y: Array.from({ length: Math.ceil(A4.h) + 1 }, (_, i) => i),
      }),
      [A4.w, A4.h],
    ),
    invalid = layers.some((l) => l.visible && l.invalid),
    gridImage =
      zoom >= 2.3
        ? "linear-gradient(#aeb6b066 1px,transparent 1px),linear-gradient(90deg,#aeb6b066 1px,transparent 1px),linear-gradient(#bec6c044 1px,transparent 1px),linear-gradient(90deg,#bec6c044 1px,transparent 1px),linear-gradient(#cbd2ce2b 1px,transparent 1px),linear-gradient(90deg,#cbd2ce2b 1px,transparent 1px)"
        : zoom >= 1.3
          ? "linear-gradient(#aeb6b05c 1px,transparent 1px),linear-gradient(90deg,#aeb6b05c 1px,transparent 1px),linear-gradient(#c7ceca35 1px,transparent 1px),linear-gradient(90deg,#c7ceca35 1px,transparent 1px)"
          : "linear-gradient(#9fa8a255 1px,transparent 1px),linear-gradient(90deg,#9fa8a255 1px,transparent 1px),linear-gradient(#c7ceca33 1px,transparent 1px),linear-gradient(90deg,#c7ceca33 1px,transparent 1px)",
    gridSize =
      zoom >= 2.3
        ? `${scale}px ${scale}px,${scale}px ${scale}px,${scale / 2}px ${scale / 2}px,${scale / 2}px ${scale / 2}px,${scale / 10}px ${scale / 10}px,${scale / 10}px ${scale / 10}px`
        : zoom >= 1.3
          ? `${scale}px ${scale}px,${scale}px ${scale}px,${scale / 2}px ${scale / 2}px,${scale / 2}px ${scale / 2}px`
          : `${scale * 10}px ${scale * 10}px,${scale * 10}px ${scale * 10}px,${scale}px ${scale}px,${scale}px ${scale}px`,
    labelBelow = box.y < 2.7;
  return (
    <main
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length) void importFiles(files);
      }}
      onPointerMove={pointerMove}
      onPointerUp={endPointer}
      ref={menuRef}
    >
      <header className="topbar">
        <div className="brand">
          <span>
            <Scissors />
          </span>
          <div>
            <b>Better Cricut Editor</b>
            <small>Personal workspace · v53</small>
          </div>
        </div>
        <button className="brand-undo" onClick={undo} title="Undo (Ctrl+Z)"><Undo2 /> Undo</button>
        <input
          hidden
          ref={fileRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.svg,.webp"
          onChange={add}
        />
        <span className="toolbar-divider" />
        <nav className="main-actions">
          <button type="button" className="remove-bg-main" onClick={()=>{if(!one)return setNotice("Select one image first");setBgMenuOpen(true)}}><Sparkles />Remove Background</button>
          <button
            disabled={!one || ["vector", "stroke", "acetate"].includes(one.kind)}
            onClick={() => void smoothCutoutV1()}
          >
            <Scissors />
            Make Cutout
          </button>
          <button disabled={!one || !["vector", "stroke"].includes(one.kind)} onClick={acetate}>
            <FileImage />
            Make It Acetate
          </button>
        </nav>
        <div className="export-actions" aria-label="Export options">
          {picked.length > 1 && canSVG && (
            <button className="multiple-svg" onClick={exportSVG} title="Export every selected Cutout as a separate SVG file">
              <Type /> Multiple SVG
            </button>
          )}
          <button disabled={picked.length !== 1 || !canSVG} onClick={exportSVG} title="Export selected Cutout as SVG">
            <Type /> SVG
          </button>
          <button disabled={!canExport} onClick={exportPNG} title="Export selected layers as separate PNG files">
            <FileImage /> PNG
          </button>
          <button disabled={invalid || !layers.some((l) => l.visible)} onClick={exportPDF} title="Export visible A4 canvas as PDF">
            <Download /> PDF
          </button>
        </div>
      </header>
      <div className="sub-toolbar">
        <div className="sub-left">
        <div className="wrap page-setup-slot">
          <button onClick={() => setPageSetupOpen((value) => !value)}><RotateCw /> Page Setup <ChevronDown /></button>
          {pageSetupOpen && <div className="pop page-setup-menu setup-root">
            <div className="setup-group"><button>Page Size <ChevronDown/></button><div className="setup-submenu">{(["portrait","landscape","full"] as PageMode[]).map(mode=><button key={mode} className={pageMode===mode?"active":""} onClick={()=>{setPageMode(mode);setPageSetupOpen(false);setSelected([])}}><b>{mode[0].toUpperCase()+mode.slice(1)}</b><span>{mode==="portrait"?"21 × 29.7 cm":mode==="landscape"?"29.7 × 21 cm":"100 × 100 cm"}</span></button>)}</div></div>
            <div className="setup-group"><button>Grid <ChevronDown/></button><div className="setup-submenu"><button className={gridVisible?"active":""} onClick={()=>{setGridVisible(true);setPageSetupOpen(false)}}>Grid On</button><button className={!gridVisible?"active":""} onClick={()=>{setGridVisible(false);setPageSetupOpen(false)}}>Grid Off</button></div></div>
            <div className="setup-group"><button>Safe Area <ChevronDown/></button><div className="setup-submenu">{[0,.5,1].map(margin=><button key={margin} className={safeMargin===margin?"active":""} onClick={()=>{setSafeMargin(margin);setPageSetupOpen(false)}}>{margin} cm</button>)}</div></div>
          </div>}
        </div>
        </div>
        <div className="sub-center">
        <div className="wrap color-slot">
          <button
            disabled={!vectorsOnly}
            className="color-current"
            style={{ "--swatch": one?.color || DARK } as React.CSSProperties}
            onClick={() => setColorOpen((v) => !v)}
          >
            <Palette /> Color <ChevronDown className="tiny-chevron" />
          </button>
          {colorOpen && vectorsOnly && (
            <div className="pop palette">
              {COLORS.map((c) => (
                <button
                  key={c}
                  style={{ background: c }}
                  onClick={() => applyColor(c)}
                  title={c}
                />
              ))}
            </div>
          )}
        </div>
        <div className="wrap">
          <button
            disabled={picked.length < 2}
            onClick={() => setAlignOpen((v) => !v)}
          >
            <AlignHorizontalJustifyCenter /> Align
          </button>
          {alignOpen && (
            <div className="pop align-menu">
              {([
                ["top", AlignStartVertical, "Top"],
                ["left", AlignStartHorizontal, "Left"],
                ["vcenter", AlignVerticalJustifyCenter, "Vertical"],
                ["hcenter", AlignHorizontalJustifyCenter, "Horizontal"],
                ["bottom", AlignEndVertical, "Bottom"],
                ["right", AlignEndHorizontal, "Right"],
                ["center", Crosshair, "Center"],
              ] as const).map(([m, I, label]) => (
                <button key={m} onClick={() => align(m)}>
                  <I />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button disabled={!one || !["vector", "stroke"].includes(one.kind)} onClick={openCutoutEditor}>
          <Scissors /> Edit Cutout
        </button>
        <button disabled={!one || ["vector","stroke","acetate"].includes(one.kind)} onClick={openImageEditor}><ImageIcon/> Edit Image</button>
        <button className="bake-cutout" disabled={!one || !["vector", "stroke"].includes(one.kind)} onClick={() => void makeGapsPermanent()}>
          <Sparkles /> Bake Cutout
        </button>
        </div>
        <div className="save-actions"><button className="new-project" onClick={newProject} title="Start a new project"><Plus /> New Project</button><button className="save-project" onClick={() => currentProjectId ? void saveProject(false) : (setSaveAsMode(false),setProjectsOpen(true))} title="Save current project"><Download /> Save</button><button className="save-as-project" onClick={() => {setSaveAsMode(true);setProjectName(currentProjectId?`${projectName} Copy`:projectName);setProjectsOpen(true)}} title="Create a new project copy"><Copy /> Save As</button></div>
      </div>
      <section className="workspace">
        <div className="left-tools">
          <button className="left-add" onClick={()=>fileRef.current?.click()}><ImagePlus/><span>Add New</span></button>
          <div className="left-separator" />
          {["circle","rectangle","triangle"].map(shape=><button key={shape} className={shapeTool===shape?"active":""} onClick={()=>{setShapeTool(shapeTool===shape?null:shape);setShapeOpen(false)}}><span className={`shape-icon shape-${shape}`}/><small>{shape}</small></button>)}
          <div className="custom-shape-wrap">
            <button className={shapeOpen?"active":""} onClick={()=>setShapeOpen(v=>!v)}><Star/><small>Custom</small></button>
            {shapeOpen&&<div className="custom-shapes-menu">{CUSTOM_SHAPES.map(([name,icon])=>{const [w,h,,,path]=icon.icon;return <button key={name} title={name} onClick={()=>{setShapeTool(name);setShapeOpen(false)}}><svg viewBox={`0 0 ${w} ${h}`}>{Array.isArray(path)?path.map((d,i)=><path key={i} d={d}/>):<path d={path}/>}</svg><span>{name}</span></button>})}</div>}
          </div>
          <div className="left-future">
            <button className="left-projects" onClick={() => { setProjectsOpen(true); setAccountOpen(false); void refreshProjects(); }}><FolderOpen/><small>My Projects</small></button>
            <button className="left-account" onClick={() => { setAccountOpen(true); setProjectsOpen(false); }}><span className="profile-placeholder"><User/></span><small>My Account</small></button>
          </div>
        </div>
        <div className={`stage ${pageMode==="full"?"full-page":"standard-page"}`} ref={stageRef} onScroll={updateRulers} onWheel={editorWheel} onPointerDown={stageDown}>
          <div className="viewport-rulers">
            <div className="viewport-corner" />
            <div className="viewport-ruler-x">
              {rulers.x.map((n) => (
                <i key={n} style={{ left: rulerOrigin.x - 30 + n * scale }}>
                  <span>{n}</span>
                </i>
              ))}
            </div>
            <div className="viewport-ruler-y">
              {rulers.y.map((n) => (
                <i key={n} style={{ top: rulerOrigin.y - 30 + n * scale }}>
                  <span>{n}</span>
                </i>
              ))}
            </div>
          </div>
          <div className="zoom">
            <div className="zoom-row"><button onClick={() => setZoom((v) => clamp(v - 0.1, 0.2, 4))}>
              <ZoomOut />
            </button>
            {zoomEditing?<input autoFocus className="zoom-value-input" aria-label="Zoom percentage" inputMode="numeric" value={zoomDraft} onChange={e=>setZoomDraft(e.target.value.replace(/[^0-9]/g,""))} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();if(e.key==="Escape"){setZoomEditing(false);setZoomDraft(String(Math.round(zoom*100)))}}} onBlur={()=>{const value=clamp((+zoomDraft||20)/100,.2,4);setZoom(value);setZoomDraft(String(Math.round(value*100)));setZoomEditing(false)}}/>:<button className="zoom-value" onClick={()=>{setZoomDraft(String(Math.round(zoom*100)));setZoomEditing(true)}}>{Math.round(zoom*100)}%</button>}
            <button onClick={() => setZoom((v) => clamp(v + 0.1, 0.2, 4))}>
              <ZoomIn />
            </button></div>
            <div className="zoom-actions"><button onClick={()=>{setZoom(1);window.setTimeout(centerDocument,30)}} title="Center document at 100%"><Crosshair /><span>Center</span></button>
            <button onClick={()=>{setCalibrationDraft(calibration);setCalibrationOpen(true)}} title="Calibrate real-world size"><Ruler /><span>Calibrate</span></button></div>
          </div>
          <div
            className="board"
            style={{ width: A4.w * scale + 42, height: A4.h * scale + 42 }}
          >
            <div className="ruler rx" style={{ left: 42, width: A4.w * scale }}>
              {rulers.x.map((n) => (
                <i key={n} style={{ left: n * scale }}>
                  <span>{n}</span>
                </i>
              ))}
            </div>
            <div className="ruler ry" style={{ top: 42, height: A4.h * scale }}>
              {rulers.y.map((n) => (
                <i key={n} style={{ top: n * scale }}>
                  <span>{n}</span>
                </i>
              ))}
            </div>
            <div
              ref={canvasRef}
              className={`canvas ${zoom > 1.5 ? "mm-grid" : ""} ${gridVisible ? "" : "grid-off"}`}
              onPointerDown={canvasDown}
              style={{
                left: 42,
                top: 42,
                width: A4.w * scale,
                height: A4.h * scale,
                backgroundImage: gridImage,
                backgroundSize: gridSize,
              }}
            >
              <div
                className="safe"
                style={{
                  left: safeMargin * scale,
                  top: safeMargin * scale,
                  width: SAFE.w * scale,
                  height: SAFE.h * scale,
                }}
              >
                <span>SAFE AREA · {safeMargin} CM</span>
              </div>
              {layers
                .filter((l) => l.visible)
                .map((l) => (
                  <div
                    key={l.id}
                    className={`object ${selected.includes(l.id) ? "picked" : ""} ${["stroke", "vector"].includes(l.kind) ? "vector-shape" : ""} ${l.acetateOn ? "acetate" : ""}`}
                    onPointerDown={(e) => choose(e, l)}
                    style={{
                      left: l.x * scale,
                      top: l.y * scale,
                      width: l.w * scale,
                      height: l.h * scale,
                      zIndex: layers.indexOf(l) + 2,
                      transform: `rotate(${l.rotation}deg)`,
                    }}
                  >
                    <img
                      src={l.src}
                      alt=""
                      draggable={false}
                      style={{ opacity: l.acetateOn ? 0.8 : 1 }}
                    />
                  </div>
                ))}
              {marquee && (
                <div
                  className="marquee"
                  style={{
                    left: marquee.x * scale,
                    top: marquee.y * scale,
                    width: marquee.w * scale,
                    height: marquee.h * scale,
                  }}
                />
              )}
              {picked.length > 0 && (
                <div
                  className="selection-box"
                  onPointerDown={(e) => startDrag(e, "move")}
                  style={
                    {
                      left: displayBox.x * scale,
                      top: displayBox.y * scale,
                      width: displayBox.w * scale,
                      height: displayBox.h * scale,
                      zIndex: layers.length + 5,
                      "--handle": `${clamp(11 * zoom, 11, 15)}px`,
                      "--rotation": `${one?.rotation || 0}deg`,
                      transform:
                        one && drag?.mode === "rotate"
                          ? `rotate(${one.rotation}deg)`
                          : undefined,
                    } as React.CSSProperties
                  }
                >
                  <div className={`measure ${labelBelow ? "below" : ""}`}>
                    {fmt(displayBox.w)} × {fmt(displayBox.h)} cm
                    {one &&
                      one.rotation !== 0 &&
                      ` · ${Math.round(one.rotation)}°`}
                  </div>
                  {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => (
                    <button
                      key={h}
                      className={`handle h-${h}`}
                      onPointerDown={(e) => startDrag(e, h)}
                    />
                  ))}
                  {picked.length > 0 && (
                    <button
                      className="rotate-handle"
                      onPointerDown={(e) => startDrag(e, "rotate")}
                    >
                      <RotateCw />
                    </button>
                  )}
                  <div
                    className={`float-menu ${labelBelow ? "lower" : ""}`}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <button title="Delete" onClick={removeSelected}>
                      <Trash2 />
                    </button>
                    <button title="Duplicate" onClick={duplicate}>
                      <Copy />
                      <Plus />
                    </button>
                    <button title="Cut" onClick={cut}>
                      <Scissors />
                    </button>
                    <button title="Copy" onClick={copy}>
                      <Copy />
                    </button>
                    <button
                      title="Paste"
                      onClick={paste}
                      disabled={!clipboard.current.length}
                    >
                      <Download />
                    </button>
                  </div>
                </div>
              )}
              {!layers.length && (
                <div className="empty">
                  <span>
                    <ImagePlus />
                  </span>
                  <h2>Add your first design</h2>
                  <p>JPG, PNG, SVG or WebP</p>
                  <button onClick={() => fileRef.current?.click()}>
                    Choose an image
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <aside>
          <div
            className={`side-tool permanent-tools ${picked.length ? "enabled" : "disabled-panel"}`}
          >
            <div className="side-tool-title">
              <b>Size</b>
              <small>Selected layer</small>
            </div>
            <div className="size-row">
              <label>
                W{" "}
                <input
                  disabled={!picked.length}
                  type="text"
                  inputMode="decimal"
                  value={widthDraft}
                  onChange={(e) => setWidthDraft(e.target.value)}
                  onBlur={() => commitDimension("w", widthDraft)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && commitDimension("w", widthDraft)
                  }
                />{" "}
                cm
              </label>
              <button
                className="side-chain"
                onClick={() => setLocked((v) => !v)}
              >
                {locked ? <LinkIcon /> : <Link2Off />}
              </button>
              <label>
                H{" "}
                <input
                  disabled={!picked.length}
                  type="text"
                  inputMode="decimal"
                  value={heightDraft}
                  onChange={(e) => setHeightDraft(e.target.value)}
                  onBlur={() => commitDimension("h", heightDraft)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && commitDimension("h", heightDraft)
                  }
                />{" "}
                cm
              </label>
            </div>
            {(
              <>
                <div className="tool-separator" />
                <div>
                  <div className="side-tool-title">
                    <b>Stroke</b>
                    <small>Cutout only · default 0.5 cm</small>
                  </div>
                  <div className="stroke-row">
                    <input
                      disabled={
                        !one || !["vector", "stroke"].includes(one.kind)
                      }
                      type="number"
                      min="0"
                      step=".1"
                      value={strokeDraft.toFixed(1)}
                      onChange={(e) =>
                        setStrokeDraft(Math.max(0, +e.target.value))
                      }
                    />
                    <span>cm</span>
                    <button
                      disabled={
                        !one || !["vector", "stroke"].includes(one.kind)
                      }
                      onClick={() =>
                        one?.kind === "stroke"
                          ? void updateStroke()
                          : void addStroke()
                      }
                    >
                      Apply Stroke
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          {(
            <div className="finalize-tool">
              <div className="side-tool-title">
                <b>Fill Gaps</b>
                <small>Cutout geometry cleanup</small>
              </div>
              <div className="fill-gaps-row">
                <div
                  className="gap-control-row"
                  title="Fills enclosed holes whose total area is below the selected square-mm threshold"
                >
                  <input
                    disabled={!one || !["stroke", "vector"].includes(one.kind)}
                    type="number"
                    min="0"
                    step="1"
                    value={Math.round(fillGapsDraft)}
                    onChange={(e) =>
                      setFillGapsDraft(Math.max(0, Math.round(+e.target.value)))
                    }
                  />
                  <span>mm²</span>
                  <button
                    className="gap-apply"
                    disabled={!one || !["stroke", "vector"].includes(one.kind)}
                    onClick={() => void applyGapPreview()}
                  >
                    Apply Fill
                  </button>
                </div>
                <small>Try a whole-mm threshold before committing</small>
              </div>
            </div>
          )}
          <div className="aside-head">
            <div>
              <small>WORKSPACE</small>
              <h2>
                Layers <span>{layers.length}</span>
              </h2>
            </div>
            <div>
              <button disabled={!selected.length} onClick={removeSelected}>
                <Trash2 />
              </button>
              <button disabled={!selected.length} onClick={duplicate}>
                <Copy />
              </button>
              <button onClick={() => fileRef.current?.click()}>
                <Plus />
              </button>
            </div>
          </div>
          <div className="list">
            {[...layers].reverse().map((l) => (
              <div
                key={l.id}
                draggable={editingName !== l.id}
                className={`card ${selected.includes(l.id) ? "active" : ""} ${!l.visible ? "hidden" : ""} ${dragLayer === l.id ? "dragging" : ""}`}
                onDragStart={() => setDragLayer(l.id)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => {
                  if (!dragLayer || dragLayer === l.id) return;
                  setLayers((v) => {
                    const from = v.findIndex((x) => x.id === dragLayer),
                      to = v.findIndex((x) => x.id === l.id),
                      next = [...v],
                      [item] = next.splice(from, 1);
                    next.splice(to, 0, item);
                    return next;
                  });
                }}
                onDragEnd={() => setDragLayer(null)}
                onDrop={() => setDragLayer(null)}
                onClick={(e) => {
                  if (e.shiftKey || e.ctrlKey || e.metaKey)
                    setSelected((v) =>
                      v.includes(l.id)
                        ? v.filter((x) => x !== l.id)
                        : [...v, l.id],
                    );
                  else setSelected([l.id]);
                }}
              >
                <button
                  className="eye"
                  onClick={(e) => {
                    e.stopPropagation();
                    mutate(l.id, (v) => ({ ...v, visible: !v.visible }));
                  }}
                >
                  {l.visible ? <Eye /> : <EyeOff />}
                </button>
                <div className="thumb">
                  <img src={l.src} alt="" />
                </div>
                <div className="info">
                  <input
                    value={l.name}
                    onClick={(e) => e.stopPropagation()}
                    readOnly={editingName !== l.id}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingName(l.id);
                      (e.currentTarget as HTMLInputElement).select();
                    }}
                    onBlur={() => setEditingName(null)}
                    onChange={(e) =>
                      mutate(l.id, (v) => ({ ...v, name: e.target.value }))
                    }
                  />
                  <small>
                    {l.kind === "original"
                      ? "Original"
                      : l.kind === "nobg"
                        ? "Background removed"
                        : l.kind === "stroke"
                          ? `Stroke · ${fmt(l.strokeCm)} cm`
                          : "Acetate"}{" "}
                    · {fmt(l.w)} × {fmt(l.h)} cm
                  </small>
                </div>
                {l.invalid && <AlertTriangle className="warning" />}
                <GripVertical className="drag-grip" />
                {l.steps.length > 0 && (
                  <div
                    className="layer-styles"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {l.steps.map((step, index) => (
                      <div
                        key={step.id}
                        className={`style-step ${index > l.activeStep ? "step-off" : ""}`}
                      >
                        <button
                          className="step-eye"
                          onClick={() => showStep(l, index)}
                          title={`Show through ${step.label}`}
                        >
                          {index <= l.activeStep ? <Eye /> : <EyeOff />}
                        </button>
                        <span onClick={() => showStep(l, index)}>
                          {step.label}
                        </span>
                        {!step.locked && (
                          <button
                            className="step-remove"
                            onClick={() => removeStep(l, index)}
                            title={`Remove ${step.label}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!layers.length && (
              <div className="no-layers">
                Your uploaded designs will appear here.
              </div>
            )}
          </div>
          <footer>
            <span className={invalid ? "bad" : ""}>
              {invalid ? (
                <>
                  <AlertTriangle />
                  Safe zone issue
                </>
              ) : (
                <>
                  <i />
                  All layers in safe area
                </>
              )}
            </span>
            <small>150 DPI output</small>
          </footer>
        </aside>
      </section>
      {projectsOpen && <div className="project-modal" role="dialog" aria-modal="true" aria-label="My Projects"><div className="project-dialog">
        <header><div><b>My Projects</b><small>{projects.length} saved {projects.length === 1 ? "project" : "projects"}</small></div><button onClick={() => setProjectsOpen(false)} aria-label="Close"><X/></button></header>
        <div className="project-name-row"><label>{saveAsMode?"New project name":"Project name"}</label><input autoFocus value={projectName} maxLength={80} onFocus={(e)=>e.currentTarget.select()} onChange={(e) => setProjectName(e.target.value)} /><button onClick={() => void saveProject(saveAsMode)}>{saveAsMode?"Save As":"Save"}</button></div>
        <div className="project-list">{projects.length ? projects.map(project => <article key={project.id} className={project.id === currentProjectId ? "current" : ""}><button className="project-open" onClick={() => openProject(project)}><FolderOpen/><span><b>{project.name}</b><small>Updated {new Date(project.updated_at).toLocaleString()}</small></span></button><button className="project-delete" onClick={() => void deleteProject(project.id)} title="Delete project"><Trash2/></button></article>) : <div className="projects-empty"><FolderOpen/><b>No saved projects yet</b><span>Save your current canvas to see it here.</span></div>}</div>
      </div></div>}
      {accountOpen && <div className="account-panel" role="dialog" aria-label="My Account"><button className="account-close" onClick={() => setAccountOpen(false)} aria-label="Close"><X/></button><span className="account-avatar"><User/></span><b>My Account</b><small>Signed in as</small><p>{session?.user.email || "Unknown account"}</p><div className="account-stat"><FolderOpen/><span><b>{projects.length}</b><small>Saved projects</small></span></div><button className="sign-out" onClick={() => void supabase.auth.signOut()}><LogOut/> Sign Out</button></div>}
      {bgMenuOpen&&<div className="preset-modal" role="dialog" aria-modal="true" aria-label="Remove Background" onPointerDown={()=>setBgMenuOpen(false)}><div className="preset-dialog" onPointerDown={e=>e.stopPropagation()}>
        <header><div><b>Remove Background</b><small>Choose the result you need for this image.</small></div><button onClick={()=>setBgMenuOpen(false)} aria-label="Close"><X/></button></header>
        <div className="preset-grid">
          <button onClick={()=>void applyBackgroundPreset("image")}><span className="preset-image"><img src="/background-presets/image-default.png" alt="Default image background removal preview"/></span><span><b>Image Remove Background</b><small>Default</small></span></button>
          <button onClick={()=>void applyBackgroundPreset("rim")}><span className="preset-image"><img src="/background-presets/image-rim.png" alt="Image background removal with rim preview"/></span><span><b>Image Remove Background</b><small>Add Rim</small></span></button>
          <button onClick={()=>void applyBackgroundPreset("text")}><span className="preset-image"><img src="/background-presets/text-bw.png" alt="Black and white text background removal preview"/></span><span><b>Text Remove Background</b><small>Black and White</small></span></button>
        </div>
        <button className="advanced-preset" onClick={()=>{setBgMenuOpen(false);noBackground()}}><i><SlidersHorizontal/></i><span><b>Advanced Background Removal</b><small>Open the full control panel</small></span></button>
      </div></div>}
      {calibrationOpen&&<div className="calibration-modal" role="dialog" aria-modal="true" aria-label="Screen size calibration"><div className="calibration-dialog"><header><div><b>Calibrate Screen Size</b><small>Place a physical ruler against the screen and match its 10 cm length.</small></div><button onClick={()=>setCalibrationOpen(false)}><X/></button></header><div className="calibration-body"><div className="screen-ruler" style={{width:10*PPCM*calibrationDraft}}>{Array.from({length:101},(_,i)=><i key={i} className={i%10===0?"cm":i%5===0?"half":"mm"} style={{left:`${i}%`}}>{i%10===0&&<span>{i/10}</span>}</i>)}</div><div className="calibration-slider"><span>Shorter</span><button onClick={()=>setCalibrationDraft(v=>clamp(+(v-.001).toFixed(3),.5,2))}>←</button><input type="range" min=".5" max="2" step=".001" value={calibrationDraft} onChange={e=>setCalibrationDraft(+e.target.value)}/><button onClick={()=>setCalibrationDraft(v=>clamp(+(v+.001).toFixed(3),.5,2))}>→</button><span>Longer</span></div><p>Calibration: {(calibrationDraft*100).toFixed(1)}%</p></div><footer><button onClick={()=>setCalibrationOpen(false)}>Cancel</button><button className="confirm" onClick={()=>{setCalibration(calibrationDraft);setZoom(1);localStorage.setItem("better-cricut-screen-calibration",String(calibrationDraft));setCalibrationOpen(false);window.setTimeout(centerDocument,30);setNotice("Screen calibration saved at true 100% size")}}>Save Calibration</button></footer></div></div>}
      {notice && <div className="toast">{notice}</div>}
      {imageEditor&&(()=>{const target=layers.find(l=>l.id===imageEditor.layerId);return <div className="bg-modal image-edit-modal" role="dialog" aria-modal="true" aria-label="Image editor">
        <div className="bg-dialog"><header><div><b>Edit Image</b><small>Crop and increase raster resolution without altering the design geometry.</small></div><button onClick={()=>setImageEditor(null)}>×</button></header>
        <div className="bg-editor-body"><div className="bg-preview"><div className="image-edit-wrap" style={{"--fit-w":imageEditorSize.w?`${imageEditorSize.w}px`:"auto","--fit-h":imageEditorSize.h?`${imageEditorSize.h}px`:"auto"} as React.CSSProperties}><img className={`image-tool-${imageEditor.tool}`} src={imageEditor.source} draggable={false} alt="Image edit preview" onLoad={e=>setImageEditorSize(fitEditorImage(e.currentTarget,e.currentTarget.closest(".bg-preview") as HTMLDivElement))} onPointerDown={startImageEdit} onPointerMove={moveImageEdit} onPointerUp={endImageEdit} onPointerCancel={endImageEdit}/><svg className="image-edit-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">{imageEditor.strokes.map(s=>{const pts=s.points.map(p=>`${p.x*100},${p.y*100}`).join(" ");return s.tool==="lasso"?<polygon key={s.id} points={pts} className="image-lasso-mark"/>:<polyline key={s.id} points={pts} className="image-erase-mark" style={{strokeWidth:s.brush}}/>})}</svg>{imageEditor.tool==="crop"&&<div className="crop-guide" style={{left:`${imageEditor.crop.left}%`,top:`${imageEditor.crop.top}%`,right:`${imageEditor.crop.right}%`,bottom:`${imageEditor.crop.bottom}%`}}>{["nw","n","ne","e","se","s","sw","w"].map(h=><button key={h} className={`crop-handle crop-${h}`} onPointerDown={e=>startImageCrop(e,h)} onPointerMove={moveImageCrop} onPointerUp={endImageCrop} onPointerCancel={endImageCrop}/>)}</div>}</div></div>
        <aside className="bg-controls image-controls"><section><label>Edit Tool</label><div className="image-tool-buttons">{(["crop","erase","lasso"] as ImageEditTool[]).map(tool=><button key={tool} className={imageEditor.tool===tool?"active":""} onClick={()=>setImageEditor({...imageEditor,tool})}>{tool==="lasso"?"Lasso Erase":tool[0].toUpperCase()+tool.slice(1)}</button>)}</div></section>{imageEditor.tool==="erase"&&<section><label>Brush Size <b>{imageEditor.brush}%</b></label><input type="range" min=".5" max="35" step=".5" value={imageEditor.brush} onChange={e=>setImageEditor({...imageEditor,brush:+e.target.value})}/></section>}<section><label>Resolution</label><b>{target?.naturalW||0} × {target?.naturalH||0} px</b><small>Output: {Math.round((target?.naturalW||0)*(1-(imageEditor.crop.left+imageEditor.crop.right)/100)*imageEditor.upscale)} × {Math.round((target?.naturalH||0)*(1-(imageEditor.crop.top+imageEditor.crop.bottom)/100)*imageEditor.upscale)} px</small></section>
        <section><label>Upscale</label><div className="mode-buttons">{([1,2,3] as const).map(n=><button key={n} className={imageEditor.upscale===n?"active keep":""} onClick={()=>setImageEditor({...imageEditor,upscale:n})}>{n}×</button>)}</div><small>High-quality resampling preserves hard corners and smooth curves; it does not invent missing detail.</small></section>
        <section><label>Crop Canvas</label>{(["left","right","top","bottom"] as const).map(side=><label className="crop-range" key={side}><span>{side}</span><input type="range" min="0" max="90" value={imageEditor.crop[side]} onChange={e=>setImageEditor({...imageEditor,crop:{...imageEditor.crop,[side]:+e.target.value}})}/><b>{imageEditor.crop[side]}%</b></label>)}</section></aside></div>
        <footer><button className="image-undo" disabled={!imageEditor.history.length} onClick={undoImageStage}><Undo2/> Undo</button><button className="cancel" onClick={()=>setImageEditor(null)}>Cancel</button><button className="secondary-create" onClick={()=>void applyImageEdit(true)}>Create Layer</button><button className="confirm" onClick={()=>void applyImageEdit(false)}>Save Edit</button></footer></div></div>})()}
      {cutEditor && (
        <div className="bg-modal cutout-modal" role="dialog" aria-modal="true" aria-label="Cutout editor">
          <div className="bg-dialog" onPointerDown={(e)=>e.stopPropagation()}>
            <header><div><b>Edit Cutout</b><small>Crop, remove pieces, erase details or create bridges.</small></div><button onClick={()=>setCutEditor(null)}>×</button></header>
            <div className="bg-editor-body">
              <div className="bg-preview cutout-preview" ref={cutPreviewRef} onWheel={zoomCutout} onPointerDown={startCutoutPan} onPointerMove={moveCutoutPan} onPointerUp={endCutoutPan} onPointerCancel={endCutoutPan}>
                {cutPreview && <div className="cut-image-wrap" style={{"--fit-w":cutImageSize.w?`${cutImageSize.w}px`:"auto","--fit-h":cutImageSize.h?`${cutImageSize.h}px`:"auto",transform:`translate(${cutEditor.panX}px,${cutEditor.panY}px) scale(${cutEditor.zoom})`} as React.CSSProperties}>
                  <img className={`cut-tool-${cutEditor.tool}`} src={cutPreview} alt="Cutout edit preview" draggable={false} onLoad={e=>setCutImageSize(fitEditorImage(e.currentTarget,cutPreviewRef.current))} onPointerDown={startCutEdit} onPointerMove={moveCutEdit} onPointerUp={endCutEdit} onPointerCancel={endCutEdit} onPointerEnter={()=>setCutCursor(v=>({...v,visible:true}))} onPointerLeave={()=>setCutCursor(v=>({...v,visible:false}))}/>
                  <svg className="cut-edit-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {cutEditor.strokes.filter(s=>s.id===cutActiveStroke).map(s=>{
                      const first=s.points[0],last=s.points.at(-1)!,pts=s.points.map(p=>`${p.x*100},${p.y*100}`).join(" ");
                      if(s.tool==="rectangle")return <rect key={s.id} x={Math.min(first.x,last.x)*100} y={Math.min(first.y,last.y)*100} width={Math.abs(last.x-first.x)*100} height={Math.abs(last.y-first.y)*100} className="eraser-selection"/>;
                      if(s.tool==="lasso")return <polyline key={s.id} points={pts} className="eraser-selection lasso-selection"/>;
                      return <polyline key={s.id} points={pts} className={`edit-brush-stroke ${s.tool}`} style={{strokeWidth:s.brush}}/>;
                    })}
                    {cutCursor.visible&&["bridge","erase","smooth"].includes(cutEditor.tool)&&<circle cx={cutCursor.x*100} cy={cutCursor.y*100} r={cutEditor.brush/2} className="cut-brush-cursor"/>}
                  </svg>
                  <div className="crop-guide" style={{left:`${cutEditor.crop.left}%`,top:`${cutEditor.crop.top}%`,right:`${cutEditor.crop.right}%`,bottom:`${cutEditor.crop.bottom}%`}}>
                    {["nw","n","ne","e","se","s","sw","w"].map(h=><button key={h} className={`crop-handle crop-${h}`} onPointerDown={e=>startCropDrag(e,h)} onPointerMove={moveCropDrag} onPointerUp={endCropDrag} onPointerCancel={endCropDrag}/>) }
                  </div>
                </div>}
                <div className="bg-zoom-controls">
                  <button onClick={()=>setCutEditor({...cutEditor,zoom:clamp(cutEditor.zoom/1.2,.5,4)})}>−</button>
                  <span>{Math.round(cutEditor.zoom*100)}%</span>
                  <button onClick={()=>setCutEditor({...cutEditor,zoom:clamp(cutEditor.zoom*1.2,.5,4)})}>+</button>
                  <button onClick={()=>setCutEditor({...cutEditor,zoom:1,panX:0,panY:0})}>Fit</button>
                </div>
              </div>
              <aside className="bg-controls cutout-controls">
                <section><label>Edit Tool</label><div className="edit-tool-grid">
                  {(["bridge","erase","smooth","lasso","rectangle"] as EditTool[]).map((tool)=><button key={tool} className={cutEditor.tool===tool?"active":""} onClick={()=>setCutEditor({...cutEditor,tool})}>{tool==="smooth"?"Fix the Edges":tool==="lasso"?"Lasso Eraser":tool==="rectangle"?"Rectangle Eraser":tool[0].toUpperCase()+tool.slice(1)}</button>)}
                </div><small>Fix the Edges smooths only the brushed contour. Its start and end preserve the surrounding trajectory.</small></section>
                <section><label>Brush Size <b>{cutEditor.brush}%</b></label><input type="range" min="1" max="15" value={cutEditor.brush} onChange={(e)=>setCutEditor({...cutEditor,brush:+e.target.value})}/></section>
                <section><label>Crop Canvas</label><small>Drag the crop frame from any edge or corner. Up to 90% can be removed from a side.</small></section>
                <div className="bg-history-actions"><button disabled={!cutEditor.strokes.length} onClick={()=>setCutEditor({...cutEditor,strokes:cutEditor.strokes.slice(0,-1)})}>Undo Edit</button><button disabled={!cutEditor.strokes.length} onClick={()=>setCutEditor({...cutEditor,strokes:[]})}>Reset Edits</button></div>
                <p>Applying edits creates a baked Cutout and removes previous editable modifiers from this layer.</p>
              </aside>
            </div>
            <footer><button className="cancel" onClick={()=>setCutEditor(null)}>Cancel</button><button className="confirm" onClick={()=>void applyCutoutEdit()}>Apply Edit</button></footer>
          </div>
        </div>
      )}
      {bgEditor && (
        <div className="bg-modal" role="dialog" aria-modal="true" aria-label="Background removal editor">
          <div className="bg-dialog" onPointerDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                <b>Refine Background Removal</b>
                <small>Mark areas to remove or protect before applying.</small>
              </div>
              <div className="refine-quick-tools">
                <button disabled={!bgEditor.strokes.length} onClick={() => setBgEditor({ ...bgEditor, strokes: bgEditor.strokes.slice(0, -1) })}>Undo</button>
                <button disabled={!bgEditor.strokes.length} onClick={() => setBgEditor({ ...bgEditor, strokes: [] })}>Reset</button>
                <label><input type="checkbox" checked={bgEditor.alphaView} onChange={(e) => setBgEditor({ ...bgEditor, alphaView: e.target.checked })}/> Alpha</label>
                <button className={bgEditor.optimizeAlpha?"active optimize-alpha":"optimize-alpha"} onClick={()=>setBgEditor({...bgEditor,optimizeAlpha:!bgEditor.optimizeAlpha,alphaView:true})}><Sparkles/> Optimize Alpha</button>
              </div>
              <button aria-label="Close" onClick={() => setBgEditor(null)}>×</button>
            </header>
            <div className="bg-editor-body">
              <div
                ref={bgPreviewRef}
                className={`bg-preview ${bgEditor.alphaView ? "alpha-view" : ""}`}
                onWheel={zoomBackground}
                onPointerDown={startBackgroundPan}
                onPointerMove={moveBackgroundPan}
                onPointerUp={endBackgroundPan}
                onPointerCancel={endBackgroundPan}
              >
                {bgPreview ? (
                  <div className="bg-image-wrap" style={{ "--fit-w":bgImageSize.w?`${bgImageSize.w}px`:"auto","--fit-h":bgImageSize.h?`${bgImageSize.h}px`:"auto",transform: `translate(${bgEditor.panX}px,${bgEditor.panY}px) scale(${bgEditor.zoom})` } as React.CSSProperties}>
                    <img
                      src={bgPreview}
                      alt="Background removal preview"
                      draggable={false}
                        className={bgEditor.pickingColor!==null?"eyedrop-active":""}
                        onLoad={e=>setBgImageSize(fitEditorImage(e.currentTarget,bgPreviewRef.current))}
                      onPointerDown={startBackgroundStroke}
                      onPointerMove={moveBackgroundStroke}
                      onPointerUp={endBackgroundStroke}
                      onPointerCancel={endBackgroundStroke}
                      onPointerLeave={() => setBgCursor((v) => ({ ...v, visible: false }))}
                      onPointerEnter={() => setBgCursor((v) => ({ ...v, visible: true }))}
                    />
                    <svg className="bg-marks" viewBox={`0 0 ${bgImageSize.w||100} ${bgImageSize.h||100}`} aria-hidden="true">
                      {bgEditor.strokes.filter((stroke) => stroke.id === bgActiveStroke).map((stroke) => {
                        const points = stroke.points.map((p) => `${p.x * (bgImageSize.w||100)},${p.y * (bgImageSize.h||100)}`).join(" ");
                        const color = stroke.mode === "remove" ? "#ef3f46" : "#00a66f";
                        const radius=stroke.brush/200*Math.min(bgImageSize.w||100,bgImageSize.h||100);
                        return stroke.points.length === 1 ? (
                          <circle key={stroke.id} cx={stroke.points[0].x*(bgImageSize.w||100)} cy={stroke.points[0].y*(bgImageSize.h||100)} r={radius} fill={color} fillOpacity=".5" stroke="#fff" strokeWidth="1" />
                        ) : (
                          <polyline key={stroke.id} points={points} fill="none" stroke={color} strokeOpacity=".5" strokeWidth={radius*2} strokeLinecap="round" strokeLinejoin="round" />
                        );
                      })}
                      {bgCursor.visible && (
                        <circle cx={bgCursor.x*(bgImageSize.w||100)} cy={bgCursor.y*(bgImageSize.h||100)} r={bgEditor.brush/200*Math.min(bgImageSize.w||100,bgImageSize.h||100)} className="bg-brush-cursor" />
                      )}
                    </svg>
                  </div>
                ) : <div className="bg-loading">Preparing preview…</div>}
                {bgRendering && <span className="bg-updating">Updating…</span>}
                <div className="bg-zoom-controls">
                  <button onClick={() => setBgEditor({ ...bgEditor, zoom: clamp(bgEditor.zoom / 1.2, .6, 5) })}>−</button>
                  <span>{Math.round(bgEditor.zoom * 100)}%</span>
                  <button onClick={() => setBgEditor({ ...bgEditor, zoom: clamp(bgEditor.zoom * 1.2, .6, 5) })}>+</button>
                  <button onClick={() => setBgEditor({ ...bgEditor, zoom: 1, panX: 0, panY: 0 })}>Fit</button>
                </div>
              </div>
              <aside className="bg-controls">
                <section className="connected-brush-section">
                  <label>Connected Area with Brush</label>
                  <div className="mode-buttons">
                    <button className={bgEditor.mode === "remove" ? "active remove" : ""} onClick={() => setBgEditor({ ...bgEditor, mode: "remove" })}>Remove</button>
                    <button className={bgEditor.mode === "keep" ? "active keep" : ""} onClick={() => setBgEditor({ ...bgEditor, mode: "keep" })}>Keep</button>
                  </div>
                  <div className="compact-slider"><label>Brush Size <b>{bgEditor.brush.toFixed(1)}%</b></label><input type="range" min=".1" max="60" step=".1" value={bgEditor.brush} onChange={(e) => setBgEditor({ ...bgEditor, brush: +e.target.value })} /></div>
                  <div className="compact-slider"><label>Color Bleed <b>{bgEditor.sensitivity}</b></label><input type="range" min="0" max="100" value={bgEditor.sensitivity} onChange={(e) => setBgEditor({ ...bgEditor, sensitivity: +e.target.value })} /></div>
                  <div className="compact-slider"><label>Connected Distance <b>{bgEditor.connectedReach>=51?"Full":`${(bgEditor.connectedReach/10).toFixed(1)} cm`}</b></label><input type="range" min="0" max="51" value={bgEditor.connectedReach} onChange={(e) => setBgEditor({ ...bgEditor, connectedReach: +e.target.value })} /></div>
                  <small>Each stroke keeps the size, color bleed and distance used when it was drawn. Distance limits connected-color spread; Full follows the complete connected area.</small>
                </section>
                <section className="all-color-section">
                  <label>All the Color with Eyedrop</label>
                  {bgEditor.eraseColors.map((entry,index)=><div className="erase-color-entry" key={index}>
                    <div className="erase-color-row"><input type="color" value={entry.color||"#ffffff"} onChange={(e)=>{const colors=[...bgEditor.eraseColors];colors[index]={...entry,color:e.target.value};if(colors.every(v=>v.color)&&colors.length<6)colors.push({color:null,sensitivity:30});setBgEditor({...bgEditor,eraseColors:colors})}}/><button className={bgEditor.pickingColor===index?"active":""} onClick={()=>setBgEditor({...bgEditor,pickingColor:bgEditor.pickingColor===index?null:index})}><Pipette/> Pick from Image</button><button disabled={!entry.color} onClick={()=>{const colors=bgEditor.eraseColors.filter((_,i)=>i!==index);setBgEditor({...bgEditor,eraseColors:colors.length?colors:[{color:null,sensitivity:30}],pickingColor:null})}}>Clear</button></div>
                    <div className="compact-slider"><label>Color Sensitivity <b>{entry.sensitivity}</b></label><input type="range" min="0" max="100" value={entry.sensitivity} onChange={(e)=>{const colors=[...bgEditor.eraseColors];colors[index]={...entry,sensitivity:+e.target.value};setBgEditor({...bgEditor,eraseColors:colors})}}/></div>
                  </div>)}
                  <small>Every selected color is removed throughout the entire image, whether its pixels are connected or not.</small>
                </section>
                <section>
                  <label>Edge Refinement <b>{bgEditor.edgeRefine > 0 ? "+" : ""}{bgEditor.edgeRefine} px</b></label>
                  <input type="range" min="-12" max="12" step="1" value={bgEditor.edgeRefine} onChange={(e)=>setBgEditor({...bgEditor,edgeRefine:+e.target.value})}/>
                  <small>Positive values contract the edge to remove pale halos. Negative values recover pixels removed by an aggressive cut.</small>
                  <div className="compact-slider edge-smooth-control"><label>Edge Smooth <b>{bgEditor.edgeSmooth}</b></label><input type="range" min="0" max="10" step="1" value={bgEditor.edgeSmooth} onChange={e=>setBgEditor({...bgEditor,edgeSmooth:+e.target.value})}/><small>Smooths both outer and inner alpha contours at pixel level. The result remains fully opaque or transparent.</small></div>
                </section>
                <section>
                  <label>Remove Speckles <b>{bgEditor.speckles} px</b></label>
                  <input type="range" min="0" max="1000" step="5" value={bgEditor.speckles} onChange={(e) => setBgEditor({ ...bgEditor, speckles: +e.target.value })} />
                  <small>Fills enclosed transparent speckles up to this pixel area. Set to 0 to restore them.</small>
                </section>
                <p>Small isolated islands are removed automatically. The final mask contains no semi-transparent pixels.</p>
              </aside>
            </div>
            <footer>
              <button className="cancel" onClick={() => setBgEditor(null)}>Cancel</button>
              <button className="confirm" disabled={!bgPreview} onClick={() => void commitBackground()}>OK</button>
            </footer>
          </div>
        </div>
      )}
      {working && (
        <div className="working">
          <div />
          <b>{vTracerStartedAt === null ? "WORKING" : "CREATING SMOOTH CUTOUT"}</b>
          <span>{vTracerStartedAt === null ? "Processing your design…" : `VTracer is processing locally · ${String(Math.floor(vTracerElapsed / 60)).padStart(2, "0")}:${String(vTracerElapsed % 60).padStart(2, "0")} / 03:00`}</span>
        </div>
      )}
    </main>
  );
}
