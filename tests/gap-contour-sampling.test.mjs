import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleGapContour, gapBounds } from '../app/editor/gap-contour-sampling.ts';
test('cubic inspection retains curvature and closing bounds without length queries', () => {
  const points = sampleGapContour('M 0 0 C 0 100 100 100 100 0 L 0 0 Z');
  assert.ok(points.length > 10 && points.length < 200);
  assert.deepEqual(gapBounds(points),{minX:0,minY:0,maxX:100,maxY:75});
});
test('scientific notation and implicit line coordinates are supported', () => {
  assert.deepEqual(sampleGapContour('M 1e1 0 20 0 20 10 Z'),[{x:10,y:0},{x:20,y:0},{x:20,y:10}]);
  assert.equal(sampleGapContour('M0 0 A20 20 0 0 1 20 20 Z'),null);
  assert.ok(sampleGapContour('M0 0 c0 10 10 10 10 0 Z').length > 3);
});
test('thousands of straight cubic segments are inspected in linear work', () => {
  const raw='M0 0 '+Array.from({length:2000},(_,i)=>`C ${i+.3} 0 ${i+.6} 0 ${i+1} 0`).join(' ')+' L0 0 Z';
  const start=performance.now(), points=sampleGapContour(raw);
  assert.equal(points.length,2002);
  assert.ok(performance.now()-start<1000);
});
