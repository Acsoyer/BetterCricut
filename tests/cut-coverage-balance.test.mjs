import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCutContour, cutMaskTopology } from '../app/editor/cut-contour.ts';
test('both creation modes avoid adding foreground during edge cleanup', () => {
  const w = 80, h = 80, data = new Uint8ClampedArray(w*h*4);
  const original = new Uint8Array(w*h);
  for (let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const distance = Math.hypot(x-40,y-40);
    data[(y*w+x)*4+3] = Math.round(Math.max(0,Math.min(1,25.4-distance))*255);
    original[y*w+x] = data[(y*w+x)*4+3]>=128?1:0;
  }
  for (const profile of ['smooth','detailed']) {
    const mask = prepareCutContour(data,w,h,profile);
    assert.ok(mask.reduce((a,b)=>a+b,0)<=original.reduce((a,b)=>a+b,0));
    assert.deepEqual(cutMaskTopology(mask,w,h),cutMaskTopology(original,w,h));
  }
});
