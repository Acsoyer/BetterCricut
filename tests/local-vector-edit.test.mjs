import test from 'node:test';
import assert from 'node:assert/strict';
import paper from 'paper';
import { absoluteSubpaths } from '../app/editor/svg-subpaths.ts';
test('relative subpath origins preserve location after earlier hole removal', () => {
  const parts=absoluteSubpaths('m10 10 h100 v100 h-100 z m20 20 h10 v10 h-10 z m40 40 h10 v10 h-10 z');
  assert.deepEqual(parts,['M10 10 h100 v100 h-100 z ','M30 30 h10 v10 h-10 z ','M70 70 h10 v10 h-10 z']);
});
test('untouched sharp corners and Bezier handles survive local vector edits', () => {
  const s=new paper.PaperScope();s.setup(new s.Size(100,100));
  try {
    const original=new s.Path('M0 0 L100 0 L100 100 C75 100 25 100 0 100 Z');
    const add=new s.Path.Circle({center:[100,50],radius:10,insert:false});
    for(const result of [original.unite(add,{insert:false}),original.subtract(add,{insert:false})]) {
      const paths=result.className==='CompoundPath'?result.children:[result];
      const segments=paths.flatMap(p=>p.segments);
      const corner=segments.find(p=>p.point.x===0 && p.point.y===0);
      assert.ok(corner);assert.equal(corner.handleIn.length,0);assert.equal(corner.handleOut.length,0);
      const lower=segments.find(p=>p.point.x===0 && p.point.y===100);
      assert.ok(lower);assert.equal(lower.handleIn.x,25);assert.equal(lower.handleIn.y,0);
    }
  } finally {s.project.remove();}
});

test('SVG viewport clipping rectangles are not treated as filled geometry', async () => {
  const { editableVectorPaths }=await import('../app/editor/local-vector-edit.ts');
  const s=new paper.PaperScope();s.setup(new s.Size(100,100));
  try {
    const rectangle=new s.Path.Rectangle({from:[0,0],to:[100,100]});rectangle.clipMask=true;
    const text=new s.CompoundPath('M10 10L90 10L90 90L10 90Z M30 30L30 60L60 60L60 30Z');
    const group=new s.Group([rectangle,text]);group.clipped=true;
    assert.deepEqual(editableVectorPaths(group),[text]);
  } finally {s.remove();}
});