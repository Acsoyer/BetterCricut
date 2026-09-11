"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs, react-hooks/purity */
import { ChangeEvent, PointerEvent as RPointer, WheelEvent as RWheel, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlignVerticalJustifyCenter, AlignEndHorizontal, AlignEndVertical, AlignHorizontalJustifyCenter, AlignStartHorizontal, AlignStartVertical, AlertTriangle, BringToFront, ChevronDown, Check, Copy, Crosshair, Download, Eye, EyeOff, FileImage, File, ImagePlus, Paintbrush, Eraser, GripVertical, Grid3X3, Link as LinkIcon, Link2Off, Layers3, Maximize2, Palette, Pipette, Plus, RotateCw, Replace, Ruler, Scissors, ShieldCheck, SlidersHorizontal, SendToBack, Sparkles, Star, Trash2, Type, Undo2, ZoomIn, ZoomOut, User, FolderOpen, Image as ImageIcon, LogOut, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { EDITOR_VERSION, editorDevLog } from "../editor-dev-log";
import { getSVG, traceCanvas } from "@cadit-app/potrace-ts";
import { faStar, faHeart, faArrowRight, faBolt, faBurst, faCloud, faMoon, faSun, faDiamond, faShield, faDroplet, faLeaf, faCrown, faBell, faGift, faTag, faBookmark, faLocationPin, faComment, faPuzzlePiece } from "@fortawesome/free-solid-svg-icons";
const PORTRAIT = { w: 21, h: 29.7 },
  PPCM = 34,
  DPI = 150,
  DARK = "#3c4144";
const COLORS = ["#EF9999", "#CF93DA", "#9DA8DB", "#90CAF8", "#A5D6A7", "#FEF59C", "#FFCC80", "#F53636", "#9928B1", "#3F51B5", "#2296F3", "#4DAF50", "#FFEC3C", "#FF9702", "#B71B1B", "#49148B", "#1B237E", "#0E47A0", "#1D5E21", "#FAC02E", "#E65002", "#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000", "#8E5609"];
const CUSTOM_SHAPES = [
  ["Star", faStar],
  ["Heart", faHeart],
  ["Arrow", faArrowRight],
  ["Bolt", faBolt],
  ["Burst", faBurst],
  ["Cloud", faCloud],
  ["Moon", faMoon],
  ["Sun", faSun],
  ["Diamond", faDiamond],
  ["Shield", faShield],
  ["Drop", faDroplet],
  ["Leaf", faLeaf],
  ["Crown", faCrown],
  ["Bell", faBell],
  ["Gift", faGift],
  ["Tag", faTag],
  ["Bookmark", faBookmark],
  ["Pin", faLocationPin],
  ["Bubble", faComment],
  ["Puzzle", faPuzzlePiece],
] as const;
const nativeShapeSvg = (viewBox: string, body: string, color: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="${viewBox}" preserveAspectRatio="none" fill="${color}" stroke="#141715" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision" style="paint-order:stroke fill"><style>path,rect,ellipse{vector-effect:non-scaling-stroke}</style>${body}</svg>`)}`;
const shapeSource = (name: string, color: string) => {
  if (name === "circle") return nativeShapeSvg("0 0 100 100", `<ellipse cx="50" cy="50" rx="49.5" ry="49.5"/>`, color);
  if (name === "rectangle") return nativeShapeSvg("0 0 100 100", `<rect x=".5" y=".5" width="99" height="99"/>`, color);
  if (name === "triangle") return nativeShapeSvg("0 0 100 100", `<path d="M50 .5 99.5 99.5H.5Z"/>`, color);
  const found = CUSTOM_SHAPES.find(([label]) => label === name),
    icon = found?.[1];
  if (!icon) return "";
  const [w, h, , , path] = icon.icon,
    paths = Array.isArray(path) ? path.map((d) => `<path d="${d}"/>`).join("") : `<path d="${path}"/>`;
  return nativeShapeSvg(`0 0 ${w} ${h}`, paths, color);
};
type Kind = "original" | "nobg" | "stroke" | "acetate" | "vector";
type LayerStep = {
  id: string;
  type: "remove-bg" | "cutout" | "stroke" | "fill-gaps" | "acetate" | "edit-image" | "optimize-alpha";
  label: string;
  locked?: boolean;
  before?: Pick<Layer, "src" | "x" | "y" | "w" | "h" | "kind" | "color" | "strokeCm" | "fillGapsMm" | "acetateOn">;
  backgroundColor?: string;
  removalSettings?: {
    strokes: BgStroke[];
    speckles: number;
    edgeRefine: number;
    edgeSmooth: number;
    optimizeAlpha: boolean;
    eraseColors: EraseColor[];
  };
  snapshot: Pick<Layer, "src" | "x" | "y" | "w" | "h" | "kind" | "color" | "strokeCm" | "fillGapsMm" | "acetateOn">;
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
  isShape?: boolean;
  shapeBaseSrc?: string;
  shapeImage?: {
    source: Layer;
    offsetX: number;
    offsetY: number;
    widthScale: number;
    heightScale: number;
    rotation: number;
    visible: boolean;
  };
  cutRisk?: boolean;
  cutRiskReason?: string;
  cutRiskOverlay?: string;
};
type SavedProject = {
  id: string;
  name: string;
  updated_at: string;
  data: {
    layers: Layer[];
    landscape: boolean;
    pageMode?: PageMode;
    safeMargin: number;
    thumbnail?: string;
    sessionLog?: SessionLogEntry[];
    cutSafetyEnabled?: boolean;
  };
};
type SessionLogEntry = { id: string; at: string; action: string; details: string };
type PageMode = "portrait" | "landscape" | "full";
type PageColor = "white" | "offwhite" | "warm" | "lightgray" | "darkgray" | "canson";
const PAGE_COLORS: Record<PageColor, { label: string; color: string }> = {
  white: { label: "White", color: "#ffffff" },
  offwhite: { label: "Broken White", color: "#fffdf7" },
  warm: { label: "Warm White", color: "#fff6dc" },
  lightgray: { label: "Light Gray", color: "#e7e9e8" },
  darkgray: { label: "Dark Gray", color: "#777d7a" },
  canson: { label: "Canson Paper", color: "#f6eddd" },
};
const TEXT_FONT_OPTIONS = [
  ["cursive", "Cursive Font", "/create-examples/text-black/black-happy-birthday-sophia-v2-cursive.png"],
  ["serif", "Serif Font", "/create-examples/text-black/black-happy-birthday-sophia-v3-serif.png"],
  ["mixed", "Mixed Font", "/create-examples/text-black/black-happy-birthday-sophia-v1-mixed.png"],
] as const;
const IMAGE_STYLE_OPTIONS = [
  ["watercolor", "Watercolor", "/create-examples/image-styles/cute-giraffe-watercolor-v2.png"],
  ["cartoon", "Cartoon", "/create-examples/image-styles/cute-giraffe-cartoon-v2.png"],
  ["baby", "Baby", "/create-examples/image-styles/cute-giraffe-baby-v2.png"],
  ["girly", "Girly", "/create-examples/image-styles/cute-giraffe-girly.png"],
  ["storybook", "3D Storybook", "/create-examples/image-styles/cute-giraffe-3d-storybook.png"],
  ["paper-cut", "Paper Cut", "/create-examples/image-styles/cute-giraffe-paper-cut.png"],
] as const;
function GeneratedRail({ images, onOpen }: { images: string[]; onOpen: (src: string) => void }) {
  return <aside className="generated-rail"><header><b>Versions</b><small>Newest at the bottom</small></header>{images.length ? images.map((src,i)=><button key={`${src}-${i}`} onClick={()=>onOpen(src)}><img src={src} alt={`Generated version ${i+1}`}/><span>V{i+1}</span></button>) : <p>Your generated versions will appear here.</p>}</aside>;
}
const textPlaceholders = (count: 1 | 2 | 3 | 4) => count === 1 ? ["Happy Birthday Sophia"] : count === 2 ? ["Happy Birthday", "Sophia"] : count === 3 ? ["Happy", "Birthday", "Sophia"] : ["Happy", "Birthday", "Dear", "Sophia"];
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
  base: Pick<Layer, "src" | "x" | "y" | "w" | "h" | "kind" | "color" | "strokeCm" | "fillGapsMm" | "acetateOn">;
};
type ImageEditTool = "crop" | "erase" | "lasso";
type ImageEditStroke = {
  id: string;
  tool: Exclude<ImageEditTool, "crop">;
  brush: number;
  points: { x: number; y: number }[];
};
type ImageEditState = {
  source: string;
  offsetX: number;
  offsetY: number;
  widthScale: number;
  heightScale: number;
};
type ImageEditor = ImageEditState & {
  layerId: string;
  crop: { left: number; top: number; right: number; bottom: number };
  upscale: 1 | 2 | 3;
  tool: ImageEditTool;
  brush: number;
  strokes: ImageEditStroke[];
  history: ImageEditState[];
  zoom: number;
  panX: number;
  panY: number;
};
type EditTool = "bridge" | "erase" | "lasso" | "rectangle" | "smooth";
type EditStroke = {
  id: string;
  tool: EditTool;
  brush: number;
  points: { x: number; y: number }[];
};
type SplitPart = {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  naturalW: number;
  naturalH: number;
};
type SplitPreview = {
  layerId: string;
  preview: string;
  parts: SplitPart[];
  base?: { x: number; y: number; w: number; h: number };
};
type CutoutEditor = {
  layerId: string;
  source: string;
  color: string;
  tool: EditTool | null;
  brush: number;
  strokes: EditStroke[];
  redoStrokes: EditStroke[];
  crop: { left: number; top: number; right: number; bottom: number };
  zoom: number;
  panX: number;
  panY: number;
  smoothPasses: number;
};
type ClipEditor = {
  layerId: string;
  maskSrc: string;
  imageSrc: string;
  scale: number;
  offsetX: number;
  offsetY: number;
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
// SVG layers must stay SVG in every editor. Their non-scaling stroke is what keeps
// the visible cutting edge crisp and the same screen width at every zoom level.
const scalableSvgPreview = (src: string) => src;
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
    // Presets are designed for light paper backgrounds. Choosing the lightest
    // corner prevents artwork touching another corner from poisoning the sample.
    backgroundAt = p.reduce((best, q) => (d.data[q] + d.data[q + 1] + d.data[q + 2] > d.data[best] + d.data[best + 1] + d.data[best + 2] ? q : best), p[0]),
    bg = [d.data[backgroundAt], d.data[backgroundAt + 1], d.data[backgroundAt + 2]];
  const alreadyTransparent = cornerAlpha < 80;
  for (let i = 0; i < w * h; i++) {
    const q = i * 4,
      dist = Math.hypot(d.data[q] - bg[0], d.data[q + 1] - bg[1], d.data[q + 2] - bg[2]);
    // Cricut geometry must be binary: never leave a semi-transparent fringe.
    d.data[q + 3] = alreadyTransparent ? (d.data[q + 3] < 128 ? 0 : 255) : dist <= tolerance + 12 ? 0 : 255;
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
        if (next < 0 || next >= w * h || seen[next] || (n === 0 && px === 0) || (n === 1 && px === w - 1) || (n === 2 && py === 0) || (n === 3 && py === h - 1) || d.data[next * 4 + 3] === 0) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
    if (tail <= minIslandArea) for (let i = 0; i < tail; i++) d.data[queue[i] * 4 + 3] = 0;
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL();
}
async function optimizeAlphaChannel(src: string) {
  const img = await getImage(src),
    c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height),
    count = c.width * c.height,
    source = new Uint8ClampedArray(data.data),
    alpha = new Uint8Array(count);
  for (let i = 0; i < count; i++) alpha[i] = source[i * 4 + 3] >= 128 ? 1 : 0;
  // Preserve the original antialiased contour. Optimization only removes truly
  // microscopic detached speckles and fills microscopic enclosed pinholes.
  const settled = new Uint8Array(alpha);
  const walkComponents = (foreground: boolean, maxArea: number, fill: number) => {
    const seen = new Uint8Array(count),
      queue = new Int32Array(count);
    for (let start = 0; start < count; start++) {
      if (seen[start] || Boolean(settled[start]) !== foreground) continue;
      let head = 0,
        tail = 0,
        touchesEdge = false;
      queue[tail++] = start;
      seen[start] = 1;
      while (head < tail) {
        const at = queue[head++],
          px = at % c.width,
          py = (at / c.width) | 0;
        if (px === 0 || py === 0 || px === c.width - 1 || py === c.height - 1) touchesEdge = true;
        const ns = [at - 1, at + 1, at - c.width, at + c.width];
        for (let n = 0; n < 4; n++) {
          const next = ns[n];
          if (next < 0 || next >= count || seen[next] || (n === 0 && px === 0) || (n === 1 && px === c.width - 1) || Boolean(settled[next]) !== foreground) continue;
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
      const removable = foreground ? tail <= maxArea : !touchesEdge && tail <= maxArea;
      if (removable) for (let i = 0; i < tail; i++) settled[queue[i]] = fill;
    }
  };
  const islandLimit = Math.min(8, Math.max(2, Math.round(count / 900000))),
    holeLimit = Math.min(8, Math.max(2, Math.round(count / 900000)));
  walkComponents(true, islandLimit, 0);
  walkComponents(false, holeLimit, 1);
  for (let i = 0; i < count; i++) {
    const q = i * 4;
    if (settled[i]) {
      data.data[q] = source[q];
      data.data[q + 1] = source[q + 1];
      data.data[q + 2] = source[q + 2];
      data.data[q + 3] = source[q + 3] >= 128 ? source[q + 3] : 255;
    } else data.data[q + 3] = 0;
  }
  x.putImageData(data, 0, 0);
  return c.toDataURL("image/png");
}
async function featherAlphaInside(src: string) {
  const img = await getImage(src),
    c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height),
    source = new Uint8ClampedArray(data.data),
    w = c.width,
    h = c.height;
  // Keep transparent pixels transparent so no removed background colour can bleed back in.
  // One-pixel, inside-only antialiasing: keep the result sharp and never revive
  // removed background RGB as an outside halo.
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const at = py * w + px,
        q = at * 4;
      if (source[q + 3] < 128) {
        data.data[q + 3] = 0;
        continue;
      }
      let opaqueNeighbours = 0;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = px + ox,
            ny = py + oy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && source[(ny * w + nx) * 4 + 3] >= 128) opaqueNeighbours++;
        }
      data.data[q + 3] = opaqueNeighbours === 8 ? 255 : clamp(96 + opaqueNeighbours * 18, 112, 232);
    }
  x.putImageData(data, 0, 0);
  return c.toDataURL("image/png");
}

type RefinedBackground = { src: string; left: number; top: number; width: number; height: number };
async function refineBackgroundWithRoom(src: string, tolerance: number, strokes: BgStroke[], speckles = 0, edgeRefine = 0, eraseColors: EraseColor[] = [], edgeSmooth = 0, optimizeAlpha = false): Promise<RefinedBackground> {
  if (edgeRefine >= 0) {
    const refined = await refineBackground(src, tolerance, strokes, speckles, edgeRefine, eraseColors, edgeSmooth, optimizeAlpha);
    return { src: await featherAlphaInside(refined), left: 0, top: 0, width: 1, height: 1 };
  }
  const image = await getImage(src),
    pad = Math.ceil(Math.abs(edgeRefine) + Math.max(2, edgeSmooth) + 3),
    canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth + pad * 2;
  canvas.height = image.naturalHeight + pad * 2;
  canvas.getContext("2d")!.drawImage(image, pad, pad);
  const paddedStrokes = strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({
      x: (point.x * image.naturalWidth + pad) / canvas.width,
      y: (point.y * image.naturalHeight + pad) / canvas.height,
    })),
  }));
  const refined = await refineBackground(canvas.toDataURL("image/png"), tolerance, paddedStrokes, speckles, edgeRefine, eraseColors, edgeSmooth, optimizeAlpha);
  return {
    src: await featherAlphaInside(refined),
    left: -pad / image.naturalWidth,
    top: -pad / image.naturalHeight,
    width: canvas.width / image.naturalWidth,
    height: canvas.height / image.naturalHeight,
  };
}
async function addProtectiveRim(maskSrc: string, originalSrc: string, physicalWidthCm: number) {
  const mask = await getImage(maskSrc),
    original = await getImage(originalSrc),
    radius = clamp(Math.ceil((mask.naturalWidth / Math.max(0.1, physicalWidthCm)) * 0.11), 2, 72),
    w = mask.naturalWidth + radius * 2,
    h = mask.naturalHeight + radius * 2,
    alphaCanvas = document.createElement("canvas"),
    sourceCanvas = document.createElement("canvas"),
    out = document.createElement("canvas");
  alphaCanvas.width = sourceCanvas.width = out.width = w;
  alphaCanvas.height = sourceCanvas.height = out.height = h;
  const ax = alphaCanvas.getContext("2d")!,
    sx = sourceCanvas.getContext("2d")!,
    ox = out.getContext("2d")!;
  ax.imageSmoothingEnabled = true;
  ax.imageSmoothingQuality = "high";
  // Expand only the mask. Never stretch or repeat edge colours.
  for (let distance = 0; distance <= radius; distance += Math.max(1, radius / 8)) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 32) ax.drawImage(mask, radius + Math.cos(angle) * distance, radius + Math.sin(angle) * distance);
  sx.drawImage(original, radius, radius, mask.naturalWidth, mask.naturalHeight);
  const alpha = ax.getImageData(0, 0, w, h),
    source = sx.getImageData(0, 0, w, h),
    result = ox.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const q = i * 4,
      a = alpha.data[q + 3];
    if (a < 8) continue;
    if (source.data[q + 3] > 8) {
      result.data[q] = source.data[q];
      result.data[q + 1] = source.data[q + 1];
      result.data[q + 2] = source.data[q + 2];
    } else result.data[q] = result.data[q + 1] = result.data[q + 2] = 255;
    result.data[q + 3] = a;
  }
  ox.putImageData(result, 0, 0);
  return {
    src: out.toDataURL("image/png"),
    left: -radius / mask.naturalWidth,
    top: -radius / mask.naturalHeight,
    width: w / mask.naturalWidth,
    height: h / mask.naturalHeight,
  };
}
async function refineBackground(src: string, tolerance: number, strokes: BgStroke[], speckles = 0, edgeRefine = 0, eraseColors: EraseColor[] = [], edgeSmooth = 0, optimizeAlpha = false) {
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
  const restoreSourceOrWhite = (q:number) => {
    // RGB 0,0,0 is valid artwork, not missing pixel data. Only transparent
    // source pixels need the white fallback used for newly expanded edges.
    const usable=sourceData[q+3]>8;
    result.data[q]=usable?sourceData[q]:255;result.data[q+1]=usable?sourceData[q+1]:255;result.data[q+2]=usable?sourceData[q+2]:255;
  };
  for (const entry of eraseColors) {
    if (!entry.color) continue;
    const rgb = entry.color.match(/[a-f\d]{2}/gi)?.map((part) => parseInt(part, 16));
    if (rgb?.length === 3)
      for (let q = 0; q < result.data.length; q += 4) {
        const distance = Math.hypot(sourceData[q] - rgb[0], sourceData[q + 1] - rgb[1], sourceData[q + 2] - rgb[2]);
        if (distance <= entry.sensitivity * 2.2) result.data[q + 3] = 0;
      }
  }
  let floodGeneration = 0;
  const floodApply = (seedX: number, seedY: number, mode: "remove" | "keep", bleed: number, reach: number | null) => {
    const startX = clamp(Math.round(seedX), 0, c.width - 1),
      startY = clamp(Math.round(seedY), 0, c.height - 1),
      start = startY * c.width + startX,
      q0 = start * 4,
      target = [sourceData[q0], sourceData[q0 + 1], sourceData[q0 + 2]];
    floodGeneration++;
    if (floodGeneration >= 65535) {
      floodSeen.fill(0);
      floodGeneration = 1;
    }
    let head = 0,
      tail = 0;
    floodQueue[tail++] = start;
    floodSeen[start] = floodGeneration;
    while (head < tail) {
      const at = floodQueue[head++],
        q = at * 4,
        px = at % c.width,
        py = (at / c.width) | 0,
        dist = Math.hypot(sourceData[q] - target[0], sourceData[q + 1] - target[1], sourceData[q + 2] - target[2]);
      if (dist > Math.max(2, bleed * 2.2)) continue;
      if (reach !== null && Math.hypot(px - startX, py - startY) > reach * Math.max(c.width, c.height)) continue;
      if (mode === "remove") result.data[q + 3] = 0;
      else {
        result.data[q] = sourceData[q];
        result.data[q + 1] = sourceData[q + 1];
        result.data[q + 2] = sourceData[q + 2];
        result.data[q + 3] = 255;
      }
      const ns = [at - 1, at + 1, at - c.width, at + c.width];
      for (let n = 0; n < 4; n++) {
        const next = ns[n];
        if (next < 0 || next >= floodSeen.length || floodSeen[next] === floodGeneration || (n === 0 && px === 0) || (n === 1 && px === c.width - 1) || (n === 2 && py === 0) || (n === 3 && py === c.height - 1)) continue;
        floodSeen[next] = floodGeneration;
        floodQueue[tail++] = next;
      }
    }
  };
  for (const stroke of strokes) {
    const radius = Math.max(2, (stroke.brush / 200) * Math.min(c.width, c.height));
    const mask = document.createElement("canvas");
    mask.width = c.width;
    mask.height = c.height;
    const mx = mask.getContext("2d")!;
    mx.strokeStyle = "#fff";
    mx.fillStyle = "#fff";
    mx.lineWidth = radius * 2;
    mx.lineCap = "round";
    mx.lineJoin = "round";
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      mx.beginPath();
      mx.arc(p.x * c.width, p.y * c.height, radius, 0, Math.PI * 2);
      mx.fill();
    } else {
      mx.beginPath();
      stroke.points.forEach((p, index) => (index ? mx.lineTo(p.x * c.width, p.y * c.height) : mx.moveTo(p.x * c.width, p.y * c.height)));
      mx.stroke();
    }
    const painted = mx.getImageData(0, 0, c.width, c.height).data;
    for (let at = 0; at < c.width * c.height; at++) {
      if (painted[at * 4 + 3] < 64) continue;
      const q = at * 4;
      if (stroke.mode === "remove") result.data[q + 3] = 0;
      else {
        result.data[q] = sourceData[q];
        result.data[q + 1] = sourceData[q + 1];
        result.data[q + 2] = sourceData[q + 2];
        result.data[q + 3] = 255;
      }
    }
    if (stroke.bleed > 0) {
      const stride = Math.max(1, Math.ceil(stroke.points.length / 12));
      for (let i = 0; i < stroke.points.length; i += stride) {
        const p = stroke.points[i];
        floodApply(p.x * c.width, p.y * c.height, stroke.mode, stroke.bleed, stroke.reach);
      }
    }
  }
  // Final output is strictly binary, including manually refined areas.
  for (let q = 3; q < result.data.length; q += 4) result.data[q] = result.data[q] < 128 ? 0 : 255;
  // Fill small enclosed transparent components. This restores tiny white
  // details removed with the background while leaving the outer background open.
  if (speckles > 0) {
    const seen = new Uint8Array(c.width * c.height),
      queue = new Int32Array(c.width * c.height),
      maxArea = Math.round(speckles);
    for (let start = 0; start < seen.length; start++) {
      if (seen[start] || result.data[start * 4 + 3] !== 0) continue;
      let head = 0,
        tail = 0,
        touchesEdge = false;
      queue[tail++] = start;
      seen[start] = 1;
      while (head < tail) {
        const at = queue[head++],
          px = at % c.width,
          py = (at / c.width) | 0;
        if (px === 0 || py === 0 || px === c.width - 1 || py === c.height - 1) touchesEdge = true;
        const ns = [at - 1, at + 1, at - c.width, at + c.width];
        for (let n = 0; n < 4; n++) {
          const next = ns[n];
          if (next < 0 || next >= seen.length || seen[next] || (n === 0 && px === 0) || (n === 1 && px === c.width - 1) || result.data[next * 4 + 3] !== 0) continue;
          seen[next] = 1;
          queue[tail++] = next;
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
  const edgeSteps = Math.min(25, Math.abs(Math.round(edgeRefine)));
  for (let pass = 0; pass < edgeSteps; pass++) {
    const before = new Uint8ClampedArray(result.data),
      remove = edgeRefine > 0;
    for (let py = 1; py < c.height - 1; py++)
      for (let px = 1; px < c.width - 1; px++) {
        const at = py * c.width + px,
          q = at * 4,
          opaque = before[q + 3] >= 128;
        const neighbor = [at - 1, at + 1, at - c.width, at + c.width].some((n) => before[n * 4 + 3] >= 128);
        const transparentNeighbor = [at - 1, at + 1, at - c.width, at + c.width].some((n) => before[n * 4 + 3] < 128);
        if (remove && opaque && transparentNeighbor) result.data[q + 3] = 0;
        if (!remove && !opaque && neighbor) {
          restoreSourceOrWhite(q);
          result.data[q + 3] = 255;
        }
      }
  }
  if (edgeSmooth > 0) {
    const radius = Math.max(1, Math.round(edgeSmooth)),
      w = c.width,
      h = c.height,
      alpha = new Float32Array(w * h),
      horizontal = new Float32Array(w * h),
      smoothed = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = result.data[i * 4 + 3] / 255;
    for (let py = 0; py < h; py++) {
      let sum = 0;
      for (let px = -radius; px <= radius; px++) sum += alpha[py * w + clamp(px, 0, w - 1)];
      for (let px = 0; px < w; px++) {
        horizontal[py * w + px] = sum / (radius * 2 + 1);
        sum -= alpha[py * w + clamp(px - radius, 0, w - 1)];
        sum += alpha[py * w + clamp(px + radius + 1, 0, w - 1)];
      }
    }
    for (let px = 0; px < w; px++) {
      let sum = 0;
      for (let py = -radius; py <= radius; py++) sum += horizontal[clamp(py, 0, h - 1) * w + px];
      for (let py = 0; py < h; py++) {
        smoothed[py * w + px] = sum / (radius * 2 + 1);
        sum -= horizontal[clamp(py - radius, 0, h - 1) * w + px];
        sum += horizontal[clamp(py + radius + 1, 0, h - 1) * w + px];
      }
    }
    for (let i = 0; i < w * h; i++) {
      const q = i * 4;
      if (smoothed[i] >= 0.5) {
        restoreSourceOrWhite(q);
        result.data[q + 3] = 255;
      } else result.data[q + 3] = 0;
    }
  }
  x.putImageData(result, 0, 0);
  const output = c.toDataURL("image/png");
  return optimizeAlpha ? optimizeAlphaChannel(output) : output;
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
    const data = x.getImageData(0, 0, c.width, c.height),
      original = new Uint8ClampedArray(data.data),
      border = Math.max(1, Math.round(Math.min(c.width, c.height) / 700));
    for (let py = 0; py < c.height; py++)
      for (let px = 0; px < c.width; px++) {
        const q = (py * c.width + px) * 4;
        if (original[q + 3] < 128) continue;
        let edge = false;
        for (let oy = -border; oy <= border && !edge; oy++)
          for (let ox = -border; ox <= border; ox++) {
            const nx = px + ox,
              ny = py + oy;
            if (nx < 0 || ny < 0 || nx >= c.width || ny >= c.height || original[(ny * c.width + nx) * 4 + 3] < 128) {
              edge = true;
              break;
            }
          }
        if (edge) {
          data.data[q] = 20;
          data.data[q + 1] = 23;
          data.data[q + 2] = 21;
          data.data[q + 3] = 255;
        }
      }
    x.putImageData(data, 0, 0);
  }
  return c.toDataURL();
}

async function marqueeTouchesVisiblePixels(layer: Layer, area: { x: number; y: number; w: number; h: number }) {
  const img = await getImage(layer.src),
    limit = 280;
  const ratio = Math.min(1, limit / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * ratio));
  c.height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const context = c.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(img, 0, 0, c.width, c.height);
  const pixels = context.getImageData(0, 0, c.width, c.height).data;
  const radians = (layer.rotation * Math.PI) / 180,
    cos = Math.cos(radians),
    sin = Math.sin(radians);
  const centerX = layer.x + layer.w / 2,
    centerY = layer.y + layer.h / 2;
  for (let py = 0; py < c.height; py++)
    for (let px = 0; px < c.width; px++) {
      if (pixels[(py * c.width + px) * 4 + 3] < 96) continue;
      const localX = layer.x + ((px + 0.5) / c.width) * layer.w;
      const localY = layer.y + ((py + 0.5) / c.height) * layer.h;
      const dx = localX - centerX,
        dy = localY - centerY;
      const worldX = centerX + dx * cos - dy * sin,
        worldY = centerY + dx * sin + dy * cos;
      if (worldX >= area.x && worldX <= area.x + area.w && worldY >= area.y && worldY <= area.y + area.h) return true;
    }
  return false;
}
async function layerOpaqueAtWorld(layer:Layer,worldX:number,worldY:number){
  const cx=layer.x+layer.w/2,cy=layer.y+layer.h/2,rad=-layer.rotation*Math.PI/180,dx=worldX-cx,dy=worldY-cy,localX=cx+dx*Math.cos(rad)-dy*Math.sin(rad),localY=cy+dx*Math.sin(rad)+dy*Math.cos(rad),u=(localX-layer.x)/layer.w,v=(localY-layer.y)/layer.h;
  if(u<0||u>1||v<0||v>1)return false;const img=await getImage(layer.src),c=document.createElement("canvas");c.width=c.height=1;const x=c.getContext("2d")!;x.drawImage(img,clamp(Math.floor(u*img.naturalWidth),0,img.naturalWidth-1),clamp(Math.floor(v*img.naturalHeight),0,img.naturalHeight-1),1,1,0,0,1,1);return x.getImageData(0,0,1,1).data[3]>=64;
}
async function smoothVectorCutout(src: string, color: string) {
  const img = await getImage(src),
    longest = Math.max(img.naturalWidth, img.naturalHeight),
    supersample = clamp(1800 / Math.max(longest, 1), 1, 3),
    pad = Math.ceil(supersample * 6),
    mask = document.createElement("canvas"),
    traced = document.createElement("canvas");
  mask.width = Math.max(1, Math.round(img.naturalWidth * supersample));
  mask.height = Math.max(1, Math.round(img.naturalHeight * supersample));
  const mx = mask.getContext("2d")!;
  mx.imageSmoothingEnabled = true;
  mx.imageSmoothingQuality = "high";
  mx.drawImage(img, 0, 0, mask.width, mask.height);
  const pixels = mx.getImageData(0, 0, mask.width, mask.height);
  traced.width = mask.width + pad * 2;
  traced.height = mask.height + pad * 2;
  const tx = traced.getContext("2d")!;
  tx.fillStyle = "#fff";
  tx.fillRect(0, 0, traced.width, traced.height);
  const binary = tx.createImageData(mask.width, mask.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const solid = pixels.data[i + 3] >= 128;
    binary.data[i] = binary.data[i + 1] = binary.data[i + 2] = solid ? 0 : 255;
    binary.data[i + 3] = 255;
  }
  tx.putImageData(binary, pad, pad);
  const paths = traceCanvas(traced, {
    turnpolicy: "minority",
    turdsize: Math.max(2, Math.round(supersample * supersample * 0.25)),
    alphamax: 0.62,
    optcurve: true,
    opttolerance: 0.08,
  });
  if (!paths.length) throw new Error("The cutout contour is empty");
  const doc = new DOMParser().parseFromString(getSVG(paths, 1, "fill"), "image/svg+xml"),
    root = doc.documentElement;
  root.setAttribute("width", String(traced.width));
  root.setAttribute("height", String(traced.height));
  root.setAttribute("viewBox", `0 0 ${traced.width} ${traced.height}`);
  root.setAttribute("preserveAspectRatio", "none");
  root.setAttribute("shape-rendering", "geometricPrecision");
  root.querySelectorAll("path").forEach((path) => {
    path.setAttribute("fill", color);
    path.setAttribute("fill-rule", "evenodd");
    path.setAttribute("stroke", "none");
  });
  return `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`;
}
async function hasTransparentCanvas(src: string) {
  const img = await getImage(src),
    sample = document.createElement("canvas"),
    ratio = Math.min(1, 700 / Math.max(img.naturalWidth, img.naturalHeight));
  sample.width = Math.max(1, Math.round(img.naturalWidth * ratio));
  sample.height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const context = sample.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(img, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 16) return true;
  return false;
}
async function vTracerCutout(src: string, color: string, physicalWidthCm?: number, simplify = 1.25) {
  const img = await getImage(src),
    canvas = document.createElement("canvas"),
    ratio = img.naturalHeight / Math.max(1, img.naturalWidth),
    targetWidth = physicalWidthCm ? clamp(Math.round(physicalWidthCm * 96), 64, 2800) : clamp(img.naturalWidth, 64, 2800);
  canvas.width = targetWidth;
  canvas.height = Math.max(1, Math.round(targetWidth * ratio));
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const foreground = pixels.data[i + 3] >= 128;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = foreground ? 0 : 255;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Cutout mask could not be prepared"))), "image/png"));
  const buffer = await blob.arrayBuffer(),
    worker = new Worker("/vtracer/worker.js");
  const tracedSvg = await new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("VTracer could not finish this image within three minutes"));
    }, 180000);
    worker.onmessage = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.svg);
    };
    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || "VTracer worker failed"));
    };
    worker.postMessage({ buffer, simplify }, [buffer]);
  });
  const doc = new DOMParser().parseFromString(tracedSvg, "image/svg+xml"),
    output = doc.documentElement as unknown as SVGSVGElement;
  if (output.tagName.toLowerCase() !== "svg" || output.querySelector("parsererror")) throw new Error("VTracer returned an invalid SVG");
  const outputWidth = Number(output.getAttribute("width")) || canvas.width,
    outputHeight = Number(output.getAttribute("height")) || canvas.height,
    framePaddingX = 3,
    framePaddingY = framePaddingX * (outputHeight / Math.max(1, outputWidth));
  output.setAttribute("preserveAspectRatio", "none");
  output.setAttribute("width", String(outputWidth + framePaddingX * 2));
  output.setAttribute("height", String(outputHeight + framePaddingY * 2));
  output.setAttribute("viewBox", `${-framePaddingX} ${-framePaddingY} ${outputWidth + framePaddingX * 2} ${outputHeight + framePaddingY * 2}`);
  output.setAttribute("shape-rendering", "geometricPrecision");
  output.querySelectorAll("path").forEach((path) => {
    path.setAttribute("fill", color);
    path.setAttribute("stroke", "#141715");
    path.setAttribute("stroke-width", "1.1");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    path.setAttribute("paint-order", "stroke fill");
  });
  return `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(output))}`;
}
async function analyzeCutSafety(src: string, widthCm: number) {
  const img = await getImage(src),
    w = Math.min(700, img.naturalWidth),
    h = Math.max(1, Math.round((w * img.naturalHeight) / Math.max(1, img.naturalWidth))),
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, w, h);
  const data = x.getImageData(0, 0, w, h).data,
    solid = new Uint8Array(w * h);
  for (let i = 0; i < solid.length; i++) solid[i] = data[i * 4 + 3] >= 96 ? 1 : 0;
  const threshold = Math.max(1, (0.1 / Math.max(widthCm, 0.01)) * w),
    seen = new Uint8Array(w * h),
    riskMask = new Uint8Array(w * h);
  let tinyIslandCount = 0,
    tinyHoleCount = 0;
  const scan = (foreground: boolean) => {
    seen.fill(0);
    for (let start = 0; start < solid.length; start++) {
      if (seen[start] || Boolean(solid[start]) !== foreground) continue;
      const stack = [start];
      let minX = w,
        maxX = 0,
        minY = h,
        maxY = 0,
        touches = false,
        count = 0;
      const component: number[] = [];
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop()!,
          px = p % w,
          py = (p / w) | 0;
        count++;
        component.push(p);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
        if (!px || !py || px === w - 1 || py === h - 1) touches = true;
        for (const n of [p - 1, p + 1, p - w, p + w])
          if (n >= 0 && n < solid.length && !seen[n] && Math.abs((n % w) - px) <= 1 && Boolean(solid[n]) === foreground) {
            seen[n] = 1;
            stack.push(n);
          }
      }
      const bw = maxX - minX + 1,
        bh = maxY - minY + 1;
      if (foreground && count > 1 && Math.min(bw, bh) < threshold && Math.max(bw, bh) < threshold * 5) {
        tinyIslandCount++;
        component.forEach((position) => (riskMask[position] = 1));
      }
      if (!foreground && !touches && Math.min(bw, bh) < threshold) {
        tinyHoleCount++;
        component.forEach((position) => (riskMask[position] = 1));
      }
    }
  };
  scan(true);
  scan(false);
  const thinMask = new Uint8Array(w * h),
    thinWidth = new Uint16Array(w * h);
  const markThinRun = (positions: number[], run: number) => {
    if (run <= 0 || run >= threshold) return;
    for (const position of positions) {
      thinMask[position] = 1;
      thinWidth[position] = thinWidth[position] ? Math.min(thinWidth[position], run) : run;
    }
  };
  for (let y = 0; y < h; y += 2) {
    let run = 0,
      positions: number[] = [];
    for (let xx = 0; xx <= w; xx++) {
      if (xx < w && solid[y * w + xx]) {
        run++;
        positions.push(y * w + xx);
      }
      else {
        markThinRun(positions, run);
        run = 0;
        positions = [];
      }
    }
  }
  for (let xx = 0; xx < w; xx += 2) {
    let run = 0,
      positions: number[] = [];
    for (let y = 0; y <= h; y++) {
      if (y < h && solid[y * w + xx]) {
        run++;
        positions.push(y * w + xx);
      }
      else {
        markThinRun(positions, run);
        run = 0;
        positions = [];
      }
    }
  }
  seen.fill(0);
  let thinRegionCount = 0,
    minStructuralWidth = Number.POSITIVE_INFINITY;
  for (let start = 0; start < thinMask.length; start++) {
    if (!thinMask[start] || seen[start]) continue;
    const stack = [start];
    let minX = w,
      maxX = 0,
      minY = h,
      maxY = 0,
      minWidth = Number.POSITIVE_INFINITY,
      count = 0;
    const component: number[] = [];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!,
        px = p % w,
        py = (p / w) | 0;
      count++;
      component.push(p);
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
      if (thinWidth[p]) minWidth = Math.min(minWidth, thinWidth[p]);
      for (const n of [p - 1, p + 1, p - w, p + w])
        if (n >= 0 && n < thinMask.length && !seen[n] && thinMask[n] && Math.abs((n % w) - px) <= 1) {
          seen[n] = 1;
          stack.push(n);
        }
    }
    const span = Math.max(maxX - minX + 1, maxY - minY + 1);
    if (span >= threshold * 2 && count >= threshold) {
      thinRegionCount++;
      minStructuralWidth = Math.min(minStructuralWidth, minWidth);
      component.forEach((position) => (riskMask[position] = 1));
    }
  }
  const minThinMm = Number.isFinite(minStructuralWidth) ? (minStructuralWidth / w) * widthCm * 10 : 0,
    reasons = [
      thinRegionCount > 0 && `${thinRegionCount} structurally thin region${thinRegionCount === 1 ? "" : "s"} detected; thinnest is approximately ${minThinMm.toFixed(1)} mm (minimum 1.0 mm)`,
      tinyIslandCount > 0 && `${tinyIslandCount} detached positive island${tinyIslandCount === 1 ? "" : "s"} smaller than 1 mm`,
      tinyHoleCount > 0 && `${tinyHoleCount} enclosed gap${tinyHoleCount === 1 ? "" : "s"} smaller than 1 mm`,
    ].filter(Boolean) as string[];
  if (!reasons.length) return { cutRisk: false, cutRiskReason: "", cutRiskOverlay: "" };
  const overlay = document.createElement("canvas");
  overlay.width = w;
  overlay.height = h;
  const overlayContext = overlay.getContext("2d")!,
    overlayData = overlayContext.createImageData(w, h);
  let baseR = 20,
    baseG = 23,
    baseB = 21;
  for (let i = 0; i < solid.length; i++)
    if (solid[i]) {
      baseR = data[i * 4];
      baseG = data[i * 4 + 1];
      baseB = data[i * 4 + 2];
      break;
    }
  const marker = [255 - baseR, 255 - baseG, 255 - baseB];
  for (let p = 0; p < riskMask.length; p++) {
    if (!riskMask[p]) continue;
    const px = p % w,
      py = (p / w) | 0;
    for (let oy = -2; oy <= 2; oy++)
      for (let ox = -2; ox <= 2; ox++) {
        const nx = px + ox,
          ny = py + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = (ny * w + nx) * 4;
        overlayData.data[q] = marker[0];
        overlayData.data[q + 1] = marker[1];
        overlayData.data[q + 2] = marker[2];
        overlayData.data[q + 3] = 220;
      }
  }
  overlayContext.putImageData(overlayData, 0, 0);
  return { cutRisk: true, cutRiskReason: reasons.join(", "), cutRiskOverlay: overlay.toDataURL("image/png") };
}
async function renderCutoutEdit(editor: CutoutEditor, applyCrop = false) {
  const img = await getImage(editor.source),
    c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  for (const stroke of editor.strokes) {
    if (!stroke.points.length) continue;
    if (stroke.tool === "smooth") continue;
    x.save();
    x.lineCap = "round";
    x.lineJoin = "round";
    x.lineWidth = Math.max(2, (stroke.brush / 100) * Math.min(c.width, c.height));
    if (stroke.tool === "bridge") {
      x.globalCompositeOperation = "source-over";
      x.strokeStyle = editor.color;
      x.fillStyle = editor.color;
    } else {
      x.globalCompositeOperation = "destination-out";
      x.strokeStyle = "#000";
      x.fillStyle = "#000";
    }
    x.beginPath();
    x.moveTo(stroke.points[0].x * c.width, stroke.points[0].y * c.height);
    for (const p of stroke.points.slice(1)) x.lineTo(p.x * c.width, p.y * c.height);
    if (stroke.tool === "rectangle" && stroke.points.length > 1) {
      const a = stroke.points[0],
        z = stroke.points.at(-1)!;
      x.fillRect(Math.min(a.x, z.x) * c.width, Math.min(a.y, z.y) * c.height, Math.abs(z.x - a.x) * c.width, Math.abs(z.y - a.y) * c.height);
    } else if (stroke.tool === "lasso" && stroke.points.length > 2) {
      x.closePath();
      x.fill();
    } else if (stroke.points.length === 1) {
      const p = stroke.points[0];
      x.arc(p.x * c.width, p.y * c.height, x.lineWidth / 2, 0, Math.PI * 2);
      x.fill();
    } else x.stroke();
    x.restore();
  }
  for (const stroke of editor.strokes.filter((item) => item.tool === "smooth" && item.points.length)) {
    const mask = document.createElement("canvas"),
      softened = document.createElement("canvas");
    mask.width = softened.width = c.width;
    mask.height = softened.height = c.height;
    const maskContext = mask.getContext("2d")!,
      softContext = softened.getContext("2d")!;
    maskContext.lineCap = "round";
    maskContext.lineJoin = "round";
    maskContext.strokeStyle = "#fff";
    maskContext.lineWidth = Math.max(4, (stroke.brush / 100) * Math.min(c.width, c.height));
    const trajectory = stroke.points.map((point, index, points) => {
      if (index === 0 || index === points.length - 1) return point;
      const from = Math.max(0, index - 3),
        to = Math.min(points.length - 1, index + 3),
        window = points.slice(from, to + 1);
      return {
        x: window.reduce((sum, p) => sum + p.x, 0) / window.length,
        y: window.reduce((sum, p) => sum + p.y, 0) / window.length,
      };
    });
    maskContext.beginPath();
    maskContext.moveTo(trajectory[0].x * c.width, trajectory[0].y * c.height);
    for (const point of trajectory.slice(1)) maskContext.lineTo(point.x * c.width, point.y * c.height);
    if (stroke.points.length === 1) maskContext.lineTo(stroke.points[0].x * c.width + 0.01, stroke.points[0].y * c.height);
    maskContext.stroke();
    softContext.filter = `blur(${Math.max(4, maskContext.lineWidth * 0.2)}px)`;
    softContext.drawImage(c, 0, 0);
    softContext.filter = "none";
    const current = x.getImageData(0, 0, c.width, c.height),
      blurred = softContext.getImageData(0, 0, c.width, c.height),
      selected = maskContext.getImageData(0, 0, c.width, c.height);
    for (let q = 0; q < current.data.length; q += 4)
      if (selected.data[q + 3] > 20) {
        const alpha = blurred.data[q + 3] >= 128 ? 255 : 0;
        if (current.data[q + 3] < 96) {
          current.data[q] = parseInt(editor.color.slice(1, 3), 16);
          current.data[q + 1] = parseInt(editor.color.slice(3, 5), 16);
          current.data[q + 2] = parseInt(editor.color.slice(5, 7), 16);
        }
        current.data[q + 3] = alpha;
      }
    for (let py = 1; py < c.height - 1; py++)
      for (let px = 1; px < c.width - 1; px++) {
        const p = py * c.width + px,
          q = p * 4;
        if (selected.data[q + 3] < 20 || current.data[q + 3] < 128) continue;
        if ([p - 1, p + 1, p - c.width, p + c.width].some((n) => current.data[n * 4 + 3] < 128)) {
          current.data[q] = 20;
          current.data[q + 1] = 23;
          current.data[q + 2] = 21;
        }
      }
    x.putImageData(current, 0, 0);
  }
  const outlined = x.getImageData(0, 0, c.width, c.height),
    copy = new Uint8ClampedArray(outlined.data);
  for (let py = 0; py < c.height; py++)
    for (let px = 0; px < c.width; px++) {
      const p = py * c.width + px,
        q = p * 4;
      if (copy[q + 3] < 96) continue;
      let edge = false;
      for (let oy = -1; oy <= 1 && !edge; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const nx = px + ox,
            ny = py + oy;
          if (nx < 0 || ny < 0 || nx >= c.width || ny >= c.height || copy[(ny * c.width + nx) * 4 + 3] < 96) {
            edge = true;
            break;
          }
        }
      if (edge) {
        outlined.data[q] = 20;
        outlined.data[q + 1] = 23;
        outlined.data[q + 2] = 21;
        outlined.data[q + 3] = 255;
      }
    }
  x.putImageData(outlined, 0, 0);
  if (!applyCrop) return { src: c.toDataURL(), left: 0, top: 0, width: 1, height: 1 };
  const l = clamp(editor.crop.left / 100, 0, 0.9),
    t = clamp(editor.crop.top / 100, 0, 0.9),
    r = clamp(editor.crop.right / 100, 0, Math.max(0, 0.95 - l)),
    b = clamp(editor.crop.bottom / 100, 0, Math.max(0, 0.95 - t)),
    out = document.createElement("canvas"),
    sx = Math.round(l * c.width),
    sy = Math.round(t * c.height),
    sw = Math.max(1, Math.round(c.width * (1 - l - r))),
    sh = Math.max(1, Math.round(c.height * (1 - t - b)));
  out.width = sw;
  out.height = sh;
  out.getContext("2d")!.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
  const trimmed = await trimTransparent(out.toDataURL());
  return {
    src: trimmed.src,
    left: l + (1 - l - r) * trimmed.left,
    top: t + (1 - t - b) * trimmed.top,
    width: (1 - l - r) * trimmed.width,
    height: (1 - t - b) * trimmed.height,
  };
}
async function bakeRotation(layer: Layer) {
  if (!layer.rotation) return layer;
  const img = await getImage(layer.src),
    angle = (layer.rotation * Math.PI) / 180,
    outW = Math.ceil(Math.abs(img.width * Math.cos(angle)) + Math.abs(img.height * Math.sin(angle))),
    outH = Math.ceil(Math.abs(img.width * Math.sin(angle)) + Math.abs(img.height * Math.cos(angle))),
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
async function strokeImage(src: string, strokeCm: number, wCm: number, color: string, fillGapsMm = 0) {
  const cleaned = await removeBg(src),
    img = await getImage(cleaned),
    s = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight)),
    iw = Math.max(1, Math.round(img.naturalWidth * s)),
    ih = Math.max(1, Math.round(img.naturalHeight * s)),
    r = Math.max(0, Math.min(72, Math.round((strokeCm / Math.max(wCm, 0.1)) * iw))),
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
      limit = Math.max(1, Math.round((fillGapsMm / 10 / Math.max(wCm + strokeCm * 2, 0.1)) * c.width)),
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
        if (qx === 0 || qy === 0 || qx === c.width - 1 || qy === c.height - 1) edge = true;
        for (const n of [q - 1, q + 1, q - c.width, q + c.width])
          if (n >= 0 && n < seen.length && !seen[n] && data.data[n * 4 + 3] < 245 && Math.abs((n % c.width) - qx) <= 1) {
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
async function trimUniformBorder(src: string) {
  const img = await getImage(src),
    c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height),
    d = data.data;
  const corners = [
    [0, 0],
    [c.width - 1, 0],
    [0, c.height - 1],
    [c.width - 1, c.height - 1],
  ].map(([px, py]) => {
    const i = (py * c.width + px) * 4;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  });
  const bg = corners[0],
    distance = (a: number[], b: number[]) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]), Math.abs(a[3] - b[3]));
  if (corners.some((color) => distance(color, bg) > 18)) return { src, left: 0, top: 0, width: 1, height: 1 };
  let minX = c.width,
    minY = c.height,
    maxX = -1,
    maxY = -1;
  for (let py = 0; py < c.height; py++)
    for (let px = 0; px < c.width; px++) {
      const i = (py * c.width + px) * 4,
        current = [d[i], d[i + 1], d[i + 2], d[i + 3]];
      if (distance(current, bg) > 22) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
  if (maxX < minX) return { src, left: 0, top: 0, width: 1, height: 1 };
  const pad = 1;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(c.width - 1, maxX + pad);
  maxY = Math.min(c.height - 1, maxY + pad);
  if (minX === 0 && minY === 0 && maxX === c.width - 1 && maxY === c.height - 1) return { src, left: 0, top: 0, width: 1, height: 1 };
  const w = maxX - minX + 1,
    h = maxY - minY + 1,
    out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(c, minX, minY, w, h, 0, 0, w, h);
  return {
    src: out.toDataURL("image/png"),
    left: minX / c.width,
    top: minY / c.height,
    width: w / c.width,
    height: h / c.height,
  };
}
async function selectedEdgeOverlay(src: string, stroke: EditStroke, color: string) {
  const img = await getImage(src),
    c = document.createElement("canvas"),
    mask = document.createElement("canvas");
  c.width = mask.width = img.naturalWidth;
  c.height = mask.height = img.naturalHeight;
  const cx = c.getContext("2d")!,
    mx = mask.getContext("2d")!;
  cx.drawImage(img, 0, 0);
  mx.lineCap = "round";
  mx.lineJoin = "round";
  mx.strokeStyle = "#fff";
  mx.lineWidth = Math.max(4, (stroke.brush / 100) * Math.min(c.width, c.height));
  mx.beginPath();
  stroke.points.forEach((p, i) => (i ? mx.lineTo(p.x * c.width, p.y * c.height) : mx.moveTo(p.x * c.width, p.y * c.height)));
  if (stroke.points.length === 1) mx.lineTo(stroke.points[0].x * c.width + 0.01, stroke.points[0].y * c.height);
  mx.stroke();
  const source = cx.getImageData(0, 0, c.width, c.height),
    selection = mx.getImageData(0, 0, c.width, c.height),
    out = cx.createImageData(c.width, c.height),
    rgb = color === "green" ? [22, 163, 74] : [239, 43, 45],
    radius = Math.max(1, Math.round(Math.min(c.width, c.height) / 350));
  for (let y = 1; y < c.height - 1; y++)
    for (let x = 1; x < c.width - 1; x++) {
      const p = y * c.width + x,
        i = p * 4;
      if (selection.data[i + 3] < 20 || source.data[i + 3] < 96) continue;
      const edge = [p - 1, p + 1, p - c.width, p + c.width].some((q) => source.data[q * 4 + 3] < 96);
      if (!edge) continue;
      for (let oy = -radius; oy <= radius; oy++)
        for (let ox = -radius; ox <= radius; ox++) {
          if (ox * ox + oy * oy > radius * radius) continue;
          const k = ((y + oy) * c.width + x + ox) * 4;
          out.data[k] = rgb[0];
          out.data[k + 1] = rgb[1];
          out.data[k + 2] = rgb[2];
          out.data[k + 3] = 255;
        }
    }
  cx.clearRect(0, 0, c.width, c.height);
  cx.putImageData(out, 0, 0);
  return c.toDataURL("image/png");
}
async function findOpaqueIslands(src: string) {
  const img = await getImage(src),
    scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight)),
    w = Math.max(1, Math.round(img.naturalWidth * scale)),
    h = Math.max(1, Math.round(img.naturalHeight * scale)),
    work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const wx = work.getContext("2d")!;
  wx.drawImage(img, 0, 0, w, h);
  const pixels = wx.getImageData(0, 0, w, h),
    seen = new Uint8Array(w * h),
    queue = new Int32Array(w * h),
    groups: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      pixels: number[];
    }[] = [];
  for (let seed = 0; seed < w * h; seed++) {
    if (seen[seed] || pixels.data[seed * 4 + 3] < 40) continue;
    let head = 0,
      tail = 0;
    queue[tail++] = seed;
    seen[seed] = 1;
    const group = {
      minX: w,
      minY: h,
      maxX: 0,
      maxY: 0,
      pixels: [] as number[],
    };
    while (head < tail) {
      const p = queue[head++],
        x = p % w,
        y = Math.floor(p / w);
      group.pixels.push(p);
      group.minX = Math.min(group.minX, x);
      group.maxX = Math.max(group.maxX, x);
      group.minY = Math.min(group.minY, y);
      group.maxY = Math.max(group.maxY, y);
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = x + ox,
            ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (!seen[q] && pixels.data[q * 4 + 3] >= 40) {
            seen[q] = 1;
            queue[tail++] = q;
          }
        }
    }
    if (group.pixels.length >= Math.max(20, w * h * 0.00008)) groups.push(group);
  }
  groups.sort((a, b) => a.minX - b.minX || a.minY - b.minY);
  const preview = document.createElement("canvas");
  preview.width = w;
  preview.height = h;
  const px = preview.getContext("2d")!,
    previewData = px.createImageData(w, h),
    palette = [
      [239, 68, 68],
      [14, 165, 233],
      [34, 197, 94],
      [168, 85, 247],
      [245, 158, 11],
      [236, 72, 153],
    ];
  groups.forEach((group, index) => {
    const rgb = palette[index % palette.length];
    for (const p of group.pixels) {
      const i = p * 4;
      previewData.data[i] = rgb[0];
      previewData.data[i + 1] = rgb[1];
      previewData.data[i + 2] = rgb[2];
      previewData.data[i + 3] = 220;
    }
  });
  px.putImageData(previewData, 0, 0);
  const full = document.createElement("canvas");
  full.width = img.naturalWidth;
  full.height = img.naturalHeight;
  full.getContext("2d")!.drawImage(img, 0, 0);
  const parts = groups.map((group) => {
    const sx = Math.floor((group.minX * full.width) / w),
      sy = Math.floor((group.minY * full.height) / h),
      ex = Math.ceil(((group.maxX + 1) * full.width) / w),
      ey = Math.ceil(((group.maxY + 1) * full.height) / h),
      sw = Math.max(1, ex - sx),
      sh = Math.max(1, ey - sy),
      out = document.createElement("canvas"),
      componentMask = document.createElement("canvas"),
      fullMask = document.createElement("canvas");
    componentMask.width = w;
    componentMask.height = h;
    const maskContext = componentMask.getContext("2d")!,
      maskData = maskContext.createImageData(w, h);
    for (const p of group.pixels) maskData.data[p * 4 + 3] = 255;
    maskContext.putImageData(maskData, 0, 0);
    fullMask.width = full.width;
    fullMask.height = full.height;
    const fullMaskContext = fullMask.getContext("2d")!;
    fullMaskContext.imageSmoothingEnabled = false;
    fullMaskContext.drawImage(componentMask, 0, 0, full.width, full.height);
    out.width = sw;
    out.height = sh;
    const outContext = out.getContext("2d")!;
    outContext.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
    outContext.globalCompositeOperation = "destination-in";
    outContext.imageSmoothingEnabled = false;
    outContext.drawImage(fullMask, sx, sy, sw, sh, 0, 0, sw, sh);
    return {
      src: out.toDataURL("image/png"),
      left: sx / full.width,
      top: sy / full.height,
      width: sw / full.width,
      height: sh / full.height,
      naturalW: sw,
      naturalH: sh,
    };
  });
  return { preview: preview.toDataURL("image/png"), parts };
}
const projectSignature = (layers: Layer[], pageMode: PageMode, safeMargin: number, cutSafetyEnabled = false) => JSON.stringify({ layers, pageMode, safeMargin, cutSafetyEnabled });
const formatProjectSize = (project: SavedProject) => {
  const bytes = new Blob([JSON.stringify(project.data)]).size;
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};
async function createProjectThumbnail(layers: Layer[]) {
  const visible = layers.filter((layer) => layer.visible);
  if (!visible.length) return "";
  const b = bounds(visible),
    canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 120;
  const x = canvas.getContext("2d")!;
  x.fillStyle = "#f7faf8";
  x.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(160 / Math.max(b.w, 0.1), 100 / Math.max(b.h, 0.1));
  for (const layer of visible) {
    try {
      const img = await getImage(layer.src),
        w = layer.w * scale,
        h = layer.h * scale,
        cx = 10 + (layer.x - b.x) * scale + w / 2,
        cy = 10 + (layer.y - b.y) * scale + h / 2;
      x.save();
      x.translate(cx, cy);
      x.rotate((layer.rotation * Math.PI) / 180);
      x.globalAlpha = layer.acetateOn ? 0.42 : 1;
      x.drawImage(img, -w / 2, -h / 2, w, h);
      x.restore();
    } catch {}
  }
  return canvas.toDataURL("image/webp", 0.62);
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
    [zoomEditing, setZoomEditing] = useState(false),
    [zoomDraft, setZoomDraft] = useState("82"),
    [calibration, setCalibration] = useState(1),
    [calibrationDraft, setCalibrationDraft] = useState(1),
    [calibrationOpen, setCalibrationOpen] = useState(false),
    [locked, setLocked] = useState(true),
    [alignOpen, setAlignOpen] = useState(false),
    [colorOpen, setColorOpen] = useState(false),
    [working, setWorking] = useState(false),
    [vTracerStartedAt, setVTracerStartedAt] = useState<number | null>(null),
    [vTracerElapsed, setVTracerElapsed] = useState(0),
    [notice, setNotice] = useState(""),
    [drag, setDrag] = useState<Drag>(null),
    [cycle, setCycle] = useState({ key: "", index: 0, x: -9999, y: -9999 }),
    [strokeDraft, setStrokeDraft] = useState(0.5),
    [fillGapsDraft, setFillGapsDraft] = useState(0),
    [widthDraft, setWidthDraft] = useState("0.0"),
    [heightDraft, setHeightDraft] = useState("0.0"),
    [pageMode, setPageMode] = useState<PageMode>("portrait"),
    [pageColor,setPageColor]=useState<PageColor>("white"),
    [pageSetupOpen, setPageSetupOpen] = useState(false),
    [safeMargin, setSafeMargin] = useState(1),
    [safeOpen, setSafeOpen] = useState(false),
    [gridVisible, setGridVisible] = useState(true),
    [bgMenuOpen, setBgMenuOpen] = useState(false),
    [addNewOpen, setAddNewOpen] = useState(false),
    [createImageMode, setCreateImageMode] = useState<"choose" | "text" | "image" | null>(null),
    [textFontStyle, setTextFontStyle] = useState<"mixed" | "cursive" | "serif">("mixed"),
    [textLineCount, setTextLineCount] = useState<1 | 2 | 3 | 4>(3),
    [textLines, setTextLines] = useState(["", "", "", ""]),
    [textExtraPrompt, setTextExtraPrompt] = useState(""),
    [textDetailsOpen, setTextDetailsOpen] = useState(false),
    [optionGallery, setOptionGallery] = useState<{ kind: "font" | "style"; index: number } | null>(null),
    [imageArtStyle, setImageArtStyle] = useState<"watercolor" | "cartoon" | "baby" | "girly" | "storybook" | "paper-cut">("watercolor"),
    [imagePrompt, setImagePrompt] = useState(""),
    [whiteStickerOffset, setWhiteStickerOffset] = useState(false),
    [generatedTextImages, setGeneratedTextImages] = useState<string[]>([]),
    [generatedArtImages, setGeneratedArtImages] = useState<string[]>([]),
    [hasGeneratedText, setHasGeneratedText] = useState(false),
    [generationBusy, setGenerationBusy] = useState<"text" | "image" | null>(null),
    [generatedPreview, setGeneratedPreview] = useState<string | null>(null),
    [splashOpen, setSplashOpen] = useState(false),
    [hideSplashOnStartup, setHideSplashOnStartup] = useState(false),
    [cutoutMenuOpen, setCutoutMenuOpen] = useState(false),
    [svgWarningOpen, setSvgWarningOpen] = useState(false),
    [validationIntroOpen, setValidationIntroOpen] = useState(false),
    [cutSafetyEnabled, setCutSafetyEnabled] = useState(false),
    [riskLayerId, setRiskLayerId] = useState<string | null>(null),
    [clipEditor, setClipEditor] = useState<ClipEditor | null>(null),
    [imageOnShapeTarget, setImageOnShapeTarget] = useState<string | null>(null),
    [shapeImageEditing, setShapeImageEditing] = useState<string | null>(null),
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
    [bgCursor, setBgCursor] = useState<{
      x: number;
      y: number;
      visible: boolean;
    }>({ x: 0, y: 0, visible: false }),
    [bgImageSize, setBgImageSize] = useState({ w: 0, h: 0 }),
    [cutEditor, setCutEditor] = useState<CutoutEditor | null>(null),
    [cutoutTab, setCutoutTab] = useState<"edit" | "stroke">("edit"),
    [cutPreview, setCutPreview] = useState(""),
    [cutImageSize, setCutImageSize] = useState({ w: 0, h: 0 }),
    [cutActiveStroke, setCutActiveStroke] = useState<string | null>(null),
    [cutFinishedStroke, setCutFinishedStroke] = useState<string | null>(null),
    [cutEdgeOverlay, setCutEdgeOverlay] = useState(""),
    [cutCropActive, setCutCropActive] = useState(false),
    [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null),
    [cutCursor, setCutCursor] = useState<{
      visible: boolean;
    }>({ visible: false }),
    [imageEditor, setImageEditor] = useState<ImageEditor | null>(null),
    [imageTab, setImageTab] = useState<"edit" | "background" | "preset">("edit"),
    [imagePreset, setImagePreset] = useState<"image" | "rim" | "text">("image"),
    [imageEditorSize, setImageEditorSize] = useState({ w: 0, h: 0 }),
    [rulerOrigin, setRulerOrigin] = useState({ x: 0, y: 0 }),
    [session, setSession] = useState<Session | null>(null),
    [projects, setProjects] = useState<SavedProject[]>([]),
    [projectsLoading, setProjectsLoading] = useState(true),
    [projectsOpen, setProjectsOpen] = useState(false),
    [expandedProjectId, setExpandedProjectId] = useState<string | null>(null),
    [pendingOpenProject, setPendingOpenProject] = useState<SavedProject | null>(null),
    [pendingOverwriteProject, setPendingOverwriteProject] = useState<SavedProject | null>(null),
    [pendingNewProject, setPendingNewProject] = useState(false),
    [saveAsMode, setSaveAsMode] = useState(false),
    [accountOpen, setAccountOpen] = useState(false),
    [devLogOpen, setDevLogOpen] = useState(false),
    [sessionLogOpen, setSessionLogOpen] = useState(false),
    [sessionLog, setSessionLog] = useState<SessionLogEntry[]>([
      { id: uid(), at: new Date().toISOString(), action: "Project started", details: "A new editing session was created." },
    ]),
    [lastSavedSignature, setLastSavedSignature] = useState(projectSignature([], "portrait", 1)),
    [saveStatus, setSaveStatus] = useState<"saving" | "saved" | null>(null),
    [savedCountdown, setSavedCountdown] = useState<number | null>(null),
    [currentProjectId, setCurrentProjectId] = useState<string | null>(null),
    [projectName, setProjectName] = useState("Untitled Project");
  const fileRef = useRef<HTMLInputElement>(null),
    clipFileRef = useRef<HTMLInputElement>(null),
    stageRef = useRef<HTMLDivElement>(null),
    canvasRef = useRef<HTMLDivElement>(null),
    menuRef = useRef<HTMLElement>(null),
    clipboard = useRef<Layer[]>([]),
    history = useRef<Layer[][]>([]),
    redoHistory = useRef<Layer[][]>([]),
    imageRedoHistory = useRef<ImageEditState[]>([]),
    bgRedoStrokes = useRef<BgStroke[]>([]),
    lastLayers = useRef<Layer[]>([]),
    lastChange = useRef(0),
    undoing = useRef(false),
    bgDrawing = useRef<string | null>(null),
    bgPanDrag = useRef<{
      x: number;
      y: number;
      panX: number;
      panY: number;
    } | null>(null),
    cutDrawing = useRef<string | null>(null),
    cutDraftStroke = useRef<EditStroke | null>(null),
    cutCursorRef = useRef<HTMLElement>(null),
    cutLivePathRef = useRef<SVGPolylineElement>(null),
    cutLiveRectRef = useRef<SVGRectElement>(null),
    cutFrame = useRef<number | null>(null),
    cutPanDrag = useRef<{
      x: number;
      y: number;
      panX: number;
      panY: number;
    } | null>(null),
    imagePanDrag = useRef<{
      x: number;
      y: number;
      panX: number;
      panY: number;
    } | null>(null),
    bgPreviewRef = useRef<HTMLDivElement>(null),
    cutPreviewRef = useRef<HTMLDivElement>(null),
    cropDrag = useRef<{
      mode: string;
      x: number;
      y: number;
      crop: CutoutEditor["crop"];
      rect: DOMRect;
    } | null>(null),
    imageCropDrag = useRef<{
      mode: string;
      x: number;
      y: number;
      crop: ImageEditor["crop"];
      rect: DOMRect;
    } | null>(null),
    imageDrawing = useRef<string | null>(null),
    clipDrag = useRef<{
      x: number;
      y: number;
      offsetX: number;
      offsetY: number;
      rect: DOMRect;
    } | null>(null),
    imageOnShapeTargetRef = useRef<string | null>(null),
    shapeImageDrag = useRef<{
      mode: string;
      x: number;
      y: number;
      offsetX: number;
      offsetY: number;
      widthScale: number;
      heightScale: number;
    } | null>(null),
    zoomRef = useRef(0.82),
    zoomAnchor = useRef<{
      clientX: number;
      clientY: number;
      worldX: number;
      worldY: number;
    } | null>(null),
    pan = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const loggedLayers = useRef<Layer[]>([]),
    logTimer = useRef<number | null>(null),
    suppressLayerLog = useRef(false);
  const saveToastDismissed = useRef(false);
  const landscape = pageMode === "landscape",
    A4 = pageMode === "full" ? { w: 100, h: 100 } : landscape ? { w: PORTRAIT.h, h: PORTRAIT.w } : PORTRAIT,
    SAFE = {
      x: safeMargin,
      y: safeMargin,
      w: A4.w - safeMargin * 2,
      h: A4.h - safeMargin * 2,
    },
    picked = layers.filter((l) => selected.includes(l.id)),
    one = picked.length === 1 ? picked[0] : null,
    box = bounds(picked),
    displayBox = one && drag?.mode === "rotate" ? { x: one.x, y: one.y, w: one.w, h: one.h } : one && one.rotation ? rotatedBounds(one) : box,
    scale = PPCM * zoom * calibration,
    vectorsOnly = picked.length > 0 && picked.every((l) => ["stroke", "vector"].includes(l.kind));
  const currentSignature = useMemo(() => projectSignature(layers, pageMode, safeMargin, cutSafetyEnabled), [layers, pageMode, safeMargin, cutSafetyEnabled]),
    projectDirty = currentSignature !== lastSavedSignature;
  const activeTextLines = textLines.slice(0, textLineCount).map((line) => line.trim()).filter(Boolean);
  const generateArtwork = async (mode: "text" | "image", variation = false) => {
    if (!session || generationBusy) return;
    const lines = activeTextLines.length ? activeTextLines : textPlaceholders(textLineCount);
    if (mode === "image" && !imagePrompt.trim()) {
      setNotice("Describe the image you want before generating it");
      return;
    }
    setGenerationBusy(mode);
    setNotice(mode === "text" ? "Creating your text image…" : "Creating your image…");
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(mode === "text" ? { mode, lines, font: textFontStyle, extraPrompt: textExtraPrompt, variation } : { mode, description: imagePrompt, style: imageArtStyle, whiteStickerOffset }),
      });
      const result = await response.json() as { image?: string; error?: string };
      if (!response.ok || !result.image) throw new Error(result.error || "Image generation failed");
      if (mode === "text") {
        setHasGeneratedText(true);
        setGeneratedTextImages((images) => images.concat(result.image!));
      } else setGeneratedArtImages((images) => images.concat(result.image!));
      setGeneratedPreview(result.image);
      addSessionLog("AI image generated", `${mode === "text" ? "Text" : "Illustration"} · ${mode === "text" ? textFontStyle : imageArtStyle} · 1024 × 1024 px`);
      setNotice("Image created successfully");
    } catch (error) {
      setNotice(`Could not generate the image: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally { setGenerationBusy(null); }
  };
  const splashStorageKey = session?.user?.id ? `cake-topper-maker-hide-welcome:${session.user.id}` : null;
  const dismissSplash = () => {
    if (hideSplashOnStartup && splashStorageKey) localStorage.setItem(splashStorageKey, "1");
    setSplashOpen(false);
  };
  const addSessionLog = (action: string, details: string) =>
    setSessionLog((items) => [...items, { id: uid(), at: new Date().toISOString(), action, details }].slice(-1000));
  useEffect(() => {
    if (!notice) return;
    addSessionLog("Editor message", notice);
  }, [notice]);
  useEffect(() => {
    if (!splashStorageKey) return;
    setSplashOpen(localStorage.getItem(splashStorageKey) !== "1");
  }, [splashStorageKey]);
  useEffect(() => {
    if (suppressLayerLog.current) {
      suppressLayerLog.current = false;
      loggedLayers.current = layers;
      return;
    }
    if (logTimer.current) window.clearTimeout(logTimer.current);
    logTimer.current = window.setTimeout(() => {
      const before = loggedLayers.current,
        prior = new Map(before.map((layer) => [layer.id, layer])),
        current = new Map(layers.map((layer) => [layer.id, layer])),
        added = layers.filter((layer) => !prior.has(layer.id)),
        removed = before.filter((layer) => !current.has(layer.id)),
        changed = layers.filter((layer) => {
          const old = prior.get(layer.id);
          return old && JSON.stringify({ name: old.name, x: old.x, y: old.y, w: old.w, h: old.h, rotation: old.rotation, visible: old.visible, kind: old.kind, color: old.color, steps: old.steps.length, risk: old.cutRiskReason }) !== JSON.stringify({ name: layer.name, x: layer.x, y: layer.y, w: layer.w, h: layer.h, rotation: layer.rotation, visible: layer.visible, kind: layer.kind, color: layer.color, steps: layer.steps.length, risk: layer.cutRiskReason });
        });
      added.forEach((layer) => addSessionLog("Layer added", `${layer.name} · ${layer.kind} · ${layer.w.toFixed(2)} × ${layer.h.toFixed(2)} cm`));
      removed.forEach((layer) => addSessionLog("Layer removed", `${layer.name} · ${layer.kind}`));
      changed.forEach((layer) => {
        const old = prior.get(layer.id)!;
        const details = [old.name !== layer.name && `renamed ${old.name} → ${layer.name}`, old.kind !== layer.kind && `type ${old.kind} → ${layer.kind}`, (old.x !== layer.x || old.y !== layer.y) && `position (${old.x.toFixed(2)}, ${old.y.toFixed(2)}) → (${layer.x.toFixed(2)}, ${layer.y.toFixed(2)}) cm`, (old.w !== layer.w || old.h !== layer.h) && `size ${old.w.toFixed(2)} × ${old.h.toFixed(2)} → ${layer.w.toFixed(2)} × ${layer.h.toFixed(2)} cm`, old.rotation !== layer.rotation && `rotation ${old.rotation.toFixed(1)}° → ${layer.rotation.toFixed(1)}°`, old.visible !== layer.visible && `${layer.visible ? "shown" : "hidden"}`, old.steps.length !== layer.steps.length && `operations ${old.steps.length} → ${layer.steps.length}`, old.cutRiskReason !== layer.cutRiskReason && `cut warning: ${layer.cutRiskReason || "cleared"}`].filter(Boolean);
        if (details.length) addSessionLog("Layer changed", `${layer.name} · ${details.join("; ")}`);
      });
      loggedLayers.current = layers;
    }, 350);
    return () => {
      if (logTimer.current) window.clearTimeout(logTimer.current);
    };
  }, [layers]);
  useEffect(() => {
    if (!selected.length) addSessionLog("Selection cleared", "No layer is selected.");
    else addSessionLog("Layer selected", layers.filter((layer) => selected.includes(layer.id)).map((layer) => layer.name).join(", "));
    // Selection changes are the event being recorded; layer mutations are logged separately above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const mutate = (id: string, fn: (l: Layer) => Layer) => setLayers((v) => v.map((l) => (l.id === id ? fn(l) : l)));
  const refreshProjects = async (showLoading = projects.length === 0) => {
    if (showLoading) setProjectsLoading(true);
    const { data, error } = await supabase.from("projects").select("id,name,updated_at,data").order("updated_at", { ascending: false });
    setProjectsLoading(false);
    if (error) {
      setNotice("Projects could not be loaded. Please try again.");
      return;
    }
    setProjects((data || []) as SavedProject[]);
  };
  const saveProject = async (asNew = false, targetId?: string, targetName?: string, closePanel = true) => {
    if (!session?.user) {
      setNotice("Sign in to save a project");
      return false;
    }
    saveToastDismissed.current = false;
    setSaveStatus("saving");
    setSavedCountdown(null);
    const name = (targetName ?? projectName).trim() || "Untitled Project",
      thumbnail = await createProjectThumbnail(layers),
      saveEntry: SessionLogEntry = { id: uid(), at: new Date().toISOString(), action: "Project saved", details: `${name} was ${asNew ? "saved as a new project" : "saved"}.` },
      nextSessionLog = [...sessionLog, saveEntry].slice(-1000),
      projectData = { layers, landscape, pageMode, safeMargin, thumbnail, sessionLog: nextSessionLog, cutSafetyEnabled },
      payload = {
        name,
        data: projectData,
        user_id: session.user.id,
        updated_at: new Date().toISOString(),
      },
      updateId = targetId ?? currentProjectId;
    let { data, error } = updateId && !asNew ? await supabase.from("projects").update({ name, data: projectData, updated_at: payload.updated_at }).eq("id", updateId).eq("user_id", session.user.id).select("id,name,updated_at,data").single() : await supabase.from("projects").insert(payload).select("id,name,updated_at,data").single();
    if ((error || !data) && updateId && !asNew) {
      const listed = projects.find((project) => project.id === updateId) || projects.find((project) => project.name === name);
      if (listed && listed.id !== updateId) ({ data, error } = await supabase.from("projects").update({ name, data: projectData, updated_at: payload.updated_at }).eq("id", listed.id).eq("user_id", session.user.id).select("id,name,updated_at,data").single());
    }
    if (error || !data) {
      setSaveStatus(null);
      setNotice("Project could not be saved");
      return false;
    }
    setCurrentProjectId(data.id);
    setSessionLog(nextSessionLog);
    setProjectName(data.name);
    setLastSavedSignature(projectSignature(layers, pageMode, safeMargin, cutSafetyEnabled));
    setProjects((items) => [data as SavedProject, ...items.filter((project) => project.id !== data.id)]);
    void refreshProjects(false);
    if (closePanel) setProjectsOpen(false);
    setSaveAsMode(false);
    if (!saveToastDismissed.current) {
      setSaveStatus("saved");
      setSavedCountdown(2);
    }
    return true;
  };
  const openProject = (project: SavedProject) => {
    suppressLayerLog.current = true;
    setLayers(project.data.layers || []);
    setSessionLog([...(project.data.sessionLog || []), { id: uid(), at: new Date().toISOString(), action: "Project opened", details: `${project.name} was opened.` }]);
    setPageMode(project.data.pageMode || (project.data.landscape ? "landscape" : "portrait"));
    setSafeMargin(project.data.safeMargin ?? 1);
    setCutSafetyEnabled(Boolean(project.data.cutSafetyEnabled));
    setSelected([]);
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setLastSavedSignature(projectSignature(project.data.layers || [], project.data.pageMode || (project.data.landscape ? "landscape" : "portrait"), project.data.safeMargin ?? 1, Boolean(project.data.cutSafetyEnabled)));
    history.current = [];
    setProjectsOpen(false);
    setNotice(`${project.name} opened`);
  };
  const requestOpenProject = (project: SavedProject) => {
    if (projectDirty && layers.length) {
      setPendingOpenProject(project);
      return;
    }
    openProject(project);
  };
  const deleteProject = async (id: string) => {
    const previous = projects;
    setProjects((items) => items.filter((project) => project.id !== id));
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      setProjects(previous);
      return setNotice("Project could not be deleted");
    }
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      setProjectName("Untitled Project");
    }
    await refreshProjects();
    setNotice("Project deleted");
  };
  const createNewProject = () => {
    suppressLayerLog.current = true;
    setLayers([]);
    setSessionLog([{ id: uid(), at: new Date().toISOString(), action: "Project started", details: "A new editing session was created." }]);
    setSelected([]);
    setCurrentProjectId(null);
    setProjectName("Untitled Project");
    setPageMode("portrait");
    setSafeMargin(1);
    setCutSafetyEnabled(false);
    setLastSavedSignature(projectSignature([], "portrait", 1));
    history.current = [];
    redoHistory.current = [];
    setProjectsOpen(false);
    window.setTimeout(centerDocument, 40);
    setNotice("New project created");
  };
  const newProject = () => {
    if (layers.length || currentProjectId) {
      setPendingNewProject(true);
      return;
    }
    createNewProject();
  };
  const discardAndContinue = () => {
    const target = pendingOpenProject;
    setPendingOpenProject(null);
    setPendingNewProject(false);
    if (target) openProject(target);
    else createNewProject();
  };
  const saveAndContinue = async () => {
    const target = pendingOpenProject;
    const creating = pendingNewProject;
    if (!target && !creating) return;
    const saved = await saveProject(false, undefined, undefined, false);
    if (!saved) return;
    setPendingOpenProject(null);
    setPendingNewProject(false);
    if (target) openProject(target);
    else createNewProject();
  };
  useEffect(() => {
    const stored = Number(localStorage.getItem("better-cricut-screen-calibration"));
    if (Number.isFinite(stored) && stored >= 0.5 && stored <= 2) {
      setCalibration(stored);
      setCalibrationDraft(stored);
    }
  }, []);
  useEffect(() => {
    if (savedCountdown === null) return;
    const timer = window.setTimeout(
      () =>
        setSavedCountdown((value) => {
          if (value !== null && value > 1) return value - 1;
          setSaveStatus(null);
          return null;
        }),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [savedCountdown]);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void refreshProjects();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) void refreshProjects();
      else setProjects([]);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!bgEditor) return;
    let cancelled = false;
    setBgRendering(true);
    const timer = window.setTimeout(() => {
      void refineBackgroundWithRoom(bgEditor.source, bgEditor.sensitivity, bgEditor.strokes, bgEditor.speckles, bgEditor.edgeRefine, bgEditor.eraseColors, bgEditor.edgeSmooth, bgEditor.optimizeAlpha)
        .then(({ src }) => {
          if (!cancelled) {
            setBgPreview(src);
            setBgRendering(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBgRendering(false);
            setNotice("Preview could not be updated");
          }
        });
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bgEditor?.source, bgEditor?.strokes, bgEditor?.speckles, bgEditor?.edgeRefine, bgEditor?.eraseColors, bgEditor?.edgeSmooth, bgEditor?.optimizeAlpha]);
  useEffect(() => {
    if (!cutEditor) return;
    if (cutEditor.source.startsWith("data:image/svg+xml") && cutEditor.strokes.length === 0) {
      setCutPreview(scalableSvgPreview(cutEditor.source));
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(
      () =>
        void renderCutoutEdit(cutEditor).then((r) => {
          if (!cancelled) setCutPreview(r.src);
        }),
      80,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cutEditor?.source, cutEditor?.strokes, cutEditor?.color]);
  useEffect(() => {
    const id = cutActiveStroke || cutFinishedStroke,
      stroke = cutEditor?.strokes.find((item) => item.id === id);
    if (!stroke || stroke.tool !== "smooth" || !cutPreview) {
      setCutEdgeOverlay("");
      return;
    }
    let cancelled = false;
    void selectedEdgeOverlay(cutPreview, stroke, cutFinishedStroke === id ? "green" : "red").then((src) => {
      if (!cancelled) setCutEdgeOverlay(src);
    });
    return () => {
      cancelled = true;
    };
  }, [cutActiveStroke, cutFinishedStroke, cutEditor?.strokes, cutPreview]);
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
        redoHistory.current = [];
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
    if (vTracerStartedAt === null) {
      setVTracerElapsed(0);
      return;
    }
    const update = () => setVTracerElapsed(Math.floor((Date.now() - vTracerStartedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [vTracerStartedAt]);
  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    redoHistory.current.push(layers.map((layer) => ({ ...layer })));
    undoing.current = true;
    setLayers(previous);
    setSelected([]);
    setNotice("Undone");
  };
  const redo = () => {
    const next = redoHistory.current.pop();
    if (!next) return;
    history.current.push(layers.map((layer) => ({ ...layer })));
    undoing.current = true;
    setLayers(next);
    setSelected([]);
    setNotice("Redone");
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
        setZoom((z) => (e.key === "0" ? 1 : clamp(z + (e.key === "-" ? -0.1 : 0.1), 0.2, 5)));
        return;
      }
      if (e.key === "Escape" && (imageOnShapeTarget || shapeImageEditing)) {
        imageOnShapeTargetRef.current = null;
        setImageOnShapeTarget(null);
        setShapeImageEditing(null);
        setNotice("Image on Shape cancelled");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const wantsRedo = e.shiftKey;
        if (cutEditor) {
          setCutEditor((value) => {
            if (!value) return value;
            if (wantsRedo) {
              const restored = value.redoStrokes.at(-1);
              return restored ? { ...value, strokes: [...value.strokes, restored], redoStrokes: value.redoStrokes.slice(0, -1) } : value;
            }
            const removed = value.strokes.at(-1);
            return removed ? { ...value, strokes: value.strokes.slice(0, -1), redoStrokes: [...value.redoStrokes, removed] } : value;
          });
          return;
        }
        if (imageEditor) {
          if (wantsRedo) redoImageStage();
          else undoImageStage();
          return;
        }
        if (bgEditor) {
          setBgEditor((value) => {
            if (!value) return value;
            if (wantsRedo) {
              const restored = bgRedoStrokes.current.pop();
              return restored ? { ...value, strokes: [...value.strokes, restored] } : value;
            }
            const removed = value.strokes.at(-1);
            if (removed) bgRedoStrokes.current.push(removed);
            return removed ? { ...value, strokes: value.strokes.slice(0, -1) } : value;
          });
          return;
        }
        if (wantsRedo) redo();
        else undo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !(e.target as HTMLElement).matches("input,textarea")) {
        e.preventDefault();
        setLayers((v) => v.filter((l) => !selected.includes(l.id)));
        setSelected([]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, bgEditor, imageEditor, cutEditor, imageOnShapeTarget, shapeImageEditing]);
  useEffect(() => {
    const stopBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey && !stageRef.current?.contains(e.target as Node)) e.preventDefault();
    };
    window.addEventListener("wheel", stopBrowserZoom, { passive: false });
    return () => window.removeEventListener("wheel", stopBrowserZoom);
  }, []);
  useEffect(() => {
    const clearMarquee = () => {
      setMarquee(null);
      setDrag((value) => (value?.mode === "marquee" ? null : value));
    };
    window.addEventListener("pointerup", clearMarquee);
    window.addEventListener("pointercancel", clearMarquee);
    window.addEventListener("blur", clearMarquee);
    return () => {
      window.removeEventListener("pointerup", clearMarquee);
      window.removeEventListener("pointercancel", clearMarquee);
      window.removeEventListener("blur", clearMarquee);
    };
  }, []);
  const editorWheel = (e: RWheel<HTMLDivElement> | WheelEvent) => {
    e.preventDefault();
    const stage = stageRef.current,
      canvas = canvasRef.current;
    if (!stage || !canvas) return;
    if (e.ctrlKey) {
      stage.scrollTop += e.deltaY;
      stage.scrollLeft += e.deltaX;
      updateRulers();
      return;
    }
    const clientX = e.clientX,
      clientY = e.clientY,
      before = canvas.getBoundingClientRect(),
      oldScale = before.width / A4.w,
      worldX = (clientX - before.left) / oldScale,
      worldY = (clientY - before.top) / oldScale,
      nextZoom = clamp(zoomRef.current * Math.exp(-e.deltaY * 0.0012), 0.2, 7);
    if (Math.abs(nextZoom - zoomRef.current) < 0.0001) return;
    zoomAnchor.current = { clientX, clientY, worldX, worldY };
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  };
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const wheel = (event: WheelEvent) => editorWheel(event);
    stage.addEventListener("wheel", wheel, { passive: false });
    return () => stage.removeEventListener("wheel", wheel);
  }, [A4.w, A4.h]);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const anchor = zoomAnchor.current,
      stage = stageRef.current,
      canvas = canvasRef.current;
    if (!anchor || !stage || !canvas) return;
    const rect = canvas.getBoundingClientRect(),
      actualScale = rect.width / A4.w;
    stage.scrollLeft += rect.left + anchor.worldX * actualScale - anchor.clientX;
    stage.scrollTop += rect.top + anchor.worldY * actualScale - anchor.clientY;
    zoomAnchor.current = null;
    updateRulers();
  }, [zoom]);
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
  useEffect(() => {
    updateRulers();
  }, [zoom, pageMode, safeMargin]);
  useEffect(() => {
    const timer = window.setTimeout(() => (pageMode === "full" ? stageRef.current?.scrollTo({ left: 0, top: 0 }) : centerDocument()), 40);
    return () => window.clearTimeout(timer);
  }, [pageMode]);
  const visibleInsertionPoint = (w: number, h: number) => {
    const stage = stageRef.current,
      canvas = canvasRef.current;
    if (!stage || !canvas) return { x: SAFE.x + (SAFE.w - w) / 2, y: SAFE.y + (SAFE.h - h) / 2 };
    const s = stage.getBoundingClientRect(),
      c = canvas.getBoundingClientRect();
    return {
      x: clamp((s.left + s.width / 2 - c.left) / scale - w / 2, SAFE.x, Math.max(SAFE.x, SAFE.x + SAFE.w - w)),
      y: clamp((s.top + s.height / 2 - c.top) / scale - h / 2, SAFE.y, Math.max(SAFE.y, SAFE.y + SAFE.h - h)),
    };
  };
  const importFiles = async (files: File[]) => {
    let imported = 0;
    for (const f of files) {
      if (!/image\/(jpeg|png|svg\+xml|webp)/.test(f.type)) continue;
      const rawSrc = await new Promise<string>((ok, fail) => {
          const r = new FileReader();
          r.onload = () => ok(String(r.result));
          r.onerror = () => fail(r.error || new Error("The image file could not be read"));
          r.readAsDataURL(f);
        }),
        prepared = f.type === "image/png" ? await trimUniformBorder(rawSrc) : { src: rawSrc, left: 0, top: 0, width: 1, height: 1 },
        src = prepared.src,
        img = await getImage(src),
        ratio = img.naturalWidth / img.naturalHeight;
      let w = Math.min(10, SAFE.w),
        h = w / ratio;
      if (h > SAFE.h) {
        h = SAFE.h;
        w = h * ratio;
      }
      const id = uid(),
        place = visibleInsertionPoint(w, h);
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
      imported++;
    }
    return imported;
  };
  const add = async (e: ChangeEvent<HTMLInputElement>) => {
    await importFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };
  const addGeneratedAsset = async (src: string) => {
    try {
      const response = await fetch(new URL(src, window.location.origin));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob(),
        filename = src.startsWith("data:") ? "generated-cake-topper.png" : (src.split("/").pop() || "generated-cake-topper.png").split("?")[0];
      const imported = await importFiles([new window.File([blob], filename, { type: "image/png" })]);
      if (imported !== 1) throw new Error("The generated PNG was not accepted by the canvas importer");
      setGeneratedPreview(null);
      setAddNewOpen(false);
      setNotice("Generated image added to the page");
    } catch (error) {
      setNotice(`Could not add the generated image: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  useEffect(() => {
    const pasteImage = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const files = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
      if (!files.length) return;
      event.preventDefault();
      void importFiles(files);
    };
    document.addEventListener("paste", pasteImage);
    return () => document.removeEventListener("paste", pasteImage);
  });
  const fitEditorImage = (img: HTMLImageElement, host?: HTMLDivElement | null) => {
    const maxW = Math.max(180, Math.min((host?.clientWidth || window.innerWidth * 0.58) - 48, 700));
    const maxH = Math.max(180, (host?.clientHeight || window.innerHeight * 0.65) - 48);
    const target = Math.min(maxW, maxH),
      longest = Math.max(img.naturalWidth, img.naturalHeight);
    const ratio = target / longest;
    return {
      w: Math.max(1, Math.round(img.naturalWidth * ratio)),
      h: Math.max(1, Math.round(img.naturalHeight * ratio)),
    };
  };
  const noBackground = (chosen: Layer | null | undefined = one) => {
    if (!chosen) return;
    bgRedoStrokes.current = [];
    const latestStep = chosen.steps[chosen.activeStep] || chosen.steps[chosen.steps.length - 1],
      priorRemoval = latestStep?.type === "remove-bg" && latestStep.before ? latestStep : undefined,
      base = priorRemoval?.before || snapshot(chosen),
      settings = priorRemoval?.removalSettings;
    setBgPreview("");
    setBgImageSize({ w: 0, h: 0 });
    setBgEditor({
      layerId: chosen.id,
      source: base.src,
      base,
      strokes:
        settings?.strokes.map((stroke) => ({
          ...stroke,
          points: stroke.points.map((point) => ({ ...point })),
        })) || [],
      mode: "remove",
      brush: 3,
      sensitivity: 0,
      connectedReach: 0,
      alphaView: false,
      zoom: 1,
      panX: 0,
      panY: 0,
      speckles: settings?.speckles || 0,
      edgeRefine: settings?.edgeRefine || 0,
      edgeSmooth: settings?.edgeSmooth || 0,
      optimizeAlpha: settings?.optimizeAlpha || false,
      eraseColors: settings?.eraseColors.map((entry) => ({ ...entry })) || [{ color: null, sensitivity: 30 }],
      pickingColor: null,
    });
  };
  const quickBackground = async (chosen?: Layer | null) => {
    const targets = chosen ? [chosen] : picked;
    if (!targets.length) {
      setNotice("Select at least one image first");
      return;
    }
    setBgMenuOpen(false);
    setNotice("Removing background…");
    setWorking(true);
    try {
      const results = await Promise.all(
        targets.map(async (target) => {
          const before = snapshot(target),
            refined = await featherAlphaInside(await removeBg(target.src)),
            t = await trimTransparent(refined),
            nextWidth = target.w * t.width,
            safety = await analyzeCutSafety(t.src, nextWidth),
            next = {
              ...target,
              ...safety,
              src: t.src,
              x: target.x + target.w * t.left,
              y: target.y + target.h * t.top,
              w: nextWidth,
              h: target.h * t.height,
              kind: "nobg" as Kind,
            };
          const step: LayerStep = {
            id: uid(),
            type: "remove-bg",
            label: "Remove Background",
            before,
            backgroundColor: "#ffffff",
            snapshot: snapshot(next),
          };
          return {
            ...next,
            steps: [...target.steps, step],
            activeStep: target.steps.length,
          };
        }),
      );
      const byId = new Map(results.map((l) => [l.id, l]));
      setLayers((items) => items.map((l) => byId.get(l.id) || l));
      setNotice(`${results.length} background${results.length > 1 ? "s" : ""} removed`);
    } catch {
      setNotice("Background removal could not be applied");
    } finally {
      setWorking(false);
    }
  };
  const buildBackgroundPreset = async (type: "image" | "rim" | "text", chosen: Layer) => {
    const latestStep = chosen.steps[chosen.activeStep] || chosen.steps[chosen.steps.length - 1],
      removalIndex = latestStep?.type === "remove-bg" ? chosen.steps.indexOf(latestStep) : -1,
      prior = removalIndex >= 0 ? latestStep : undefined,
      before = prior?.before || snapshot(chosen),
      source = before.src;
    let strokes: BgStroke[] = [],
      colors: EraseColor[] = [];
    const edgeRefine = 0;
    let edgeSmooth = 2;
    const img = await getImage(source),
      sample = document.createElement("canvas");
    sample.width = img.naturalWidth;
    sample.height = img.naturalHeight;
    const sx = sample.getContext("2d")!;
    sx.drawImage(img, 0, 0);
    const pixels = sx.getImageData(0, 0, sample.width, sample.height).data,
      corners = [
        { x: 0.005, y: 0.005, q: 0 },
        { x: 0.995, y: 0.005, q: (sample.width - 1) * 4 },
        { x: 0.005, y: 0.995, q: (sample.height - 1) * sample.width * 4 },
        { x: 0.995, y: 0.995, q: (sample.width * sample.height - 1) * 4 },
      ],
      backgroundCorner = corners.reduce((best, entry) => (pixels[entry.q] + pixels[entry.q + 1] + pixels[entry.q + 2] > pixels[best.q] + pixels[best.q + 1] + pixels[best.q + 2] ? entry : best), corners[0]),
      backgroundColor = `#${[pixels[backgroundCorner.q], pixels[backgroundCorner.q + 1], pixels[backgroundCorner.q + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    if (type === "text") {
      colors = [{ color: backgroundColor, sensitivity: 30 }];
      edgeSmooth = 1;
    } else {
      strokes = [
        {
          id: uid(),
          mode: "remove",
          brush: 4,
          bleed: 10,
          reach: null,
          points: [{ x: backgroundCorner.x, y: backgroundCorner.y }],
        },
      ];
      if (type === "rim") edgeSmooth = 8;
    }
    let refined = await refineBackground(source, 0, strokes, 0, edgeRefine, colors, edgeSmooth, true),
      map = { left: 0, top: 0, width: 1, height: 1 };
    if (type === "rim") {
      const rim = await addProtectiveRim(refined, source, before.w);
      refined = await optimizeAlphaChannel(rim.src);
      map = {
        left: rim.left,
        top: rim.top,
        width: rim.width,
        height: rim.height,
      };
    }
    refined = await featherAlphaInside(refined);
    const t = await trimTransparent(refined),
      finalImage = await getImage(t.src),
      left = map.left + map.width * t.left,
      top = map.top + map.height * t.top,
      width = map.width * t.width,
      height = map.height * t.height,
      nextWidth = before.w * width,
      safety = await analyzeCutSafety(t.src, nextWidth),
      next = {
        ...chosen,
        ...safety,
        src: t.src,
        x: before.x + before.w * left,
        y: before.y + before.h * top,
        w: nextWidth,
        h: before.h * height,
        naturalW: finalImage.naturalWidth,
        naturalH: finalImage.naturalHeight,
        kind: "nobg" as Kind,
      },
      label = type === "image" ? "Image Remove Background" : type === "rim" ? "Image Background + Rim" : "Text Background Removal",
      removalSettings = {
        strokes,
        speckles: 0,
        edgeRefine,
        edgeSmooth,
        optimizeAlpha: true,
        eraseColors: colors,
      },
      step: LayerStep = {
        id: uid(),
        type: "remove-bg",
        label,
        before,
        backgroundColor,
        removalSettings,
        snapshot: snapshot(next),
      },
      steps = removalIndex >= 0 ? chosen.steps.slice(0, removalIndex) : chosen.steps;
    return {
      ...next,
      cutRisk: type === "rim" ? false : next.cutRisk,
      cutRiskReason: type === "rim" ? "" : next.cutRiskReason,
      steps: [...steps, step],
      activeStep: steps.length,
    };
  };
  const applyBackgroundPreset = async (type: "image" | "rim" | "text", chosen: Layer | null = one) => {
    if (!chosen) return setNotice("Select one image first");
    setBgMenuOpen(false);
    setWorking(true);
    setNotice("Applying background removal preset…");
    try {
      const next = await buildBackgroundPreset(type, chosen);
      mutate(chosen.id, () => next);
      setRiskLayerId(null);
      setNotice(`${type === "image" ? "Image Remove Background" : type === "rim" ? "Image Background + Rim" : "Text Background Removal"} applied`);
    } catch {
      setNotice("Background removal preset could not be applied");
    } finally {
      setWorking(false);
    }
  };
  const optimizeSelectedAlpha = async () => {
    if (!one || !["nobg", "vector", "stroke", "acetate"].includes(one.kind)) {
      setNotice("Select one background-removed image or Cutout first");
      return;
    }
    setBgMenuOpen(false);
    setWorking(true);
    setNotice("Optimizing alpha channel…");
    try {
      const cleaned = await featherAlphaInside(await optimizeAlphaChannel(one.src)),
        trimmed = await trimTransparent(cleaned),
        nextWidth = one.w * trimmed.width,
        safety = await analyzeCutSafety(trimmed.src, nextWidth),
        next = {
          ...one,
          ...safety,
          src: trimmed.src,
          x: one.x + one.w * trimmed.left,
          y: one.y + one.h * trimmed.top,
          w: nextWidth,
          h: one.h * trimmed.height,
        },
        step: LayerStep = {
          id: uid(),
          type: "optimize-alpha",
          label: "Optimize Alpha",
          snapshot: snapshot(next),
        };
      mutate(one.id, () => ({
        ...next,
        steps: [...one.steps, step],
        activeStep: one.steps.length,
      }));
      setNotice("Alpha channel optimized for cleaner Cricut cutting paths");
    } catch {
      setNotice("Alpha channel could not be optimized");
    } finally {
      setWorking(false);
    }
  };
  const commitBackground = async () => {
    if (!bgEditor) return;
    const target = layers.find((l) => l.id === bgEditor.layerId);
    if (!target) return;
    setWorking(true);
    try {
      const refined = await refineBackgroundWithRoom(bgEditor.source, 0, bgEditor.strokes, bgEditor.speckles, bgEditor.edgeRefine, bgEditor.eraseColors, bgEditor.edgeSmooth, bgEditor.optimizeAlpha);
      const t = await trimTransparent(refined.src),
        finalImage = await getImage(t.src);
      const base = bgEditor.base;
      const mappedLeft = refined.left + refined.width * t.left,
        mappedTop = refined.top + refined.height * t.top,
        mappedWidth = refined.width * t.width,
        mappedHeight = refined.height * t.height,
        safety = await analyzeCutSafety(t.src, base.w * mappedWidth),
        next = {
          ...target,
          ...safety,
          src: t.src,
          x: base.x + base.w * mappedLeft,
          y: base.y + base.h * mappedTop,
          w: base.w * mappedWidth,
          h: base.h * mappedHeight,
          naturalW: finalImage.naturalWidth,
          naturalH: finalImage.naturalHeight,
          kind: "nobg" as Kind,
        };
      const selectedBackground = bgEditor.eraseColors.find((entry) => entry.color)?.color || [...target.steps].reverse().find((item) => item.type === "remove-bg")?.backgroundColor || "#ffffff";
      const step: LayerStep = {
        id: uid(),
        type: "remove-bg",
        label: "Remove Background",
        before: base,
        backgroundColor: selectedBackground,
        removalSettings: {
          strokes: bgEditor.strokes.map((stroke) => ({
            ...stroke,
            points: stroke.points.map((point) => ({ ...point })),
          })),
          speckles: bgEditor.speckles,
          edgeRefine: bgEditor.edgeRefine,
          edgeSmooth: bgEditor.edgeSmooth,
          optimizeAlpha: bgEditor.optimizeAlpha,
          eraseColors: bgEditor.eraseColors.map((entry) => ({ ...entry })),
        },
        snapshot: snapshot(next),
      };
      const priorRemoval = target.steps.findIndex((item) => item.type === "remove-bg"),
        steps = priorRemoval >= 0 ? target.steps.slice(0, priorRemoval) : target.steps;
      mutate(target.id, () => ({
        ...next,
        steps: [...steps, step],
        activeStep: steps.length,
      }));
      if (imageEditor?.layerId === target.id) {
        setImageEditorSize({ w: 0, h: 0 });
        setImageEditor({
          ...imageEditor,
          source: t.src,
          strokes: [],
          crop: { left: 0, top: 0, right: 0, bottom: 0 },
          history: [],
          offsetX: 0,
          offsetY: 0,
          widthScale: 1,
          heightScale: 1,
          zoom: 1,
          panX: 0,
          panY: 0,
        });
        setImageTab("edit");
      }
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
      const point = bgPointFromEvent(e),
        img = await getImage(bgEditor.source),
        sample = document.createElement("canvas");
      sample.width = img.naturalWidth;
      sample.height = img.naturalHeight;
      const context = sample.getContext("2d")!;
      context.drawImage(img, 0, 0);
      const pixel = context.getImageData(Math.min(sample.width - 1, Math.floor(point.x * sample.width)), Math.min(sample.height - 1, Math.floor(point.y * sample.height)), 1, 1).data;
      const color = `#${[pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      const colors = [...bgEditor.eraseColors];
      colors[bgEditor.pickingColor] = {
        ...colors[bgEditor.pickingColor],
        color,
      };
      if (colors.every((entry) => entry.color) && colors.length < 6) colors.push({ color: null, sensitivity: 30 });
      setBgEditor({ ...bgEditor, eraseColors: colors, pickingColor: null });
      return;
    }
    const target = layers.find((layer) => layer.id === bgEditor.layerId);
    const reach = bgEditor.connectedReach >= 51 ? null : bgEditor.connectedReach / 10 / Math.max(target?.w || 1, target?.h || 1);
    const stroke: BgStroke = {
      id,
      mode: bgEditor.mode,
      brush: bgEditor.brush,
      bleed: bgEditor.sensitivity,
      reach,
      points: [bgPointFromEvent(e)],
    };
    bgRedoStrokes.current = [];
    setBgEditor({ ...bgEditor, strokes: [...bgEditor.strokes, stroke] });
  };
  const moveBackgroundStroke = (e: RPointer<HTMLImageElement>) => {
    const cursor = bgPointFromEvent(e);
    setBgCursor({ ...cursor, visible: true });
    if (!bgDrawing.current || e.buttons !== 1) return;
    const point = cursor,
      id = bgDrawing.current;
    setBgEditor((v) => {
      if (!v) return v;
      return {
        ...v,
        strokes: v.strokes.map((s) => {
          if (s.id !== id) return s;
          const last = s.points[s.points.length - 1];
          if (last && Math.hypot(point.x - last.x, point.y - last.y) < Math.max(0.0025, s.brush / 600)) return s;
          return { ...s, points: [...s.points, point] };
        }),
      };
    });
  };
  const endBackgroundStroke = () => {
    bgDrawing.current = null;
    setBgActiveStroke(null);
  };
  const zoomBackground = (e: RWheel<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!bgEditor) return;
    setBgEditor({
      ...bgEditor,
      zoom: clamp(bgEditor.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.6, 5),
    });
  };
  const startBackgroundPan = (e: RPointer<HTMLDivElement>) => {
    e.stopPropagation();
    if (!bgEditor || e.button !== 1) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    bgPanDrag.current = {
      x: e.clientX,
      y: e.clientY,
      panX: bgEditor.panX,
      panY: bgEditor.panY,
    };
  };
  const moveBackgroundPan = (e: RPointer<HTMLDivElement>) => {
    if (!bgEditor || !bgPanDrag.current) return;
    const p = bgPanDrag.current;
    setBgEditor({
      ...bgEditor,
      panX: p.panX + e.clientX - p.x,
      panY: p.panY + e.clientY - p.y,
    });
  };
  const endBackgroundPan = () => {
    bgPanDrag.current = null;
  };
  const zoomCutout = (e: RWheel<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cutEditor) return;
    setCutEditor({
      ...cutEditor,
      zoom: clamp(cutEditor.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.5, 10),
    });
  };
  const startCutoutPan = (e: RPointer<HTMLDivElement>) => {
    if (!cutEditor || e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    cutPanDrag.current = {
      x: e.clientX,
      y: e.clientY,
      panX: cutEditor.panX,
      panY: cutEditor.panY,
    };
  };
  const moveCutoutPan = (e: RPointer<HTMLDivElement>) => {
    if (!cutEditor || !cutPanDrag.current) return;
    const start = cutPanDrag.current;
    setCutEditor({
      ...cutEditor,
      panX: start.panX + e.clientX - start.x,
      panY: start.panY + e.clientY - start.y,
    });
  };
  const endCutoutPan = () => {
    cutPanDrag.current = null;
  };
  const openCutoutEditor = (chosen: Layer | null = one) => {
    if (!chosen || !["vector", "stroke"].includes(chosen.kind)) return;
    const previewSrc = scalableSvgPreview(chosen.src);
    setCutPreview(previewSrc);
    setCutCropActive(false);
    setCutoutTab("edit");
    setCutImageSize({ w: 0, h: 0 });
    setCutEditor({
      layerId: chosen.id,
      source: previewSrc,
      color: chosen.color,
      tool: null,
      brush: 3,
      strokes: [],
      redoStrokes: [],
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      zoom: 1,
      panX: 0,
      panY: 0,
      smoothPasses: 0,
    });
  };
  const cutPoint = (e: RPointer<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };
  const startCutEdit = (e: RPointer<HTMLImageElement>) => {
    if (!cutEditor || !cutEditor.tool || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const id = uid();
    cutDrawing.current = id;
    setCutFinishedStroke(null);
    setCutEdgeOverlay("");
    setCutActiveStroke(id);
    const stroke: EditStroke = {
      id,
      tool: cutEditor.tool,
      brush: cutEditor.brush / Math.sqrt(Math.max(1, cutEditor.zoom)),
      points: [cutPoint(e)],
    };
    cutDraftStroke.current = stroke;
    if (cutLivePathRef.current) {
      cutLivePathRef.current.setAttribute("class", `edit-brush-stroke ${stroke.tool}`);
      cutLivePathRef.current.setAttribute("points", `${stroke.points[0].x * 100},${stroke.points[0].y * 100}`);
    }
  };
  const moveCutEdit = (e: RPointer<HTMLImageElement>) => {
    const cursor = cutPoint(e);
    if (cutCursorRef.current) {
      cutCursorRef.current.style.left = `${cursor.x * 100}%`;
      cutCursorRef.current.style.top = `${cursor.y * 100}%`;
    }
    const draft = cutDraftStroke.current;
    if (!draft || !cutDrawing.current || e.buttons !== 1) return;
    const last = draft.points.at(-1);
    if (last && Math.hypot(cursor.x - last.x, cursor.y - last.y) < 0.0012) return;
    draft.points.push(cursor);
    if (cutFrame.current !== null) return;
    cutFrame.current = window.requestAnimationFrame(() => {
      cutFrame.current = null;
      const current = cutDraftStroke.current;
      if (!current) return;
      const first = current.points[0],
        lastPoint = current.points.at(-1)!;
      if (current.tool === "rectangle" && cutLiveRectRef.current) {
        cutLiveRectRef.current.setAttribute("x", String(Math.min(first.x, lastPoint.x) * 100));
        cutLiveRectRef.current.setAttribute("y", String(Math.min(first.y, lastPoint.y) * 100));
        cutLiveRectRef.current.setAttribute("width", String(Math.abs(lastPoint.x - first.x) * 100));
        cutLiveRectRef.current.setAttribute("height", String(Math.abs(lastPoint.y - first.y) * 100));
        cutLiveRectRef.current.style.display = "block";
      } else if (cutLivePathRef.current) cutLivePathRef.current.setAttribute("points", current.points.map((point) => `${point.x * 100},${point.y * 100}`).join(" "));
    });
  };
  const endCutEdit = () => {
    const id = cutDrawing.current;
    const completed = cutDraftStroke.current;
    cutDrawing.current = null;
    cutDraftStroke.current = null;
    setCutActiveStroke(null);
    if (cutLivePathRef.current) cutLivePathRef.current.setAttribute("points", "");
    if (cutLiveRectRef.current) cutLiveRectRef.current.style.display = "none";
    if (completed) setCutEditor((value) => (value ? { ...value, strokes: [...value.strokes, completed], redoStrokes: [] } : value));
    if (id) {
      setCutFinishedStroke(id);
      window.setTimeout(() => setCutFinishedStroke((value) => (value === id ? null : value)), 1000);
    }
  };
  const startCropDrag = (e: RPointer<HTMLButtonElement>, mode: string) => {
    if (!cutEditor) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.closest(".cut-image-wrap")!.getBoundingClientRect();
    cropDrag.current = {
      mode,
      x: e.clientX,
      y: e.clientY,
      crop: { ...cutEditor.crop },
      rect,
    };
  };
  const moveCropDrag = (e: RPointer<HTMLButtonElement>) => {
    const d = cropDrag.current;
    if (!d || !cutEditor) return;
    e.preventDefault();
    const dx = ((e.clientX - d.x) / d.rect.width) * 100,
      dy = ((e.clientY - d.y) / d.rect.height) * 100,
      c = { ...d.crop };
    if (d.mode.includes("w")) c.left = clamp(d.crop.left + dx, -25, Math.min(90, 95 - c.right));
    if (d.mode.includes("e")) c.right = clamp(d.crop.right - dx, -25, Math.min(90, 95 - c.left));
    if (d.mode.includes("n")) c.top = clamp(d.crop.top + dy, -25, Math.min(90, 95 - c.bottom));
    if (d.mode.includes("s")) c.bottom = clamp(d.crop.bottom - dy, -25, Math.min(90, 95 - c.top));
    setCutEditor({ ...cutEditor, crop: c });
  };
  const endCropDrag = () => {
    cropDrag.current = null;
  };
  const applyCutoutEdit = async () => {
    if (!cutEditor) return;
    const target = layers.find((l) => l.id === cutEditor.layerId);
    if (!target) return;
    setWorking(true);
    try {
      const result = await renderCutoutEdit(cutEditor, true),
        finalSrc = await smoothVectorCutout(result.src, target.color),
        safety = await analyzeCutSafety(finalSrc, target.w * result.width),
        next: Layer = {
          ...target,
          src: finalSrc,
          originalSrc: finalSrc,
          kind: "vector",
          strokeCm: 0,
          fillGapsMm: 0,
          ...safety,
          parentId: undefined,
          innerSrc: undefined,
          acetateOn: false,
          invalid: false,
          x: target.x + target.w * result.left,
          y: target.y + target.h * result.top,
          w: target.w * result.width,
          h: target.h * result.height,
          steps: [],
          activeStep: 0,
        };
      const step: LayerStep = {
        id: uid(),
        type: "cutout",
        label: "Cutout",
        locked: true,
        snapshot: snapshot(next),
      };
      next.steps = [step];
      mutate(target.id, () => next);
      setCutEditor(null);
      setNotice("Cutout edits baked into the layer");
    } finally {
      setWorking(false);
    }
  };
  const smoothCutoutNow = async () => {
    if (!cutEditor) return;
    const target = layers.find((layer) => layer.id === cutEditor.layerId);
    if (!target) return;
    setWorking(true);
    try {
      const rendered = await renderCutoutEdit(cutEditor),
        pass = cutEditor.smoothPasses + 1,
        src = await smoothVectorCutout(rendered.src, target.color);
      setCutEditor({
        ...cutEditor,
        source: src,
        strokes: [],
        smoothPasses: pass,
      });
      setCutPreview(src);
      setCutEdgeOverlay("");
      setNotice(`Contour smoothing applied · pass ${pass}`);
    } finally {
      setWorking(false);
    }
  };
  const quickFixCutRisk = async () => {
    const target = layers.find((layer) => layer.id === riskLayerId);
    if (!target) return;
    setRiskLayerId(null);
    setWorking(true);
    try {
      let src: string,
        geometry = { x: target.x, y: target.y, w: target.w, h: target.h };
      if (["vector", "stroke"].includes(target.kind)) {
        const solid = await silhouette(target.src, target.color, 255),
          rim = await addProtectiveRim(solid, solid, target.w);
        geometry = {
          x: target.x + target.w * rim.left,
          y: target.y + target.h * rim.top,
          w: target.w * rim.width,
          h: target.h * rim.height,
        };
        src = await vTracerCutout(rim.src, target.color, geometry.w, 2.7);
      } else src = await optimizeAlphaChannel(target.src);
      const safety = await analyzeCutSafety(src, geometry.w);
      mutate(target.id, (layer) => ({
        ...layer,
        ...safety,
        ...geometry,
        src,
        originalSrc: src,
      }));
      addSessionLog("Quick Fix applied", `${target.name} · protective 1.1 mm expansion and contour smoothing · ${safety.cutRisk ? `remaining warning: ${safety.cutRiskReason}` : "warning cleared"}`);
      setNotice(safety.cutRisk ? `Quick Fix widened and smoothed the contour, but this remains: ${safety.cutRiskReason}` : "Cut safety issue fixed with a protective 1.1 mm expansion");
    } finally {
      setWorking(false);
    }
  };
  const quickFixRasterRisk=async(target:Layer)=>{
    const hasRim=target.steps.some(step=>step.type==="remove-bg"&&/rim/i.test(step.label));
    if(!hasRim){setRiskLayerId(null);await applyBackgroundPreset("rim",target);return}
    setRiskLayerId(null);setWorking(true);
    try{const cleaned=await featherAlphaInside(await optimizeAlphaChannel(target.src)),trimmed=await trimTransparent(cleaned),width=target.w*trimmed.width,safety=await analyzeCutSafety(trimmed.src,width);mutate(target.id,layer=>({...layer,...safety,src:trimmed.src,originalSrc:trimmed.src,x:layer.x+layer.w*trimmed.left,y:layer.y+layer.h*trimmed.top,w:width,h:layer.h*trimmed.height}));setNotice(safety.cutRisk?"Alpha cleaned; a real sub-2 mm detail may still need review":"Cut safety issue fixed without adding another rim")}
    finally{setWorking(false)}
  };
  const moveSelectionTo = (front: boolean) =>
    setLayers((items) => {
      const moving = items.filter((item) => selected.includes(item.id)),
        rest = items.filter((item) => !selected.includes(item.id));
      return front ? [...rest, ...moving] : [...moving, ...rest];
    });
  const hideSelection = () => {
    setLayers((items) => items.map((item) => (selected.includes(item.id) ? { ...item, visible: false } : item)));
    setSelected([]);
  };
  const openImageEditor = (chosen: Layer | null = one) => {
    if (!chosen || ["vector", "stroke", "acetate"].includes(chosen.kind)) return;
    setImageEditorSize({ w: 0, h: 0 });
    setImageTab("edit");
    setImageEditor({
      layerId: chosen.id,
      source: chosen.src,
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      upscale: 1,
      tool: "crop",
      brush: 4,
      strokes: [],
      history: [],
      offsetX: 0,
      offsetY: 0,
      widthScale: 1,
      heightScale: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    noBackground(chosen);
  };
  const zoomImageEditor = (e: RWheel<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setImageEditor((v) => (v ? { ...v, zoom: clamp(v.zoom * (e.deltaY < 0 ? 1.12 : 0.89), 0.5, 5) } : v));
  };
  const startImagePan = (e: RPointer<HTMLDivElement>) => {
    e.stopPropagation();
    if (!imageEditor || e.button !== 1) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    imagePanDrag.current = {
      x: e.clientX,
      y: e.clientY,
      panX: imageEditor.panX,
      panY: imageEditor.panY,
    };
  };
  const moveImagePan = (e: RPointer<HTMLDivElement>) => {
    const start = imagePanDrag.current;
    if (!start) return;
    setImageEditor((v) =>
      v
        ? {
            ...v,
            panX: start.panX + e.clientX - start.x,
            panY: start.panY + e.clientY - start.y,
          }
        : v,
    );
  };
  const endImagePan = () => {
    imagePanDrag.current = null;
  };
  const imageEditPoint = (e: RPointer<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };
  const startImageEdit = (e: RPointer<HTMLImageElement>) => {
    if (!imageEditor || imageEditor.tool === "crop" || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const id = uid(),
      stroke: ImageEditStroke = {
        id,
        tool: imageEditor.tool,
        brush: imageEditor.brush,
        points: [imageEditPoint(e)],
      };
    imageDrawing.current = id;
    setImageEditor({
      ...imageEditor,
      strokes: [...imageEditor.strokes, stroke],
    });
  };
  const moveImageEdit = (e: RPointer<HTMLImageElement>) => {
    if (!imageDrawing.current || !imageEditor || e.buttons !== 1) return;
    const p = imageEditPoint(e),
      id = imageDrawing.current;
    setImageEditor((v) =>
      v
        ? {
            ...v,
            strokes: v.strokes.map((s) => (s.id !== id ? s : { ...s, points: [...s.points, p] })),
          }
        : v,
    );
  };
  const renderImageStage = async (editor: ImageEditor) => {
    const img = await getImage(editor.source),
      work = document.createElement("canvas");
    work.width = img.naturalWidth;
    work.height = img.naturalHeight;
    const wx = work.getContext("2d")!;
    wx.drawImage(img, 0, 0);
    wx.globalCompositeOperation = "destination-out";
    for (const stroke of editor.strokes) {
      if (!stroke.points.length) continue;
      wx.beginPath();
      if (stroke.tool === "lasso") {
        stroke.points.forEach((p, i) => (i ? wx.lineTo(p.x * work.width, p.y * work.height) : wx.moveTo(p.x * work.width, p.y * work.height)));
        wx.closePath();
        wx.fill();
      } else {
        wx.lineWidth = Math.max(2, (stroke.brush / 100) * Math.min(work.width, work.height));
        wx.lineCap = "round";
        wx.lineJoin = "round";
        stroke.points.forEach((p, i) => (i ? wx.lineTo(p.x * work.width, p.y * work.height) : wx.moveTo(p.x * work.width, p.y * work.height)));
        if (stroke.points.length === 1) {
          const p = stroke.points[0];
          wx.arc(p.x * work.width, p.y * work.height, wx.lineWidth / 2, 0, Math.PI * 2);
          wx.fill();
        } else wx.stroke();
      }
    }
    const c = editor.crop,
      l = clamp(c.left / 100, -0.25, 0.9),
      t = clamp(c.top / 100, -0.25, 0.9),
      r = clamp(c.right / 100, -0.25, 0.9 - l),
      b = clamp(c.bottom / 100, -0.25, 0.9 - t),
      sw = Math.max(1, Math.round(work.width * (1 - l - r))),
      sh = Math.max(1, Math.round(work.height * (1 - t - b))),
      out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    out.getContext("2d")!.drawImage(work, -Math.round(work.width * l), -Math.round(work.height * t));
    return {
      src: out.toDataURL("image/png"),
      l,
      t,
      w: 1 - l - r,
      h: 1 - t - b,
      naturalW: sw,
      naturalH: sh,
    };
  };
  const enterAdvancedBackground = async () => {
    if (!imageEditor) return;
    const target = layers.find((layer) => layer.id === imageEditor.layerId);
    if (!target) return;
    const pending = imageEditor.strokes.length > 0 || Object.values(imageEditor.crop).some(Boolean),
      hasCommittedImageEdit = imageEditor.history.length > 0 || imageEditor.offsetX !== 0 || imageEditor.offsetY !== 0 || imageEditor.widthScale !== 1 || imageEditor.heightScale !== 1;
    if (!pending && !hasCommittedImageEdit) {
      noBackground(target);
      setImageTab("background");
      return;
    }
    const rendered = pending
        ? await renderImageStage(imageEditor)
        : {
            src: imageEditor.source,
            l: 0,
            t: 0,
            w: 1,
            h: 1,
            naturalW: (await getImage(imageEditor.source)).naturalWidth,
            naturalH: (await getImage(imageEditor.source)).naturalHeight,
          },
      virtual: Layer = {
        ...target,
        src: rendered.src,
        originalSrc: rendered.src,
        x: target.x + target.w * (imageEditor.offsetX + imageEditor.widthScale * rendered.l),
        y: target.y + target.h * (imageEditor.offsetY + imageEditor.heightScale * rendered.t),
        w: target.w * imageEditor.widthScale * rendered.w,
        h: target.h * imageEditor.heightScale * rendered.h,
        naturalW: rendered.naturalW,
        naturalH: rendered.naturalH,
        steps: target.steps.filter((step) => step.type !== "remove-bg"),
      };
    setImageEditor({
      ...imageEditor,
      source: rendered.src,
      strokes: [],
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      history: [],
      offsetX: 0,
      offsetY: 0,
      widthScale: 1,
      heightScale: 1,
    });
    noBackground(virtual);
    setImageTab("background");
  };
  const commitImageStage = async () => {
    if (!imageEditor || (!imageEditor.strokes.length && !Object.values(imageEditor.crop).some(Boolean))) return;
    const before: ImageEditState = {
        source: imageEditor.source,
        offsetX: imageEditor.offsetX,
        offsetY: imageEditor.offsetY,
        widthScale: imageEditor.widthScale,
        heightScale: imageEditor.heightScale,
      },
      rendered = await renderImageStage(imageEditor);
    imageRedoHistory.current = [];
    setImageEditor((v) =>
      v
        ? {
            ...v,
            source: rendered.src,
            strokes: [],
            crop: { left: 0, top: 0, right: 0, bottom: 0 },
            history: [...v.history, before],
            offsetX: v.offsetX + v.widthScale * rendered.l,
            offsetY: v.offsetY + v.heightScale * rendered.t,
            widthScale: v.widthScale * rendered.w,
            heightScale: v.heightScale * rendered.h,
          }
        : v,
    );
  };
  const undoImageStage = () =>
    setImageEditor((v) => {
      if (!v || !v.history.length) return v;
      const prior = v.history[v.history.length - 1];
      imageRedoHistory.current.push({ source: v.source, offsetX: v.offsetX, offsetY: v.offsetY, widthScale: v.widthScale, heightScale: v.heightScale });
      return {
        ...v,
        ...prior,
        history: v.history.slice(0, -1),
        strokes: [],
        crop: { left: 0, top: 0, right: 0, bottom: 0 },
      };
    });
  const redoImageStage = () =>
    setImageEditor((v) => {
      const next = imageRedoHistory.current.pop();
      if (!v || !next) return v;
      const current = { source: v.source, offsetX: v.offsetX, offsetY: v.offsetY, widthScale: v.widthScale, heightScale: v.heightScale };
      return { ...v, ...next, history: [...v.history, current], strokes: [], crop: { left: 0, top: 0, right: 0, bottom: 0 } };
    });
  const resetImageStage = () => {
    if (!imageEditor) return;
    const target = layers.find((l) => l.id === imageEditor.layerId),
      first = imageEditor.history[0];
    setImageEditor({
      ...imageEditor,
      source: first?.source || target?.src || imageEditor.source,
      strokes: [],
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      history: [],
      offsetX: first?.offsetX || 0,
      offsetY: first?.offsetY || 0,
      widthScale: first?.widthScale || 1,
      heightScale: first?.heightScale || 1,
    });
  };
  const endImageEdit = () => {
    imageDrawing.current = null;
    void commitImageStage();
  };
  const applyImageEdit = async (createLayer = false) => {
    if (!imageEditor) return;
    const target = layers.find((l) => l.id === imageEditor.layerId);
    if (!target) return;
    setWorking(true);
    try {
      if (imageEditor.strokes.length || Object.values(imageEditor.crop).some(Boolean)) await commitImageStage();
      const current =
        imageEditor.strokes.length || Object.values(imageEditor.crop).some(Boolean)
          ? await renderImageStage(imageEditor)
          : {
              src: imageEditor.source,
              naturalW: (await getImage(imageEditor.source)).naturalWidth,
              naturalH: (await getImage(imageEditor.source)).naturalHeight,
            };
      const img = await getImage(current.src),
        out = document.createElement("canvas"),
        factor = imageEditor.upscale;
      out.width = img.naturalWidth * factor;
      out.height = img.naturalHeight * factor;
      const x = out.getContext("2d")!;
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = "high";
      x.drawImage(img, 0, 0, out.width, out.height);
      const src = out.toDataURL("image/png"),
        edited = {
          ...target,
          src,
          originalSrc: src,
          x: target.x + target.w * imageEditor.offsetX,
          y: target.y + target.h * imageEditor.offsetY,
          w: target.w * imageEditor.widthScale,
          h: target.h * imageEditor.heightScale,
          naturalW: out.width,
          naturalH: out.height,
        };
      const step: LayerStep = {
        id: uid(),
        type: "edit-image",
        label: "Edit Image",
        snapshot: snapshot(edited),
      };
      edited.steps = [...target.steps, step];
      edited.activeStep = edited.steps.length - 1;
      if (createLayer) {
        const clone = { ...edited, id: uid(), name: `${target.name}_Edit` };
        setLayers((items) => {
          const at = items.findIndex((v) => v.id === target.id);
          const next = [...items];
          next.splice(at + 1, 0, clone);
          return next;
        });
        setSelected([clone.id]);
      } else mutate(target.id, () => edited);
      setImageEditor(null);
      setBgEditor(null);
      setNotice(createLayer ? "Edited result created as a separate layer" : `Image edited at ${out.width} × ${out.height} px`);
    } finally {
      setWorking(false);
    }
  };
  const applyPresetInImageEditor = async () => {
    if (!imageEditor) return;
    const target = layers.find((l) => l.id === imageEditor.layerId);
    if (!target) return;
    setWorking(true);
    setNotice("Applying preset…");
    try {
      const pending = imageEditor.strokes.length || Object.values(imageEditor.crop).some(Boolean),
        rendered = pending
          ? await renderImageStage(imageEditor)
          : {
              src: imageEditor.source,
              l: 0,
              t: 0,
              w: 1,
              h: 1,
              naturalW: (await getImage(imageEditor.source)).naturalWidth,
              naturalH: (await getImage(imageEditor.source)).naturalHeight,
            },
        virtual = {
          ...target,
          src: rendered.src,
          originalSrc: rendered.src,
          x: target.x + target.w * (imageEditor.offsetX + imageEditor.widthScale * rendered.l),
          y: target.y + target.h * (imageEditor.offsetY + imageEditor.heightScale * rendered.t),
          w: target.w * imageEditor.widthScale * rendered.w,
          h: target.h * imageEditor.heightScale * rendered.h,
          naturalW: rendered.naturalW,
          naturalH: rendered.naturalH,
          steps: target.steps.filter((step) => step.type !== "remove-bg"),
        },
        next = await buildBackgroundPreset(imagePreset, virtual);
      mutate(target.id, () => next);
      setImageEditor(null);
      setBgEditor(null);
      setRiskLayerId(null);
      setNotice("Preset applied");
    } catch {
      setNotice("Preset could not be applied");
    } finally {
      setWorking(false);
    }
  };
  const startImageCrop = (e: RPointer<HTMLButtonElement>, mode: string) => {
    if (!imageEditor) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    imageCropDrag.current = {
      mode,
      x: e.clientX,
      y: e.clientY,
      crop: { ...imageEditor.crop },
      rect: e.currentTarget.closest(".image-edit-wrap")!.getBoundingClientRect(),
    };
  };
  const moveImageCrop = (e: RPointer<HTMLButtonElement>) => {
    const d = imageCropDrag.current;
    if (!d || !imageEditor) return;
    const dx = ((e.clientX - d.x) / d.rect.width) * 100,
      dy = ((e.clientY - d.y) / d.rect.height) * 100,
      c = { ...d.crop };
    if (d.mode.includes("w")) c.left = clamp(d.crop.left + dx, -25, Math.min(90, 95 - c.right));
    if (d.mode.includes("e")) c.right = clamp(d.crop.right - dx, -25, Math.min(90, 95 - c.left));
    if (d.mode.includes("n")) c.top = clamp(d.crop.top + dy, -25, Math.min(90, 95 - c.bottom));
    if (d.mode.includes("s")) c.bottom = clamp(d.crop.bottom - dy, -25, Math.min(90, 95 - c.top));
    setImageEditor({ ...imageEditor, crop: c });
  };
  const endImageCrop = () => {
    imageCropDrag.current = null;
    void commitImageStage();
  };
  const openSeparateLayers = async (source: string, layerId: string, base?: { x: number; y: number; w: number; h: number }) => {
    setWorking(true);
    try {
      const result = await findOpaqueIslands(source);
      if (result.parts.length < 2) {
        setNotice("No separate islands were found in this design");
        return;
      }
      setSplitPreview({
        layerId,
        preview: result.preview,
        parts: result.parts,
        base,
      });
    } finally {
      setWorking(false);
    }
  };
  const separateCurrentImage = async () => {
    if (!imageEditor) return;
    const target = layers.find((l) => l.id === imageEditor.layerId);
    if (!target) return;
    const pending = imageEditor.strokes.length || Object.values(imageEditor.crop).some(Boolean),
      rendered = pending ? await renderImageStage(imageEditor) : null,
      l = rendered?.l || 0,
      t = rendered?.t || 0,
      w = rendered?.w || 1,
      h = rendered?.h || 1,
      base = {
        x: target.x + target.w * (imageEditor.offsetX + imageEditor.widthScale * l),
        y: target.y + target.h * (imageEditor.offsetY + imageEditor.heightScale * t),
        w: target.w * imageEditor.widthScale * w,
        h: target.h * imageEditor.heightScale * h,
      };
    await openSeparateLayers(rendered?.src || imageEditor.source, imageEditor.layerId, base);
  };
  const confirmSeparateLayers = async () => {
    if (!splitPreview) return;
    const target = layers.find((layer) => layer.id === splitPreview.layerId);
    if (!target) return;
    setWorking(true);
    try {
      const vector = ["vector", "stroke"].includes(target.kind),
        base = splitPreview.base || target,
        created: Layer[] = [];
      for (let index = 0; index < splitPreview.parts.length; index++) {
        const part = splitPreview.parts[index],
          solid = vector ? await silhouette(part.src, target.color, 255) : part.src,
          src = vector ? await vTracerCutout(solid, target.color) : solid,
          safety = await analyzeCutSafety(src, base.w * part.width);
        created.push({
          ...target,
          ...safety,
          id: uid(),
          name: `${target.name}_Part_${index + 1}`,
          src,
          originalSrc: src,
          x: base.x + base.w * part.left,
          y: base.y + base.h * part.top,
          w: base.w * part.width,
          h: base.h * part.height,
          naturalW: part.naturalW,
          naturalH: part.naturalH,
          kind: vector ? "vector" : target.kind,
          parentId: undefined,
          innerSrc: undefined,
          steps: [],
          activeStep: -1,
        });
      }
      setLayers((items) => {
        const at = items.findIndex((layer) => layer.id === target.id),
          next = items.filter((layer) => layer.id !== target.id);
        next.splice(Math.max(0, at), 0, ...created);
        return next;
      });
      setSelected(created.map((layer) => layer.id));
      setSplitPreview(null);
      setCutEditor(null);
      setImageEditor(null);
      setBgEditor(null);
      setNotice(`${created.length} separate layers created`);
    } finally {
      setWorking(false);
    }
  };
  const addStroke = async (cmOverride?: number) => {
    if (!one || one.kind !== "vector") {
      setNotice("Stroke can only be applied to a Cutout layer");
      return;
    }
    setWorking(true);
    try {
      const cm = cmOverride ?? strokeDraft,
        rasterStroke = await strokeImage(one.src, cm, one.w, lighten(one.color), fillGapsDraft),
        src = await vTracerCutout(rasterStroke, lighten(one.color), one.w + cm * 2, 1.25),
        x = one.x - cm,
        y = one.y - cm,
        w = one.w + cm * 2,
        h = one.h + cm * 2,
        invalid = x < SAFE.x || y < SAFE.y || x + w > SAFE.x + SAFE.w || y + h > SAFE.y + SAFE.h;
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
      setNotice(invalid ? "Stroke extends outside the safe area" : "Stroke applied as a new layer below the Cutout");
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
        rasterStroke = await strokeImage(base.src, cm, base.w, previewColor, fillGapsDraft),
        src = await vTracerCutout(rasterStroke, previewColor, base.w + cm * 2, 1.25),
        invalid = x < SAFE.x || y < SAFE.y || x + newW > SAFE.x + SAFE.w || y + newH > SAFE.y + SAFE.h;
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
      setNotice(invalid ? "Stroke extends outside the safe area" : "Stroke updated");
    } finally {
      setWorking(false);
    }
  };
  const applyGapPreview = async () => {
    if (!one || !["vector", "stroke"].includes(one.kind)) return;
    setWorking(true);
    try {
      const parent = one.kind === "stroke" ? layers.find((l) => l.id === one.parentId) : undefined,
        base = parent || one,
        cm = one.kind === "stroke" ? one.strokeCm : 0,
        preservedColor = one.color,
        rasterStroke = await strokeImage(base.src, cm, base.w, preservedColor, fillGapsDraft),
        src = await vTracerCutout(rasterStroke, preservedColor, base.w + cm * 2, 1.25);
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
      setNotice(fillGapsDraft > 0 ? "Gap Fill preview applied" : "Gap Fill preview removed");
    } finally {
      setWorking(false);
    }
  };
  const makeGapsPermanent = async () => {
    if (!one || !["stroke", "vector"].includes(one.kind)) return;
    setWorking(true);
    try {
      const solid = await silhouette(one.src, one.color, 255),
        trimmed = await trimTransparent(solid),
        vectorSrc = await vTracerCutout(trimmed.src, one.color, one.w * trimmed.width, 1.25),
        finalLayer: Layer = {
          ...one,
          name: one.name.replace(/_Stroke$/, ""),
          src: vectorSrc,
          originalSrc: vectorSrc,
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
    setNotice(one.acetateOn ? "Acetate preview disabled" : "Acetate preview enabled");
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
  const smoothCutoutV4 = async (extraSmooth = false, openEditor = false) => {
    const targets = picked.filter((layer) => !["vector", "stroke", "acetate"].includes(layer.kind));
    if (!targets.length) return;
    setBgMenuOpen(false);
    setCutoutMenuOpen(false);
    setVTracerStartedAt(Date.now());
    setWorking(true);
    try {
      const converted: Layer[] = [];
      for (const target of targets) {
        const alreadyTransparent = await hasTransparentCanvas(target.src),
          refined = alreadyTransparent ? target.src : await featherAlphaInside(await refineBackground(target.src, 46, [], 12, 0)),
          trimmed = await trimTransparent(refined),
          color = COLORS[Math.floor(Math.random() * 21)],
          vectorSrc = alreadyTransparent
            ? await smoothVectorCutout(trimmed.src, color)
            : await vTracerCutout(await silhouette(trimmed.src, color, 255), color, undefined, extraSmooth ? 2.25 : 1.25),
          safety = await analyzeCutSafety(vectorSrc, target.w * trimmed.width),
          noBgLayer: Layer = {
            ...target,
            src: trimmed.src,
            x: target.x + target.w * trimmed.left,
            y: target.y + target.h * trimmed.top,
            w: target.w * trimmed.width,
            h: target.h * trimmed.height,
            kind: "nobg",
          },
          finalLayer: Layer = {
            ...noBgLayer,
            ...safety,
            name: `${target.name.replace(/_(NoBG|Cutout|SmoothCutout)$/i, "")}_${extraSmooth ? "SmoothCutout" : "DetailedCutout"}`,
            src: vectorSrc,
            color,
            kind: "vector",
          },
          removeStep: LayerStep = {
            id: uid(),
            type: "remove-bg",
            label: "Remove Background",
            snapshot: snapshot(noBgLayer),
          },
          cutoutStep: LayerStep = {
            id: uid(),
            type: "cutout",
            label: "Smooth Cutout v5",
            snapshot: snapshot(finalLayer),
          };
        converted.push({
          ...finalLayer,
          steps: [...target.steps, removeStep, cutoutStep],
          activeStep: target.steps.length + 1,
        });
      }
      const replacements = new Map(converted.map((layer) => [layer.id, layer]));
      setLayers((items) => items.map((layer) => replacements.get(layer.id) || layer));
      setSelected(converted.map((layer) => layer.id));
      setNotice(`${converted.length} ${converted.length === 1 ? "cutout" : "cutouts"} created with Cricut-optimized curves`);
      if (openEditor && converted.length === 1) openCutoutEditor(converted[0]);
    } catch (error) {
      setNotice(`Smooth Cutout could not be created: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setWorking(false);
      setVTracerStartedAt(null);
    }
  };
  const applyColor = async (color: string) => {
    if (!vectorsOnly) return;
    setWorking(true);
    try {
      for (const item of picked) {
        if (item.isShape && item.shapeImage) {
          const baseSrc = shapeSource(item.name, color),
            draft = { ...item, shapeBaseSrc: baseSrc, color };
          const src = await renderShapeImage(draft, item.shapeImage);
          mutate(item.id, (l) => ({
            ...l,
            src,
            originalSrc: src,
            shapeBaseSrc: baseSrc,
            color,
          }));
          continue;
        }
        const base = layers.find((l) => l.id === item.parentId) || item;
        const raster = item.kind === "stroke" ? await strokeImage(base.src, item.strokeCm, base.w, color, item.fillGapsMm || 0) : await silhouette(item.src, color, item.kind === "acetate" ? 77 : 255),
          src = item.kind === "stroke" ? await vTracerCutout(raster, color, base.w + item.strokeCm * 2, 1.25) : raster;
        mutate(item.id, (l) => ({ ...l, src, color }));
        if (item.kind === "vector")
          for (const child of layers.filter((l) => l.kind === "stroke" && l.parentId === item.id)) {
            const strokeRaster = await strokeImage(src, child.strokeCm, item.w, lighten(color), child.fillGapsMm || 0),
              strokeSrc = await vTracerCutout(strokeRaster, lighten(color), item.w + child.strokeCm * 2, 1.25);
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
  const pickShapeColor = async () => {
    if (!one?.isShape) return;
    const EyeDropperCtor = (
      window as typeof window & {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper;
    if (!EyeDropperCtor) {
      setNotice("Color picker is not supported by this browser");
      return;
    }
    try {
      const { sRGBHex } = await new EyeDropperCtor().open();
      await applyColor(sRGBHex);
    } catch {
      /* User cancelled the picker. */
    }
  };
  const renderShapeImage = async (shape: Layer, placed: NonNullable<Layer["shapeImage"]>) => {
    const baseSrc = shape.shapeBaseSrc || shape.src,
      mask = await getImage(baseSrc),
      photo = await getImage(placed.source.src),
      w = 1800,
      h = Math.max(1, Math.round((w * shape.h) / shape.w)),
      out = document.createElement("canvas"),
      overlay = document.createElement("canvas");
    out.width = overlay.width = w;
    out.height = overlay.height = h;
    const x = out.getContext("2d")!,
      o = overlay.getContext("2d")!;
    x.imageSmoothingEnabled = o.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = o.imageSmoothingQuality = "high";
    x.drawImage(mask, 0, 0, w, h);
    if (placed.visible) {
      const ix = placed.offsetX * w,
        iy = placed.offsetY * h,
        iw = placed.widthScale * w,
        ih = placed.heightScale * h,
        cx = ix + iw / 2,
        cy = iy + ih / 2;
      o.save();
      o.translate(cx, cy);
      o.rotate((placed.rotation * Math.PI) / 180);
      o.drawImage(photo, -iw / 2, -ih / 2, iw, ih);
      o.restore();
      o.globalCompositeOperation = "destination-in";
      o.drawImage(mask, 0, 0, w, h);
      x.drawImage(overlay, 0, 0);
    }
    return out.toDataURL("image/png");
  };
  const attachImageOnShape = async (source: Layer) => {
    const targetId = imageOnShapeTargetRef.current || imageOnShapeTarget,
      target = layers.find((l) => l.id === targetId);
    if (!target?.isShape) {
      imageOnShapeTargetRef.current = null;
      setImageOnShapeTarget(null);
      setNotice("Select a shape before choosing Image on Shape");
      return;
    }
    if (source.id === target.id || source.isShape || !["original", "nobg"].includes(source.kind)) {
      setNotice("Choose a regular image layer — cutouts and shapes cannot be placed here");
      return;
    }
    const placed: NonNullable<Layer["shapeImage"]> = {
      source: { ...source },
      offsetX: (source.x - target.x) / target.w,
      offsetY: (source.y - target.y) / target.h,
      widthScale: source.w / target.w,
      heightScale: source.h / target.h,
      rotation: source.rotation - target.rotation,
      visible: true,
    };
    setWorking(true);
    try {
      const draft = {
          ...target,
          shapeBaseSrc: target.shapeBaseSrc || target.src,
          shapeImage: placed,
        },
        src = await renderShapeImage(draft, placed);
      setLayers((items) =>
        items
          .filter((l) => l.id !== source.id)
          .map((l) =>
            l.id === target.id
              ? {
                  ...draft,
                  src,
                  originalSrc: src,
                  naturalW: 1800,
                  naturalH: Math.max(1, Math.round((1800 * target.h) / target.w)),
                }
              : l,
          ),
      );
      setSelected([target.id]);
      setShapeImageEditing(target.id);
      imageOnShapeTargetRef.current = null;
      setImageOnShapeTarget(null);
      setNotice("Image placed on shape — drag its frame to reposition it");
    } finally {
      setWorking(false);
    }
  };
  const startImageOnShape = () => {
    if (!one?.isShape) return;
    if (one.shapeImage) {
      imageOnShapeTargetRef.current = null;
      setImageOnShapeTarget(null);
      setShapeImageEditing((v) => (v === one.id ? null : one.id));
      return;
    }
    const next = imageOnShapeTargetRef.current === one.id ? null : one.id;
    imageOnShapeTargetRef.current = next;
    setShapeImageEditing(null);
    setImageOnShapeTarget(next);
    setNotice(next ? "Now choose an image from the canvas or Layers" : "Image selection cancelled");
  };
  const refreshShapeImage = async (id: string) => {
    const shape = layers.find((l) => l.id === id);
    if (!shape?.shapeImage) return;
    const src = await renderShapeImage(shape, shape.shapeImage);
    mutate(id, (l) => ({ ...l, src, originalSrc: src }));
  };
  const toggleShapeImage = async (id: string) => {
    const shape = layers.find((l) => l.id === id);
    if (!shape?.shapeImage) return;
    const placed = { ...shape.shapeImage, visible: !shape.shapeImage.visible },
      src = await renderShapeImage(shape, placed);
    mutate(id, (l) => ({ ...l, shapeImage: placed, src, originalSrc: src }));
  };
  const removeShapeImage = (id: string) => {
    setLayers((items) => {
      const index = items.findIndex((l) => l.id === id),
        shape = items[index];
      if (index < 0 || !shape.shapeImage) return items;
      const restored = { ...shape.shapeImage.source },
        clean = {
          ...shape,
          src: shape.shapeBaseSrc || shape.src,
          originalSrc: shape.shapeBaseSrc || shape.originalSrc,
          shapeImage: undefined,
          shapeBaseSrc: undefined,
        };
      const next = [...items];
      next[index] = clean;
      next.splice(index + 1, 0, restored);
      return next;
    });
    setShapeImageEditing(null);
    setNotice("Image on Shape removed; the original image layer was restored");
  };
  const startShapeImageDrag = (e: RPointer, mode: string, shape: Layer) => {
    if (!shape.shapeImage) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    shapeImageDrag.current = {
      mode,
      x: e.clientX,
      y: e.clientY,
      offsetX: shape.shapeImage.offsetX,
      offsetY: shape.shapeImage.offsetY,
      widthScale: shape.shapeImage.widthScale,
      heightScale: shape.shapeImage.heightScale,
    };
  };
  const moveShapeImageDrag = (e: RPointer, shape: Layer) => {
    const d = shapeImageDrag.current;
    if (!d || !shape.shapeImage) return;
    const dx = (e.clientX - d.x) / (shape.w * scale),
      dy = (e.clientY - d.y) / (shape.h * scale);
    let placed = { ...shape.shapeImage };
    if (d.mode === "move") placed = { ...placed, offsetX: d.offsetX + dx, offsetY: d.offsetY + dy };
    else {
      const sx = d.mode.includes("w") ? -dx : dx,
        sy = d.mode.includes("n") ? -dy : dy;
      if (e.shiftKey)
        placed = {
          ...placed,
          widthScale: Math.max(0.03, d.widthScale + sx),
          heightScale: Math.max(0.03, d.heightScale + sy),
        };
      else {
        const delta = Math.abs(sx) > Math.abs(sy) ? sx : sy,
          ratio = d.widthScale / d.heightScale;
        placed = {
          ...placed,
          widthScale: Math.max(0.03, d.widthScale + delta),
          heightScale: Math.max(0.03, (d.widthScale + delta) / ratio),
        };
      }
      if (d.mode.includes("w")) placed.offsetX = d.offsetX + d.widthScale - placed.widthScale;
      if (d.mode.includes("n")) placed.offsetY = d.offsetY + d.heightScale - placed.heightScale;
    }
    mutate(shape.id, (l) => ({ ...l, shapeImage: placed }));
  };
  const endShapeImageDrag = (shape: Layer) => {
    if (!shapeImageDrag.current) return;
    shapeImageDrag.current = null;
    void refreshShapeImage(shape.id);
  };
  const chooseClipImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !one?.isShape) return;
    const reader = new FileReader();
    reader.onload = () =>
      setClipEditor({
        layerId: one.id,
        maskSrc: one.src,
        imageSrc: String(reader.result),
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      });
    reader.readAsDataURL(file);
  };
  const startClipDrag = (e: RPointer<HTMLDivElement>) => {
    if (!clipEditor || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    clipDrag.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: clipEditor.offsetX,
      offsetY: clipEditor.offsetY,
      rect: e.currentTarget.getBoundingClientRect(),
    };
  };
  const moveClipDrag = (e: RPointer<HTMLDivElement>) => {
    const start = clipDrag.current;
    if (!start) return;
    setClipEditor((v) =>
      v
        ? {
            ...v,
            offsetX: start.offsetX + (e.clientX - start.x) / start.rect.width,
            offsetY: start.offsetY + (e.clientY - start.y) / start.rect.height,
          }
        : v,
    );
  };
  const endClipDrag = () => {
    clipDrag.current = null;
  };
  const applyClipImage = async () => {
    if (!clipEditor) return;
    const target = layers.find((layer) => layer.id === clipEditor.layerId);
    if (!target) return;
    setWorking(true);
    try {
      const mask = await getImage(clipEditor.maskSrc),
        photo = await getImage(clipEditor.imageSrc),
        w = 1600,
        h = Math.max(1, Math.round((w * target.h) / target.w)),
        out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const x = out.getContext("2d")!,
        cover = Math.max(w / photo.naturalWidth, h / photo.naturalHeight) * clipEditor.scale,
        dw = photo.naturalWidth * cover,
        dh = photo.naturalHeight * cover;
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = "high";
      x.drawImage(photo, (w - dw) / 2 + clipEditor.offsetX * w, (h - dh) / 2 + clipEditor.offsetY * h, dw, dh);
      x.globalCompositeOperation = "destination-in";
      x.drawImage(mask, 0, 0, w, h);
      const src = out.toDataURL("image/png");
      mutate(target.id, (layer) => ({
        ...layer,
        src,
        originalSrc: src,
        naturalW: w,
        naturalH: h,
      }));
      setClipEditor(null);
      setNotice("Image placed inside shape");
    } finally {
      setWorking(false);
    }
  };
  const choose = async (e: RPointer, l: Layer) => {
    e.stopPropagation();
    if (imageOnShapeTargetRef.current || imageOnShapeTarget) {
      await attachImageOnShape(l);
      return;
    }
    if (l.isShape) {
      const rect=canvasRef.current?.getBoundingClientRect();if(!rect||!await layerOpaqueAtWorld(l,(e.clientX-rect.left)/scale,(e.clientY-rect.top)/scale))return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey) setSelected((v) => (v.includes(l.id) ? v.filter((x) => x !== l.id) : [...v, l.id]));
    else if (!selected.includes(l.id)) setSelected([l.id]);
  };
  const startDrag = (e: RPointer, mode: string) => {
    e.stopPropagation();
    if (!picked.length) return;
    const rect = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect(),
      cx = rect ? rect.left + rect.width / 2 : e.clientX,
      cy = rect ? rect.top + rect.height / 2 : e.clientY;
    setDrag({
      mode,
      sx: e.clientX,
      sy: e.clientY,
      start: picked.map((l) => ({ ...l })),
      box: mode === "rotate" && one ? { x: one.x, y: one.y, w: one.w, h: one.h } : { ...box },
      cx,
      cy,
      angle0: Math.atan2(e.clientY - cy, e.clientX - cx),
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const startSelectionMove=async(e:RPointer)=>{e.stopPropagation();if(one?.isShape){const rect=canvasRef.current?.getBoundingClientRect();if(!rect||!await layerOpaqueAtWorld(one,(e.clientX-rect.left)/scale,(e.clientY-rect.top)/scale)){setSelected([]);return}}startDrag(e,"move")};
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
    if (drag.mode === "draw-shape") {
      const source = drag.start[0],
        lockedShape = e.shiftKey,
        rawW = Math.abs(dx),
        rawH = Math.abs(dy),
        size = Math.max(rawW, rawH),
        nw = Math.max(0.1, lockedShape ? size : rawW),
        nh = Math.max(0.1, lockedShape ? size : rawH),
        nx = dx < 0 ? drag.box.x - nw : drag.box.x,
        ny = dy < 0 ? drag.box.y - nh : drag.box.y;
      setLayers((v) =>
        v.map((l) =>
          l.id === source.id
            ? {
                ...l,
                x: clamp(nx, SAFE.x, SAFE.x + SAFE.w - nw),
                y: clamp(ny, SAFE.y, SAFE.y + SAFE.h - nh),
                w: Math.min(nw, SAFE.w),
                h: Math.min(nh, SAFE.h),
              }
            : l,
        ),
      );
      return;
    }
    if (drag.mode === "rotate") {
      const a = Math.atan2(e.clientY - (drag.cy || 0), e.clientX - (drag.cx || 0)),
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
      const allowedDx = clamp(dx, Math.max(...drag.start.map((s) => SAFE.x - s.x)), Math.min(...drag.start.map((s) => SAFE.x + SAFE.w - s.w - s.x))),
        allowedDy = clamp(dy, Math.max(...drag.start.map((s) => SAFE.y - s.y)), Math.min(...drag.start.map((s) => SAFE.y + SAFE.h - s.h - s.y)));
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
    if (corner && !e.shiftKey) {
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
  const canvasDown = async (e: RPointer) => {
    e.stopPropagation();
    if (shapeImageEditing) setShapeImageEditing(null);
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
      candidates = [...layers].reverse().filter(l=>{const b=rotatedBounds(l);return l.visible&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h}),
      opaque=await Promise.all(candidates.map(async l=>!l.isShape||await layerOpaqueAtWorld(l,x,y))),h=candidates.filter((_,index)=>opaque[index]);
    if (shapeTool && e.button === 0) {
      e.preventDefault();
      const id = uid(),
        color = COLORS[Math.floor(Math.random() * 21)],
        src = shapeSource(shapeTool, color),
        layer: Layer = {
          id,
          name: shapeTool,
          src,
          originalSrc: src,
          visible: true,
          x,
          y,
          w: 0.1,
          h: 0.1,
          naturalW: 1600,
          naturalH: 1600,
          kind: "vector",
          strokeCm: 0,
          fillGapsMm: 0,
          invalid: false,
          rotation: 0,
          color,
          steps: [],
          activeStep: 0,
          acetateOn: false,
          isShape: true,
        };
      const step: LayerStep = {
        id: uid(),
        type: "cutout",
        label: "Cutout",
        locked: true,
        snapshot: snapshot(layer),
      };
      layer.steps = [step];
      setLayers((v) => [...v, layer]);
      setSelected([id]);
      setDrag({
        mode: "draw-shape",
        sx: e.clientX,
        sy: e.clientY,
        start: [layer],
        box: { x, y, w: 0, h: 0 },
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
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
      sameSpot = key === cycle.key && Math.hypot(e.clientX - cycle.x, e.clientY - cycle.y) <= 3,
      i = sameSpot ? (cycle.index + 1) % h.length : 0;
    setCycle({ key, index: i, x: e.clientX, y: e.clientY });
    const target = h[i];
    if (e.shiftKey || e.ctrlKey || e.metaKey) setSelected((v) => (v.includes(target.id) ? v.filter((q) => q !== target.id) : [...v, target.id]));
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
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pan.current = {
        x: e.clientX,
        y: e.clientY,
        l: stageRef.current.scrollLeft,
        t: stageRef.current.scrollTop,
      };
      return;
    }
    if (e.button !== 0 || (e.target as HTMLElement).closest("button,.viewport-rulers,.canvas")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(),
      x = (e.clientX - rect.left) / scale,
      y = (e.clientY - rect.top) / scale;
    setSelected([]);
    setMarquee({ x, y, w: 0, h: 0 });
    setDrag({
      mode: "marquee",
      sx: e.clientX,
      sy: e.clientY,
      start: [],
      box: { x, y, w: 0, h: 0 },
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const endPointer = async () => {
    if (marquee && marquee.w > 0.05 && marquee.h > 0.05) {
      const candidates = layers.filter((l) => {
        const b = rotatedBounds(l);
        return l.visible && b.x < marquee.x + marquee.w && b.x + b.w > marquee.x && b.y < marquee.y + marquee.h && b.y + b.h > marquee.y;
      });
      const hits = await Promise.all(candidates.map(async (layer) => ((await marqueeTouchesVisiblePixels(layer, marquee)) ? layer.id : null)));
      setSelected(hits.filter((id): id is string => Boolean(id)));
    }
    if (drag?.mode === "rotate") {
      const rotatedIds = new Set(drag.start.map((l) => l.id));
      const current = layers.filter((l) => rotatedIds.has(l.id));
      const baked = await Promise.all(current.map(bakeRotation));
      setLayers((items) => items.map((l) => baked.find((b) => b.id === l.id) || l));
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
          x: left ? b.x : right ? b.x + b.w - l.w : horizontalCenter ? b.x + (b.w - l.w) / 2 : l.x,
          y: top ? b.y : bottom ? b.y + b.h - l.h : verticalCenter ? b.y + (b.h - l.h) / 2 : l.y,
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
      previous = step.before || steps.at(-1)?.snapshot;
    mutate(layer.id, (l) => ({
      ...l,
      ...(previous || {
        src: l.originalSrc,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
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
  const validateLayers = async () => {
    const candidates = layers.filter((layer) => ["vector", "stroke"].includes(layer.kind));
    setValidationIntroOpen(false);
    setWorking(true);
    try {
      const checks = await Promise.all(candidates.map(async (layer) => ({ id: layer.id, ...(await analyzeCutSafety(layer.src, layer.w)) })));
      const byId = new Map(checks.map((check) => [check.id, check]));
      setLayers((items) => items.map((layer) => ({ ...layer, ...(byId.get(layer.id) || { cutRisk: false, cutRiskReason: "", cutRiskOverlay: "" }) })));
      setCutSafetyEnabled(true);
      const risky = checks.filter((check) => check.cutRisk);
      setNotice(risky.length ? `${risky.length} layer${risky.length === 1 ? "" : "s"} marked for review` : "Layer validation complete · no sub-1 mm risks found");
      addSessionLog("Layers validated", risky.length ? `${risky.length} layer(s) contain sub-1 mm cut details.` : "No sub-1 mm cut details were detected.");
    } finally {
      setWorking(false);
    }
  };
  const canExport = picked.length > 0 && picked.every((l) => !l.invalid),
    canSVG = picked.length > 0 && picked.every((l) => ["vector", "stroke"].includes(l.kind) && !l.invalid),
    exportPNG = async () => {
      if (!canExport) return;
      for (const layer of picked) {
        const c = await renderCanvas(layer, true, 3),
          b = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
        if (b) save(URL.createObjectURL(b), `${layer.name}_PNG_Cricut.png`);
      }
    },
    exportSVG = async (confirmed = false) => {
      if (!canSVG) return;
      if (!confirmed && cutSafetyEnabled && picked.some((layer) => layer.cutRisk)) {
        setSvgWarningOpen(true);
        return;
      }
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
            save(
              URL.createObjectURL(
                new Blob([new XMLSerializer().serializeToString(nativeRoot)], {
                  type: "image/svg+xml",
                }),
              ),
              `${layer.name}_SVG_Cricut.svg`,
            );
            continue;
          }
          // Export uses a temporary baked copy. The editable layer and all of
          // its parametric modifiers remain untouched in the project.
          const bakedSrc = await silhouette(layer.src, DARK, 255),
            bakedLayer: Layer = {
              ...layer,
              src: bakedSrc,
              kind: "vector",
              acetateOn: false,
            },
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
          doc.querySelectorAll("path").forEach((path) => path.setAttribute("fill", DARK));
          const root = doc.documentElement;
          root.setAttribute("width", `${layer.w}cm`);
          root.setAttribute("height", `${layer.h}cm`);
          root.setAttribute("viewBox", `0 0 ${input.width} ${input.height}`);
          root.setAttribute("preserveAspectRatio", "none");
          svg = new XMLSerializer().serializeToString(root);
          save(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), `${layer.name}_SVG_Cricut.svg`);
        }
        setNotice("Potrace SVG ready");
      } catch (error) {
        setNotice(`SVG could not be created: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setWorking(false);
      }
    };
  const exportPDF = async () => {
    if (layers.some((l) => l.visible && l.invalid)) return setNotice("Resolve the safe area issue before exporting");
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
        x.drawImage(img, ((-l.w / A4.w) * c.width) / 2, ((-l.h / A4.h) * c.height) / 2, (l.w / A4.w) * c.width, (l.h / A4.h) * c.height);
        x.restore();
      }
      const pdf = new jsPDF({
        unit: "cm",
        format: pageMode === "full" ? [100, 100] : "a4",
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
    gridImage = zoom >= 2.3 ? "linear-gradient(#aeb6b066 1px,transparent 1px),linear-gradient(90deg,#aeb6b066 1px,transparent 1px),linear-gradient(#bec6c044 1px,transparent 1px),linear-gradient(90deg,#bec6c044 1px,transparent 1px),linear-gradient(#cbd2ce2b 1px,transparent 1px),linear-gradient(90deg,#cbd2ce2b 1px,transparent 1px)" : zoom >= 1.3 ? "linear-gradient(#aeb6b05c 1px,transparent 1px),linear-gradient(90deg,#aeb6b05c 1px,transparent 1px),linear-gradient(#c7ceca35 1px,transparent 1px),linear-gradient(90deg,#c7ceca35 1px,transparent 1px)" : "linear-gradient(#9fa8a255 1px,transparent 1px),linear-gradient(90deg,#9fa8a255 1px,transparent 1px),linear-gradient(#c7ceca33 1px,transparent 1px),linear-gradient(90deg,#c7ceca33 1px,transparent 1px)",
    gridSize = zoom >= 2.3 ? `${scale}px ${scale}px,${scale}px ${scale}px,${scale / 2}px ${scale / 2}px,${scale / 2}px ${scale / 2}px,${scale / 10}px ${scale / 10}px,${scale / 10}px ${scale / 10}px` : zoom >= 1.3 ? `${scale}px ${scale}px,${scale}px ${scale}px,${scale / 2}px ${scale / 2}px,${scale / 2}px ${scale / 2}px` : `${scale * 10}px ${scale * 10}px,${scale * 10}px ${scale * 10}px,${scale}px ${scale}px,${scale}px ${scale}px`,
    canvasBackgroundImage=pageColor==="canson"?`${gridImage},url("/textures/canson-paper-yellow.png")`:gridImage,
    canvasBackgroundSize=pageColor==="canson"?`${gridSize},640px 640px`:gridSize,
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
          <button className="brand-copy" onClick={() => setDevLogOpen(true)} title="Open development log">
            <b>Cake Topper Maker</b>
            <small>Personal workspace · {EDITOR_VERSION}</small>
          </button>
        </div>
        <button className="brand-undo" onClick={undo} title="Undo (Ctrl+Z)">
          <Undo2 /> Undo
        </button>
        <input hidden ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.svg,.webp" onChange={add} />
        <input hidden ref={clipFileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseClipImage} />
        <span className="toolbar-divider" />
        <nav className="main-actions">
          <button
            type="button"
            className="remove-bg-main"
            onClick={() => {
              if (!one) return setNotice("Select one image first");
              setBgMenuOpen(true);
            }}
          >
            <Sparkles />
            Remove Background
          </button>
          <button disabled={!picked.some((layer) => !["vector", "stroke", "acetate"].includes(layer.kind))} onClick={() => setCutoutMenuOpen(true)}>
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
            <button className="multiple-svg" onClick={() => void exportSVG()} title="Export every selected Cutout as a separate SVG file">
              <Type /> Multiple SVG
            </button>
          )}
          <button disabled={picked.length !== 1 || !canSVG} onClick={() => void exportSVG()} title="Export selected Cutout as SVG">
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
            <button onClick={() => setPageSetupOpen((value) => !value)}>
              <File /> Page Setup <ChevronDown />
            </button>
            {pageSetupOpen && (
              <div className="pop page-setup-menu setup-root">
                <div className="setup-group">
                  <button>
                    Page Size <ChevronDown />
                  </button>
                  <div className="setup-submenu">
                    {(["portrait", "landscape", "full"] as PageMode[]).map((mode) => (
                      <button
                        key={mode}
                        className={pageMode === mode ? "active" : ""}
                        onClick={() => {
                          setPageMode(mode);
                          setPageSetupOpen(false);
                          setSelected([]);
                        }}
                      >
                        <b>{mode[0].toUpperCase() + mode.slice(1)}</b>
                        <span>{mode === "portrait" ? "21 × 29.7 cm" : mode === "landscape" ? "29.7 × 21 cm" : "100 × 100 cm"}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setup-group page-color-group">
                  <button>
                    Page Color <ChevronDown />
                  </button>
                  <div className="setup-submenu page-color-submenu">
                    {(Object.keys(PAGE_COLORS) as PageColor[]).map(value=><button key={value} className={pageColor===value?"active":""} onClick={()=>{setPageColor(value);setPageSetupOpen(false)}}><i style={{background:PAGE_COLORS[value].color}} className={value==="canson"?"paper-swatch":""}/><b>{PAGE_COLORS[value].label}</b></button>)}
                  </div>
                </div>
                <div className="setup-group">
                  <button>
                    Grid <ChevronDown />
                  </button>
                  <div className="setup-submenu">
                    <button
                      className={gridVisible ? "active" : ""}
                      onClick={() => {
                        setGridVisible(true);
                        setPageSetupOpen(false);
                      }}
                    >
                      Grid On
                    </button>
                    <button
                      className={!gridVisible ? "active" : ""}
                      onClick={() => {
                        setGridVisible(false);
                        setPageSetupOpen(false);
                      }}
                    >
                      Grid Off
                    </button>
                  </div>
                </div>
                <div className="setup-group">
                  <button>
                    Safe Area <ChevronDown />
                  </button>
                  <div className="setup-submenu">
                    {[0, 0.5, 1].map((margin) => (
                      <button
                        key={margin}
                        className={safeMargin === margin ? "active" : ""}
                        onClick={() => {
                          setSafeMargin(margin);
                          setPageSetupOpen(false);
                        }}
                      >
                        {margin} cm
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="sub-center">
          <div className="wrap color-slot">
            <button disabled={!vectorsOnly} className="color-current" style={{ "--swatch": one?.color || DARK } as React.CSSProperties} onClick={() => setColorOpen((v) => !v)}>
              <Palette /> Color <ChevronDown className="tiny-chevron" />
            </button>
            {colorOpen && vectorsOnly && (
              <div className="pop palette">
                {one?.isShape && (
                  <button className="shape-eyedrop" onClick={() => void pickShapeColor()} title="Pick a colour from the screen">
                    <Pipette />
                    <span>Pick Color</span>
                  </button>
                )}
                {COLORS.map((c) => (
                  <button key={c} style={{ background: c }} onClick={() => applyColor(c)} title={c} />
                ))}
              </div>
            )}
          </div>
          <div className="wrap">
            <button disabled={picked.length < 2} onClick={() => setAlignOpen((v) => !v)}>
              <AlignHorizontalJustifyCenter /> Align
            </button>
            {alignOpen && (
              <div className="pop align-menu">
                {(
                  [
                    ["top", AlignStartVertical, "Top"],
                    ["left", AlignStartHorizontal, "Left"],
                    ["vcenter", AlignVerticalJustifyCenter, "Vertical"],
                    ["hcenter", AlignHorizontalJustifyCenter, "Horizontal"],
                    ["bottom", AlignEndVertical, "Bottom"],
                    ["right", AlignEndHorizontal, "Right"],
                    ["center", Crosshair, "Center"],
                  ] as const
                ).map(([m, I, label]) => (
                  <button key={m} onClick={() => align(m)}>
                    <I />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button disabled={!one || !["vector", "stroke"].includes(one.kind)} onClick={() => openCutoutEditor()}>
            <Scissors /> Edit Cutout
          </button>
          <button disabled={!one || ["vector", "stroke", "acetate"].includes(one.kind)} onClick={() => openImageEditor()}>
            <ImageIcon /> Edit Image
          </button>
          <button className={imageOnShapeTarget || shapeImageEditing ? "active-action" : ""} disabled={!one?.isShape} onClick={startImageOnShape}>
            <ImagePlus /> Image on Shape
          </button>
          <button className="bake-cutout" disabled={!one || !["vector", "stroke"].includes(one.kind)} onClick={() => void makeGapsPermanent()}>
            <Sparkles /> Bake Cutout
          </button>
        </div>
        <div className="save-actions">
          <button className="new-project" onClick={newProject} title="Start a new project">
            <Plus /> New Project
          </button>
          <button className="save-project" onClick={() => (currentProjectId ? void saveProject(false) : (setSaveAsMode(false), setProjectsOpen(true)))} title="Save current project">
            <Download /> Save
          </button>
          <button
            className="save-as-project"
            onClick={() => {
              setSaveAsMode(true);
              setProjectName(currentProjectId ? `${projectName} Copy` : projectName);
              setProjectsOpen(true);
            }}
            title="Create a new project copy"
          >
            <Copy /> Save As
          </button>
        </div>
      </div>
      <section className="workspace">
        <div className="left-tools">
          <button className="left-add" onClick={() => { setCreateImageMode(null); setAddNewOpen(true); }}>
            <ImagePlus />
            <span>Add New</span>
          </button>
          <div className="left-separator" />
          {["circle", "rectangle", "triangle"].map((shape) => (
            <button
              key={shape}
              className={shapeTool === shape ? "active" : ""}
              onClick={() => {
                setShapeTool(shapeTool === shape ? null : shape);
                setShapeOpen(false);
              }}
            >
              <span className={`shape-icon shape-${shape}`} />
              <small>{shape}</small>
            </button>
          ))}
          <div className="custom-shape-wrap">
            <button className={shapeOpen ? "active" : ""} onClick={() => setShapeOpen((v) => !v)}>
              <Star />
              <small>Custom</small>
            </button>
            {shapeOpen && (
              <div className="custom-shapes-menu">
                {CUSTOM_SHAPES.map(([name, icon]) => {
                  const [w, h, , , path] = icon.icon;
                  return (
                    <button
                      key={name}
                      title={name}
                      onClick={() => {
                        setShapeTool(name);
                        setShapeOpen(false);
                      }}
                    >
                      <svg viewBox={`0 0 ${w} ${h}`}>{Array.isArray(path) ? path.map((d, i) => <path key={i} d={d} />) : <path d={path} />}</svg>
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="left-future">
            <button
              className="left-projects"
              onClick={() => {
                setProjectsOpen(true);
                setAccountOpen(false);
                void refreshProjects(projects.length === 0);
              }}
            >
              <FolderOpen />
              <small>My Projects</small>
            </button>
            <button
              className="left-account"
              onClick={() => {
                setAccountOpen(true);
                setProjectsOpen(false);
              }}
            >
              <span className="profile-placeholder">{session?.user.user_metadata?.avatar_url || session?.user.user_metadata?.picture ? <img src={session.user.user_metadata.avatar_url || session.user.user_metadata.picture} alt="" /> : <User />}</span>
              <small>My Account</small>
            </button>
          </div>
        </div>
        <div className={`stage ${pageMode === "full" ? "full-page" : "standard-page"}`} ref={stageRef} onScroll={updateRulers} onPointerDown={stageDown}>
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
            <div className="zoom-row">
              <button onClick={() => setZoom((v) => clamp(v - 0.1, 0.2, 7))}>
                <ZoomOut />
              </button>
              {zoomEditing ? (
                <input
                  autoFocus
                  className="zoom-value-input"
                  aria-label="Zoom percentage"
                  inputMode="numeric"
                  value={zoomDraft}
                  onChange={(e) => setZoomDraft(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      setZoomEditing(false);
                      setZoomDraft(String(Math.round(zoom * 100)));
                    }
                  }}
                  onBlur={() => {
                    const value = clamp((+zoomDraft || 20) / 100, 0.2, 7);
                    setZoom(value);
                    setZoomDraft(String(Math.round(value * 100)));
                    setZoomEditing(false);
                  }}
                />
              ) : (
                <button
                  className="zoom-value"
                  onClick={() => {
                    setZoomDraft(String(Math.round(zoom * 100)));
                    setZoomEditing(true);
                  }}
                >
                  {Math.round(zoom * 100)}%
                </button>
              )}
              <button onClick={() => setZoom((v) => clamp(v + 0.1, 0.2, 7))}>
                <ZoomIn />
              </button>
            </div>
            <div className="zoom-actions">
              <button
                onClick={() => {
                  setZoom(1);
                  window.setTimeout(centerDocument, 30);
                }}
                title="Center document at 100%"
              >
                <Crosshair />
                <span>Center</span>
              </button>
              <button
                onClick={() => {
                  setCalibrationDraft(calibration);
                  setCalibrationOpen(true);
                }}
                title="Calibrate real-world size"
              >
                <Ruler />
                <span>Calibrate</span>
              </button>
            </div>
          </div>
          <div className="board" style={{ width: A4.w * scale + 42, height: A4.h * scale + 42 }}>
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
              className={`canvas page-color-${pageColor} ${zoom > 1.5 ? "mm-grid" : ""} ${gridVisible ? "" : "grid-off"} ${imageOnShapeTarget ? "image-on-shape-picking" : ""}`}
              onPointerDown={canvasDown}
              style={{
                left: 42,
                top: 42,
                width: A4.w * scale,
                height: A4.h * scale,
                backgroundColor:PAGE_COLORS[pageColor].color,
                backgroundImage: canvasBackgroundImage,
                backgroundSize: canvasBackgroundSize,
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
                    <img src={["vector", "stroke"].includes(l.kind) ? scalableSvgPreview(l.src) : l.src} alt="" draggable={false} style={{ opacity: l.acetateOn ? 0.8 : 1 }} />
                  </div>
                ))}
              {shapeImageEditing &&
                (() => {
                  const shape = layers.find((l) => l.id === shapeImageEditing),
                    placed = shape?.shapeImage;
                  if (!shape || !placed) return null;
                  const left = (shape.x + placed.offsetX * shape.w) * scale,
                    top = (shape.y + placed.offsetY * shape.h) * scale,
                    width = placed.widthScale * shape.w * scale,
                    height = placed.heightScale * shape.h * scale;
                  return (
                    <div
                      className="shape-image-frame"
                      onPointerDown={(e) => startShapeImageDrag(e, "move", shape)}
                      onPointerMove={(e) => moveShapeImageDrag(e, shape)}
                      onPointerUp={() => endShapeImageDrag(shape)}
                      onPointerCancel={() => endShapeImageDrag(shape)}
                      style={{
                        left,
                        top,
                        width,
                        height,
                        zIndex: layers.length + 8,
                        transform: `rotate(${shape.rotation + placed.rotation}deg)`,
                      }}
                    >
                      <span>Image on Shape</span>
                      {["nw", "ne", "se", "sw"].map((handle) => (
                        <button key={handle} className={`shape-image-handle h-${handle}`} onPointerDown={(e) => startShapeImageDrag(e, handle, shape)} onPointerMove={(e) => moveShapeImageDrag(e, shape)} onPointerUp={() => endShapeImageDrag(shape)} onPointerCancel={() => endShapeImageDrag(shape)} />
                      ))}
                    </div>
                  );
                })()}
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
                  className={`selection-box ${cutSafetyEnabled && picked.some((layer) => layer.cutRisk) ? "cut-risk" : ""}`}
                  onPointerDown={(e) => void startSelectionMove(e)}
                  style={
                    {
                      left: displayBox.x * scale,
                      top: displayBox.y * scale,
                      width: displayBox.w * scale,
                      height: displayBox.h * scale,
                      zIndex: layers.length + 5,
                      "--handle": `${clamp(11 * zoom, 11, 15)}px`,
                      "--rotation": `${one?.rotation || 0}deg`,
                      transform: one && drag?.mode === "rotate" ? `rotate(${one.rotation}deg)` : undefined,
                    } as React.CSSProperties
                  }
                >
                  <div className={`measure ${labelBelow ? "below" : ""}`}>
                    {fmt(displayBox.w)} × {fmt(displayBox.h)} cm
                    {one && one.rotation !== 0 && ` · ${Math.round(one.rotation)}°`}
                    {cutSafetyEnabled && picked.some((layer) => layer.cutRisk) && (
                      <button
                        className="measure-warning"
                        title="Cut safety warning"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRiskLayerId(picked.find((layer) => layer.cutRisk)?.id || null);
                        }}
                      >
                        <AlertTriangle />
                        <span>Fix!</span>
                      </button>
                    )}
                  </div>
                  {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => (
                    <button key={h} className={`handle h-${h}`} onPointerDown={(e) => startDrag(e, h)} />
                  ))}
                  {picked.length > 0 && (
                    <button className="rotate-handle" onPointerDown={(e) => startDrag(e, "rotate")}>
                      <RotateCw />
                    </button>
                  )}
                  <div className={`float-menu ${labelBelow ? "lower" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
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
                    <button title="Paste" onClick={paste} disabled={!clipboard.current.length}>
                      <Download />
                    </button>
                    <button title="Bring to front" onClick={() => moveSelectionTo(true)}>
                      <BringToFront />
                    </button>
                    <button title="Send to back" onClick={() => moveSelectionTo(false)}>
                      <SendToBack />
                    </button>
                    <button title="Hide" onClick={hideSelection}>
                      <EyeOff />
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
                  <button onClick={() => fileRef.current?.click()}>Upload image from your Computer</button>
                  <button className="generate-empty" onClick={() => { setAddNewOpen(true); setCreateImageMode("choose"); }}><Sparkles /> Generate Your Own Image</button>
                  <button
                    className="open-saved-empty"
                    onClick={() => {
                      setProjectsOpen(true);
                      void refreshProjects(projects.length === 0);
                    }}
                  >
                    <FolderOpen /> Open Existing Project
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <aside>
          <div className={`side-tool permanent-tools ${picked.length ? "enabled" : "disabled-panel"}`}>
            <div className="side-tool-title">
              <b>Size</b>
              <small>Selected layer</small>
            </div>
            <div className="size-row">
              <label>
                W <input disabled={!picked.length} type="text" inputMode="decimal" value={widthDraft} onChange={(e) => setWidthDraft(e.target.value)} onBlur={() => commitDimension("w", widthDraft)} onKeyDown={(e) => e.key === "Enter" && commitDimension("w", widthDraft)} /> cm
              </label>
              <button className="side-chain" onClick={() => setLocked((v) => !v)}>
                {locked ? <LinkIcon /> : <Link2Off />}
              </button>
              <label>
                H <input disabled={!picked.length} type="text" inputMode="decimal" value={heightDraft} onChange={(e) => setHeightDraft(e.target.value)} onBlur={() => commitDimension("h", heightDraft)} onKeyDown={(e) => e.key === "Enter" && commitDimension("h", heightDraft)} /> cm
              </label>
            </div>
            {
              <>
                <div className="tool-separator" />
                <div className={!one || !["vector", "stroke"].includes(one.kind) ? "cut-option-disabled" : ""}>
                  <div className="side-tool-title">
                    <b>Stroke</b>
                    <small>Cutout only · default 0.5 cm</small>
                  </div>
                  <div className="stroke-row">
                    <input disabled={!one || !["vector", "stroke"].includes(one.kind)} type="number" min="0" step=".1" value={strokeDraft.toFixed(1)} onChange={(e) => setStrokeDraft(Math.max(0, +e.target.value))} />
                    <span>cm</span>
                    <button disabled={!one || !["vector", "stroke"].includes(one.kind)} onClick={() => (one?.kind === "stroke" ? void updateStroke() : void addStroke())}>
                      Apply Stroke
                    </button>
                  </div>
                </div>
              </>
            }
          </div>
          {
            <div className={`finalize-tool ${!one || !["vector", "stroke"].includes(one.kind) ? "cut-option-disabled" : ""}`}>
              <div className="side-tool-title">
                <b>Fill Gaps</b>
                <small>Cutout geometry cleanup</small>
              </div>
              <div className="fill-gaps-row">
                <div className="gap-control-row" title="Fills enclosed holes whose total area is below the selected square-mm threshold">
                  <input disabled={!one || !["stroke", "vector"].includes(one.kind)} type="number" min="0" max="30" step={fillGapsDraft < 5 ? ".5" : "1"} value={fillGapsDraft} onChange={(e) => setFillGapsDraft(clamp(+e.target.value, 0, 30))} />
                  <span>mm²</span>
                  <button className="gap-apply" disabled={!one || !["stroke", "vector"].includes(one.kind)} onClick={() => void applyGapPreview()}>
                    Apply Fill
                  </button>
                </div>
                <small>Try a whole-mm threshold before committing</small>
              </div>
            </div>
          }
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
                className={`card ${selected.includes(l.id) ? "active" : ""} ${cutSafetyEnabled && l.cutRisk ? "cut-risk" : ""} ${!l.visible ? "hidden" : ""} ${dragLayer === l.id ? "dragging" : ""}`}
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
                onClickCapture={(e) => {
                  if (imageOnShapeTargetRef.current || imageOnShapeTarget) {
                    e.preventDefault();
                    e.stopPropagation();
                    void attachImageOnShape(l);
                  }
                }}
                onClick={(e) => {
                  if (e.shiftKey || e.ctrlKey || e.metaKey) setSelected((v) => (v.includes(l.id) ? v.filter((x) => x !== l.id) : [...v, l.id]));
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
                    onChange={(e) => mutate(l.id, (v) => ({ ...v, name: e.target.value }))}
                  />
                  <small>
                    {l.kind === "original" ? "Original" : l.kind === "nobg" ? "Background removed" : l.kind === "stroke" ? `Stroke · ${fmt(l.strokeCm)} cm` : "Acetate"} · {fmt(l.w)} × {fmt(l.h)} cm
                  </small>
                </div>
                {(l.invalid || (cutSafetyEnabled && l.cutRisk)) && (
                  <button
                    className="layer-warning"
                    title={l.cutRisk ? l.cutRiskReason : "Safe area warning"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (l.cutRisk) setRiskLayerId(l.id);
                    }}
                  >
                    <AlertTriangle className="warning" />
                  </button>
                )}
                <GripVertical className="drag-grip" />
                {l.shapeImage && (
                  <div className={`shape-image-style ${shapeImageEditing === l.id ? "active" : ""}`} onClick={(e) => e.stopPropagation()}>
                    <button title={l.shapeImage.visible ? "Hide image" : "Show image"} onClick={() => void toggleShapeImage(l.id)}>
                      {l.shapeImage.visible ? <Eye /> : <EyeOff />}
                    </button>
                    <button
                      className="shape-image-style-name"
                      onClick={() => {
                        setSelected([l.id]);
                        setShapeImageEditing(l.id);
                        setImageOnShapeTarget(null);
                      }}
                    >
                      <ImageIcon />
                      <span>
                        <b>Image on Shape</b>
                        <small>{l.shapeImage.source.name}</small>
                      </span>
                    </button>
                    <button className="shape-image-remove" title="Remove Image on Shape" onClick={() => removeShapeImage(l.id)}>
                      ×
                    </button>
                  </div>
                )}
                {l.steps.length > 0 && (
                  <div className="layer-styles" onClick={(e) => e.stopPropagation()}>
                    {l.steps.map((step, index) => (
                      <div key={step.id} className={`style-step ${index > l.activeStep ? "step-off" : ""}`}>
                        <button className="step-eye" onClick={() => showStep(l, index)} title={`Show through ${step.label}`}>
                          {index <= l.activeStep ? <Eye /> : <EyeOff />}
                        </button>
                        <span onClick={() => showStep(l, index)}>{step.label}</span>
                        {!step.locked && (
                          <button className="step-remove" onClick={() => removeStep(l, index)} title={`Remove ${step.label}`}>
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!layers.length && <div className="no-layers">Your uploaded designs will appear here.</div>}
          </div>
          <button className="validate-layers" disabled={!layers.some((layer) => ["vector", "stroke"].includes(layer.kind))} onClick={() => setValidationIntroOpen(true)}>
            <ShieldCheck /> Validate the Layers
          </button>
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
            <button className="session-log-trigger" onClick={() => setSessionLogOpen(true)} title="Open this project's action history">
              <File /> Session Log
            </button>
          </footer>
        </aside>
      </section>
      {projectsOpen && (
        <div className="project-modal" role="dialog" aria-modal="true" aria-label="My Projects">
          <div className="project-dialog">
            <header>
              <div>
                <b>My Projects</b>
                <small>{projectsLoading ? "Loading your saved work…" : `${projects.length} saved ${projects.length === 1 ? "project" : "projects"}`}</small>
              </div>
              <button onClick={() => setProjectsOpen(false)} aria-label="Close">
                <X />
              </button>
            </header>
            <div className="project-save-toolbar">
              <label>
                <span>{saveAsMode ? "Name for the new copy" : "Current project name"}</span>
                <input value={projectName} maxLength={80} onChange={(e) => setProjectName(e.target.value)} />
              </label>
              <button onClick={() => void saveProject(false, undefined, undefined, false)}>
                <Download /> Save Project
              </button>
              <button
                className={saveAsMode ? "active" : ""}
                onClick={() => {
                  if (saveAsMode) void saveProject(true, undefined, undefined, false);
                  else {
                    setSaveAsMode(true);
                    setProjectName(currentProjectId ? `${projectName} Copy` : projectName);
                  }
                }}
              >
                <Copy /> {saveAsMode ? "Confirm Save As" : "Save As Project"}
              </button>
            </div>
            <div className="project-list">
              {projectsLoading ? (
                <div className="projects-loading">
                  <i />
                  <b>Loading your projects…</b>
                  <span>Your saved projects are safe while we sync them.</span>
                </div>
              ) : projects.length ? (
                projects.map((project) => {
                  const expanded = expandedProjectId === project.id;
                  return (
                    <article key={project.id} className={`project-card ${project.id === currentProjectId ? "current" : ""} ${expanded ? "expanded" : ""}`}>
                      <div className="project-row">
                        <button className="project-summary" onClick={() => setExpandedProjectId((value) => (value === project.id ? null : project.id))}>
                          <span className="project-composite-thumb">{project.data.thumbnail ? <img src={project.data.thumbnail} alt="" /> : <FolderOpen />}</span>
                          <span className="project-summary-copy">
                            <b>{project.name}</b>
                            <small>Updated {new Date(project.updated_at).toLocaleString()}</small>
                            <em>
                              {project.data.layers?.length || 0} layers · {formatProjectSize(project)}
                            </em>
                          </span>
                          <ChevronDown />
                        </button>
                        <div className="project-quick-actions">
                          <button className="open" onClick={() => requestOpenProject(project)} title="Open project">
                            <FolderOpen />
                          </button>
                          <button onClick={() => setPendingOverwriteProject(project)} title="Overwrite with current">
                            <Replace />
                          </button>
                          <button className="delete" onClick={() => void deleteProject(project.id)} title="Delete project">
                            <Trash2 />
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="project-details">
                          <div className="project-layer-thumbs">
                            {(project.data.layers || []).slice(0, 12).map((layer) => (
                              <span key={layer.id} title={layer.name}>
                                <img src={layer.src} alt={layer.name} />
                              </span>
                            ))}
                            {(project.data.layers?.length || 0) > 12 && <b>+{project.data.layers.length - 12}</b>}
                          </div>
                          <div className="project-card-actions">
                            <button className="open-saved-project" onClick={() => requestOpenProject(project)}>
                              <FolderOpen /> Open Project
                            </button>
                            <button onClick={() => setPendingOverwriteProject(project)}>
                              <Replace /> Overwrite with Current
                            </button>
                            <button className="project-delete" onClick={() => void deleteProject(project.id)} title="Delete project">
                              <Trash2 /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              ) : (
                <div className="projects-empty">
                  <FolderOpen />
                  <b>No saved projects yet</b>
                  <span>Save your current canvas to see it here.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {saveStatus && (
        <div className={`saved-confirmation ${saveStatus}`} role="status">
          {saveStatus === "saved" ? <Check /> : <i />}
          <span>
            <b>{saveStatus === "saving" ? "Saving project…" : "Project saved"}</b>
            <small>{saveStatus === "saving" ? "Uploading safely in the background" : `${projectName} · just now`}</small>
          </span>
          {savedCountdown !== null && <strong>{savedCountdown}…</strong>}
          <button
            onClick={() => {
              saveToastDismissed.current = true;
              setSaveStatus(null);
              setSavedCountdown(null);
            }}
          >
            OK
          </button>
        </div>
      )}
      {pendingOpenProject && (
        <div className="project-transition-modal" role="dialog" aria-modal="true">
          <div>
            <button className="modal-x" onClick={() => setPendingOpenProject(null)}>
              <X />
            </button>
            <AlertTriangle />
            <h3>Save changes before opening another project?</h3>
            <p>
              <b>{projectName}</b> contains changes that have not been saved yet.
            </p>
            <footer>
              <button onClick={() => setPendingOpenProject(null)}>Cancel</button>
              <button className="discard" onClick={discardAndContinue}>
                Open without saving
              </button>
              <button className="confirm" onClick={() => void saveAndContinue()}>
                Save &amp; Open
              </button>
            </footer>
          </div>
        </div>
      )}
      {pendingNewProject && (
        <div className="project-transition-modal" role="dialog" aria-modal="true">
          <div>
            <button className="modal-x" onClick={() => setPendingNewProject(false)}>
              <X />
            </button>
            <AlertTriangle />
            <h3>Start a new project?</h3>
            <p>
              <b>{projectName}</b> will close and a new blank project will open.
            </p>
            <footer>
              {projectDirty ? (
                <button className="confirm" onClick={() => void saveAndContinue()}>
                  Save &amp; New
                </button>
              ) : (
                <button disabled>
                  <Check /> Saved
                </button>
              )}
              <button
                onClick={() => {
                  setPendingNewProject(false);
                  setSaveAsMode(true);
                  setProjectName(currentProjectId ? `${projectName} Copy` : projectName);
                  setProjectsOpen(true);
                }}
              >
                <Copy /> Save As
              </button>
              <button
                className="confirm"
                onClick={() => {
                  setPendingNewProject(false);
                  createNewProject();
                }}
              >
                OK
              </button>
            </footer>
          </div>
        </div>
      )}
      {pendingOverwriteProject && (
        <div className="project-transition-modal" role="dialog" aria-modal="true">
          <div>
            <button className="modal-x" onClick={() => setPendingOverwriteProject(null)}>
              <X />
            </button>
            <AlertTriangle />
            <h3>Overwrite “{pendingOverwriteProject.name}”?</h3>
            <p>Its saved canvas will be replaced with the layers currently open in the editor.</p>
            <footer>
              <button onClick={() => setPendingOverwriteProject(null)}>Cancel</button>
              <button
                className="confirm"
                onClick={async () => {
                  const target = pendingOverwriteProject;
                  setPendingOverwriteProject(null);
                  await saveProject(false, target.id, target.name, false);
                }}
              >
                Overwrite Project
              </button>
            </footer>
          </div>
        </div>
      )}
      {accountOpen && (
        <>
          <button className="account-dismiss" aria-label="Close account" onClick={() => setAccountOpen(false)} />
          <div className="account-panel" role="dialog" aria-label="My Account">
            <button className="account-close" onClick={() => setAccountOpen(false)} aria-label="Close">
              <X />
            </button>
            <span className="account-avatar">{session?.user.user_metadata?.avatar_url || session?.user.user_metadata?.picture ? <img src={session.user.user_metadata.avatar_url || session.user.user_metadata.picture} alt="Google profile" /> : <User />}</span>
            <b>My Account</b>
            <small>Signed in as</small>
            <p>{session?.user.email || "Unknown account"}</p>
            <div className="account-stat">
              <FolderOpen />
              <span>
                <b>{projects.length}</b>
                <small>Saved projects</small>
              </span>
            </div>
            <button className="sign-out" onClick={() => void supabase.auth.signOut()}>
              <LogOut /> Sign Out
            </button>
          </div>
        </>
      )}
      {clipEditor &&
        (() => {
          const target = layers.find((layer) => layer.id === clipEditor.layerId);
          return (
            <div className="clip-modal" role="dialog" aria-modal="true" aria-label="Image in Shape">
              <div className="clip-dialog">
                <header>
                  <div>
                    <b>Image in Shape</b>
                    <small>Drag the image to position it inside the shape.</small>
                  </div>
                  <button onClick={() => setClipEditor(null)}>
                    <X />
                  </button>
                </header>
                <div className="clip-body">
                  <div className="clip-preview">
                    <div
                      className="clip-mask"
                      style={
                        {
                          aspectRatio: `${target?.w || 1}/${target?.h || 1}`,
                          WebkitMaskImage: `url("${clipEditor.maskSrc}")`,
                          maskImage: `url("${clipEditor.maskSrc}")`,
                        } as React.CSSProperties
                      }
                      onPointerDown={startClipDrag}
                      onPointerMove={moveClipDrag}
                      onPointerUp={endClipDrag}
                      onPointerCancel={endClipDrag}
                    >
                      <img
                        src={clipEditor.imageSrc}
                        alt="Image placement preview"
                        draggable={false}
                        style={{
                          transform: `translate(${clipEditor.offsetX * 100}%,${clipEditor.offsetY * 100}%) scale(${clipEditor.scale})`,
                        }}
                      />
                    </div>
                  </div>
                  <aside>
                    <label>
                      Image Scale <b>{Math.round(clipEditor.scale * 100)}%</b>
                    </label>
                    <input type="range" min=".35" max="4" step=".01" value={clipEditor.scale} onChange={(e) => setClipEditor({ ...clipEditor, scale: +e.target.value })} />
                    <button
                      onClick={() =>
                        setClipEditor({
                          ...clipEditor,
                          scale: 1,
                          offsetX: 0,
                          offsetY: 0,
                        })
                      }
                    >
                      <Crosshair /> Reset Position
                    </button>
                    <p>The shape remains the cutting boundary. The image cannot render outside it.</p>
                  </aside>
                </div>
                <footer>
                  <button className="cancel" onClick={() => setClipEditor(null)}>
                    Cancel
                  </button>
                  <button className="confirm" onClick={() => void applyClipImage()}>
                    Apply Image
                  </button>
                </footer>
              </div>
            </div>
          );
        })()}
      {cutoutMenuOpen && (
        <div className="preset-modal cutout-choice-modal" role="dialog" aria-modal="true" aria-label="Make Cutout" onPointerDown={() => setCutoutMenuOpen(false)}>
          <div className="preset-dialog" onPointerDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                <b>Make Cutout</b>
                <small>Choose how much contour detail your project needs.</small>
              </div>
              <button onClick={() => setCutoutMenuOpen(false)}>
                <X />
              </button>
            </header>
            <div className="cutout-preset-grid">
              <button onClick={() => void smoothCutoutV4(true)}>
                <span>
                  <img src="/cutout-presets/smooth.png" alt="Smooth cutout preview" />
                </span>
                <b>Smooth Cutout</b>
                <small>Cleaner curves and fewer blade movements</small>
              </button>
              <button onClick={() => void smoothCutoutV4(false)}>
                <span>
                  <img src="/cutout-presets/detailed.png" alt="Detailed cutout preview" />
                </span>
                <b>Detailed Cutout</b>
                <small>Preserves more of the original contour</small>
              </button>
            </div>
            <button className="advanced-preset" disabled={picked.length !== 1} onClick={() => void smoothCutoutV4(false, true)}>
              <i>
                <SlidersHorizontal />
              </i>
              <span>
                <b>Advanced Cutout Edit</b>
                <small>{picked.length === 1 ? "Create the detailed cutout and open its editing tools" : "Select one image to continue into the editor"}</small>
              </span>
            </button>
          </div>
        </div>
      )}
      {addNewOpen && (
        <div className="preset-modal add-new-modal" role="dialog" aria-modal="true" aria-label="Add New" onPointerDown={() => setAddNewOpen(false)}>
          <div className="add-new-dialog" onPointerDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                {createImageMode && <button className="add-new-back" onClick={() => setCreateImageMode(createImageMode === "choose" ? null : "choose")} aria-label="Back">←</button>}
                <span>
                  <b>{createImageMode === "text" ? "Cake topper as text" : createImageMode === "image" ? "Cake topper as image" : createImageMode === "choose" ? "Create your own image" : "Add New"}</b>
                  <small>{createImageMode === "text" || createImageMode === "image" ? "Design the artwork you want to create." : createImageMode === "choose" ? "Choose the kind of cake topper you want to make." : "Choose how you want to add artwork to your project."}</small>
                </span>
              </div>
              <button className="add-new-close" onClick={() => setAddNewOpen(false)} aria-label="Close"><X /></button>
            </header>
            {!createImageMode ? (
              <div className="add-new-source-grid">
                <button onClick={() => setCreateImageMode("choose")}>
                  <i><Sparkles /></i><b>Create your own image</b><small>Start with AI-ready cake topper options</small>
                </button>
                <button onClick={() => { setAddNewOpen(false); fileRef.current?.click(); }}>
                  <i><ImagePlus /></i><b>Upload from your computer</b><small>JPG, PNG, SVG or WebP</small>
                </button>
              </div>
            ) : createImageMode === "choose" ? (
              <div className="add-new-source-grid create-kind-grid">
                <button onClick={() => setCreateImageMode("text")}>
                  <img src="/create-examples/happy-birthday-sophia.png" alt="Cake topper as text example" /><b>Cake topper as text</b><small>Create a topper from names and celebration text</small>
                </button>
                <button onClick={() => setCreateImageMode("image")}>
                  <img src="/create-examples/cake-topper-animals-balloons.png" alt="Cake topper as image example" /><b>Cake topper as image</b><small>Create characters, objects and decorative artwork</small>
                </button>
              </div>
            ) : createImageMode === "text" ? (
              <div className="create-studio text-studio">
              <div className="create-art-form">
                <div className="create-mode-switch">
                  <button className="active" onClick={() => setCreateImageMode("text")}><Type />Cake topper as text</button>
                  <button onClick={() => setCreateImageMode("image")}><ImageIcon />Cake topper as image</button>
                </div>
                <div className="text-compose-row">
                  <div className="text-compose-fields">
                    <div className="text-line-inputs">
                      {Array.from({length:textLineCount},(_,index)=><label key={index}>Line {index+1}<input value={textLines[index]} placeholder={textPlaceholders(textLineCount)[index]} onChange={(e)=>setTextLines((lines)=>lines.map((line,lineIndex)=>lineIndex===index?e.target.value:line))}/></label>)}
                    </div>
                    <small className="effective-lines">{activeTextLines.length || textLineCount} line{(activeTextLines.length || textLineCount) === 1 ? "" : "s"} will be generated{activeTextLines.length < textLineCount && activeTextLines.length > 0 ? " — empty lines are ignored" : ""}.</small>
                  </div>
                  <div className="text-reference"><label className="line-count-label">Number of lines<input type="number" min="1" max="4" step="1" value={textLineCount} onChange={(e)=>setTextLineCount(clamp(Math.round(+e.target.value),1,4) as 1|2|3|4)}/></label><figure><img src="/create-examples/text-black/black-happy-birthday-sophia-v1-mixed.png" alt="Happy Birthday Sophia cake topper example" /></figure></div>
                </div>
                <section><b>Fonts</b><div className="visual-option-grid three font-option-grid">
                  {TEXT_FONT_OPTIONS.map(([value,label,src],index) => <button key={value} className={textFontStyle===value?'active':''} onClick={()=>{setTextFontStyle(value);setOptionGallery({kind:"font",index})}}><img src={src} alt={label}/><span>{label}<Maximize2 /></span></button>)}
                </div></section>
                <section className="letter-details-section">
                  <button className="optional-prompt-toggle" onClick={()=>setTextDetailsOpen((open)=>!open)}><span><b>Extra Prompt</b><small>Optional instructions for decorative lettering</small></span><ChevronDown className={textDetailsOpen?"open":""}/></button>
                  {textDetailsOpen&&<label>Extra Prompt<textarea value={textExtraPrompt} onChange={(e)=>setTextExtraPrompt(e.target.value)} placeholder="For example: Add a small heart above the S, or extend the tail of the final a." maxLength={240}/><small>{textExtraPrompt.length}/240 · Describe letter details only; the line text above stays unchanged.</small></label>}
                </section>
                <div className="text-create-actions">
                  <button className="change-fonts" disabled={!hasGeneratedText || Boolean(generationBusy)} onClick={()=>void generateArtwork("text",true)}><Replace /> Change fonts</button>
                  <button className="create-soon enabled" disabled={Boolean(generationBusy)} onClick={()=>void generateArtwork("text")}><Sparkles /> {generationBusy === "text" ? "Creating…" : "Create Text Image"}</button>
                </div>
              </div>
              <GeneratedRail images={generatedTextImages} onOpen={setGeneratedPreview}/>
              </div>
            ) : (
              <div className="create-studio image-studio">
              <div className="create-art-form">
                <div className="create-mode-switch">
                  <button onClick={() => setCreateImageMode("text")}><Type />Cake topper as text</button>
                  <button className="active" onClick={() => setCreateImageMode("image")}><ImageIcon />Cake topper as image</button>
                </div>
                <div className="prompt-example-row"><label>Describe the image you want<input type="text" value={imagePrompt} onChange={(event)=>setImagePrompt(event.target.value)} placeholder="Cute giraffe with birthday hat" maxLength={500}/></label><figure><img src="/create-examples/cake-topper-animals-balloons.png" alt="Cute animals and balloons cake topper example" /></figure></div>
                <section><b>Style</b><div className={`style-choice-grid ${whiteStickerOffset ? "sticker-preview" : ""}`}>
                  {IMAGE_STYLE_OPTIONS.map(([value,label,src],index) => <button key={value} className={imageArtStyle === value ? "active" : ""} onClick={() => {setImageArtStyle(value);setOptionGallery({kind:"style",index})}}><img src={src} alt={label}/><span>{label}<Maximize2 /></span></button>)}
                </div></section>
                <label className="sticker-toggle"><input type="checkbox" checked={whiteStickerOffset} onChange={(e)=>setWhiteStickerOffset(e.target.checked)}/><span/><b>White sticker offset</b><small>Add a clean white label border around the artwork</small></label>
                <button className="create-soon enabled" disabled={Boolean(generationBusy)} onClick={()=>void generateArtwork("image")}><Sparkles /> {generationBusy === "image" ? "Creating…" : "Create Image"}</button>
              </div>
              <GeneratedRail images={generatedArtImages} onOpen={setGeneratedPreview}/>
              </div>
            )}
          </div>
          {optionGallery&&(()=>{const options=optionGallery.kind==="font"?TEXT_FONT_OPTIONS:IMAGE_STYLE_OPTIONS,current=options[optionGallery.index],previous=(optionGallery.index-1+options.length)%options.length,next=(optionGallery.index+1)%options.length;return <div className={`option-gallery ${whiteStickerOffset && optionGallery.kind === "style" ? "sticker-preview" : ""}`} onPointerDown={()=>setOptionGallery(null)}><div onPointerDown={(e)=>e.stopPropagation()}><button className="gallery-close" onClick={()=>setOptionGallery(null)}><X/></button><button className="gallery-arrow previous" onClick={()=>setOptionGallery({...optionGallery,index:previous})} aria-label="Previous option">←</button><figure><img src={current[2]} alt={current[1]}/><figcaption><b>{current[1]}</b><small>{optionGallery.index+1} of {options.length}</small></figcaption></figure><button className="gallery-arrow next" onClick={()=>setOptionGallery({...optionGallery,index:next})} aria-label="Next option">→</button><button className={`gallery-use ${optionGallery.kind}`} onClick={()=>{if(optionGallery.kind==="font")setTextFontStyle(current[0] as "mixed"|"cursive"|"serif");else setImageArtStyle(current[0] as "watercolor"|"cartoon"|"baby"|"girly"|"storybook"|"paper-cut");setOptionGallery(null)}}>Use this {optionGallery.kind}</button></div></div>})()}
          {generatedPreview && <div className={`generated-lightbox ${createImageMode === "text" ? "text-result" : "image-result"}`} onPointerDown={(e)=>{e.stopPropagation();setGeneratedPreview(null)}}><div onPointerDown={(e)=>e.stopPropagation()}><button className="add-new-close" onClick={()=>setGeneratedPreview(null)}><X/></button><img src={generatedPreview} alt="Generated cake topper preview"/><button className="add-generated" onClick={()=>void addGeneratedAsset(generatedPreview)}><Plus/>Add to Page</button></div></div>}
        </div>
      )}
      {splashOpen && <div className="welcome-splash" role="dialog" aria-modal="true" aria-label="Welcome to Cake Topper Maker" onPointerDown={dismissSplash}>
        <div onPointerDown={(event)=>event.stopPropagation()}>
          <button className="welcome-close" onClick={dismissSplash} aria-label="Close welcome screen"><X/></button>
          <div className="welcome-mark"><Sparkles/></div>
          <h1>Welcome to Cake Topper Maker</h1>
          <p>Everything you need to turn an idea into a Cricut-ready design.</p>
          <div className="welcome-steps">
            <article><span>1</span><b>Generate or bring your own image</b></article>
            <article><span>2</span><b>Edit and make them best for Cricut</b></article>
            <article><span>3</span><b>Download ready to use images in Cricut projects</b></article>
          </div>
          <button className="welcome-start" onClick={dismissSplash}>Start Now</button>
          <label className="welcome-hide"><input type="checkbox" checked={hideSplashOnStartup} onChange={(event)=>setHideSplashOnStartup(event.target.checked)}/> Don&apos;t show this on Startup</label>
        </div>
      </div>}
      {bgMenuOpen && (
        <div className="preset-modal" role="dialog" aria-modal="true" aria-label="Remove Background" onPointerDown={() => setBgMenuOpen(false)}>
          <div className="preset-dialog" onPointerDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                <b>Remove Background</b>
                <small>Choose the result you need for this image.</small>
              </div>
              <button onClick={() => setBgMenuOpen(false)} aria-label="Close">
                <X />
              </button>
            </header>
            <div className="preset-grid">
              <button onClick={() => void applyBackgroundPreset("image")}>
                <span className="preset-image">
                  <img src="/background-presets/image-default.png" alt="Default image background removal preview" />
                </span>
                <span>
                  <b>Image Remove Background</b>
                  <small>Default</small>
                </span>
              </button>
              <button onClick={() => void applyBackgroundPreset("rim")}>
                <span className="preset-image">
                  <img src="/background-presets/image-rim.png" alt="Image background removal with rim preview" />
                </span>
                <span>
                  <b>Image Remove Background</b>
                  <small>Add Rim</small>
                </span>
              </button>
              <button onClick={() => void applyBackgroundPreset("text")}>
                <span className="preset-image">
                  <img src="/background-presets/text-bw.png" alt="Black and white text background removal preview" />
                </span>
                <span>
                  <b>Text Remove Background</b>
                  <small>Black and White</small>
                </span>
              </button>
            </div>
            <button
              className="advanced-preset"
              onClick={() => {
                setBgMenuOpen(false);
                noBackground();
              }}
            >
              <i>
                <SlidersHorizontal />
              </i>
              <span>
                <b>Advanced Background Removal</b>
                <small>Open the full control panel</small>
              </span>
            </button>
          </div>
        </div>
      )}
      {validationIntroOpen && (
        <div className="project-transition-modal validation-intro-modal" role="dialog" aria-modal="true" aria-label="Validate the Layers">
          <div>
            <button className="modal-x" onClick={() => setValidationIntroOpen(false)}><X /></button>
            <ShieldCheck />
            <h3>Validate the Layers</h3>
            <p>We will now check your cutout layers. Areas with cut lines closer than 1 mm, extremely small islands, or enclosed gaps smaller than 1 mm will be marked as a warning on the layer and during SVG export.</p>
            <p>This is guidance, not a block. If the design looks intentional, you can continue. During Cricut cutting, make especially sure that your material is firmly attached to the Cricut mat because very small pieces and nearby cut lines can lift or shift.</p>
            <footer>
              <button onClick={() => setValidationIntroOpen(false)}>Not now</button>
              <button className="confirm" onClick={() => void validateLayers()}><ShieldCheck /> Start validation</button>
            </footer>
          </div>
        </div>
      )}
      {svgWarningOpen && (
        <div className="project-transition-modal cut-safety-modal" role="dialog" aria-modal="true">
          <div>
            <button className="modal-x" onClick={() => setSvgWarningOpen(false)}>
              <X />
            </button>
            <AlertTriangle />
            <h3>Layer validation note</h3>
            <p>Your optional layer validation found details smaller than 1 mm. Very small islands or nearby cut lines may move while Cricut is cutting.</p>
            <footer>
              <button onClick={() => setSvgWarningOpen(false)}>Review layers</button>
              <button
                className="confirm"
                onClick={() => {
                  setSvgWarningOpen(false);
                  void exportSVG(true);
                }}
              >
                Continue and export SVG
              </button>
            </footer>
          </div>
        </div>
      )}
      {riskLayerId &&
        (() => {
          const risk = layers.find((layer) => layer.id === riskLayerId);
          if (!risk) return null;
          const cutout = ["vector", "stroke"].includes(risk.kind);
          return (
            <div className="project-transition-modal cut-safety-modal" role="dialog" aria-modal="true">
              <div>
                <button className="modal-x" onClick={() => setRiskLayerId(null)}>
                  <X />
                </button>
                <AlertTriangle />
                <h3>Cut safety issue</h3>
                <div className="cut-risk-preview">
                  <img src={risk.src} alt={`${risk.name} cutout`} />
                  {risk.cutRiskOverlay && <img className="cut-risk-overlay" src={risk.cutRiskOverlay} alt="Highlighted areas that may be difficult to cut" />}
                </div>
                <p>
                  <b>The detected measurements are listed below.</b>
                  <br />
                  {risk.cutRiskReason || "This layer contains details smaller than 1 mm."}
                  <br />
                  <small>Quick Fix widens the outside contour by 1.1 mm, smooths it, and then measures it again. If a warning remains, the message will show what still needs manual editing.</small>
                </p>
                <footer>
                  <button onClick={() => setRiskLayerId(null)}>Cancel</button>
                  <button
                    onClick={() => {
                      setRiskLayerId(null);
                      setSelected([risk.id]);
                      window.setTimeout(() => (cutout ? openCutoutEditor(risk) : openImageEditor(risk)), 0);
                    }}
                  >
                    {cutout ? "Edit Cutout" : "Edit Image"}
                  </button>
                  <button className="confirm" onClick={() => (cutout ? void quickFixCutRisk() : void quickFixRasterRisk(risk))}>
                    <Sparkles /> {cutout ? "Quick Fix" : risk.steps.some(step=>step.type==="remove-bg"&&/rim/i.test(step.label))?"Quick Fix: Clean Alpha":"Quick Fix: Add Rim"}
                  </button>
                </footer>
              </div>
            </div>
          );
        })()}
      {calibrationOpen && (
        <div className="calibration-modal" role="dialog" aria-modal="true" aria-label="Screen size calibration">
          <div className="calibration-dialog">
            <header>
              <div>
                <b>Calibrate Screen Size</b>
                <small>Place a physical ruler against the screen and match its 10 cm length.</small>
              </div>
              <button onClick={() => setCalibrationOpen(false)}>
                <X />
              </button>
            </header>
            <div className="calibration-body">
              <div className="screen-ruler" style={{ width: 10 * PPCM * calibrationDraft }}>
                {Array.from({ length: 101 }, (_, i) => (
                  <i key={i} className={i % 10 === 0 ? "cm" : i % 5 === 0 ? "half" : "mm"} style={{ left: `${i}%` }}>
                    {i % 10 === 0 && <span>{i / 10}</span>}
                  </i>
                ))}
              </div>
              <div className="calibration-slider">
                <span>Shorter</span>
                <button onClick={() => setCalibrationDraft((v) => clamp(+(v - 0.001).toFixed(3), 0.5, 2))}>←</button>
                <input type="range" min=".5" max="2" step=".001" value={calibrationDraft} onChange={(e) => setCalibrationDraft(+e.target.value)} />
                <button onClick={() => setCalibrationDraft((v) => clamp(+(v + 0.001).toFixed(3), 0.5, 2))}>→</button>
                <span>Longer</span>
              </div>
              <p>Calibration: {(calibrationDraft * 100).toFixed(1)}%</p>
            </div>
            <footer>
              <button onClick={() => setCalibrationOpen(false)}>Cancel</button>
              <button
                className="confirm"
                onClick={() => {
                  setCalibration(calibrationDraft);
                  setZoom(1);
                  localStorage.setItem("better-cricut-screen-calibration", String(calibrationDraft));
                  setCalibrationOpen(false);
                  window.setTimeout(centerDocument, 30);
                  setNotice("Screen calibration saved at true 100% size");
                }}
              >
                Save Calibration
              </button>
            </footer>
          </div>
        </div>
      )}
      {notice && <div className="toast">{notice}</div>}
      {imageEditor &&
        (() => {
          const target = layers.find((l) => l.id === imageEditor.layerId);
          return (
            <div className="bg-modal image-edit-modal" role="dialog" aria-modal="true" aria-label="Image editor">
              <div className="bg-dialog">
                <header>
                  <div className="image-editor-title">
                    <b>Edit Image</b>
                    <small>Crop, erase or refine the image background.</small>
                  </div>
                  {bgEditor && (
                    <div className="refine-quick-tools image-refine-tools">
                      <button
                        title="Undo"
                        disabled={imageTab === "edit" ? !imageEditor.history.length : !bgEditor.strokes.length}
                        onClick={() =>
                          imageTab === "edit"
                            ? undoImageStage()
                            : setBgEditor({
                                ...bgEditor,
                                strokes: bgEditor.strokes.slice(0, -1),
                              })
                        }
                      >
                        <Undo2 />
                        <span>Undo</span>
                      </button>
                      <button title="Reset" onClick={() => (imageTab === "edit" ? resetImageStage() : noBackground(target))}>
                        <RotateCw />
                        <span>Reset</span>
                      </button>
                      <label title="Show alpha mask">
                        <input
                          type="checkbox"
                          checked={bgEditor.alphaView}
                          onChange={(e) =>
                            setBgEditor({
                              ...bgEditor,
                              alphaView: e.target.checked,
                            })
                          }
                        />
                        <Eye />
                        <span>Alpha</span>
                      </label>
                      <button
                        title="Optimize alpha"
                        className={bgEditor.optimizeAlpha ? "active optimize-alpha" : "optimize-alpha"}
                        onClick={() =>
                          setBgEditor({
                            ...bgEditor,
                            optimizeAlpha: !bgEditor.optimizeAlpha,
                          })
                        }
                      >
                        <Sparkles />
                        <span>Optimize Alpha</span>
                      </button>
                    </div>
                  )}
                  <button
                    className="image-editor-close"
                    onClick={() => {
                      setImageEditor(null);
                      setBgEditor(null);
                    }}
                  >
                    <X />
                  </button>
                </header>
                <div className="cutout-tabs image-tabs">
                  <button className={imageTab === "edit" ? "active" : ""} onClick={() => setImageTab("edit")}>
                    1. Edit Image
                  </button>
                  <button className={imageTab === "background" ? "active" : ""} onClick={() => void enterAdvancedBackground()}>
                    2. Advanced Background Removal
                  </button>
                  <button className={imageTab === "preset" ? "active" : ""} onClick={() => setImageTab("preset")}>
                    3. Apply Preset
                  </button>
                </div>
                {imageTab === "edit" ? (
                  <>
                    <div className="bg-editor-body">
                      <div className="bg-preview image-edit-preview" onWheel={zoomImageEditor} onPointerDown={startImagePan} onPointerMove={moveImagePan} onPointerUp={endImagePan} onPointerCancel={endImagePan}>
                        <div
                          className="image-edit-wrap"
                          style={
                            {
                              "--fit-w": imageEditorSize.w ? `${imageEditorSize.w}px` : "auto",
                              "--fit-h": imageEditorSize.h ? `${imageEditorSize.h}px` : "auto",
                              transform: `translate(${imageEditor.panX}px,${imageEditor.panY}px) scale(${imageEditor.zoom})`,
                            } as React.CSSProperties
                          }
                        >
                          <img className={`image-tool-${imageEditor.tool}`} src={imageEditor.source} draggable={false} alt="Image edit preview" onLoad={(e) => setImageEditorSize(fitEditorImage(e.currentTarget, e.currentTarget.closest(".bg-preview") as HTMLDivElement))} onPointerDown={startImageEdit} onPointerMove={moveImageEdit} onPointerUp={endImageEdit} onPointerCancel={endImageEdit} />
                          <svg className="image-edit-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {imageEditor.strokes.map((s) => {
                              const pts = s.points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
                              return s.tool === "lasso" ? <polygon key={s.id} points={pts} className="image-lasso-mark" /> : <polyline key={s.id} points={pts} className="image-erase-mark" style={{ strokeWidth: s.brush }} />;
                            })}
                          </svg>
                          {imageEditor.tool === "crop" && (
                            <div
                              className="crop-guide"
                              style={{
                                left: `${imageEditor.crop.left}%`,
                                top: `${imageEditor.crop.top}%`,
                                right: `${imageEditor.crop.right}%`,
                                bottom: `${imageEditor.crop.bottom}%`,
                              }}
                            >
                              {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => (
                                <button key={h} className={`crop-handle crop-${h}`} onPointerDown={(e) => startImageCrop(e, h)} onPointerMove={moveImageCrop} onPointerUp={endImageCrop} onPointerCancel={endImageCrop} />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="bg-zoom-controls">
                          <button
                            onClick={() =>
                              setImageEditor({
                                ...imageEditor,
                                zoom: clamp(imageEditor.zoom / 1.2, 0.5, 5),
                              })
                            }
                          >
                            −
                          </button>
                          <span>{Math.round(imageEditor.zoom * 100)}%</span>
                          <button
                            onClick={() =>
                              setImageEditor({
                                ...imageEditor,
                                zoom: clamp(imageEditor.zoom * 1.2, 0.5, 5),
                              })
                            }
                          >
                            +
                          </button>
                          <button
                            onClick={() =>
                              setImageEditor({
                                ...imageEditor,
                                zoom: 1,
                                panX: 0,
                                panY: 0,
                              })
                            }
                          >
                            Fit
                          </button>
                        </div>
                      </div>
                      <aside className="bg-controls image-controls">
                        <section>
                          <label>Edit Tool</label>
                          <div className="image-tool-buttons">
                            {(["crop", "erase", "lasso"] as ImageEditTool[]).map((tool) => (
                              <button key={tool} className={imageEditor.tool === tool ? "active" : ""} onClick={() => setImageEditor({ ...imageEditor, tool })}>
                                {tool === "crop" ? <Maximize2 /> : tool === "erase" ? <Trash2 /> : <Scissors />}
                                <span>{tool === "lasso" ? "Lasso Erase" : tool[0].toUpperCase() + tool.slice(1)}</span>
                              </button>
                            ))}
                          </div>
                          <small>Crop with the handles on the image. Drag outward to expand the canvas.</small>
                        </section>
                        {imageEditor.tool === "erase" && (
                          <section>
                            <label>
                              Brush Size <b>{imageEditor.brush}%</b>
                            </label>
                            <input
                              type="range"
                              min=".5"
                              max="35"
                              step=".5"
                              value={imageEditor.brush}
                              onChange={(e) =>
                                setImageEditor({
                                  ...imageEditor,
                                  brush: +e.target.value,
                                })
                              }
                            />
                          </section>
                        )}
                        <section>
                          <label>Resolution</label>
                          <b>
                            {target?.naturalW || 0} × {target?.naturalH || 0} px
                          </b>
                          <small>
                            Output: {Math.round((target?.naturalW || 0) * (1 - (imageEditor.crop.left + imageEditor.crop.right) / 100) * imageEditor.upscale)} × {Math.round((target?.naturalH || 0) * (1 - (imageEditor.crop.top + imageEditor.crop.bottom) / 100) * imageEditor.upscale)} px
                          </small>
                        </section>
                        <section>
                          <label>Upscale</label>
                          <div className="mode-buttons">
                            {([1, 2, 3] as const).map((n) => (
                              <button key={n} className={imageEditor.upscale === n ? "active keep" : ""} onClick={() => setImageEditor({ ...imageEditor, upscale: n })}>
                                {n}×
                              </button>
                            ))}
                          </div>
                          <small>High-quality resampling preserves hard corners and smooth curves; it does not invent missing detail.</small>
                        </section>
                      </aside>
                    </div>
                    <footer>
                      <button className="footer-separate" onClick={() => void separateCurrentImage()}>
                        <Layers3 /> Separate as Layers
                      </button>
                      <span className="editor-undo-hint">Ctrl+Z to undo</span>
                      <button className="image-undo" disabled={!imageEditor.history.length} onClick={undoImageStage}>
                        <Undo2 /> Undo
                      </button>
                      <button
                        className="cancel"
                        onClick={() => {
                          setImageEditor(null);
                          setBgEditor(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button className="secondary-create" onClick={() => void applyImageEdit(true)}>
                        Create Layer
                      </button>
                      <button className="confirm" onClick={() => void applyImageEdit(false)}>
                        Save Edit
                      </button>
                    </footer>
                  </>
                ) : imageTab === "preset" ? (
                  <>
                    <div className="image-preset-body">
                      <div className="image-preset-summary">
                        <div className="image-preset-preview-wrap">
                          <img src={imageEditor.source} alt="Current edited image preview" draggable={false} />
                        </div>
                        <small>The selected preset will be applied to this edited image.</small>
                      </div>
                      <aside className="image-preset-list">
                        {(
                          [
                            {
                              id: "image",
                              image: "/background-presets/image-default.png",
                              title: "Image Remove Background",
                              sub: "Default",
                            },
                            {
                              id: "rim",
                              image: "/background-presets/image-rim.png",
                              title: "Image Remove Background",
                              sub: "Add Rim",
                            },
                            {
                              id: "text",
                              image: "/background-presets/text-bw.png",
                              title: "Text Remove Background",
                              sub: "Black and White",
                            },
                          ] as const
                        ).map((preset) => (
                          <button key={preset.id} className={imagePreset === preset.id ? "active" : ""} onClick={() => setImagePreset(preset.id)}>
                            <img src={preset.image} alt="" />
                            <span>
                              <b>{preset.title}</b>
                              <small>{preset.sub}</small>
                            </span>
                            <Check />
                          </button>
                        ))}
                      </aside>
                    </div>
                    <footer>
                      <span className="footer-spacer" />
                      <button className="cancel" onClick={() => setImageTab("edit")}>
                        Back
                      </button>
                      <button className="confirm" onClick={() => void applyPresetInImageEditor()}>
                        <Sparkles /> Apply Preset
                      </button>
                    </footer>
                  </>
                ) : bgEditor ? (
                  <>
                    <div className="bg-editor-body embedded-background">
                      <div ref={bgPreviewRef} className={`bg-preview ${bgEditor.alphaView ? "alpha-view" : ""}`} onWheel={zoomBackground} onPointerDown={startBackgroundPan} onPointerMove={moveBackgroundPan} onPointerUp={endBackgroundPan} onPointerCancel={endBackgroundPan}>
                        {bgPreview ? (
                          <div
                            className="bg-image-wrap"
                            style={
                              {
                                "--fit-w": bgImageSize.w ? `${bgImageSize.w}px` : "auto",
                                "--fit-h": bgImageSize.h ? `${bgImageSize.h}px` : "auto",
                                transform: `translate(${bgEditor.panX}px,${bgEditor.panY}px) scale(${bgEditor.zoom})`,
                              } as React.CSSProperties
                            }
                          >
                            <img src={bgPreview} draggable={false} alt="Background removal preview" className={bgEditor.pickingColor !== null ? "eyedrop-active" : ""} onLoad={(e) => setBgImageSize(fitEditorImage(e.currentTarget, bgPreviewRef.current))} onPointerDown={startBackgroundStroke} onPointerMove={moveBackgroundStroke} onPointerUp={endBackgroundStroke} onPointerCancel={endBackgroundStroke} />
                          </div>
                        ) : (
                          <div className="bg-loading">Preparing preview…</div>
                        )}
                      </div>
                      <aside className="bg-controls embedded-bg-controls">
                        <section>
                          <label>Connected Area with Brush</label>
                          <div className="mode-buttons">
                            <button className={bgEditor.mode === "remove" ? "active remove" : ""} onClick={() => setBgEditor({ ...bgEditor, mode: "remove" })}>
                              Remove
                            </button>
                            <button className={bgEditor.mode === "keep" ? "active keep" : ""} onClick={() => setBgEditor({ ...bgEditor, mode: "keep" })}>
                              Keep
                            </button>
                          </div>
                          <label>
                            Brush Size <b>{bgEditor.brush.toFixed(1)}%</b>
                          </label>
                          <input
                            type="range"
                            min=".1"
                            max="60"
                            step=".1"
                            value={bgEditor.brush}
                            onChange={(e) =>
                              setBgEditor({
                                ...bgEditor,
                                brush: +e.target.value,
                              })
                            }
                          />
                          <label>
                            Color Bleed <b>{bgEditor.sensitivity}</b>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={bgEditor.sensitivity}
                            onChange={(e) =>
                              setBgEditor({
                                ...bgEditor,
                                sensitivity: +e.target.value,
                              })
                            }
                          />
                          <label>
                            Connected Distance <b>{bgEditor.connectedReach >= 51 ? "Full" : `${(bgEditor.connectedReach / 10).toFixed(1)} cm`}</b>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="51"
                            value={bgEditor.connectedReach}
                            onChange={(e) =>
                              setBgEditor({
                                ...bgEditor,
                                connectedReach: +e.target.value,
                              })
                            }
                          />
                        </section>
                        <section>
                          <label>All the Color with Eyedrop</label>
                          <div className="erase-color-row">
                            <input
                              type="color"
                              value={bgEditor.eraseColors[0]?.color || "#ffffff"}
                              onChange={(e) =>
                                setBgEditor({
                                  ...bgEditor,
                                  eraseColors: [
                                    {
                                      color: e.target.value,
                                      sensitivity: bgEditor.eraseColors[0]?.sensitivity || 30,
                                    },
                                  ],
                                })
                              }
                            />
                            <button onClick={() => setBgEditor({ ...bgEditor, pickingColor: 0 })}>
                              <Pipette /> Pick
                            </button>
                          </div>
                          <label>
                            Color Sensitivity <b>{bgEditor.eraseColors[0]?.sensitivity || 30}</b>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={bgEditor.eraseColors[0]?.sensitivity || 30}
                            onChange={(e) =>
                              setBgEditor({
                                ...bgEditor,
                                eraseColors: [
                                  {
                                    color: bgEditor.eraseColors[0]?.color || null,
                                    sensitivity: +e.target.value,
                                  },
                                ],
                              })
                            }
                          />
                        </section>
                        <section>
                          <label>
                            Edge Refinement <b>{bgEditor.edgeRefine}px</b>
                          </label>
                          <input
                            type="range"
                            min="-25"
                            max="25"
                            value={bgEditor.edgeRefine}
                            onChange={(e) =>
                              setBgEditor({
                                ...bgEditor,
                                edgeRefine: +e.target.value,
                              })
                            }
                          />
                          <label>
                            Edge Smooth <b>{bgEditor.edgeSmooth}</b>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            value={bgEditor.edgeSmooth}
                            onChange={(e) =>
                              setBgEditor({
                                ...bgEditor,
                                edgeSmooth: +e.target.value,
                              })
                            }
                          />
                          <label>
                            Remove Speckles <b>{bgEditor.speckles}px</b>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1000"
                            step="5"
                            value={bgEditor.speckles}
                            onChange={(e) =>
                              setBgEditor({
                                ...bgEditor,
                                speckles: +e.target.value,
                              })
                            }
                          />
                        </section>
                      </aside>
                    </div>
                    <footer>
                      <button className="cancel" onClick={() => setImageTab("edit")}>
                        Back to Edit Image
                      </button>
                      <button className="confirm" disabled={!bgPreview || bgRendering} onClick={() => void commitBackground()}>
                        Apply Background Removal
                      </button>
                    </footer>
                  </>
                ) : null}
              </div>
            </div>
          );
        })()}
      {cutEditor && (
        <div className="bg-modal cutout-modal" role="dialog" aria-modal="true" aria-label="Cutout editor">
          <div className="bg-dialog" onPointerDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                <b>Edit Cutout</b>
                <small>Crop, remove pieces, erase details or create bridges.</small>
              </div>
              <button onClick={() => setCutEditor(null)}>×</button>
            </header>
            <div className="cutout-tabs">
              <button className={cutoutTab === "edit" ? "active" : ""} onClick={() => setCutoutTab("edit")}>
                1. Cutout Edit
              </button>
              <button className={cutoutTab === "stroke" ? "active" : ""} onClick={() => setCutoutTab("stroke")}>
                2. Fill Gaps
              </button>
            </div>
            <div className="bg-editor-body">
              <div className="bg-preview cutout-preview" ref={cutPreviewRef} onWheel={zoomCutout} onPointerDown={startCutoutPan} onPointerMove={moveCutoutPan} onPointerUp={endCutoutPan} onPointerCancel={endCutoutPan}>
                {cutPreview && (
                  <div
                    className="cut-image-wrap"
                    style={
                      {
                        "--fit-w": cutImageSize.w ? `${cutImageSize.w}px` : "auto",
                        "--fit-h": cutImageSize.h ? `${cutImageSize.h}px` : "auto",
                        "--cut-zoom": String(cutEditor.zoom),
                        transform: `translate(${cutEditor.panX}px,${cutEditor.panY}px) scale(${cutEditor.zoom})`,
                      } as React.CSSProperties
                    }
                  >
                    <img className={`cut-tool-${cutEditor.tool}`} src={cutPreview} alt="Cutout edit preview" draggable={false} onLoad={(e) => setCutImageSize(fitEditorImage(e.currentTarget, cutPreviewRef.current))} onPointerDown={startCutEdit} onPointerMove={moveCutEdit} onPointerUp={endCutEdit} onPointerCancel={endCutEdit} onPointerEnter={() => setCutCursor((v) => ({ ...v, visible: true }))} onPointerLeave={() => setCutCursor((v) => ({ ...v, visible: false }))} />
                    {cutEdgeOverlay && <img className="cut-selected-edge" src={cutEdgeOverlay} alt="" draggable={false} />}
                    <svg className="cut-edit-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline ref={cutLivePathRef} points="" className="edit-brush-stroke" style={{ strokeWidth: cutEditor.brush / Math.sqrt(Math.max(1, cutEditor.zoom)) / cutEditor.zoom }} />
                      <rect ref={cutLiveRectRef} className="eraser-selection" style={{ display: "none" }} />
                    </svg>
                    {cutCursor.visible && cutEditor.tool && ["bridge", "erase", "smooth"].includes(cutEditor.tool) && (
                      <i
                        className="cut-round-cursor"
                        ref={cutCursorRef}
                        style={{
                          left: "50%",
                          top: "50%",
                          width: `${clamp(((cutEditor.brush / Math.sqrt(Math.max(1, cutEditor.zoom)) / 100) * Math.min(cutImageSize.w, cutImageSize.h)) / cutEditor.zoom, 6 / cutEditor.zoom, 72 / cutEditor.zoom)}px`,
                          aspectRatio: "1",
                        }}
                      />
                    )}
                    {cutCropActive && (
                      <div
                        className="crop-guide"
                        style={{
                          left: `${cutEditor.crop.left}%`,
                          top: `${cutEditor.crop.top}%`,
                          right: `${cutEditor.crop.right}%`,
                          bottom: `${cutEditor.crop.bottom}%`,
                        }}
                      >
                        {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => (
                          <button key={h} className={`crop-handle crop-${h}`} onPointerDown={(e) => startCropDrag(e, h)} onPointerMove={moveCropDrag} onPointerUp={endCropDrag} onPointerCancel={endCropDrag} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="bg-zoom-controls">
                  <button
                    onClick={() =>
                      setCutEditor({
                        ...cutEditor,
                        zoom: clamp(cutEditor.zoom / 1.2, 0.5, 10),
                      })
                    }
                  >
                    −
                  </button>
                  <span>{Math.round(cutEditor.zoom * 100)}%</span>
                  <button
                    onClick={() =>
                      setCutEditor({
                        ...cutEditor,
                        zoom: clamp(cutEditor.zoom * 1.2, 0.5, 10),
                      })
                    }
                  >
                    +
                  </button>
                  <button onClick={() => setCutEditor({ ...cutEditor, zoom: 1, panX: 0, panY: 0 })}>Fit</button>
                </div>
              </div>
              <aside className="bg-controls cutout-controls">
                {cutoutTab === "edit" ? (
                  <>
                    <section>
                      <label>Edit Tool</label>
                      <div className="edit-tool-grid">
                        {(["bridge", "erase", "smooth", "lasso", "rectangle"] as EditTool[]).map((tool) => (
                          <button
                            key={tool}
                            className={`${cutEditor.tool === tool ? "active" : ""} tool-${tool}`}
                            onClick={() =>
                              setCutEditor({
                                ...cutEditor,
                                tool: cutEditor.tool === tool ? null : tool,
                              })
                            }
                          >
                            {tool === "bridge" ? <Paintbrush /> : tool === "smooth" ? <Sparkles /> : tool === "rectangle" ? <Maximize2 /> : tool === "lasso" ? <Scissors /> : <Eraser />}
                            <span>{tool === "bridge" ? "Add Brush" : tool === "erase" ? "Eraser Brush" : tool === "smooth" ? "Fix the Edges" : tool === "lasso" ? "Lasso Eraser" : tool === "rectangle" ? "Rectangle Eraser" : ""}</span>
                          </button>
                        ))}
                      </div>
                      <small>Fix the Edges smooths only the brushed contour. Its start and end preserve the surrounding trajectory.</small>
                    </section>
                    <section>
                      <label>
                        Brush Size <b>{cutEditor.brush}%</b>
                      </label>
                      <div className="brush-size-control">
                        <input type="range" min=".3" max="20" step=".1" value={cutEditor.brush} onChange={(e) => setCutEditor({ ...cutEditor, brush: +e.target.value })} />
                        <span className="brush-size-preview"><i style={{ width: `${clamp(cutEditor.brush * 1.4, 5, 34)}px`, height: `${clamp(cutEditor.brush * 1.4, 5, 34)}px` }} /></span>
                      </div>
                    </section>
                    <section>
                      <label>Crop Canvas</label>
                      <button className={cutCropActive ? "crop-mode active" : "crop-mode"} onClick={() => setCutCropActive((value) => !value)}>
                        <Maximize2 />
                        <span>{cutCropActive ? "Finish Crop" : "Crop Canvas"}</span>
                      </button>
                      <small>Drag any edge or corner, then finish crop.</small>
                    </section>
                    <div className="bg-history-actions">
                      <button
                        disabled={!cutEditor.strokes.length}
                        onClick={() => setCutEditor((value) => {
                          const removed = value?.strokes.at(-1);
                          return value && removed ? { ...value, strokes: value.strokes.slice(0, -1), redoStrokes: [...value.redoStrokes, removed] } : value;
                        })}
                      >
                        Undo Edit
                      </button>
                      <button disabled={!cutEditor.redoStrokes.length} onClick={() => setCutEditor((value) => {
                        const restored = value?.redoStrokes.at(-1);
                        return value && restored ? { ...value, strokes: [...value.strokes, restored], redoStrokes: value.redoStrokes.slice(0, -1) } : value;
                      })}>
                        Redo Edit
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="cutout-stroke-tab">
                    <section>
                      <label>
                        Fill Gaps <b>{fillGapsDraft.toFixed(fillGapsDraft < 5 ? 1 : 0)} mm²</b>
                      </label>
                      <input type="range" min="0" max="30" step={fillGapsDraft < 5 ? ".5" : "1"} value={fillGapsDraft} onChange={(e) => setFillGapsDraft(+e.target.value)} />
                      <button onClick={() => void applyGapPreview()}>Apply Fill Gaps</button>
                    </section>
                    <p>Fill Gaps removes small enclosed holes that would create unnecessary blade movements.</p>
                  </div>
                )}
              </aside>
            </div>
            <footer>
              <button className="footer-smooth" onClick={() => void smoothCutoutNow()}>
                <Sparkles /> Smooth
              </button>
              <span className="footer-spacer" />
              <button className="footer-separate" onClick={() => void openSeparateLayers(cutPreview, cutEditor.layerId)}>
                <Layers3 /> Separate as Layers
              </button>
              <button className="cancel" onClick={() => setCutEditor(null)}>
                Cancel
              </button>
              <button className="confirm" onClick={() => void applyCutoutEdit()}>
                Apply Edit
              </button>
            </footer>
          </div>
        </div>
      )}
      {bgEditor && !imageEditor && (
        <div className="bg-modal" role="dialog" aria-modal="true" aria-label="Background removal editor">
          <div className="bg-dialog" onPointerDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                <b>Refine Background Removal</b>
                <small>Mark areas to remove or protect before applying.</small>
              </div>
              <div className="refine-quick-tools">
                <button
                  disabled={!bgEditor.strokes.length}
                  onClick={() =>
                    setBgEditor({
                      ...bgEditor,
                      strokes: bgEditor.strokes.slice(0, -1),
                    })
                  }
                >
                  Undo
                </button>
                <button disabled={!bgEditor.strokes.length} onClick={() => setBgEditor({ ...bgEditor, strokes: [] })}>
                  Reset
                </button>
                <label>
                  <input type="checkbox" checked={bgEditor.alphaView} onChange={(e) => setBgEditor({ ...bgEditor, alphaView: e.target.checked })} /> Alpha
                </label>
                <button
                  className={bgEditor.optimizeAlpha ? "active optimize-alpha" : "optimize-alpha"}
                  onClick={() =>
                    setBgEditor({
                      ...bgEditor,
                      optimizeAlpha: !bgEditor.optimizeAlpha,
                    })
                  }
                >
                  <Sparkles /> Optimize Alpha
                </button>
              </div>
              <button aria-label="Close" onClick={() => setBgEditor(null)}>
                ×
              </button>
            </header>
            <div className="bg-editor-body">
              <div ref={bgPreviewRef} className={`bg-preview ${bgEditor.alphaView ? "alpha-view" : ""}`} onWheel={zoomBackground} onPointerDown={startBackgroundPan} onPointerMove={moveBackgroundPan} onPointerUp={endBackgroundPan} onPointerCancel={endBackgroundPan}>
                {bgPreview ? (
                  <div
                    className="bg-image-wrap"
                    style={
                      {
                        "--fit-w": bgImageSize.w ? `${bgImageSize.w}px` : "auto",
                        "--fit-h": bgImageSize.h ? `${bgImageSize.h}px` : "auto",
                        transform: `translate(${bgEditor.panX}px,${bgEditor.panY}px) scale(${bgEditor.zoom})`,
                      } as React.CSSProperties
                    }
                  >
                    <img src={bgPreview} alt="Background removal preview" draggable={false} className={bgEditor.pickingColor !== null ? "eyedrop-active" : ""} onLoad={(e) => setBgImageSize(fitEditorImage(e.currentTarget, bgPreviewRef.current))} onPointerDown={startBackgroundStroke} onPointerMove={moveBackgroundStroke} onPointerUp={endBackgroundStroke} onPointerCancel={endBackgroundStroke} onPointerLeave={() => setBgCursor((v) => ({ ...v, visible: false }))} onPointerEnter={() => setBgCursor((v) => ({ ...v, visible: true }))} />
                    <svg className="bg-marks" viewBox={`0 0 ${bgImageSize.w || 100} ${bgImageSize.h || 100}`} aria-hidden="true">
                      {bgEditor.strokes
                        .filter((stroke) => stroke.id === bgActiveStroke)
                        .map((stroke) => {
                          const points = stroke.points.map((p) => `${p.x * (bgImageSize.w || 100)},${p.y * (bgImageSize.h || 100)}`).join(" ");
                          const color = stroke.mode === "remove" ? "#ef3f46" : "#00a66f";
                          const radius = (stroke.brush / 200) * Math.min(bgImageSize.w || 100, bgImageSize.h || 100);
                          return stroke.points.length === 1 ? <circle key={stroke.id} cx={stroke.points[0].x * (bgImageSize.w || 100)} cy={stroke.points[0].y * (bgImageSize.h || 100)} r={radius} fill={color} fillOpacity=".5" stroke="#fff" strokeWidth="1" /> : <polyline key={stroke.id} points={points} fill="none" stroke={color} strokeOpacity=".5" strokeWidth={radius * 2} strokeLinecap="round" strokeLinejoin="round" />;
                        })}
                      {bgCursor.visible && <circle cx={bgCursor.x * (bgImageSize.w || 100)} cy={bgCursor.y * (bgImageSize.h || 100)} r={(bgEditor.brush / 200) * Math.min(bgImageSize.w || 100, bgImageSize.h || 100)} className="bg-brush-cursor" />}
                    </svg>
                  </div>
                ) : (
                  <div className="bg-loading">Preparing preview…</div>
                )}
                {bgRendering && <span className="bg-updating">Updating…</span>}
                <div className="bg-zoom-controls">
                  <button
                    onClick={() =>
                      setBgEditor({
                        ...bgEditor,
                        zoom: clamp(bgEditor.zoom / 1.2, 0.6, 5),
                      })
                    }
                  >
                    −
                  </button>
                  <span>{Math.round(bgEditor.zoom * 100)}%</span>
                  <button
                    onClick={() =>
                      setBgEditor({
                        ...bgEditor,
                        zoom: clamp(bgEditor.zoom * 1.2, 0.6, 5),
                      })
                    }
                  >
                    +
                  </button>
                  <button onClick={() => setBgEditor({ ...bgEditor, zoom: 1, panX: 0, panY: 0 })}>Fit</button>
                </div>
              </div>
              <aside className="bg-controls">
                <section className="connected-brush-section">
                  <label>Connected Area with Brush</label>
                  <div className="mode-buttons">
                    <button className={bgEditor.mode === "remove" ? "active remove" : ""} onClick={() => setBgEditor({ ...bgEditor, mode: "remove" })}>
                      Remove
                    </button>
                    <button className={bgEditor.mode === "keep" ? "active keep" : ""} onClick={() => setBgEditor({ ...bgEditor, mode: "keep" })}>
                      Keep
                    </button>
                  </div>
                  <div className="compact-slider">
                    <label>
                      Brush Size <b>{bgEditor.brush.toFixed(1)}%</b>
                    </label>
                    <input type="range" min=".1" max="60" step=".1" value={bgEditor.brush} onChange={(e) => setBgEditor({ ...bgEditor, brush: +e.target.value })} />
                  </div>
                  <div className="compact-slider">
                    <label>
                      Color Bleed <b>{bgEditor.sensitivity}</b>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={bgEditor.sensitivity}
                      onChange={(e) =>
                        setBgEditor({
                          ...bgEditor,
                          sensitivity: +e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="compact-slider">
                    <label>
                      Connected Distance <b>{bgEditor.connectedReach >= 51 ? "Full" : `${(bgEditor.connectedReach / 10).toFixed(1)} cm`}</b>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="51"
                      value={bgEditor.connectedReach}
                      onChange={(e) =>
                        setBgEditor({
                          ...bgEditor,
                          connectedReach: +e.target.value,
                        })
                      }
                    />
                  </div>
                  <small>Each stroke keeps the size, color bleed and distance used when it was drawn. Distance limits connected-color spread; Full follows the complete connected area.</small>
                </section>
                <section className="all-color-section">
                  <label>All the Color with Eyedrop</label>
                  {bgEditor.eraseColors.map((entry, index) => (
                    <div className="erase-color-entry" key={index}>
                      <div className="erase-color-row">
                        <input
                          type="color"
                          value={entry.color || "#ffffff"}
                          onChange={(e) => {
                            const colors = [...bgEditor.eraseColors];
                            colors[index] = { ...entry, color: e.target.value };
                            if (colors.every((v) => v.color) && colors.length < 6) colors.push({ color: null, sensitivity: 30 });
                            setBgEditor({ ...bgEditor, eraseColors: colors });
                          }}
                        />
                        <button
                          className={bgEditor.pickingColor === index ? "active" : ""}
                          onClick={() =>
                            setBgEditor({
                              ...bgEditor,
                              pickingColor: bgEditor.pickingColor === index ? null : index,
                            })
                          }
                        >
                          <Pipette /> Pick from Image
                        </button>
                        <button
                          disabled={!entry.color}
                          onClick={() => {
                            const colors = bgEditor.eraseColors.filter((_, i) => i !== index);
                            setBgEditor({
                              ...bgEditor,
                              eraseColors: colors.length ? colors : [{ color: null, sensitivity: 30 }],
                              pickingColor: null,
                            });
                          }}
                        >
                          Clear
                        </button>
                      </div>
                      <div className="compact-slider">
                        <label>
                          Color Sensitivity <b>{entry.sensitivity}</b>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={entry.sensitivity}
                          onChange={(e) => {
                            const colors = [...bgEditor.eraseColors];
                            colors[index] = {
                              ...entry,
                              sensitivity: +e.target.value,
                            };
                            setBgEditor({ ...bgEditor, eraseColors: colors });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <small>Every selected color is removed throughout the entire image, whether its pixels are connected or not.</small>
                </section>
                <section>
                  <label>
                    Edge Refinement{" "}
                    <b>
                      {bgEditor.edgeRefine > 0 ? "+" : ""}
                      {bgEditor.edgeRefine} px
                    </b>
                  </label>
                  <input type="range" min="-25" max="25" step="1" value={bgEditor.edgeRefine} onChange={(e) => setBgEditor({ ...bgEditor, edgeRefine: +e.target.value })} />
                  <small>Positive values contract the edge to remove pale halos. Negative values recover pixels removed by an aggressive cut.</small>
                  <div className="compact-slider edge-smooth-control">
                    <label>
                      Edge Smooth <b>{bgEditor.edgeSmooth}</b>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={bgEditor.edgeSmooth}
                      onChange={(e) =>
                        setBgEditor({
                          ...bgEditor,
                          edgeSmooth: +e.target.value,
                        })
                      }
                    />
                    <small>Smooths both outer and inner alpha contours at pixel level. The result remains fully opaque or transparent.</small>
                  </div>
                </section>
                <section>
                  <label>
                    Remove Speckles <b>{bgEditor.speckles} px</b>
                  </label>
                  <input type="range" min="0" max="1000" step="5" value={bgEditor.speckles} onChange={(e) => setBgEditor({ ...bgEditor, speckles: +e.target.value })} />
                  <small>Fills enclosed transparent speckles up to this pixel area. Set to 0 to restore them.</small>
                </section>
                <p>Small isolated islands are removed automatically. The final mask contains no semi-transparent pixels.</p>
              </aside>
            </div>
            <footer>
              <button className="cancel" onClick={() => setBgEditor(null)}>
                Cancel
              </button>
              <button className="confirm" disabled={!bgPreview} onClick={() => void commitBackground()}>
                OK
              </button>
            </footer>
          </div>
        </div>
      )}
      {splitPreview && (
        <div className="split-modal" role="dialog" aria-modal="true" aria-label="Separate as layers preview">
          <div className="split-dialog">
            <header>
              <div>
                <b>Separate as Layers</b>
                <small>{splitPreview.parts.length} independent islands found. Each color will become a separate layer.</small>
              </div>
              <button onClick={() => setSplitPreview(null)}>×</button>
            </header>
            <div className="split-preview">
              <img src={splitPreview.preview} alt="Colored preview of separate layers" />
            </div>
            <footer>
              <button className="cancel" onClick={() => setSplitPreview(null)}>
                Cancel
              </button>
              <button className="confirm" onClick={() => void confirmSeparateLayers()}>
                Create {splitPreview.parts.length} Layers
              </button>
            </footer>
          </div>
        </div>
      )}
      {sessionLogOpen && (
        <div className="editor-devlog-modal session-log-modal" role="dialog" aria-modal="true" aria-label="Project session log">
          <div className="editor-devlog-dialog">
            <header>
              <div>
                <span>PROJECT ACTION HISTORY</span>
                <b>{projectName}</b>
                <small>Selections, layer changes and editor operations in chronological order.</small>
              </div>
              <button onClick={() => setSessionLogOpen(false)}><X /></button>
            </header>
            <div className="editor-devlog-scroll">
              {sessionLog.length ? sessionLog.map((entry, index) => (
                <article key={entry.id}>
                  <div><b>#{String(index + 1).padStart(3, "0")}</b><span>{entry.action}</span></div>
                  <ul><li>{new Date(entry.at).toLocaleString()} · {entry.details}</li></ul>
                </article>
              )) : <article><div><span>No actions recorded yet.</span></div></article>}
            </div>
            <footer>
              <span>{sessionLog.length} recorded actions · saved with this project</span>
              <button onClick={() => void navigator.clipboard.writeText(sessionLog.map((entry, index) => `#${index + 1} ${new Date(entry.at).toLocaleString()} — ${entry.action}\n${entry.details}`).join("\n\n")).then(() => setNotice("Session Log copied"))}>Copy All</button>
            </footer>
          </div>
        </div>
      )}
      {devLogOpen && (
        <div className="editor-devlog-modal" role="dialog" aria-modal="true" aria-label="Cake Topper Maker development log">
          <div className="editor-devlog-dialog">
            <header>
              <div>
                <span>PRODUCT DEVELOPMENT LOG</span>
                <b>Cake Topper Maker</b>
                <small>Every shipped improvement, newest first.</small>
              </div>
              <button onClick={() => setDevLogOpen(false)}>
                <X />
              </button>
            </header>
            <div className="editor-devlog-scroll">
              {editorDevLog.map((release) => (
                <article key={release.version}>
                  <div>
                    <b>{release.version}</b>
                    <span>{release.title}</span>
                  </div>
                  <ul>
                    {release.changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <footer>
              <span>
                {editorDevLog.length} releases · Current build {EDITOR_VERSION}
              </span>
              <button onClick={() => setDevLogOpen(false)}>Close</button>
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
