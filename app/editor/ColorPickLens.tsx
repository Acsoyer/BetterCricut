import { useEffect, useRef, useState } from "react";
export type PickPointer = { x: number; y: number; clientX: number; clientY: number };
export default function ColorPickLens({src, pointer}: {src: string; pointer: PickPointer}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [image,setImage]=useState<HTMLImageElement|null>(null);
  useEffect(()=>{let cancelled=false;const img=new Image();img.onload=()=>{if(!cancelled)setImage(img);};img.src=src;return()=>{cancelled=true;};},[src]);
  useEffect(()=>{
    const ctx=canvas.current?.getContext("2d");if(!ctx||!image)return;
    const x=Math.min(image.naturalWidth-1,Math.max(0,Math.floor(pointer.x*image.naturalWidth))), y=Math.min(image.naturalHeight-1,Math.max(0,Math.floor(pointer.y*image.naturalHeight)));
    ctx.clearRect(0,0,104,104);ctx.imageSmoothingEnabled=false;
    // Thirteen pixels across: the exact selected pixel occupies the central
    // eight-pixel square, with its original neighbours around it.
    ctx.drawImage(image,x-6,y-6,13,13,0,0,104,104);
    ctx.strokeStyle="#17211c";ctx.lineWidth=3;ctx.strokeRect(47,47,10,10);
    ctx.strokeStyle="#fff";ctx.lineWidth=1;ctx.strokeRect(48,48,8,8);
  },[image,pointer]);
  return <div className="color-pick-lens" style={{left:pointer.clientX-52,top:pointer.clientY-52}}>
    <canvas ref={canvas} width="104" height="104"/><span>Pick Color</span>
  </div>;
}
