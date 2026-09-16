import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "./cut-contour" ? "./cut-contour.ts" : specifier,
      context,
    );
  },
});
const { smoothAlphaCoverage } = await import("../app/editor/alpha-coverage.ts");

test("fully opaque images do not acquire fake transparency at the frame", () => {
  const data = new Uint8ClampedArray(20 * 20 * 4).fill(255);
  assert.deepEqual(smoothAlphaCoverage(data, 20, 20), data);
});

test("edges retain fractional coverage without transparent background colour bleeding in", () => {
  const w = 20,
    h = 20,
    data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const q = (y * w + x) * 4;
      data[q] = x < 10 ? 0 : 255;
      data[q + 1] = x < 10 ? 150 : 0;
      data[q + 2] = 0;
      data[q + 3] = x < 10 ? 255 : 0;
    }
  const out = smoothAlphaCoverage(data, w, h),
    q = (10 * w + 10) * 4;
  assert.ok(out[q + 3] > 0 && out[q + 3] < 128);
  assert.equal(out[q], 0);
  assert.equal(out[q + 1], 150);
  assert.equal(out[(10 * w + 11) * 4 + 3], 0);
});
