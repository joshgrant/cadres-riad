/**
 * Neutre: the built-in studio backdrop. A warm-grey radial gradient with fine,
 * seeded grain, so it renders identically every time.
 */
export function drawNeutralBackdrop(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  if (width <= 0 || height <= 0) return;
  const cx = x + width / 2;
  const cy = y + height * 0.42;
  const radius = Math.hypot(width, height) * 0.62;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, '#d9d4cc');
  gradient.addColorStop(0.55, '#c3bdb3');
  gradient.addColorStop(1, '#9c968d');
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = grainPattern(ctx) ?? 'transparent';
  ctx.translate(x, y);
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

let grain: HTMLCanvasElement | undefined;

function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (!grain) {
    const size = 128;
    grain = document.createElement('canvas');
    grain.width = size;
    grain.height = size;
    const grainCtx = grain.getContext('2d');
    if (!grainCtx) return null;
    const image = grainCtx.createImageData(size, size);
    let seed = 0x9e3779b9;
    for (let i = 0; i < image.data.length; i += 4) {
      // xorshift32: fixed seed, same grain on every render.
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const value = (seed >>> 0) % 256;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    grainCtx.putImageData(image, 0, 0);
  }
  return ctx.createPattern(grain, 'repeat');
}
