import { frenchSpacing } from '../i18n/typography';
import type { FrameLayout, Rect } from './layout';

/**
 * Polaroid: one sheet of instant-film card, not a moulding. Rounded corners,
 * paper texture, corners lifting off the surface, handwritten caption.
 */

const PAPER = '#f4f3ef';
const INK = 'rgba(28, 32, 58, 0.92)';
export const CAPTION_FONT_FAMILY = 'Caveat';
const CAPTION_WEIGHT = 500;

function cardPath(ctx: CanvasRenderingContext2D, card: Rect): void {
  const radius = card.width * 0.008;
  ctx.beginPath();
  ctx.roundRect(card.x, card.y, card.width, card.height, radius);
}

/** Shadow only, by drawing the shape far off-canvas and offsetting its shadow back. */
function castShadow(ctx: CanvasRenderingContext2D, draw: () => void, blur: number, offsetY: number, alpha: number): void {
  const away = 100_000;
  ctx.save();
  ctx.translate(-away, 0);
  ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = away * ctx.getTransform().a;
  ctx.shadowOffsetY = offsetY * ctx.getTransform().d;
  ctx.fillStyle = '#000';
  draw();
  ctx.fill();
  ctx.restore();
}

/** The card, its shadows, texture and caption. Cached; the photo is drawn on top afterwards. */
export function drawPolaroidCard(ctx: CanvasRenderingContext2D, layout: FrameLayout, caption: string): void {
  const card = layout.frame;
  if (card.width <= 0 || card.height <= 0) return;
  const { x, y, width: w, height: h } = card;
  const dpr = ctx.getTransform().a || 1;

  // Contact shadow where the card touches the surface.
  castShadow(ctx, () => cardPath(ctx, card), h * 0.006 * dpr, h * 0.003, 0.28);
  // The lower corners curl up, so the shadow there is softer, wider and further away.
  castShadow(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.08, y + h * 0.45);
      ctx.lineTo(x + w * 0.92, y + h * 0.45);
      ctx.quadraticCurveTo(x + w * 1.0, y + h * 0.9, x + w * 1.012, y + h * 1.008);
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.985, x - w * 0.012, y + h * 1.008);
      ctx.quadraticCurveTo(x, y + h * 0.9, x + w * 0.08, y + h * 0.45);
    },
    h * 0.035 * dpr,
    h * 0.018,
    0.32,
  );
  // Each lifted corner throws its own tighter shadow, out and down.
  for (const side of [-1, 1] as const) {
    const cornerX = side < 0 ? x : x + w;
    castShadow(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(cornerX - side * w * 0.06 + side * w * 0.008, y + h * 0.985, w * 0.08, h * 0.02, 0, 0, Math.PI * 2);
      },
      h * 0.014 * dpr,
      h * 0.012,
      0.3,
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

/** The caption's box on the bottom strip, for hit-testing and the editing overlay. */
export function polaroidCaptionBox(layout: FrameLayout): Rect {
  const strip = layout.rails.bottom;
  const { frame } = layout;
  return {
    x: frame.x + frame.width * 0.07,
    y: layout.window.y + layout.window.height + strip * 0.18,
    width: frame.width * 0.86,
    height: strip * 0.64,
  };
}

function drawCaption(ctx: CanvasRenderingContext2D, layout: FrameLayout, caption: string): void {
  const text = frenchSpacing(caption.trim());
  if (!text) return;
  const box = polaroidCaptionBox(layout);
  let size = layout.rails.bottom * 0.3;
  const font = (px: number) => `${CAPTION_WEIGHT} ${px}px ${CAPTION_FONT_FAMILY}, 'Segoe Print', 'Bradley Hand', cursive`;
  ctx.save();
  ctx.font = font(size);
  const measured = ctx.measureText(text).width;
  if (measured > box.width) {
    size *= box.width / measured;
    ctx.font = font(size);
  }
  // Handwriting sits a little left of centre and is never perfectly level.
  const cx = box.x + box.width * 0.48;
  const baseline = box.y + box.height * 0.66;
  ctx.translate(cx, baseline);
  ctx.rotate((-0.8 * Math.PI) / 180);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  // Ink bleeds a little into the paper.
  ctx.shadowColor = 'rgba(28, 32, 58, 0.35)';
  ctx.shadowBlur = size * 0.04 * (ctx.getTransform().a || 1);
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillText(text, 0, 0);
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
