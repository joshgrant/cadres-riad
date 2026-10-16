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
  dore: 'engraved',
  noyer: 'plaque',
  brut: 'plaque',
  chene: 'engraved',
  noir: 'engraved',
  blanc: 'engraved',
  polaroid: 'ink',
};

const SERIF = "'Cormorant Garamond', 'Times New Roman', serif";

/**
 * One caption size for every framed (serif) caption, as a fraction of the
 * frame's short side, so the text reads the same whichever frame he picks.
 */
const SERIF_SIZE = 0.038;
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
  const serifSize = Math.min(outer.width, outer.height) * SERIF_SIZE;
  if (kind === 'ink') {
    const box = polaroidCaptionBox(layout);
    return { kind, family: HAND, weight: 500, box, fontSize: rails.bottom * 0.3, letterSpacing: 0, color: 'rgba(28, 32, 58, 0.92)' };
  }
  if (kind === 'plaque') {
    // Brass plaque: 68% of the rail's height (a smaller plate on Bois brut),
    // centred on it; text padded by 1.2× its cap height plus room for the screws.
    const height = rails.bottom * (frame === 'brut' ? 0.66 : 0.68);
    const fontSize = serifSize;
    const pad = plaquePadding(height, fontSize);
    const width = outer.width * 0.7 - 2 * pad;
    const centreY = outer.y + outer.height - rails.bottom / 2;
    const box = { x: outer.x + (outer.width - width) / 2, y: centreY - height / 2, width, height };
    return { kind, family: SERIF, weight: 600, box, fontSize, letterSpacing: fontSize * 0.04, color: '#231c14' };
  }
  // Engraved and burned text runs along the bottom rail, 8% clear of each end.
  const margin = outer.width * 0.08;
  const box = { x: outer.x + margin, y: outer.y + outer.height - rails.bottom, width: outer.width - 2 * margin, height: rails.bottom };
  const colors: Record<FrameId, string> = {
    dore: '#1a140d',
    noyer: '#231c14',
    brut: '#1a150f',
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
    fontSize: serifSize,
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
  /** Rendered width at fontSize, in layout units. */
  width: number;
  /** False when even the smallest size overflows: the editor refuses more characters. */
  fits: boolean;
}

/** Shrinks the font, down to 60% of nominal, until the text fits the box. */
export function fitCaption(caption: string, style: CaptionStyle): FittedCaption {
  const text = frenchSpacing(caption.trim());
  const nominal = style.fontSize;
  const width = measure(text, style, nominal);
  if (width <= style.box.width) return { text, fontSize: nominal, width, fits: true };
  const size = nominal * (style.box.width / width);
  if (size >= nominal * MIN_FONT_RATIO) return { text, fontSize: size, width: style.box.width, fits: true };
  const min = nominal * MIN_FONT_RATIO;
  return { text, fontSize: min, width: width * MIN_FONT_RATIO, fits: false };
}

function plaquePadding(height: number, fontSize: number): number {
  return 1.2 * 0.63 * fontSize + height * 0.42;
}

/** The plaque itself: as wide as its text needs, between 34% and 70% of the rail. */
export function plaqueRect(layout: FrameLayout, style: CaptionStyle, fitted: FittedCaption): Rect {
  const rail = layout.frame.width;
  const pad = plaquePadding(style.box.height, style.fontSize);
  const width = Math.min(rail * 0.7, Math.max(rail * 0.34, (fitted.text ? fitted.width : 0) + 2 * pad));
  return { x: style.box.x + style.box.width / 2 - width / 2, y: style.box.y, width, height: style.box.height };
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
  // Cap height is about 0.63em, so this centres capitals on the rail or plate.
  return { centerX: box.x + box.width / 2, baseline: box.y + box.height * 0.5 + fontSize * 0.31, rotation: 0 };
}

/** Distance from the top of a `line-height: 1` box to the baseline, in em, per family. */
export function baselineRatio(style: CaptionStyle): number {
  return style.kind === 'ink' ? 0.83 : 0.82;
}

/**
 * Upright caption mask for the GL frames, in frame-local pixels at `scale`.
 * Opaque RGB channels: R the sharp text, G a soft halo (6% of the rail
 * width), B a wide blur (25%) for the smoothed patch under burned text.
 */
export function captionMask(layout: FrameLayout, style: CaptionStyle, caption: string, scale: number) {
  const fitted = fitCaption(caption, style);
  if (!fitted.text) return null;
  const pad = style.box.height * 0.4;
  const rect = {
    x: (style.box.x - layout.frame.x - pad) * scale,
    y: (style.box.y - layout.frame.y) * scale,
    width: (style.box.width + 2 * pad) * scale,
    height: style.box.height * scale,
  };
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const text = document.createElement('canvas');
  text.width = width;
  text.height = height;
  const ctx = text.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  const size = fitted.fontSize * scale;
  ctx.font = fontString(style, size);
  ctx.letterSpacing = `${style.letterSpacing * (fitted.fontSize / style.fontSize) * scale}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  const placement = captionPlacement(style, fitted.fontSize);
  ctx.fillText(fitted.text, (placement.centerX - layout.frame.x) * scale - rect.x, (placement.baseline - layout.frame.y) * scale - rect.y);

  const rail = layout.rails.bottom * scale;
  const sharp = ctx.getImageData(0, 0, width, height).data;
  const halo = blurred(text, rail * 0.06);
  const wide = blurred(text, rail * 0.25);
  const out = ctx.createImageData(width, height);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = sharp[i]!;
    out.data[i + 1] = halo[i]!;
    out.data[i + 2] = wide[i]!;
    out.data[i + 3] = 255;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.putImageData(out, 0, 0);
  return { canvas, rect, halfWidth: (fitted.width / 2) * scale };
}

/**
 * A blur of roughly `radius` pixels without ctx.filter (missing in older WebKit):
 * shrink with smoothing, then scale back up, twice.
 */
function blurred(source: HTMLCanvasElement, radius: number): Uint8ClampedArray {
  const { width, height } = source;
  const factor = Math.max(1, radius / 1.5);
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(width / factor));
  small.height = Math.max(1, Math.round(height / factor));
  const smallCtx = small.getContext('2d')!;
  smallCtx.imageSmoothingQuality = 'high';
  const big = document.createElement('canvas');
  big.width = width;
  big.height = height;
  const bigCtx = big.getContext('2d')!;
  bigCtx.imageSmoothingQuality = 'high';
  bigCtx.drawImage(source, 0, 0);
  for (let pass = 0; pass < 2; pass++) {
    smallCtx.clearRect(0, 0, small.width, small.height);
    smallCtx.drawImage(big, 0, 0, small.width, small.height);
    bigCtx.clearRect(0, 0, width, height);
    bigCtx.drawImage(small, 0, 0, width, height);
  }
  return bigCtx.getImageData(0, 0, width, height).data;
}
