import test from 'node:test';
import assert from 'node:assert/strict';
import { cutMaskTopology, prepareCutContour, cutContourOptions } from '../app/editor/cut-contour.ts';

function rgba(mask) {
  const data = new Uint8ClampedArray(mask.length * 4);
  mask.forEach((v, p) => { data[p * 4 + 3] = v * 255; });
  return data;
}

test('explicit creation profiles differ without changing existing edit settings', () => {
  assert.equal(cutContourOptions().opttolerance, .12);
  assert.ok(cutContourOptions('smooth').opttolerance > cutContourOptions('detailed').opttolerance);
});

test('separate thin pieces and enclosed counters survive cleanup', () => {
  const w = 40, h = 40, mask = new Uint8Array(w * h);
  for (let y = 5; y < 25; y++) for (let x = 5; x < 25; x++)
    mask[y * w + x] = x < 8 || x >= 22 || y < 8 || y >= 22 ? 1 : 0;
  for (let y = 10; y < 30; y++) mask[y * w + 32] = 1;
  mask[35 * w + 35] = 1;
  assert.deepEqual(cutMaskTopology(mask, w, h), { pieces: 3, holes: 1 });
  for (const profile of ['detailed', 'smooth']) {
    const out = prepareCutContour(rgba(mask), w, h, profile);
    assert.deepEqual(cutMaskTopology(out, w, h), cutMaskTopology(mask, w, h));
    assert.deepEqual(out, mask); // Cleanup would erase a thin piece: reject it.
  }
});

test('preview/no-profile never modifies the input silhouette', () => {
  const mask = Uint8Array.from({ length: 400 }, (_, p) => p % 7 === 0 ? 1 : 0);
  assert.deepEqual(prepareCutContour(rgba(mask), 20, 20), mask);
});
