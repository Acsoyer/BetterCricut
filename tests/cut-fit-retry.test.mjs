import test from "node:test";
import assert from "node:assert/strict";
import {
  cutFitRetryPlan,
  losslessCutMaskSvg,
} from "../app/editor/cut-fit-retry.ts";

test("failed fits allow four times as many curves on each next attempt", () => {
  const plan = cutFitRetryPlan(27);
  assert.equal(plan[0].budget, 27);
  for (let i = 1; i < plan.length; i++) {
    assert.equal(plan[i].budget, plan[i - 1].budget * 4);
    assert.ok(plan[i].scale < plan[i - 1].scale);
  }
});

test("lossless boundary SVG preserves every pixel, counter and disconnected piece", () => {
  const w = 13,
    h = 11;
  for (const mask of [
    Uint8Array.from({ length: w * h }, (_, i) =>
      i % 7 === 0 || i % 11 === 0 ? 1 : 0,
    ),
    Uint8Array.from({ length: w * h }, (_, i) =>
      (i + (i % w)) % 3 === 0 ? 1 : 0,
    ),
    Uint8Array.from({ length: w * h }, (_, i) =>
      i % w > 2 &&
      i % w < 10 &&
      Math.floor(i / w) > 1 &&
      Math.floor(i / w) < 9 &&
      !(
        i % w > 4 &&
        i % w < 8 &&
        Math.floor(i / w) > 3 &&
        Math.floor(i / w) < 7
      )
        ? 1
        : 0,
    ),
  ]) {
    const svg = losslessCutMaskSvg(mask, w, h, 6),
      polygons = [];
    for (const m of svg.matchAll(/M (\d+) (\d+) ([^Z]+)Z/g)) {
      const points = [[+m[1] - 6, +m[2] - 6]];
      for (const c of m[3].matchAll(/C \d+ \d+ \d+ \d+ (\d+) (\d+)/g))
        points.push([+c[1] - 6, +c[2] - 6]);
      polygons.push(points);
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let inside = false;
        for (const points of polygons)
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [ax, ay] = points[i],
              [bx, by] = points[j],
              px = x + 0.5,
              py = y + 0.5;
            if (
              ay > py !== by > py &&
              px < ((bx - ax) * (py - ay)) / (by - ay) + ax
            )
              inside = !inside;
          }
        assert.equal(+inside, mask[y * w + x], `Pixel ${x},${y} changed`);
      }
    assert.ok(!svg.includes("<image"));
  }
});

test("lossless fallback never creates internal cutting lines inside a solid rectangle", () => {
  const svg = losslessCutMaskSvg(new Uint8Array(20 * 15).fill(1), 20, 15);
  assert.equal((svg.match(/M /g) || []).length, 1);
  assert.equal((svg.match(/C /g) || []).length, 4);
});
