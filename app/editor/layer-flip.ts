export type FlippableBox = { x: number; y: number; w: number; h: number; rotation: number };

export function flippedLayerBox<T extends FlippableBox>(layer: T, selection: { x: number; y: number; w: number; h: number }, axis: "horizontal" | "vertical"): T {
  const centerX = layer.x + layer.w / 2,
    centerY = layer.y + layer.h / 2,
    reflectedX = axis === "horizontal" ? 2 * (selection.x + selection.w / 2) - centerX : centerX,
    reflectedY = axis === "vertical" ? 2 * (selection.y + selection.h / 2) - centerY : centerY;
  return { ...layer, x: reflectedX - layer.w / 2, y: reflectedY - layer.h / 2, rotation: -layer.rotation };
}
