import type { Rect } from './layout';

/**
 * How the photo sits in the frame window, independent of pixel sizes so the
 * preview, thumbnails and export agree: the image point (fractions of the
 * photo) shown at the window centre, and the zoom relative to cover-fit.
 */
export interface View {
  cx: number;
  cy: number;
  zoom: number;
}

export interface Size {
  width: number;
  height: number;
}

export const DEFAULT_VIEW: View = { cx: 0.5, cy: 0.5, zoom: 1 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

/** Scale at which the photo exactly covers the window. */
export function coverScale(window: Size, image: Size): number {
  return Math.max(window.width / image.width, window.height / image.height);
}

/** Keeps the zoom in range and the window fully covered by the photo. */
export function clampView(view: View, window: Size, image: Size): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(view.zoom) ? view.zoom : 1));
  if (window.width <= 0 || window.height <= 0) return { ...view, zoom };
  const scale = coverScale(window, image) * zoom;
  const halfWidth = window.width / 2 / (scale * image.width);
  const halfHeight = window.height / 2 / (scale * image.height);
  const clamp = (value: number, half: number) => (half >= 0.5 ? 0.5 : Math.min(1 - half, Math.max(half, value)));
  return { cx: clamp(view.cx, halfWidth), cy: clamp(view.cy, halfHeight), zoom };
}

/** Where to draw the photo, in the window's coordinate space. */
export function photoRect(view: View, window: Rect, image: Size): Rect {
  const scale = coverScale(window, image) * view.zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: window.x + window.width / 2 - view.cx * width,
    y: window.y + window.height / 2 - view.cy * height,
    width,
    height,
  };
}

/** Moves the photo by a drag of (dx, dy) window pixels. */
export function panBy(view: View, dx: number, dy: number, window: Size, image: Size): View {
  const scale = coverScale(window, image) * view.zoom;
  return clampView({ ...view, cx: view.cx - dx / (scale * image.width), cy: view.cy - dy / (scale * image.height) }, window, image);
}

/**
 * Zooms by `factor`, keeping the photo point under `anchor` still. The anchor is
 * in window pixels relative to the window centre (0, 0 zooms around the centre).
 */
export function zoomAt(view: View, factor: number, anchor: { x: number; y: number }, window: Size, image: Size): View {
  const before = coverScale(window, image) * view.zoom;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
  const after = coverScale(window, image) * zoom;
  const u = view.cx + anchor.x / (before * image.width);
  const v = view.cy + anchor.y / (before * image.height);
  return clampView({ cx: u - anchor.x / (after * image.width), cy: v - anchor.y / (after * image.height), zoom }, window, image);
}
