/**
 * Cleans up the model's cut-out: a 1px feather on the alpha edge, then colour
 * decontamination, pulling edge pixels towards the colour just inside the
 * person so the old background's halo disappears. Pure, so it runs in the worker.
 */

/** Box blur of one channel with radius r (separable, O(n)). */
export function boxBlur(source: Float32Array, width: number, height: number, r: number): Float32Array {
  if (r <= 0) return source.slice();
  const temp = new Float32Array(source.length);
  const out = new Float32Array(source.length);
  const size = 2 * r + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += source[row + Math.min(width - 1, Math.max(0, x))]!;
    for (let x = 0; x < width; x++) {
      temp[row + x] = sum / size;
      sum += source[row + Math.min(width - 1, x + r + 1)]! - source[row + Math.max(0, x - r)]!;
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += temp[Math.min(height - 1, Math.max(0, y)) * width + x]!;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / size;
      sum += temp[Math.min(height - 1, y + r + 1) * width + x]! - temp[Math.max(0, y - r) * width + x]!;
    }
  }
  return out;
}

/**
 * `rgba` holds the photo's colours with the model's alpha. Modified in place and returned.
 * `radius` is how far, in pixels, to look inwards for the person's true colour.
 */
export function refineCutout(rgba: Uint8ClampedArray, width: number, height: number, radius = 4): Uint8ClampedArray {
  const n = width * height;
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) alpha[i] = rgba[i * 4 + 3]! / 255;

  // 1px feather.
  const feathered = boxBlur(alpha, width, height, 1);

  // Interior colour: neighbours weighted strongly towards fully opaque pixels.
  const weight = new Float32Array(n);
  const channels = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const w = alpha[i]! ** 6;
    weight[i] = w;
    for (let c = 0; c < 3; c++) channels[c]![i] = rgba[i * 4 + c]! * w;
  }
  const weightBlur = boxBlur(weight, width, height, radius);
  const colourBlur = channels.map((channel) => boxBlur(channel, width, height, radius));

  for (let i = 0; i < n; i++) {
    const a = feathered[i]!;
    rgba[i * 4 + 3] = Math.round(a * 255);
    // Only partly transparent edge pixels carry the old background.
    if (a <= 0.01 || a >= 0.99 || weightBlur[i]! < 1e-4) continue;
    const pull = 1 - a;
    for (let c = 0; c < 3; c++) {
      const interior = colourBlur[c]![i]! / weightBlur[i]!;
      rgba[i * 4 + c] = Math.round(rgba[i * 4 + c]! * (1 - pull) + interior * pull);
    }
  }
  return rgba;
}
