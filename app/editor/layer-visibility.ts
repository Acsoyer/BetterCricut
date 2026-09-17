export function isLayerVisible(layer: { visible: boolean; groupHidden?: boolean }) {
  return layer.visible && !layer.groupHidden;
}
