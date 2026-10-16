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
      style.kind === 'plaque' && (hasText || !options.forExport) ? plaqueRect(layout, style, fitCaption(caption, style)) : null;
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
  // Inside the frame's outline, so only the shadow shows past its edges.
  // Narrower at the top, so the shadow reads slightly wider at the bottom corners.
  ctx.beginPath();
  ctx.moveTo(outer.x + outer.width * 0.012, outer.y + outer.height * 0.02);
  ctx.lineTo(outer.x + outer.width * 0.988, outer.y + outer.height * 0.02);
  ctx.lineTo(outer.x + outer.width - 1 / scale, outer.y + outer.height - 1 / scale);
  ctx.lineTo(outer.x + 1 / scale, outer.y + outer.height - 1 / scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The picture in the window: his photo, or the soft neutral backdrop when there is none. */
export function drawWindowContent(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  photo: { image: CanvasImageSource; width: number; height: number; view: View } | null,
): void {
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
  ctx.drawImage(photo.image, rect.x, rect.y, rect.width, rect.height);
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
