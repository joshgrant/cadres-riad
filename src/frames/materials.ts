import type { MaterialShader } from '../render/gl/moulding';
import type { FrameId } from './ids';
import { ORNAMENTS_GLSL } from './ornaments';

/**
 * Material shaders for the WebGL frames. Heights are in rail widths; q.x runs
 * along the rail (0 at its outer start), q.y across (0 outer edge, 1 window).
 * Restraint rule: carving and incision stay on the outer two-thirds of the rail.
 */

/** Rounded edge: rises from 0 at t=0 to 1 at t=r. */
const EDGE_GLSL = /* glsl */ `
float roundEdge(float t, float r) {
  float x = clamp(t / r, 0.0, 1.0);
  return sqrt(1.0 - (1.0 - x) * (1.0 - x));
}
`;

/** Chêne clair: light oak, matte oil, flat face, three small steps at the inner lip (a muqarnas nod). */
const chene: MaterialShader = {
  captionDepth: 0.035,
  glsl: /* glsl */ `
${EDGE_GLSL}
float frameHeight(vec2 q) {
  float t = q.y;
  float face = 0.22 * roundEdge(t, 0.05);
  // Three descending steps into the window, each with a softened riser.
  float steps = 0.0;
  steps += 0.035 * smoothstep(0.770, 0.785, t);
  steps += 0.035 * smoothstep(0.845, 0.860, t);
  steps += 0.035 * smoothstep(0.920, 0.935, t);
  float lip = 0.022 * (1.0 - roundEdge(1.0 - t, 0.025));
  vec2 grain = woodGrain(q, u_seed, 11.0);
  return face - steps - lip - grain.y * 0.0015;
}

void frameSurface(vec2 q, float h, float cavity, inout Surface surface) {
  vec3 albedo;
  float roughness;
  float specular;
  vec2 grain = woodGrain(q, u_seed, 11.0);
  float tone = fbm(vec2(q.x * 0.25 + u_seed, q.y * 1.5)) - 0.5;
  vec3 early = vec3(0.84, 0.71, 0.56);
  vec3 late = vec3(0.75, 0.6, 0.45);
  albedo = mix(early, late, grain.x * 0.6);
  albedo = mix(albedo, vec3(0.58, 0.45, 0.32), grain.y * 0.55);
  albedo *= 1.0 + tone * 0.12;
  // End grain in the engraved cut and the step risers reads darker.
  albedo *= 1.0 - cavity * 0.45;
  // The engraved letters are stained dark so they read clearly.
  albedo = mix(albedo, vec3(0.27, 0.17, 0.1), smoothstep(0.2, 0.7, captionCut(q, 1.0)) * 0.85);
  roughness = 0.7;
  specular = 0.035;
  surface = Surface(albedo, roughness, specular, 0.0);
}

float frameAlpha(vec2 q) { return 1.0; }
float jointOffset(vec2 q) { return 0.0; }
`,
};

/** Noir: black-stained open-grain oak with one incised lozenge chain around the face. */
const noir: MaterialShader = {
  captionDepth: 0.02,
  glsl: /* glsl */ `
${EDGE_GLSL}
// The chain sits on the face's centre line; an integer number of lozenges fits
// between the mitres, so the pattern meets itself at every corner.
float lozengeGroove(vec2 q) {
  float c = 0.5;
  float a = 0.14;
  float len = railLength() - 2.0 * c;
  float n = max(2.0, floor(len / 0.62 + 0.5));
  float period = len / n;
  float s = (q.x - c) / period;
  // On the bottom rail the chain stops a whole lozenge short of the caption.
  if (u_captionHalf > 0.0) {
    float lozenge = floor(s - 0.5) + 1.0;
    float centre = c + lozenge * period;
    if (abs(centre - railLength() * 0.5) < u_captionHalf + period * 0.6) return 0.0;
  }
  float wave = triangleWave(s * 0.5 - 0.25);
  float slope = 2.0 * a / period;
  float d1 = abs(q.y - (c + a * wave)) / sqrt(1.0 + slope * slope);
  float d2 = abs(q.y - (c - a * wave)) / sqrt(1.0 + slope * slope);
  float d = min(d1, d2);
  return 1.0 - smoothstep(0.0, 0.009, d);
}

float frameHeight(vec2 q) {
  float t = q.y;
  float face = 0.2 * roundEdge(t, 0.04) * roundEdge(1.0 - t, 0.035);
  vec2 grain = woodGrain(q, u_seed, 13.0);
  return face - lozengeGroove(q) * 0.01 - grain.y * 0.0012;
}

void frameSurface(vec2 q, float h, float cavity, inout Surface surface) {
  vec3 albedo;
  float roughness;
  float specular;
  vec2 grain = woodGrain(q, u_seed, 13.0);
  // Stain pools darker in the latewood; the open grain shows as faint grey streaks.
  albedo = vec3(0.06, 0.058, 0.056);
  albedo = mix(albedo, vec3(0.04, 0.039, 0.038), grain.x * 0.5);
  albedo = mix(albedo, vec3(0.12, 0.118, 0.114), grain.y * 0.6);
  albedo *= 1.0 - cavity * 0.4;
  roughness = 0.55;
  specular = 0.035;
  surface = Surface(albedo, roughness, specular, 0.0);
  // Incised letters gilded with gold leaf.
  float letter = smoothstep(0.3, 0.6, captionCut(q, 1.0));
  if (letter > 0.0) {
    Surface gold = Surface(vec3(0.95, 0.76, 0.4), 0.3, 0.6, 1.0);
    surface = Surface(mix(albedo, gold.albedo, letter), mix(roughness, gold.roughness, letter), mix(specular, gold.specular, letter), letter);
  }
}

float frameAlpha(vec2 q) { return 1.0; }
float jointOffset(vec2 q) { return 0.0; }
`,
};

/** Blanc: tadelakt-inspired white, polished lime plaster with trowel marks and faint crazing. */
const blanc: MaterialShader = {
  captionDepth: 0.03,
  glsl: /* glsl */ `
${EDGE_GLSL}
float trowel(vec2 q) {
  // Broad, angled strokes of the trowel.
  vec2 r = mat2(0.87, 0.5, -0.5, 0.87) * q;
  return fbm(vec2(r.x * 1.4, r.y * 3.2) + u_seed) - 0.5;
}

// Hairline cracks, only in a few patches, as on old polished plaster.
float crazing(vec2 q) {
  float patchMask = smoothstep(0.62, 0.78, fbm(q * 0.9 + u_seed * 2.3));
  return smoothstep(0.02, 0.0, cellEdge(q * 9.0 + u_seed)) * patchMask;
}

float frameHeight(vec2 q) {
  float t = q.y;
  // Hand-applied plaster: soft, pillowed edges.
  float pillow = 0.17 * roundEdge(t, 0.16) * roundEdge(1.0 - t, 0.1);
  return pillow + trowel(q) * 0.006 - crazing(q) * 0.0008;
}

void frameSurface(vec2 q, float h, float cavity, inout Surface surface) {
  vec3 albedo;
  float roughness;
  float specular;
  float mottle = fbm(q * 1.6 + u_seed * 1.7) - 0.5;
  float cloud = fbm(q * 0.5 - u_seed) - 0.5;
  albedo = vec3(0.949, 0.937, 0.91);
  albedo *= 1.0 + mottle * 0.07;
  albedo = mix(albedo, vec3(0.93, 0.905, 0.86), clamp(cloud * 1.5 + 0.3, 0.0, 1.0) * 0.5);
  albedo = mix(albedo, albedo * vec3(0.9, 0.89, 0.87), crazing(q) * 0.6);
  albedo *= 1.0 - cavity * 0.3;
  // The engraved letters are filled with a warm grey pigment.
  albedo = mix(albedo, vec3(0.42, 0.39, 0.35), smoothstep(0.2, 0.7, captionCut(q, 1.0)) * 0.85);
  // Burnished: glossier where the trowel pressed hardest.
  roughness = 0.32 + trowel(q) * 0.25;
  specular = 0.07;
  surface = Surface(albedo, roughness, specular, 0.0);
}

float frameAlpha(vec2 q) { return 1.0; }
float jointOffset(vec2 q) { return 0.0; }
`,
};

/**
 * Noyer sculpté: dark walnut, satin oil, an ogee profile, and a chip-carved band
 * of eight-point stars and lozenges with darker oil settled in the cuts. A thin
 * gold slip lines the window.
 */
const noyer: MaterialShader = {
  glsl: /* glsl */ `
${EDGE_GLSL}
${ORNAMENTS_GLSL}
const float BAND_TOP = 0.13;
const float BAND_BOTTOM = 0.53;
const float SLIP = 0.93;

// Ogee: a convex swell on the outside turning concave towards the window.
float ogee(float t) {
  float x = clamp((t - 0.55) / 0.38, 0.0, 1.0);
  float s = x * x * (3.0 - 2.0 * x);
  return mix(0.22, 0.08, s) + 0.025 * sin(x * 3.14159);
}

float carving(vec2 q) {
  float centre = (BAND_TOP + BAND_BOTTOM) * 0.5;
  float halfBand = (BAND_BOTTOM - BAND_TOP) * 0.5;
  float period = bandPeriod(centre, halfBand * 2.2);
  vec2 cell = bandCell(q.x, centre, halfBand * 2.2);
  vec2 p = vec2(cell.x * period, q.y - centre);
  // An eight-point star in every cell, a lozenge between neighbours.
  float star = sdEightPointStar(p, halfBand * 0.78);
  vec2 between = vec2((cell.x < 0.0 ? cell.x + 0.5 : cell.x - 0.5) * period, p.y);
  float lozenge = sdLozenge(between, vec2(halfBand * 0.34, halfBand * 0.62));
  float h = chipCut(star, 0.035, halfBand * 0.42) + chipCut(lozenge, 0.03, halfBand * 0.3);
  // Fine V-cut borders frame the band.
  h += vCut(q.y - BAND_TOP, 0.012, 0.012) + vCut(q.y - BAND_BOTTOM, 0.012, 0.012);
  return h;
}

// Under the brass plaque the carving stops and the moulding is planed flat, so
// the plate sits flush on a level seat (with a little margin around it).
float plaqueSeat(vec2 q) {
  if (u_plaqueHalf <= 0.0) return 0.0;
  float dx = abs(q.x - railLength() * 0.5) - u_plaqueHalf;
  return 1.0 - smoothstep(0.08, 0.18, dx);
}

float frameHeight(vec2 q) {
  float t = q.y;
  float face = t < 0.6 ? 0.22 : ogee(t);
  face *= roundEdge(t, 0.035);
  float seat = plaqueSeat(q);
  if (t > BAND_TOP - 0.03 && t < BAND_BOTTOM + 0.03) face += carving(q) * (1.0 - seat);
  // The seat: level with the face, eased down at the window like the ogee.
  float level = 0.22 * roundEdge(t, 0.035) * mix(1.0, smoothstep(1.0, 0.86, t) * 0.6 + 0.4, step(0.86, t));
  if (t < SLIP) face = mix(face, level, seat);
  // The gold slip: a small rounded bead at the window.
  if (t > SLIP) face = 0.06 + 0.025 * roundEdge(t - SLIP, 0.03) * roundEdge(1.0 - t, 0.02);
  vec2 grain = woodGrain(q, u_seed, 9.0);
  return face - grain.y * 0.0012;
}

void frameSurface(vec2 q, float h, float cavity, inout Surface surface) {
  if (q.y > SLIP) {
    float wear = valueNoise(q * vec2(4.0, 40.0) + u_seed) * 0.15;
    surface = Surface(vec3(0.96, 0.76, 0.38) * (0.92 + wear), 0.28, 0.6, 1.0);
    return;
  }
  vec2 grain = woodGrain(q, u_seed, 9.0);
  float tone = fbm(vec2(q.x * 0.22 + u_seed, q.y * 1.2)) - 0.5;
  vec3 albedo = mix(vec3(0.34, 0.22, 0.14), vec3(0.2, 0.12, 0.075), grain.x * 0.7);
  albedo = mix(albedo, vec3(0.13, 0.08, 0.05), grain.y * 0.6);
  albedo *= 1.0 + tone * 0.18;
  // Oil settles darker in the cuts.
  albedo *= 1.0 - cavity * 0.55;
  surface = Surface(albedo, 0.42, 0.05, 0.0);
}

float frameAlpha(vec2 q) { return 1.0; }
float jointOffset(vec2 q) { return 0.0; }
`,
};

/**
 * Bois brut: sun-bleached driftwood. An uneven, rounded cross-section whose
 * crown and thickness wander along the board; grain eroded into ridges and long
 * fibrous splits; knots of every kind (pin knots, oval knots, cat's eyes, open
 * holes) with the growth rings whorling around them; grey-brown weathering; a
 * wandering outer edge and uneven joints. The caption goes on an aged brass plate
 * nailed to a planed patch.
 */
const brut: MaterialShader = {
  glsl: /* glsl */ `
${EDGE_GLSL}
const float KNOT_CELL = 1.6;

// Detail finer than a few pixels would sparkle; fade it out as it gets small.
float detail(float cyclesPerRail) {
  return smoothstep(2.5, 6.0, 1.0 / (cyclesPerRail * u_pixel));
}

// Keep knots and splits off the plaque.
float clearOfCaption(vec2 q) {
  if (u_plaqueHalf <= 0.0) return 1.0;
  float dx = abs(q.x - railLength() * 0.5) - u_plaqueHalf;
  return smoothstep(0.05, 0.25, dx);
}

/**
 * Knots near q. x: how much the rings are pushed aside (0..1), y: the dark
 * heart, z: an open hole, w: signed offset across the grain to the nearest knot.
 */
vec4 knots(vec2 q) {
  vec4 result = vec4(0.0, 0.0, 0.0, 0.0);
  float base = floor(q.x / KNOT_CELL);
  for (int i = -1; i <= 1; i++) {
    float cell = base + float(i);
    vec2 id = vec2(cell, u_seed);
    if (hash21(id) < 0.62) continue;
    float kind = hash21(id + 5.0);
    vec2 centre = vec2((cell + 0.15 + hash21(id + 1.0) * 0.7) * KNOT_CELL, 0.2 + hash21(id + 2.0) * 0.6);
    // Pin knots are tiny; oval knots medium; cat's eyes long and thin; holes open.
    float size = kind < 0.4 ? 0.018 + hash21(id + 3.0) * 0.012 : kind < 0.75 ? 0.035 + hash21(id + 3.0) * 0.035 : kind < 0.9 ? 0.03 : 0.04;
    float stretch = kind < 0.4 ? 0.7 : kind < 0.75 ? 0.35 + hash21(id + 4.0) * 0.3 : kind < 0.9 ? 0.18 : 0.5;
    vec2 d = (q - centre) * vec2(stretch, 1.0);
    float r = length(d) / size;
    // The grain parts around a knot over a region a few times its size, longer along the board.
    float push = exp(-dot(d / size, d / size) * 0.06);
    if (push > result.x) {
      result.x = push;
      result.w = q.y - centre.y;
    }
    result.y = max(result.y, smoothstep(1.0, 0.5, r) * (0.6 + 0.4 * hash21(id + 6.0)));
    if (kind >= 0.9) result.z = max(result.z, smoothstep(0.7, 0.4, r));
  }
  float clear = clearOfCaption(q);
  return vec4(result.xyz * clear, result.w);
}

// The growth-ring coordinate: uneven ring widths drifting along the board,
// pushed aside around knots so the rings flow round them.
float ringCoord(vec2 q, vec4 k) {
  float y = q.y + fbm(vec2(q.x * 0.1 + u_seed, q.y * 0.5)) * 0.35;
  y -= k.x * k.w * 0.85;
  float density = 7.0 + (fbm(vec2(q.x * 0.05, y * 2.0) + u_seed) - 0.5) * 6.0;
  return y * density;
}

// Long splits along the grain, of many lengths.
float splits(vec2 q, float ring) {
  float total = 0.0;
  for (int i = 0; i < 3; i++) {
    float f = float(i);
    float y = ring * (0.6 + f * 0.37) + f * 1.7;
    float line = abs(fract(y) - 0.5);
    float present = smoothstep(0.55 - f * 0.05, 0.7, valueNoise(vec2(q.x * (0.5 + f * 0.6) + u_seed * 3.0 + f * 11.0, floor(y))));
    total = max(total, (1.0 - smoothstep(0.0, 0.03 - f * 0.006, line)) * present);
  }
  return total * clearOfCaption(q);
}

// The planed patch under the plaque.
float plaqueSeat(vec2 q) {
  if (u_plaqueHalf <= 0.0) return 0.0;
  float dx = abs(q.x - railLength() * 0.5) - u_plaqueHalf;
  return 1.0 - smoothstep(0.03, 0.15, dx);
}

float frameHeight(vec2 q) {
  float t = q.y;
  // An uneven, rounded section: the crown and the thickness wander along the board.
  float crown = 0.42 + (fbm(vec2(q.x * 0.18 + u_seed, 1.3)) - 0.5) * 0.35;
  float thick = 0.2 + (fbm(vec2(q.x * 0.22, 7.0) + u_seed) - 0.5) * 0.08;
  float x = t < crown ? (crown - t) / crown : (t - crown) / (1.0 - crown);
  float section = thick * (1.0 - 0.45 * pow(x, 2.0)) * roundEdge(t, 0.2) * roundEdge(1.0 - t, 0.05);
  float bend = (fbm(vec2(q.x * 0.35 + u_seed, q.y * 0.3)) - 0.5) * 0.025;

  vec4 k = knots(q);
  float ring = ringCoord(q, k);
  // Weathering eats the soft earlywood: ridges stand proud, valleys run between.
  float bands = abs(fract(ring) - 0.5) * 2.0;
  float ridges = smoothstep(0.15, 0.95, bands) * 0.011;
  // Fine fibres along the grain, only where they are big enough to see.
  float fibres = (valueNoise(vec2(q.x * 1.2, ring * 6.0)) - 0.5) * 0.004 * detail(42.0);
  float h = section + bend + ridges + fibres - splits(q, ring) * 0.02 - k.z * 0.05 + k.y * 0.004;

  // Planed flat where the plaque is nailed on.
  float seat = plaqueSeat(q);
  return mix(h, 0.19 * roundEdge(t, 0.2) * roundEdge(1.0 - t, 0.05), seat);
}

void frameSurface(vec2 q, float h, float cavity, inout Surface surface) {
  vec4 k = knots(q);
  float ring = ringCoord(q, k);
  float bands = abs(fract(ring) - 0.5) * 2.0;
  // Sun-bleached grey on the highs, warmer brown down in the grain, the two
  // close in tone so the rings read as texture rather than lines.
  vec3 bleached = vec3(0.66, 0.61, 0.54);
  vec3 warm = vec3(0.54, 0.45, 0.36);
  vec3 albedo = mix(warm, bleached, smoothstep(0.1, 0.9, bands) * 0.7 + 0.15);
  // Weathering streaks and fibres run with the grain, at several scales.
  float streak = fbm(vec2(q.x * 0.18 + u_seed, ring * 0.3));
  float fibre = valueNoise(vec2(q.x * 2.5 + u_seed, ring * 3.0)) * 0.6 + valueNoise(vec2(q.x * 6.0, ring * 9.0)) * 0.4;
  albedo *= mix(0.78, 1.08, streak) * mix(0.9, 1.05, fibre);
  albedo = mix(albedo, vec3(0.6, 0.6, 0.58), smoothstep(0.55, 0.8, fbm(q * vec2(0.4, 1.2) + u_seed * 4.0)) * 0.35);
  // Knots: dark hearts, darker rings; open knots go black.
  albedo = mix(albedo, vec3(0.3, 0.22, 0.15), k.y * 0.8);
  albedo = mix(albedo, vec3(0.44, 0.35, 0.27), k.x * k.x * 0.35);
  albedo = mix(albedo, vec3(0.06, 0.045, 0.035), k.z);
  albedo *= 1.0 - splits(q, ring) * 0.7 - cavity * 0.35;
  surface = Surface(albedo, 0.92, 0.015, 0.0);
}

// The outer edge wanders, with the odd chip; the window edge stays straight.
float frameAlpha(vec2 q) {
  float edge = fbm(vec2(q.x * 0.9 + u_seed, 0.0)) * 0.05 + smoothstep(0.8, 0.95, valueNoise(vec2(q.x * 3.0, u_seed))) * 0.025;
  return smoothstep(edge, edge + u_pixel, q.y);
}

// Mitres meet with a slightly uneven 1–2px gap.
float jointOffset(vec2 q) {
  return 0.6 + valueNoise(vec2(q.y * 6.0, u_seed)) * 1.4;
}
`,
};

/**
 * Doré sculpté: engraved brass in the Fès tradition. Polished arabesque scrolls
 * (a vine with spiral tendrils, leaves and small rosettes) stand out from a
 * darkened, stippled ground; carved corner blocks carry an eight-point star;
 * beaded rims frame the field. One piece of metal, so no visible joints. On the
 * bottom rail a plain polished cartouche holds the caption, engraved and filled black.
 */
const dore: MaterialShader = {
  captionDepth: 0.012,
  glsl: /* glsl */ `
${EDGE_GLSL}
${ORNAMENTS_GLSL}
const float RIM_OUT = 0.07;
const float FIELD_TOP = 0.12;
const float FIELD_BOTTOM = 0.86;
const float RIM_IN = 0.91;
const float TAU = 6.2831853;

// Archimedean spiral around the origin, about one and a half turns.
float sdSpiral(vec2 p, float b, float turns, float dir) {
  p.x *= dir;
  float r = length(p);
  float a = atan(p.y, p.x);
  if (a < 0.0) a += TAU;
  float best = 1e3;
  for (int n = 0; n < 3; n++) {
    float theta = a + TAU * float(n);
    if (theta <= turns * TAU) best = min(best, abs(r - b * theta));
  }
  return best;
}

float sdLeaf(vec2 p, float angle, float len, float width) {
  vec2 d = vec2(cos(angle), sin(angle));
  vec2 local = vec2(dot(p, d), dot(p, vec2(-d.y, d.x)));
  local.x -= len;
  // Pointed at the tip, round at the base.
  float taper = mix(1.0, 0.35, clamp(local.x / len * 0.5 + 0.5, 0.0, 1.0));
  return length(local / vec2(len, width * taper)) - 1.0;
}

float sdRosette(vec2 p, float r, float petals) {
  float a = atan(p.y, p.x);
  return length(p) - r * (0.6 + 0.4 * abs(cos(a * petals * 0.5)));
}

// The arabesque in the main field: x distance to polished metal (negative on it),
// y distance to the chased centre lines engraved along the vines.
vec2 arabesque(vec2 q) {
  float centre = (FIELD_TOP + FIELD_BOTTOM) * 0.5;
  float start = 1.0;
  float len = railLength() - 2.0 * start;
  float n = max(1.0, floor(len / 0.8 + 0.5));
  float period = len / n;
  float u = (q.x - start) / period;
  float x = fract(u);
  vec2 p = vec2((x - 0.5) * period, q.y - centre);

  // Two vines, mirror images, interlacing into a chain of ogival lenses.
  float amp = 0.16;
  float k = TAU / period;
  float wave = amp * sin(TAU * x);
  float slope = amp * k * cos(TAU * x);
  float norm = sqrt(1.0 + slope * slope);
  float vineA = abs(p.y - wave) / norm;
  float vineB = abs(p.y + wave) / norm;
  float vines = min(vineA, vineB);
  float d = vines - 0.02;

  // A rosette in each lens, a tendril curling into each space outside the vines.
  for (int i = 0; i < 2; i++) {
    float cx = (i == 0 ? -0.25 : 0.25) * period;
    float side = i == 0 ? 1.0 : -1.0;
    d = min(d, sdRosette(p - vec2(cx, 0.0), 0.06, 8.0));
    d = min(d, sdSpiral(p - vec2(cx, 0.265), 0.0105, 1.6, side) - 0.011);
    d = min(d, sdSpiral(p - vec2(cx, -0.265), 0.0105, 1.6, -side) - 0.011);
    d = min(d, length(p - vec2(cx, 0.265)) - 0.018);
    d = min(d, length(p - vec2(cx, -0.265)) - 0.018);
  }
  // Pointed leaves where the vines cross.
  float nodeX = (x < 0.25 ? -0.5 : x < 0.75 ? 0.0 : 0.5) * period;
  vec2 pl = p - vec2(nodeX, 0.0);
  float leaves = min(min(sdLeaf(pl, 1.5708, 0.06, 0.03), sdLeaf(pl, -1.5708, 0.06, 0.03)), 1e3);
  d = min(d, leaves * 0.03);

  float chased = vines;
  return vec2(d, chased);
}

// Distance to the corner block's star medallion, and its border, in block-local p (0..1).
vec2 cornerBlock(vec2 p) {
  vec2 c = p - 0.5;
  float star = sdEightPointStar(c, 0.27);
  float ring = abs(length(c) - 0.36) - 0.022;
  float rosette = sdRosette(c, 0.1, 8.0);
  float motif = min(min(star, ring), 1e3);
  return vec2(motif, rosette);
}

bool inCartouche(vec2 q) {
  return u_captionHalf > 0.0 && abs(q.x - railLength() * 0.5) < u_captionHalf && q.y > FIELD_TOP && q.y < FIELD_BOTTOM;
}

// 0: dark ground, 1: polished metal, 2: the star's inner rosette (engraved).
float zone(vec2 q, out float sd) {
  float t = q.y;
  sd = 1.0;
  if (t < FIELD_TOP || t > FIELD_BOTTOM) return 1.0;
  if (inCartouche(q)) return 1.0;
  if (q.x < 1.0 || q.x > railLength() - 1.0) {
    vec2 p = vec2(q.x < 1.0 ? q.x : railLength() - q.x, t);
    vec2 block = cornerBlock(p);
    sd = block.x;
    if (block.y < 0.0) { sd = block.y; return 2.0; }
    return block.x < 0.0 ? 1.0 : 0.0;
  }
  sd = arabesque(q).x;
  return sd < 0.0 ? 1.0 : 0.0;
}

float frameHeight(vec2 q) {
  float t = q.y;
  // Outer beaded rim.
  float bead = sqrt(max(0.0, 1.0 - pow((fract(q.x / 0.055) - 0.5) * 2.0, 2.0)));
  float rimOut = 0.04 * roundEdge(t, 0.025) * (0.8 + 0.2 * bead);
  float rimIn = 0.036 * roundEdge(1.0 - t, 0.03);
  float h;
  if (t < RIM_OUT) h = rimOut;
  else if (t > RIM_IN) h = rimIn;
  else h = 0.032;
  if (t > FIELD_TOP && t < FIELD_BOTTOM) {
    float sd;
    float z = zone(q, sd);
    float ground = 0.024 - valueNoise(q * 220.0 + u_seed) * 0.0015;
    float relief = 0.024 + roundRelief(sd, 0.008, 0.012);
    h = z >= 1.0 ? (inCartouche(q) ? 0.032 : relief) : ground;
    if (z == 2.0) h = 0.028;
    // A fine chased line runs along the middle of each vine.
    bool field = !inCartouche(q) && q.x > 1.0 && q.x < railLength() - 1.0;
    if (field) h += vCut(arabesque(q).y, 0.004, 0.004);
  }
  // Engraved border lines around the field and the corner blocks.
  float lines = vCut(t - FIELD_TOP, 0.006, 0.006) + vCut(t - FIELD_BOTTOM, 0.006, 0.006);
  if (t > FIELD_TOP && t < FIELD_BOTTOM) {
    lines += vCut(q.x - 1.0, 0.006, 0.006) + vCut(railLength() - 1.0 - q.x, 0.006, 0.006);
    if (u_captionHalf > 0.0) lines += vCut(abs(q.x - railLength() * 0.5) - u_captionHalf, 0.006, 0.006);
  }
  return h + lines;
}

void frameSurface(vec2 q, float h, float cavity, inout Surface surface) {
  float sd;
  float z = zone(q, sd);
  float sheen = valueNoise(vec2(q.x * 3.0, q.y * 40.0) + u_seed) * 0.08;
  vec3 polished = vec3(1.0, 0.82, 0.48) * (0.96 + sheen);
  if (z >= 1.0) {
    surface = Surface(z == 2.0 ? polished * 0.7 : polished, z == 2.0 ? 0.45 : 0.22, 0.6, 1.0);
  } else {
    // The engraved ground, darkened with patina and matted with a punch.
    float stipple = valueNoise(q * 220.0 + u_seed);
    surface = Surface(vec3(0.2, 0.12, 0.05) * (0.7 + stipple * 0.5), 0.9, 0.08, 0.12);
  }
  // Lines and the engraved letters hold black.
  float letter = smoothstep(0.25, 0.6, captionCut(q, 1.0));
  surface.albedo = mix(surface.albedo, vec3(0.06, 0.045, 0.03), max(letter, cavity * 0.8));
  surface.metal *= 1.0 - letter;
  surface.roughness = mix(surface.roughness, 0.35, letter);
}

float frameAlpha(vec2 q) { return 1.0; }

// Cast as one piece: no joints at the corners.
float jointOffset(vec2 q) { return -1000.0; }
`,
};

/** Frames rendered by the WebGL moulding renderer; the rest still use 2D drawing. */
export const MATERIALS: Partial<Record<FrameId, MaterialShader>> = { dore, chene, noir, blanc, noyer, brut };

/** Seeds fixed per frame, so a frame looks identical in every render. */
export const SEEDS: Record<FrameId, number> = { dore: 11, noyer: 23, brut: 37, chene: 41, noir: 53, blanc: 67, polaroid: 71 };
