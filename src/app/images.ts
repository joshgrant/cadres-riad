import type { Rect } from '../render/layout';

/** Re-encodes `bitmap` (or the `crop` of it) with its long edge at most `edge`. */
export async function resized(bitmap: ImageBitmap, edge: number, type: 'image/jpeg' | 'image/png', crop?: Rect): Promise<Blob> {
  const source = crop ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const scale = Math.min(1, edge / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), type, 0.9),
  );
}

/** The smallest box holding every pixel that isn't fully transparent; null if there is none. */
export function alphaBounds(data: Uint8ClampedArray, width: number, height: number): Rect | null {
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] === 0) continue;
      if (y < top) top = y;
      bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** The visible part of an image with transparent margins (the whole image when there are none). */
export function visibleBounds(bitmap: ImageBitmap): Rect {
  const whole = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return whole;
  ctx.drawImage(bitmap, 0, 0);
  try {
    return alphaBounds(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, bitmap.height) ?? whole;
  } catch {
    return whole;
  }
}
