import type { Orientation } from '../app/prefs';
import type { FrameId } from './ids';

/** Rail widths from the spec, as fractions of the framed object's short side. */
export interface FrameGeometry {
  rail: number;
  /** Top border, when it differs (Polaroid). */
  topRail?: number;
  /** Bottom rail, when it differs (Polaroid). */
  bottomRail?: number;
  /** Fixed window aspect (width / height); otherwise 4:3 or 3:4 by orientation. */
  windowAspect?: number;
  /** Only ever shown upright (Polaroid). */
  portraitOnly?: boolean;
}

export const FRAME_GEOMETRY: Record<FrameId, FrameGeometry> = {
  dore: { rail: 0.11 },
  noyer: { rail: 0.09 },
  brut: { rail: 0.1 },
  chene: { rail: 0.07 },
  noir: { rail: 0.07 },
  blanc: { rail: 0.07 },
  // Instant-film card proportions: 88 × 107 mm with a 79 × 79 mm picture.
  polaroid: { rail: 4.5 / 88, topRail: 6 / 88, bottomRail: 22 / 88, windowAspect: 1, portraitOnly: true },
};

/**
 * Flat stand-in colours until the WebGL frame renderer lands (milestone 3).
 * Not design tokens: they describe the frames' materials, not the UI.
 */
export const PLACEHOLDER_COLOURS: Record<FrameId, { face: string; lip: string }> = {
  dore: { face: '#b8913a', lip: '#5a3a1e' },
  noyer: { face: '#4a3324', lip: '#c9a24a' },
  brut: { face: '#8a6a4a', lip: '#5e4630' },
  chene: { face: '#c9a97a', lip: '#a88a5e' },
  noir: { face: '#1c1b1a', lip: '#0c0c0c' },
  blanc: { face: '#f2efe8', lip: '#dcd7cc' },
  polaroid: { face: '#f4f3ef', lip: '#e2e0da' },
};

/** Polaroid ignores the rotate setting: it is always an upright card. */
export function effectiveOrientation(frame: FrameId, orientation: Orientation): Orientation {
  return FRAME_GEOMETRY[frame].portraitOnly ? 'portrait' : orientation;
}
