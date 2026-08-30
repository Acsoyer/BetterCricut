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
      filterSpeckle: 8,
      cornerThreshold: 60,
      lengthThreshold: 4,
      maxIterations: 10,
      spliceThreshold: 4,
      simplify: 1.2,
      pathPrecision: 3,
      optimize: 1,
    });
    self.postMessage({ svg });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
