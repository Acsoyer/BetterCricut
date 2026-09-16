export type PreviewView = { zoom: number; panX: number; panY: number };
export function navigatePreview<T extends PreviewView>(view: T, dx: number, dy: number, zooming: boolean, x: number, y: number, min: number, max: number): T {
  if (!zooming) return { ...view, panX: view.panX - dx, panY: view.panY - dy };
  const zoom = Math.max(min, Math.min(max, view.zoom * Math.exp(-dy * .002)));
  const ratio = zoom / view.zoom;
  return { ...view, zoom, panX: x - (x - view.panX) * ratio, panY: y - (y - view.panY) * ratio };
}
