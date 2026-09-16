import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { cleanContourPoints } from "../app/editor/cut-contour-denoise.ts";
registerHooks({
  resolve(s, c, next) {
    return next(s === "./cut-contour-denoise" ? s + ".ts" : s, c);
  },
});
const { fittedCutSvg, detailedRecoveryScales } = await import(
  "../app/editor/cut-curve-fit.ts"
);

function sampledContour(wobble = 0) {
  const points = [];
  for (let i = 0; i < 4000; i++) {
    const a = (i / 4000) * Math.PI * 2,
      r = 90 + wobble * Math.sin(a * 7),
      p = {
        x: Math.round(120 + r * Math.cos(a)),
        y: Math.round(120 + r * Math.sin(a)),
      };
    if (!points.length || p.x !== points.at(-1).x || p.y !== points.at(-1).y)
      points.push(p);
  }
  return points;
}
const segments = (svg) => (svg.match(/[CL] /g) || []).length;

test("both quality modes reject pixel stairs while Detailed retains moderately more real variation", () => {
  for (const wobble of [0, 3, 7]) {
    const points = sampledContour(wobble),
      smooth = segments(fittedCutSvg([{ points }], "smooth")),
      detailed = segments(fittedCutSvg([{ points }], "detailed"));
    assert.ok(
      smooth < 100 && detailed < 100,
      "A smooth arc must not become hundreds of pixel segments",
    );
    assert.ok(
      detailed > smooth,
      "Detailed must preserve more contour variation",
    );
    assert.ok(
      detailed <= smooth * 3,
      "Detailed complexity must remain in the same usable range",
    );
  }
});

test("tight retries cannot restore all the original noisy raster samples", () => {
  const points = sampledContour(7),
    clean = cleanContourPoints(points, 1);
  const retried = segments(fittedCutSvg([{ points }], "detailed", 1, 1 / 64));
  assert.ok(clean.length < points.length / 2);
  assert.ok(retried <= clean.length * 2);
});

test("shared noise cleanup preserves bounds and does not alter tiny detached contours", () => {
  const points = sampledContour(7),
    clean = cleanContourPoints(points, 1);
  for (const key of ["x", "y"]) {
    assert.equal(
      Math.min(...clean.map((p) => p[key])),
      Math.min(...points.map((p) => p[key])),
    );
    assert.equal(
      Math.max(...clean.map((p) => p[key])),
      Math.max(...points.map((p) => p[key])),
    );
  }
  const tiny = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  assert.deepEqual(cleanContourPoints(tiny, 1), tiny);
});

test("Detailed recovery can reuse the same clean curve family as Smooth instead of raster fallback", () => {
  const points = sampledContour(7),
    scale = detailedRecoveryScales()[5];
  assert.equal(
    fittedCutSvg([{ points }], "detailed", 1, scale),
    fittedCutSvg([{ points }], "smooth"),
  );
});
