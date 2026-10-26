import { FRAME_GEOMETRY } from './geometry';

/**
 * Le Nil Bleu's strips and dots, laid out once here; the shader only looks them up.
 * Working the fan out per pixel is far too slow for software WebGL (headless
 * browsers, machines without a GPU). The frame is square with equal rails, so every
 * rail has the same layout.
 *
 * Units are rail widths, in corner-local space: x along the rail from the nearer
 * outer corner, y across it from the outer edge (0) to the window (1). Strip k
 * counts from the corner's diagonal, where strip 0 sits; a negative k lies past the
 * diagonal, on the neighbouring rail, as the mirror image (x and y swapped).
 */
export const NIL = {
  /** Outer corner radius. */
  corner: (FRAME_GEOMETRY.nil.cornerRadius ?? 0) / FRAME_GEOMETRY.nil.rail,
  /** The strips fan from a point this far in from the outer corner (inside the window). */
  pivot: 3,
  /** Depth at which the strips are spaced `period` apart; they close up towards the window. */
  spacingDepth: 0.55,
  period: 0.13,
  borderIn: 0.02,
  borderOut: 0.05,
  bandIn: 0.075,
  dotRadius: 0.022,
  /** Each strip's round top, and the arch around it. */
  capCentre: 0.235,
  /** Each strip's round foot. */
  footCentre: 0.83,
  /** Strip half-width, as a fraction of the spacing. */
  strip: 0.22,
  /** Quartz channel half-width, as a fraction of the spacing. */
  channel: 0.56,
  lineIn: 0.89,
  lineOut: 0.925,
} as const;

export type Point = [number, number];

const QUARTER = Math.PI / 4;
const RAIL_LENGTH = 1 / FRAME_GEOMETRY.nil.rail;

/** From the diagonal to the end of the fan, at a depth. */
export function fanLength(depth: number): number {
  return (NIL.pivot - depth) * QUARTER;
}

/** From diagonal to diagonal, at a depth. */
function bandLength(depth: number): number {
  return 2 * fanLength(depth) + RAIL_LENGTH - 2 * NIL.pivot;
}

/** Strips between the two diagonals of a rail. */
export const STRIP_COUNT = Math.max(1, Math.round(bandLength(NIL.spacingDepth) / NIL.period));

/** The strip count is fixed, so the spacing shrinks towards the window. */
export function spacing(depth: number): number {
  return bandLength(depth) / STRIP_COUNT;
}

/** Strip index k (fractional allowed) at a depth, on that depth's (rounded) contour. */
export function stripPoint(k: number, depth: number): Point {
  const along = Math.abs(k) * spacing(depth);
  const fan = fanLength(depth);
  let p: Point =
    along >= fan
      ? [NIL.pivot + along - fan, depth]
      : [NIL.pivot - (NIL.pivot - depth) * Math.tan(QUARTER - along / (NIL.pivot - depth)), depth];
  if (p[0] < NIL.corner && p[1] < NIL.corner) {
    const dx = p[0] - NIL.corner;
    const dy = p[1] - NIL.corner;
    const scale = (NIL.corner - depth) / Math.hypot(dx, dy);
    p = [NIL.corner + dx * scale, NIL.corner + dy * scale];
  }
  return k < 0 ? [p[1], p[0]] : p;
}

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const unit = (v: Point): Point => {
  const length = Math.hypot(v[0], v[1]);
  return [v[0] / length, v[1] / length];
};

/** Spacing between strip k's neighbours at a depth, measured square to the strip. */
function spacingAcross(k: number, depth: number, axis: Point): number {
  const chord = sub(stripPoint(k + 0.5, depth), stripPoint(k - 0.5, depth));
  return Math.abs(chord[0] * axis[1] - chord[1] * axis[0]);
}

export interface Strip {
  top: Point;
  foot: Point;
  /** Spacing square to the strip at its top and its foot: the fan widens it towards the corner. */
  wideTop: number;
  wideFoot: number;
}

export function strip(k: number): Strip {
  const top = stripPoint(k, NIL.capCentre);
  const foot = stripPoint(k, NIL.footCentre);
  const axis = unit(sub(foot, top));
  return { top, foot, wideTop: spacingAcross(k, NIL.capCentre, axis), wideFoot: spacingAcross(k, NIL.footCentre, axis) };
}

/** Radius of the round top of strip k's quartz channel: the strip's half-width plus the straight runs' gap. */
export function archRadius(k: number): number {
  return NIL.strip * strip(k).wideTop + (NIL.channel - NIL.strip) * spacing(NIL.capCentre);
}

/**
 * Centre of the dot between strips k and k + 1 (k ≥ 0): equally far from the band's
 * top edge and from both channels' round tops, wherever the fan staggers them.
 */
export function dotCentre(k: number): Point {
  const a = stripPoint(k, NIL.capCentre);
  const b = stripPoint(k + 1, NIL.capCentre);
  const rim = (archRadius(k) + archRadius(k + 1)) / 2;
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dir = unit(sub(b, a));
  let outward: Point = [dir[1], -dir[0]];
  if (outward[1] > 0) outward = [-outward[0], -outward[1]];
  const h = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
  // Along the bisector, mid + outward·t: depth − bandIn = distance to an arch's centre − rim.
  const lift = mid[1] - NIL.bandIn + rim;
  const qa = outward[1] * outward[1] - 1;
  const qb = 2 * lift * outward[1];
  const qc = lift * lift - h * h;
  const t = Math.abs(qa) < 1e-9 ? -qc / qb : (-qb - Math.sqrt(Math.max(qb * qb - 4 * qa * qc, 0))) / (2 * qa);
  return [mid[0] + outward[0] * t, mid[1] + outward[1] * t];
}

/** Strips 0 (on the diagonal) to a little past the middle of the rail, and the dot after each. */
export const LAYOUT_SIZE = Math.ceil(STRIP_COUNT / 2) + 3;

const f = (n: number) => n.toFixed(6);

/** The layout as GLSL constants, with `nilStrip(k, …)` and `nilDot(j)` to read them. */
export function nilLayoutGlsl(): string {
  const strips: string[] = [];
  const widths: string[] = [];
  const dots: string[] = [];
  for (let k = 0; k < LAYOUT_SIZE; k++) {
    const s = strip(k);
    strips.push(`vec4(${f(s.top[0])}, ${f(s.top[1])}, ${f(s.foot[0])}, ${f(s.foot[1])})`);
    widths.push(`vec2(${f(s.wideTop)}, ${f(s.wideFoot)})`);
    const dot = dotCentre(k);
    dots.push(`vec2(${f(dot[0])}, ${f(dot[1])})`);
  }
  const n = LAYOUT_SIZE;
  return /* glsl */ `
const float STRIP_COUNT = ${STRIP_COUNT.toFixed(1)};
const vec4 NIL_STRIPS[${n}] = vec4[${n}](${strips.join(', ')});
const vec2 NIL_WIDTHS[${n}] = vec2[${n}](${widths.join(', ')});
const vec2 NIL_DOTS[${n}] = vec2[${n}](${dots.join(', ')});

// Strip k's top and foot centres, and its spacing square to it at each.
void nilStrip(float k, out vec2 top, out vec2 foot, out vec2 wide) {
  int i = min(int(abs(k)), ${n - 1});
  top = NIL_STRIPS[i].xy;
  foot = NIL_STRIPS[i].zw;
  wide = NIL_WIDTHS[i];
  if (k < 0.0) { top = top.yx; foot = foot.yx; }
}

// Centre of the dot at half-index j, between strips j - 0.5 and j + 0.5.
vec2 nilDot(float j) {
  vec2 c = NIL_DOTS[min(int(floor(abs(j))), ${n - 1})];
  return j < 0.0 ? c.yx : c;
}
`;
}
