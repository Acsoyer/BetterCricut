const INF = 1e20;

// Exact squared Euclidean distance transform (Felzenszwalb/Huttenlocher).
// This makes a true circular offset instead of stamping at sparse angles.
function distanceTransform1D(source: Float64Array, length: number) {
  const result = new Float64Array(length), sites = new Int32Array(length), boundaries = new Float64Array(length + 1);
  let last = 0;
  sites[0] = 0;
  boundaries[0] = -INF;
  boundaries[1] = INF;
  for (let q = 1; q < length; q++) {
    let intersection = ((source[q] + q * q) - (source[sites[last]] + sites[last] * sites[last])) / (2 * q - 2 * sites[last]);
    while (intersection <= boundaries[last]) {
      last--;
      intersection = ((source[q] + q * q) - (source[sites[last]] + sites[last] * sites[last])) / (2 * q - 2 * sites[last]);
    }
    last++;
    sites[last] = q;
    boundaries[last] = intersection;
    boundaries[last + 1] = INF;
  }
  last = 0;
  for (let q = 0; q < length; q++) {
    while (boundaries[last + 1] < q) last++;
    const delta = q - sites[last];
    result[q] = delta * delta + source[sites[last]];
  }
  return result;
}

export function circularDilateAlpha(alpha: Uint8Array, width: number, height: number, radius: number, threshold = 96) {
  if (alpha.length !== width * height) throw new Error("Outline mask dimensions do not match");
  if (!alpha.some(value => value >= threshold)) return new Uint8Array(alpha.length);
  const horizontal = new Float64Array(alpha.length), line = new Float64Array(Math.max(width, height)),
    far = width * width + height * height + Math.max(0, radius) ** 2 + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) line[x] = alpha[y * width + x] >= threshold ? 0 : far;
    horizontal.set(distanceTransform1D(line, width), y * width);
  }
  const distance = new Float64Array(alpha.length);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) line[y] = horizontal[y * width + x];
    const transformed = distanceTransform1D(line, height);
    for (let y = 0; y < height; y++) distance[y * width + x] = transformed[y];
  }
  const output = new Uint8Array(alpha.length), limit = Math.max(0, radius) ** 2 + 1e-9;
  for (let i = 0; i < output.length; i++) output[i] = distance[i] <= limit ? 255 : 0;
  return output;
}
