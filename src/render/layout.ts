import type { Orientation } from '../app/prefs';
import type { FrameGeometry } from '../frames/geometry';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameLayout {
  /** Outer edge of the frame. */
  frame: Rect;
  /** The photo window inside the rails. */
  window: Rect;
  rails: { top: number; right: number; bottom: number; left: number };
}

/** Window aspect is fixed for every frame: 4:3 landscape, 3:4 portrait. */
export function windowAspect(orientation: Orientation): number {
  return orientation === 'landscape' ? 4 / 3 : 3 / 4;
}

/**
 * Frame proportions for a window of unit height. Rails are fractions of the
 * frame's own short side, so solve for the outer size first.
 */
export function frameProportions(geometry: FrameGeometry, orientation: Orientation) {
  const aspect = windowAspect(orientation);
  const side = geometry.rail;
  const bottom = geometry.bottomRail ?? geometry.rail;
  const windowWidth = aspect;
  const windowHeight = 1;
  // Outer size if the short side is S: width = ww + 2·side·S, height = wh + (side + bottom)·S.
  // Try each side as the short one and keep the consistent solution.
  const sIfHeight = windowHeight / (1 - side - bottom);
  const widthIfHeight = windowWidth + 2 * side * sIfHeight;
  const short = widthIfHeight >= sIfHeight ? sIfHeight : windowWidth / (1 - 2 * side);
  const width = windowWidth + 2 * side * short;
  const height = windowHeight + (side + bottom) * short;
  return {
    width,
    height,
    rails: { top: side * short, right: side * short, bottom: bottom * short, left: side * short },
  };
}

/** Largest frame that fits `bounds`, centred. All values in the caller's units. */
export function fitFrame(bounds: Rect, geometry: FrameGeometry, orientation: Orientation): FrameLayout {
  const unit = frameProportions(geometry, orientation);
  const scale = Math.max(0, Math.min(bounds.width / unit.width, bounds.height / unit.height));
  const width = unit.width * scale;
  const height = unit.height * scale;
  const x = bounds.x + (bounds.width - width) / 2;
  const y = bounds.y + (bounds.height - height) / 2;
  const rails = {
    top: unit.rails.top * scale,
    right: unit.rails.right * scale,
    bottom: unit.rails.bottom * scale,
    left: unit.rails.left * scale,
  };
  return {
    frame: { x, y, width, height },
    window: {
      x: x + rails.left,
      y: y + rails.top,
      width: width - rails.left - rails.right,
      height: height - rails.top - rails.bottom,
    },
    rails,
  };
}
