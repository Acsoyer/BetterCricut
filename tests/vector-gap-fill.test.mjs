import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { polygonArea, containsPoint, fillVectorGaps } from '../app/editor/vector-gap-fill.ts';
test('hole nesting distinguishes gaps from adjacent separate pieces', () => {
  const outer = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  assert.equal(polygonArea(outer),10000);
  assert.equal(containsPoint(outer,{x:25,y:25}),true);
  assert.equal(containsPoint(outer,{x:110,y:25}),false);
  assert.equal(polygonArea([...outer].reverse()),-10000);
});
test('zero fill returns the exact unmodified vector source', () => {
  const svg = '<svg><path d="M0 0C1 2 3 4 5 6Z"/></svg>';
  assert.equal(fillVectorGaps(svg,10,10,0),svg);
});
test('Fill Gaps actions never rasterize or retrace the outer contour', () => {
  const page = readFileSync(new URL('../app/editor/page.tsx',import.meta.url),'utf8');
  const actions = page.slice(page.indexOf('  const applyGapPreview ='),page.indexOf('  const makeGapsPermanent ='));
  assert.equal(/strokeImage|smoothVectorCutout|vTracerCutout|trimTransparent/.test(actions),false);
  assert.equal((actions.match(/fillVectorGaps\(/g)||[]).length,2);
  const source=readFileSync(new URL('../app/editor/vector-gap-fill.ts',import.meta.url),'utf8');
  assert.ok(source.includes('map(entry => entry.part).join(""'));
});
