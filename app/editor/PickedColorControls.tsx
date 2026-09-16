import { Pipette, Plus } from "lucide-react";

type Entry = { color: string | null; sensitivity: number };
export default function PickedColorControls({ entries, picking, onChange, onPick }: {
  entries: Entry[]; picking: number | null;
  onChange: (entries: Entry[]) => void; onPick: (index: number | null) => void;
}) {
  return <section className="all-color-section picked-color-controls">
    <style>{`.picked-color-controls .erase-color-row{grid-template-columns:30px minmax(0,1fr) auto 30px!important}.picked-color-controls .erase-color-row button{font-size:11px!important}.picked-color-controls .compact-slider label{font-size:11px!important}`}</style>
    <label>All the Color with Eyedrop</label>
    {entries.map((entry, index) => <div className="erase-color-entry" key={index}>
      <div className="erase-color-row">
        <input aria-label={`Picked color ${index + 1}`} type="color" value={entry.color ?? "#ffffff"} onChange={e => onChange(entries.map((v, i) => i === index ? { ...v, color: e.target.value } : v))} />
        <button className={picking === index ? "active" : ""} onClick={() => onPick(picking === index ? null : index)}><Pipette />Pick from Image</button>
        <button disabled={!entry.color} onClick={() => { onChange(entries.map((v, i) => i === index ? { ...v, color: null } : v)); onPick(null); }}>Clear</button>
        <button aria-label="Add picked color" title="Add picked color (up to three)" disabled={entries.length >= 3} onClick={() => { if (entries.length < 3) onChange([...entries, { color: null, sensitivity: 30 }]); }}><Plus /></button>
      </div>
      <div className="compact-slider"><label>Color Sensitivity (Picked color) <b>{entry.sensitivity}</b></label>
        <input aria-label={`Color sensitivity ${index + 1}`} type="range" min="0" max="100" value={entry.sensitivity} onChange={e => onChange(entries.map((v, i) => i === index ? { ...v, sensitivity: +e.target.value } : v))} />
      </div>
    </div>)}
    <small>Every picked color is removed throughout the entire image.</small>
  </section>;
}
