import type { FrameId } from './ids';

/** Rail widths from the spec, as fractions of the framed object's short side. */
export interface FrameGeometry {
  rail: number;
  /** Bottom rail, when it differs (Polaroid). */
  bottomRail?: number;
}

export const FRAME_GEOMETRY: Record<FrameId, FrameGeometry> = {
  dore: { rail: 0.11 },
  noyer: { rail: 0.09 },
  brut: { rail: 0.1 },
  chene: { rail: 0.07 },
  noir: { rail: 0.07 },
  blanc: { rail: 0.07 },
  polaroid: { rail: 0.06, bottomRail: 0.24 },
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
