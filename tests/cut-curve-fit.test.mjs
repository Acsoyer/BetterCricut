import test from "node:test";
import assert from "node:assert/strict";
import { fitClosedContour, cubicPoint } from "../app/editor/cut-curve-fit.ts";

test("pixel stair steps on a circle become a few continuous cubics", () => {
  const points = [];
  for (let i = 0; i < 4000; i++) {
    const a = (i / 4000) * Math.PI * 2,
      p = {
        x: Math.round(100 + 90 * Math.cos(a)),
        y: Math.round(100 + 90 * Math.sin(a)),
      };
    if (!points.length || p.x !== points.at(-1).x || p.y !== points.at(-1).y)
      points.push(p);
  }
  const curves = fitClosedContour(points, 1.8);
  assert.ok(
    curves.length <= 8,
    `Expected <=8 cubics, received ${curves.length}`,
  );
  assert.deepEqual(curves.at(-1)[3], curves[0][0]);
  for (const c of curves)
    for (let t = 0; t <= 1; t += 0.01) {
      const p = cubicPoint(c, t),
        error = Math.abs(Math.hypot(p.x - 100, p.y - 100) - 90);
      assert.ok(error < 2, `Curve deviated by ${error} pixels`);
    }
});

test("true rectangle corners and placement survive curve fitting", () => {
  const points = [];
  for (let x = 0; x < 100; x++) points.push({ x: x + 30, y: 40 });
  for (let y = 0; y < 80; y++) points.push({ x: 130, y: y + 40 });
  for (let x = 100; x > 0; x--) points.push({ x: x + 30, y: 120 });
  for (let y = 80; y > 0; y--) points.push({ x: 30, y: y + 40 });
  const curves = fitClosedContour(points, 1.8);
  for (const corner of [
    { x: 30, y: 40 },
    { x: 130, y: 40 },
    { x: 130, y: 120 },
    { x: 30, y: 120 },
  ])
    assert.ok(curves.some((c) => c[0].x === corner.x && c[0].y === corner.y));
  for (const c of curves)
    for (let t = 0; t <= 1; t += 0.02) {
      const p = cubicPoint(c, t);
      assert.ok(p.x >= 29.99 && p.x <= 130.01 && p.y >= 39.99 && p.y <= 120.01);
    }
});
