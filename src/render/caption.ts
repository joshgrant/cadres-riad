import type { FrameId } from '../frames/ids';
import { frenchSpacing } from '../i18n/typography';
import type { FrameLayout, Rect } from './layout';

/**
 * Where and how the caption sits on each frame. The renderer draws from this,
 * and the editor places its live text field exactly over it.
 */

export const CAPTION_MAX_LENGTH = 60;
export const MIN_FONT_RATIO = 0.6;

export type CaptionKind = 'engraved' | 'burned' | 'plaque' | 'ink';

export interface CaptionStyle {
  kind: CaptionKind;
  family: string;
  weight: number;
  /** The area the text may use, in layout units. */
  box: Rect;
  /** Nominal font size in layout units; shrinks down to MIN_FONT_RATIO to fit. */
  fontSize: number;
  letterSpacing: number;
  /** Editor overlay colour while typing (the frame's text colour, roughly). */
  color: string;
}

export const CAPTION_KIND: Record<FrameId, CaptionKind> = {
  dore: 'plaque',
  noyer: 'plaque',
  brut: 'burned',
  chene: 'engraved',
  noir: 'engraved',
  blanc: 'engraved',
  polaroid: 'ink',
};

const SERIF = "'Cormorant Garamond', 'Times New Roman', serif";
const HAND = "Caveat, 'Segoe Print', 'Bradley Hand', cursive";

/** The Polaroid's caption area on its bottom strip. */
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

export function captionStyle(frame: FrameId, layout: FrameLayout): CaptionStyle {
  const kind = CAPTION_KIND[frame];
  const { frame: outer, rails } = layout;
  if (kind === 'ink') {
    const box = polaroidCaptionBox(layout);
    return { kind, family: HAND, weight: 500, box, fontSize: rails.bottom * 0.3, letterSpacing: 0, color: 'rgba(28, 32, 58, 0.92)' };
  }
  // Engraved and burned text runs along the bottom rail, 8% clear of each end.
  const margin = outer.width * 0.08;
  const box = { x: outer.x + margin, y: outer.y + outer.height - rails.bottom, width: outer.width - 2 * margin, height: rails.bottom };
  const colors: Record<FrameId, string> = {
    dore: '#231c14',
    noyer: '#231c14',
    brut: '#2a1608',
    chene: '#6b5136',
    noir: '#3a3633',
    blanc: '#9a948a',
    polaroid: '#1c203a',
  };
  return {
    kind,
    family: SERIF,
    weight: kind === 'burned' ? 700 : 600,
    box,
    fontSize: rails.bottom * 0.46,
    letterSpacing: rails.bottom * 0.02,
    color: colors[frame],
  };
}

export function fontString(style: CaptionStyle, size: number): string {
  return `${style.weight} ${size}px ${style.family}`;
}

let measurer: CanvasRenderingContext2D | null = null;

function measure(text: string, style: CaptionStyle, size: number): number {
  measurer ??= document.createElement('canvas').getContext('2d');
  if (!measurer) return text.length * size * 0.5;
  measurer.font = fontString(style, size);
  measurer.letterSpacing = `${style.letterSpacing * (size / style.fontSize)}px`;
  return measurer.measureText(text).width;
}

export interface FittedCaption {
  text: string;
  fontSize: number;
  /** False when even the smallest size overflows: the editor refuses more characters. */
  fits: boolean;
}

/** Shrinks the font, down to 60% of nominal, until the text fits the box. */
export function fitCaption(caption: string, style: CaptionStyle): FittedCaption {
  const text = frenchSpacing(caption.trim());
  const nominal = style.fontSize;
  const width = measure(text, style, nominal);
  if (width <= style.box.width) return { text, fontSize: nominal, fits: true };
  const size = nominal * (style.box.width / width);
  if (size >= nominal * MIN_FONT_RATIO) return { text, fontSize: size, fits: true };
  return { text, fontSize: nominal * MIN_FONT_RATIO, fits: false };
}

/**
 * Where the text's baseline and centre sit, in layout units, and its tilt.
 * Handwriting sits a little left of centre and is never perfectly level.
 */
export function captionPlacement(style: CaptionStyle, fontSize: number) {
  const { box } = style;
  if (style.kind === 'ink') {
    return { centerX: box.x + box.width * 0.48, baseline: box.y + box.height * 0.66, rotation: -0.8 };
  }
  return { centerX: box.x + box.width / 2, baseline: box.y + box.height * 0.5 + fontSize * 0.3, rotation: 0 };
}

/** Distance from the top of a `line-height: 1` box to the baseline, in em, per family. */
export function baselineRatio(style: CaptionStyle): number {
  return style.kind === 'ink' ? 0.83 : 0.82;
}

/** Upright text mask for the GL engraving, in frame-local pixels at `scale`. */
export function captionMask(layout: FrameLayout, style: CaptionStyle, caption: string, scale: number) {
  const fitted = fitCaption(caption, style);
  if (!fitted.text) return null;
  const pad = style.box.height * 0.2;
  const rect = {
    x: (style.box.x - layout.frame.x - pad) * scale,
    y: (style.box.y - layout.frame.y) * scale,
    width: (style.box.width + 2 * pad) * scale,
    height: style.box.height * scale,
  };
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(rect.width));
  canvas.height = Math.max(1, Math.ceil(rect.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const size = fitted.fontSize * scale;
  ctx.font = fontString(style, size);
  ctx.letterSpacing = `${style.letterSpacing * (fitted.fontSize / style.fontSize) * scale}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  const placement = captionPlacement(style, fitted.fontSize);
  ctx.fillText(fitted.text, (placement.centerX - layout.frame.x) * scale - rect.x, (placement.baseline - layout.frame.y) * scale - rect.y);
  return { canvas, rect };
}
