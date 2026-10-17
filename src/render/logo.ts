import type { Rect } from './layout';
import type { Size } from './view';

/**
 * Where the logo sits in the frame window, independent of pixel sizes so the
 * preview and export agree: its top-left corner as fractions of the window's
 * width and height, and its width as a fraction of the window's width. The
 * logo's own aspect gives its height. It always stays whole inside the window.
 */
export interface LogoPlacement {
  x: number;
  y: number;
  width: number;
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** Top left, a fifth of the window wide. */
export const DEFAULT_LOGO_PLACEMENT: LogoPlacement = { x: 0.03, y: 0.04, width: 0.2 };
export const MIN_LOGO_WIDTH = 0.05;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

/** Keeps the logo between its minimum size and the largest that fits, and wholly inside the window. */
export function clampLogo(placement: LogoPlacement, window: Size, aspect: number): LogoPlacement {
  if (window.width <= 0 || window.height <= 0 || !(aspect > 0)) return placement;
  const maxWidth = Math.min(1, (aspect * window.height) / window.width);
  const width = clamp(finite(placement.width, DEFAULT_LOGO_PLACEMENT.width), Math.min(MIN_LOGO_WIDTH, maxWidth), maxWidth);
  const height = (width * window.width) / aspect / window.height;
  return {
    x: clamp(finite(placement.x, DEFAULT_LOGO_PLACEMENT.x), 0, 1 - width),
    y: clamp(finite(placement.y, DEFAULT_LOGO_PLACEMENT.y), 0, 1 - height),
    width,
  };
}

/** Where to draw the logo, in the window's coordinate space. */
export function logoRect(placement: LogoPlacement, window: Rect, aspect: number): Rect {
  const { x, y, width } = clampLogo(placement, window, aspect);
  const pixelWidth = width * window.width;
  return { x: window.x + x * window.width, y: window.y + y * window.height, width: pixelWidth, height: pixelWidth / aspect };
}

/** Moves the logo by (dx, dy) window pixels. */
export function moveLogo(placement: LogoPlacement, dx: number, dy: number, window: Size, aspect: number): LogoPlacement {
  if (window.width <= 0 || window.height <= 0) return placement;
  return clampLogo({ ...placement, x: placement.x + dx / window.width, y: placement.y + dy / window.height }, window, aspect);
}

/**
 * Drags `corner` by (dx, dy) window pixels. The opposite corner stays put and
 * the aspect is kept: the drag is projected onto the logo's diagonal.
 */
export function resizeLogo(
  placement: LogoPlacement,
  corner: Corner,
  dx: number,
  dy: number,
  window: Size,
  aspect: number,
): LogoPlacement {
  if (window.width <= 0 || window.height <= 0 || !(aspect > 0)) return placement;
  const start = clampLogo(placement, window, aspect);
  const x0 = start.x * window.width;
  const y0 = start.y * window.height;
  const w0 = start.width * window.width;
  const h0 = w0 / aspect;
  const sx = corner === 'ne' || corner === 'se' ? 1 : -1;
  const sy = corner === 'sw' || corner === 'se' ? 1 : -1;
  // Room from the fixed corner to the window edges the logo grows towards.
  const roomWidth = sx > 0 ? window.width - x0 : x0 + w0;
  const roomHeight = sy > 0 ? window.height - y0 : y0 + h0;
  const max = Math.min(roomWidth, roomHeight * aspect);
  const min = Math.min(MIN_LOGO_WIDTH * window.width, max);
  const width = clamp(w0 * (1 + (sx * dx * w0 + sy * dy * h0) / (w0 * w0 + h0 * h0)), min, max);
  const x = sx > 0 ? x0 : x0 + w0 - width;
  const y = sy > 0 ? y0 : y0 + h0 - width / aspect;
  return clampLogo({ x: x / window.width, y: y / window.height, width: width / window.width }, window, aspect);
}

/** Scales the logo around its centre (keyboard + and −). */
export function scaleLogo(placement: LogoPlacement, factor: number, window: Size, aspect: number): LogoPlacement {
  if (window.width <= 0 || window.height <= 0 || !(aspect > 0)) return placement;
  const start = clampLogo(placement, window, aspect);
  const height = (start.width * window.width) / aspect / window.height;
  const width = clampLogo({ ...start, width: start.width * factor }, window, aspect).width;
  const nextHeight = (width * window.width) / aspect / window.height;
  return clampLogo(
    { x: start.x + (start.width - width) / 2, y: start.y + (height - nextHeight) / 2, width },
    window,
    aspect,
  );
}
