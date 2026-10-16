import type { FrameId } from '../frames/ids';
import { drawNeutralBackdrop } from './backdrop';
import type { FrameLayout } from './layout';
import { drawPlaceholderFrame, drawWindowShadow } from './placeholderFrame';
import { POLAROID_SHADOW_EXTENT, drawPolaroidCard, drawPolaroidWindowOverlay } from './polaroid';
import { photoRect, type View } from './view';

/**
 * One renderer for the preview, the sidebar thumbnails and (later) the export.
 * Layers, back to front: frame layer (cached) → photo → window overlay.
 */

/** Everything that doesn't move while he pans and zooms: shadow, frame, caption. */
export function drawFrameLayer(ctx: CanvasRenderingContext2D, layout: FrameLayout, frame: FrameId, caption: string): void {
  if (frame === 'polaroid') drawPolaroidCard(ctx, layout, caption);
  else drawPlaceholderFrame(ctx, layout, frame, { wallShadow: true });
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
