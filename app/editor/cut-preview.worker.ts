import { getSVG, traceImageData } from "@cadit-app/potrace-ts";

// Display-only tracing. Never feeds project geometry or editing calculations.
self.onmessage = (event: MessageEvent<{ width: number; height: number; buffer: ArrayBuffer }>) => {
  const { width, height, buffer } = event.data;
  try {
    const data = new Uint8ClampedArray(buffer);
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i + 3] >= 96 ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
    const paths = traceImageData({ data, width, height }, { turnpolicy: "minority", turdsize: 0, alphamax: 1, optcurve: true, opttolerance: .12 });
    self.postMessage({ svg: getSVG(paths, 1, "fill"), width, height });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Preview tracing failed" });
  }
};
