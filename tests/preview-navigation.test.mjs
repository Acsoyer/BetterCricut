import test from 'node:test';
import assert from 'node:assert/strict';
import { navigatePreview } from '../app/editor/preview-navigation.ts';
test('two finger navigation pans without changing preview zoom', () => {
  assert.deepEqual(navigatePreview({ zoom: 2, panX: 10, panY: 20 }, 30, -40, false, 0, 0, .5, 5), { zoom: 2, panX: -20, panY: 60 });
});
test('pinch preserves the image point beneath the pointer and clamps zoom', () => {
  const before = { zoom: 2, panX: 10, panY: 20 };
  const after = navigatePreview(before, 0, -100, true, 150, 80, .5, 5);
  assert.ok(Math.abs((150-after.panX)/after.zoom - (150-before.panX)/before.zoom) < 1e-10);
  assert.ok(Math.abs((80-after.panY)/after.zoom - (80-before.panY)/before.zoom) < 1e-10);
  assert.equal(navigatePreview(before, 0, -100000, true, 0, 0, .5, 5).zoom, 5);
  assert.equal(navigatePreview(before, 0, 100000, true, 0, 0, .5, 5).zoom, .5);
});
