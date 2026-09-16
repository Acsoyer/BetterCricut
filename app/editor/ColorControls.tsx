import { ChevronDown, Pipette } from "lucide-react";
import { useEffect, useState, type PointerEvent } from "react";
import { hsv,hex } from "./color-model";
export default function ColorControls({color,advanced,onAdvanced,onChange,onPick,picking=false}: {
  color:string;advanced:boolean;onAdvanced:()=>void;onChange:(color:string)=>void;onPick:()=>void;picking?:boolean;
}) {
  const values=hsv(/^#[0-9a-f]{6}$/i.test(color)?color:"#000000");
  const [hue,setHue]=useState(values.h),[draft,setDraft]=useState(color);
  // Synchronize the picker with swatches and image eyedrop selections.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{setDraft(color);if(values.s>0)setHue(values.h);},[color,values.s,values.h]);
  const changeSV=(e:PointerEvent<HTMLDivElement>)=>{
    if(e.type==="pointermove" && e.buttons!==1)return;
    if(e.type==="pointerdown")e.currentTarget.setPointerCapture(e.pointerId);
    const rect=e.currentTarget.getBoundingClientRect();onChange(hex(hue,Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),1-Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))));
  };
  return <div className="shared-color-controls">
    <div className="shared-color-row"><span className="shared-color-sample" style={{background:color}} aria-label={`Selected color ${color}`}/><button className={picking?"active":""} onClick={onPick}><Pipette/> Pick Color</button><button onClick={onAdvanced}>Advanced <ChevronDown style={{transform:advanced?"rotate(180deg)":undefined}}/></button></div>
    {advanced&&<div className="shared-color-advanced"><div className="color-sv-square" role="slider" aria-label="Color saturation and brightness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(values.s*100)} tabIndex={0} style={{backgroundColor:`hsl(${hue} 100% 50%)`}} onPointerDown={changeSV} onPointerMove={changeSV} onKeyDown={e=>{if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))return;e.preventDefault();onChange(hex(hue,Math.max(0,Math.min(1,values.s+(e.key==="ArrowRight"?.01:e.key==="ArrowLeft"?-.01:0))),Math.max(0,Math.min(1,values.v+(e.key==="ArrowUp"?.01:e.key==="ArrowDown"?-.01:0)))));}}><i style={{left:`${values.s*100}%`,top:`${(1-values.v)*100}%`}}/></div><div className="color-hue-row"><span className="shared-color-sample" style={{background:color}}/><input aria-label="Color hue" type="range" min="0" max="360" value={hue} onChange={e=>{setHue(+e.target.value);onChange(hex(+e.target.value,values.s||1,values.v||1));}}/></div><input className="color-hex-input" aria-label="Hex color" value={draft} maxLength={7} onChange={e=>{setDraft(e.target.value);if(/^#[0-9a-f]{6}$/i.test(e.target.value))onChange(e.target.value);}} onBlur={()=>setDraft(color)}/></div>}
  </div>;
}
