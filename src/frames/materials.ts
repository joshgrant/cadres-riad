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
  captionDepth: 0.035,
  glsl: /* glsl */ `
${EDGE_GLSL}
// The chain sits on the face's centre line; an integer number of lozenges fits
// between the mitres, so the pattern meets itself at every corner.
float lozengeGroove(vec2 q) {
  float c = 0.42;
  float a = 0.13;
  float len = railLength() - 2.0 * c;
  float n = max(2.0, floor(len / 0.62 + 0.5));
  float period = len / n;
  float s = (q.x - c) / period;
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

float frameHeight(vec2 q) {
  float t = q.y;
  float face = t < 0.6 ? 0.22 : ogee(t);
  face *= roundEdge(t, 0.035);
  if (t > BAND_TOP - 0.03 && t < BAND_BOTTOM + 0.03) face += carving(q);
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
 * Bois brut: rough-hewn wood in a warm Atlas-cedar tone. Adze facets, tool
 * chatter, a few drying checks, a wandering outer edge and uneven joints.
 * The caption is burned into a smoothed patch.
 */
const brut: MaterialShader = {
  glsl: /* glsl */ `
${EDGE_GLSL}
// Adze facets: shallow scoops, long along the grain, overlapping at soft ridges.
float scoops(vec2 q) {
  vec2 p = vec2(q.x * 0.7, q.y * 2.6) + u_seed;
  vec2 i = floor(p);
  vec2 f = fract(p);
  float best = 8.0;
  vec2 bestCell = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash21(i + g), hash21(i + g + 13.1)) * 0.8 + 0.1;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < best) { best = d; bestCell = i + g; }
    }
  }
  // Each scoop is a little deeper or shallower, and tilts with the stroke.
  float depth = 0.022 + hash21(bestCell + 4.2) * 0.02;
  return -depth * (1.0 - clamp(best, 0.0, 1.0));
}

float smoothPatch(vec2 q) {
  // Where the caption is burned, the surface was planed smooth first.
  return smoothstep(0.02, 0.2, captionMaskAt(q).z);
}

float hewn(vec2 q) {
  float chatter = sin(q.x * 38.0 + valueNoise(q * 3.0) * 9.0) * 0.00025 * valueNoise(q * 1.3 + u_seed);
  return scoops(q) + chatter;
}

float checks(vec2 q) {
  // A few drying checks running with the grain.
  float line = abs(fract(q.y * 1.7 + fbm(vec2(q.x * 0.3, u_seed)) * 0.6) - 0.5);
  float present = smoothstep(0.7, 0.78, valueNoise(vec2(q.x * 0.6 + u_seed * 3.0, floor(q.y * 1.7))));
  return (1.0 - smoothstep(0.0, 0.012, line)) * present;
}

float frameHeight(vec2 q) {
  float t = q.y;
  float base = 0.2 * roundEdge(t, 0.06) * roundEdge(1.0 - t, 0.02);
  float smoothArea = smoothPatch(q);
  float rough = hewn(q) * (1.0 - smoothArea);
  vec2 grain = woodGrain(q, u_seed, 7.0);
  float burnSink = captionCut(q, max(1.0, u_railWidth * 0.008)) * 0.004;
  return base + rough - checks(q) * 0.02 - grain.x * 0.002 - burnSink;
}

void frameSurface(vec2 q, float h, float cavity, inout Surface surface) {
  vec2 grain = woodGrain(q, u_seed, 7.0);
  float sun = smoothstep(0.17, 0.24, h); // sun-faded highs
  vec3 albedo = mix(vec3(0.58, 0.38, 0.24), vec3(0.45, 0.28, 0.17), grain.x * 0.6);
  albedo = mix(albedo, vec3(0.7, 0.53, 0.38), sun * 0.45);
  albedo *= 1.0 - checks(q) * 0.6 - cavity * 0.35;
  // Pyrography: a dark burn with feathered edges and a faint scorched halo.
  vec3 mask = captionMaskAt(q);
  float halo = mask.y;
  float burn = captionCut(q, max(1.0, u_railWidth * 0.006));
  albedo = mix(albedo, vec3(0.42, 0.25, 0.14), clamp(halo * 1.4, 0.0, 1.0) * 0.45);
  albedo = mix(albedo, vec3(0.13, 0.065, 0.03), smoothstep(0.15, 0.7, burn));
  surface = Surface(albedo, 0.85, 0.02, 0.0);
}

// The outer edge wanders by up to 1.5% of the rail width; the window edge stays straight.
float frameAlpha(vec2 q) {
  float edge = fbm(vec2(q.x * 1.3 + u_seed, 0.0)) * 0.03;
  return smoothstep(edge, edge + u_pixel, q.y);
}

// Mitres meet with a slightly uneven 1–2px gap.
float jointOffset(vec2 q) {
  return 0.6 + valueNoise(vec2(q.y * 6.0, u_seed)) * 1.4;
}
`,
};

/** Frames rendered by the WebGL moulding renderer; the rest still use 2D drawing. */
export const MATERIALS: Partial<Record<FrameId, MaterialShader>> = { chene, noir, blanc, noyer, brut };

/** Seeds fixed per frame, so a frame looks identical in every render. */
export const SEEDS: Record<FrameId, number> = { dore: 11, noyer: 23, brut: 37, chene: 41, noir: 53, blanc: 67, polaroid: 71 };
