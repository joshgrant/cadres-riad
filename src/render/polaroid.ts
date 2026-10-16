import { captionPlacement, captionStyle, fitCaption, fontString } from './caption';
import type { FrameLayout, Rect } from './layout';

/**
 * Polaroid: one sheet of instant-film card, not a moulding. Rounded corners,
 * paper texture, corners lifting off the surface, handwritten caption.
 */

const PAPER = '#f4f3ef';
const INK = 'rgba(28, 32, 58, 0.92)';

function cardPath(ctx: CanvasRenderingContext2D, card: Rect): void {
  const radius = card.width * 0.008;
  ctx.beginPath();
  ctx.roundRect(card.x, card.y, card.width, card.height, radius);
}

/**
 * Fills `draw`'s shape with a shadow cast `offsetY` below it. The shape itself
 * sits under the card, which is painted over it afterwards, so only the shadow shows.
 */
function castShadow(ctx: CanvasRenderingContext2D, draw: () => void, blur: number, offsetX: number, offsetY: number, alpha: number): void {
  // Shadow blur and offset are in device pixels, unaffected by the transform.
  const scale = ctx.getTransform().a || 1;
  ctx.save();
  ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
  ctx.shadowBlur = blur * scale;
  ctx.shadowOffsetX = offsetX * scale;
  ctx.shadowOffsetY = offsetY * scale;
  ctx.fillStyle = PAPER;
  draw();
  ctx.fill();
  ctx.restore();
}

/** How far the card's shadow reaches beyond it, as fractions of its width (for export margins). */
export const POLAROID_SHADOW_EXTENT = { side: 0.045, top: 0.01, bottom: 0.085 };

/** The card, its shadows, texture and caption. Cached; the photo is drawn on top afterwards. */
export function drawPolaroidCard(ctx: CanvasRenderingContext2D, layout: FrameLayout, caption: string): void {
  const card = layout.frame;
  if (card.width <= 0 || card.height <= 0) return;
  const { x, y, width: w, height: h } = card;
  const dpr = ctx.getTransform().a || 1;

  // Contact shadow along the whole card, where it rests on the surface.
  castShadow(ctx, () => cardPath(ctx, card), h * 0.008, 0, h * 0.004, 0.3);
  // The card lifts off the surface: a soft shadow across its full width, falling
  // further where the curled lower corners stand highest.
  castShadow(
    ctx,
    () => {
      const inset = w * 0.01;
      ctx.beginPath();
      ctx.moveTo(x + inset, y + h * 0.3);
      ctx.lineTo(x + w - inset, y + h * 0.3);
      ctx.lineTo(x + w - inset, y + h - h * 0.01);
      // The middle of the bottom edge stays closer to the surface than the corners.
      ctx.quadraticCurveTo(x + w / 2, y + h - h * 0.03, x + inset, y + h - h * 0.01);
      ctx.closePath();
    },
    h * 0.03,
    0,
    h * 0.02,
    0.3,
  );
  // Each lifted corner throws a slightly wider, softer shadow, out and down.
  for (const side of [-1, 1] as const) {
    const cornerX = side < 0 ? x : x + w;
    castShadow(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cornerX - side * w * 0.09, y + h * 0.965, w * 0.08, h * 0.025, 0, 0, Math.PI * 2);
      },
      h * 0.025,
      side * w * 0.01,
      h * 0.02,
      0.16,
    );
  }

  ctx.save();
  cardPath(ctx, card);
  ctx.clip();

  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, w, h);

  // Paper grain and the fine embossed texture of instant-film stock.
  const pattern = paperPattern(ctx);
  if (pattern) {
    const tile = w / 9;
    pattern.setTransform(new DOMMatrix().translate(x, y).scale(tile / PAPER_TILE));
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = pattern;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // Light from above: the sheet is a touch brighter at the top.
  const fall = ctx.createLinearGradient(0, y, 0, y + h);
  fall.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
  fall.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
  fall.addColorStop(1, 'rgba(0, 0, 0, 0.035)');
  ctx.fillStyle = fall;
  ctx.fillRect(x, y, w, h);

  // Curled corners turn slightly away from the light.
  for (const cornerX of [x, x + w]) {
    const curl = ctx.createRadialGradient(cornerX, y + h, 0, cornerX, y + h, w * 0.3);
    curl.addColorStop(0, 'rgba(0, 0, 0, 0.07)');
    curl.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = curl;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  // A hairline highlight along the top edge, a faint darker one at the bottom.
  ctx.save();
  cardPath(ctx, card);
  ctx.clip();
  ctx.lineWidth = Math.max(1 / dpr, w * 0.002);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.moveTo(x, y + ctx.lineWidth / 2);
  ctx.lineTo(x + w, y + ctx.lineWidth / 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  cardPath(ctx, card);
  ctx.stroke();
  ctx.restore();

  drawCaption(ctx, layout, caption);
}

/** After the photo: the picture sits a hair below the card surface, with a faint sheen. */
export function drawPolaroidWindowOverlay(ctx: CanvasRenderingContext2D, layout: FrameLayout): void {
  const { window: inner } = layout;
  if (inner.width <= 0 || inner.height <= 0) return;
  ctx.save();
  const top = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.height * 0.006);
  top.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
  top.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(inner.x, inner.y, inner.width, inner.height * 0.006);

  const sheen = ctx.createLinearGradient(inner.x, inner.y, inner.x + inner.width, inner.y + inner.height);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
  sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0.03)');
  ctx.fillStyle = sheen;
  ctx.fillRect(inner.x, inner.y, inner.width, inner.height);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = Math.max(1 / (ctx.getTransform().a || 1), inner.width * 0.0015);
  ctx.strokeRect(inner.x, inner.y, inner.width, inner.height);
  ctx.restore();
}

function drawCaption(ctx: CanvasRenderingContext2D, layout: FrameLayout, caption: string): void {
  const style = captionStyle('polaroid', layout);
  const fitted = fitCaption(caption, style);
  if (!fitted.text) return;
  const placement = captionPlacement(style, fitted.fontSize);
  ctx.save();
  ctx.font = fontString(style, fitted.fontSize);
  ctx.translate(placement.centerX, placement.baseline);
  ctx.rotate((placement.rotation * Math.PI) / 180);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  // Ink bleeds a little into the paper.
  ctx.shadowColor = 'rgba(28, 32, 58, 0.35)';
  ctx.shadowBlur = fitted.fontSize * 0.04 * (ctx.getTransform().a || 1);
  ctx.fillText(fitted.text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillText(fitted.text, 0, 0);
  ctx.restore();
}

const PAPER_TILE = 256;
let paperTile: HTMLCanvasElement | undefined;

/** Seeded, so the paper is identical in every render and export. Values around white for multiply. */
function paperPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (!paperTile) {
    paperTile = document.createElement('canvas');
    paperTile.width = PAPER_TILE;
    paperTile.height = PAPER_TILE;
    const tileCtx = paperTile.getContext('2d');
    if (!tileCtx) return null;
    const image = tileCtx.createImageData(PAPER_TILE, PAPER_TILE);
    let seed = 0x2545f491;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    // Fine grain plus a staggered grid of soft dimples, like embossed card stock.
    const pitch = PAPER_TILE / 32;
    for (let py = 0; py < PAPER_TILE; py++) {
      for (let px = 0; px < PAPER_TILE; px++) {
        const row = Math.floor(py / pitch);
        const ox = (row % 2) * (pitch / 2);
        const col = Math.floor((px + ox) / pitch);
        // Jitter each dimple a little so the grid never reads as lines.
        const jx = (hash(col, row) - 0.5) * pitch * 0.5;
        const jy = (hash(row, col + 97) - 0.5) * pitch * 0.5;
        const dx = ((px + ox) % pitch) - pitch / 2 - jx;
        const dy = (py % pitch) - pitch / 2 - jy;
        const dimple = Math.exp(-(dx * dx + dy * dy) / (pitch * pitch * 0.08));
        // Lit from above: the upper half of each dimple is in shade.
        const relief = dimple * (dy < 0 ? 1 : -0.5);
        const value = 255 - 6 - relief * 12 - random() * 8;
        const i = (py * PAPER_TILE + px) * 4;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value - 1;
        image.data[i + 3] = 255;
      }
    }
    tileCtx.putImageData(image, 0, 0);
  }
  return ctx.createPattern(paperTile, 'repeat');
}

/** Cheap deterministic hash of a grid cell to [0, 1). The tile wraps every 32 cells. */
function hash(a: number, b: number): number {
  let h = ((((a % 32) + 32) % 32) * 374761393 + (((b % 32) + 32) % 32) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
