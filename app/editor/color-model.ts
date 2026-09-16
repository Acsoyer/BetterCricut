export function hsv(hex: string) {
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255), max=Math.max(...rgb), min=Math.min(...rgb), d=max-min;
  const h=d ? ((max===rgb[0]?(rgb[1]-rgb[2])/d+(rgb[1]<rgb[2]?6:0):max===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4)*60):0;
  return {h,s:max?d/max:0,v:max};
}
export function hex(h: number,s: number,v: number) {
  const f=(n:number)=>{const k=(n+h/60)%6;return Math.round((v-v*s*Math.max(0,Math.min(k,4-k,1)))*255).toString(16).padStart(2,"0");};
  return `#${f(5)}${f(3)}${f(1)}`;
}
export function normalizePickedColors(entries?: {color:string|null;sensitivity:number}[]) {
  return entries?.length ? entries.slice(0,3).map(entry=>({...entry})) : [{color:null,sensitivity:30}];
}
