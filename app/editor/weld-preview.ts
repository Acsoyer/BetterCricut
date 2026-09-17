type Area = { x: number; y: number; w: number; h: number };
type PlacedLayer = Area & { rotation: number };

/** Canvas SVG draws must use pixel-sized destinations, not centimetre-sized
 * destinations magnified afterwards: the latter can rasterize SVGs too small. */
export function weldPixelPlacement(layer: PlacedLayer, area: Area, width: number, height: number) {
  const sx = width / area.w, sy = height / area.h;
  const angle = layer.rotation * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return {
    x: (layer.x + layer.w / 2 - area.x) * sx,
    y: (layer.y + layer.h / 2 - area.y) * sy,
    w: layer.w * sx,
    h: layer.h * sy,
    // Conjugate rotation by the canvas aspect scale. Rotation stays in world
    // coordinates even when the rectangular SVG is checked on a square canvas.
    a: cos, b: sin * sy / sx, c: -sin * sx / sy, d: cos,
  };
}

export async function drawWeldReference(
  context: CanvasRenderingContext2D,
  layers: (PlacedLayer & { src: string })[],
  area: Area,
  loadImage: (src: string) => Promise<CanvasImageSource>,
) {
  for (const layer of layers) {
    const image = await loadImage(layer.src);
    const p = weldPixelPlacement(layer, area, context.canvas.width, context.canvas.height);
    context.save();
    context.setTransform(p.a, p.b, p.c, p.d, p.x, p.y);
    context.drawImage(image, -p.w / 2, -p.h / 2, p.w, p.h);
    context.restore();
  }
}

/** SVG and canvas sampling can disagree on a one-pixel antialiased boundary.
 * Check spatial coverage, not byte equality; missing interiors still fail. */
export function inspectWeldCoverage(expected: Uint8ClampedArray, actual: Uint8ClampedArray, width: number, height: number) {
  let foreground = 0, missing = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4 + 3;
    if (expected[index] < 128) continue;
    foreground++;
    if (actual[index] >= 8) continue;
    let covered = false;
    for (let dy = -1; dy <= 1 && !covered; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && actual[(ny * width + nx) * 4 + 3] >= 8) { covered = true; break; }
    }
    if (!covered) missing++;
  }
  return { foreground, missing, valid: foreground > 0 && missing <= Math.max(4, foreground * .005) };
}