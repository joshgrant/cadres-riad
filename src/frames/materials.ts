import type { MaterialShader } from '../render/gl/moulding';
import type { FrameId } from './ids';

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

void frameSurface(vec2 q, float h, float cavity, out vec3 albedo, out float roughness, out float specular) {
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
}

float frameAlpha(vec2 q) { return 1.0; }
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

void frameSurface(vec2 q, float h, float cavity, out vec3 albedo, out float roughness, out float specular) {
  vec2 grain = woodGrain(q, u_seed, 13.0);
  // Stain pools darker in the latewood; the open grain shows as faint grey streaks.
  albedo = vec3(0.06, 0.058, 0.056);
  albedo = mix(albedo, vec3(0.04, 0.039, 0.038), grain.x * 0.5);
  albedo = mix(albedo, vec3(0.12, 0.118, 0.114), grain.y * 0.6);
  albedo *= 1.0 - cavity * 0.4;
  roughness = 0.55;
  specular = 0.035;
}

float frameAlpha(vec2 q) { return 1.0; }
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

void frameSurface(vec2 q, float h, float cavity, out vec3 albedo, out float roughness, out float specular) {
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
}

float frameAlpha(vec2 q) { return 1.0; }
`,
};

/** Frames rendered by the WebGL moulding renderer; the rest still use 2D drawing. */
export const MATERIALS: Partial<Record<FrameId, MaterialShader>> = { chene, noir, blanc };

/** Seeds fixed per frame, so a frame looks identical in every render. */
export const SEEDS: Record<FrameId, number> = { dore: 11, noyer: 23, brut: 37, chene: 41, noir: 53, blanc: 67, polaroid: 71 };
