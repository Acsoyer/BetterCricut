importScripts("./vtracer_wasm.js");

const ready = globalThis.VTracerWasm.init(new URL("./vtracer_wasm_bg.wasm", self.location.href).href);

self.onmessage = async (event) => {
  try {
    await ready;
    const svg = globalThis.VTracerWasm.vectorize_bytes(new Uint8Array(event.data.buffer), {
      clustering: "bw",
      hierarchical: "cutout",
      mode: "spline",
      binaryThreshold: 180,
      filterSpeckle: 12,
      cornerThreshold: 60,
      lengthThreshold: 8,
      maxIterations: 10,
      spliceThreshold: 45,
      simplify: 2.5,
      pathPrecision: 2,
      optimize: 2,
    });
    self.postMessage({ svg });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
