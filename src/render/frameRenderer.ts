import type { FrameId } from '../frames/ids';
import { MATERIALS, SEEDS } from '../frames/materials';
import { captionMask, captionStyle, fitCaption, plaqueRect } from './caption';
import { drawMoulding } from './gl/moulding';
import { drawNeutralBackdrop } from './backdrop';
import type { FrameLayout } from './layout';
import { drawPlaceholderFrame, drawWindowShadow } from './placeholderFrame';
import { POLAROID_SHADOW_EXTENT, drawPolaroidCard, drawPolaroidWindowOverlay } from './polaroid';
import { photoRect, type View } from './view';

/**
 * One renderer for the preview, the sidebar thumbnails and (later) the export.
 * Layers, back to front: frame layer (cached) → photo → window overlay.
 */

export interface FrameLayerOptions {
  /** While the caption is being edited the live field shows the text; the plaque still sizes to it. */
  hideText?: boolean;
  /** The export leaves an empty caption's plaque out entirely. */
  forExport?: boolean;
}

/** Everything that doesn't move while he pans and zooms: shadow, frame, caption. */
export function drawFrameLayer(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  frame: FrameId,
  caption: string,
  options: FrameLayerOptions = {},
): void {
  if (frame === 'polaroid') {
    drawPolaroidCard(ctx, layout, options.hideText ? '' : caption);
    return;
  }
  const material = MATERIALS[frame];
  if (material) {
    drawWallShadow(ctx, layout);
    const style = captionStyle(frame, layout);
    const hasText = caption.trim().length > 0;
    const plaque =
      style.kind === 'plaque' && (hasText || !options.forExport)
        ? { rect: plaqueRect(layout, style, fitCaption(caption, style)), aged: frame === 'brut' }
        : null;
    const drawn = drawMoulding(
      ctx,
      layout,
      frame,
      material,
      SEEDS[frame],
      (scale) => (options.hideText ? null : captionMask(layout, style, caption, scale)),
      plaque,
    );
    if (drawn) return;
  }
  drawPlaceholderFrame(ctx, layout, frame, { wallShadow: true });
}

/** The frame hangs on a wall lit from above: shadow offset down ~1.5%, blur ~4%, ~35% opacity. */
function drawWallShadow(ctx: CanvasRenderingContext2D, layout: FrameLayout): void {
  const { frame: outer } = layout;
  const scale = ctx.getTransform().a || 1;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = outer.height * 0.04 * scale;
  ctx.shadowOffsetY = outer.height * 0.015 * scale;
  ctx.fillStyle = '#808080';
  // Well inside the frame's outline (rough edges included), so only the shadow
  // shows past it; narrower at the top, so it reads wider at the bottom corners.
  const inset = Math.min(layout.rails.left, layout.rails.bottom) * 0.15;
  ctx.beginPath();
  ctx.moveTo(outer.x + outer.width * 0.012 + inset, outer.y + outer.height * 0.02 + inset);
  ctx.lineTo(outer.x + outer.width * 0.988 - inset, outer.y + outer.height * 0.02 + inset);
  ctx.lineTo(outer.x + outer.width - inset, outer.y + outer.height - inset);
  ctx.lineTo(outer.x + inset, outer.y + outer.height - inset);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface WindowPhoto {
  image: CanvasImageSource;
  width: number;
  height: number;
  view: View;
  /** With détourage: the people layer (same aspect as the photo) and the background behind them. */
  cutout?: { image: CanvasImageSource; background: CanvasImageSource | null; backgroundSize?: { width: number; height: number } } | null;
}

/**
 * The picture in the window, back to front: the background (or the photo when
 * détourage is off), then the people layer with its pan and zoom. With no photo,
 * the soft neutral backdrop.
 */
export function drawWindowContent(ctx: CanvasRenderingContext2D, layout: FrameLayout, photo: WindowPhoto | null): void {
  const { window: inner } = layout;
  if (inner.width <= 0 || inner.height <= 0) return;
  if (!photo) {
    drawNeutralBackdrop(ctx, inner.x, inner.y, inner.width, inner.height);
    return;
  }
  const rect = photoRect(photo.view, inner, photo);
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.width, inner.height);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  if (photo.cutout) {
    const { background, backgroundSize } = photo.cutout;
    if (background && backgroundSize) {
      // The background fills the window: cover, centred, fixed.
      const cover = photoRect({ cx: 0.5, cy: 0.5, zoom: 1 }, inner, backgroundSize);
      ctx.drawImage(background, cover.x, cover.y, cover.width, cover.height);
    } else {
      drawNeutralBackdrop(ctx, inner.x, inner.y, inner.width, inner.height);
    }
    ctx.drawImage(photo.cutout.image, rect.x, rect.y, rect.width, rect.height);
  } else {
    ctx.drawImage(photo.image, rect.x, rect.y, rect.width, rect.height);
  }
  ctx.restore();
}

/** Inner shadow cast by the frame onto the picture. */
export function drawWindowOverlay(ctx: CanvasRenderingContext2D, layout: FrameLayout, frame: FrameId): void {
  if (frame === 'polaroid') drawPolaroidWindowOverlay(ctx, layout);
  else drawWindowShadow(ctx, layout, frame);
}

/**
 * How far a frame's shadow reaches past its edges, in the frame's own units,
 * so the export margin never clips it. Wall shadow: down ~1.5%, blur ~4% of height.
 */
export function shadowExtent(frame: FrameId, size: { width: number; height: number }) {
  if (frame === 'polaroid') {
    return {
      side: POLAROID_SHADOW_EXTENT.side * size.width,
      top: POLAROID_SHADOW_EXTENT.top * size.width,
      bottom: POLAROID_SHADOW_EXTENT.bottom * size.width,
    };
  }
  return { side: size.height * 0.045, top: size.height * 0.03, bottom: size.height * 0.06 };
}
