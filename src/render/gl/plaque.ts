import { LIGHTING_GLSL, NOISE_GLSL } from './glsl';

/**
 * Brushed-brass plaque, centred on the bottom rail of Doré and Noyer: rounded
 * corners, a two-step bevel, horizontal brushing, two domed slotted screws, a
 * soft contact shadow, and the caption engraved and filled with black lacquer.
 * v_local is plaque-local pixels from the plaque's top-left; the quad extends
 * past the plaque by u_margin on every side for the shadow.
 */
export const PLAQUE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_local;
in vec2 v_image;
out vec4 outColor;

uniform vec2 u_plaque;        // plaque size in pixels
uniform float u_seed;
uniform sampler2D u_caption;
uniform vec4 u_captionRect;   // frame-local pixels
uniform float u_captionOn;
uniform float u_scale;        // pixels per layout unit
uniform float u_aged;         // 0: polished, brushed brass with screws; 1: aged brass with rivets

${NOISE_GLSL}
${LIGHTING_GLSL}

float sdRoundRect(vec2 p, vec2 halfSize, float r) {
  vec2 d = abs(p) - halfSize + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

vec2 centred(vec2 local) { return local - u_plaque * 0.5; }

float screwRadius() { return u_plaque.y * mix(0.11, 0.085, u_aged); }
vec2 screwCentre(float side) {
  return vec2(side * (u_plaque.x * 0.5 - u_plaque.y * 0.3), 0.0);
}

float textAt(vec2 local) {
  if (u_captionOn < 0.5) return 0.0;
  vec2 image = v_image + (local - v_local);
  vec2 uv = (image - u_captionRect.xy) / u_captionRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture(u_caption, uv).r;
}

// Height in plaque heights: bevelled plate, domed screws, engraved text.
float plaqueHeight(vec2 local) {
  vec2 p = centred(local);
  float H = u_plaque.y;
  float d = -sdRoundRect(p, u_plaque * 0.5, H * 0.06);
  if (d < 0.0) return 0.0;
  // Polished: a two-step bevel. Aged: one soft, worn edge.
  float bevel = smoothstep(0.0, H * 0.035, d) * 0.5 + smoothstep(H * 0.035, H * 0.08, d) * 0.5;
  bevel = mix(bevel, smoothstep(0.0, H * 0.07, d), u_aged);
  float h = 0.04 * bevel;
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    vec2 c = screwCentre(side);
    float r = screwRadius();
    float dist = length(p - c) / r;
    if (dist < 1.0) {
      float dome = sqrt(1.0 - dist * dist) * 0.05;
      float angle = hash21(vec2(side, u_seed)) * 3.14159;
      vec2 axis = vec2(cos(angle), sin(angle));
      float slot = abs(dot(p - c, vec2(-axis.y, axis.x))) / r;
      // Rivets on the aged plate have no slot.
      dome -= (1.0 - smoothstep(0.08, 0.14, slot)) * 0.03 * (1.0 - u_aged);
      h = max(h, 0.04 + dome);
    }
  }
  // The engraving: cut, then filled with lacquer a little below the surface.
  h -= textAt(local) * 0.012;
  return h;
}

void main() {
  vec2 local = v_local;
  vec2 p = centred(local);
  float H = u_plaque.y;
  float sd = sdRoundRect(p, u_plaque * 0.5, H * 0.06);
  float aa = 1.0;

  // Contact shadow on the rail, offset down a touch and softly blurred.
  float shadowOffset = 2.0 * u_scale / 2.4;
  float sdShadow = sdRoundRect(p - vec2(0.0, shadowOffset), u_plaque * 0.5, H * 0.06);
  float shadow = 0.45 * (1.0 - smoothstep(-shadowOffset, shadowOffset * 2.5, sdShadow));

  float coverage = 1.0 - smoothstep(-aa, aa, sd);
  if (coverage <= 0.0 && shadow <= 0.0) discard;

  float e = 1.0;
  float h = plaqueHeight(local);
  float hx = plaqueHeight(local + vec2(e, 0.0)) - plaqueHeight(local - vec2(e, 0.0));
  float hy = plaqueHeight(local + vec2(0.0, e)) - plaqueHeight(local - vec2(0.0, e));
  vec3 normal = normalize(vec3(-vec2(hx, hy) * H / (2.0 * e), 1.0));

  // Brushing: long horizontal streaks that vary the brass's roughness and tone.
  float streak = valueNoise(vec2(local.x / H * 0.6 + u_seed, local.y / H * 60.0));
  streak = streak * 0.6 + valueNoise(vec2(local.x / H * 2.0, local.y / H * 160.0)) * 0.4;
  float text = textAt(local);
  bool onScrew = false;
  for (int i = 0; i < 2; i++) {
    if (length(p - screwCentre(i == 0 ? -1.0 : 1.0)) < screwRadius()) onScrew = true;
  }

  Surface surface;
  if (text > 0.5) {
    // Black lacquer fill, glossy (aged: a duller dark fill).
    surface = Surface(mix(vec3(0.137, 0.11, 0.078), vec3(0.1, 0.085, 0.06), u_aged), mix(0.25, 0.6, u_aged), 0.12, 0.0);
  } else if (u_aged > 0.5) {
    // Aged brass: duller, with darker patina in blotches and towards the edges.
    float patina = smoothstep(0.4, 0.85, fbm(local / H * 1.2 + u_seed * 3.0));
    float edgeWear = 1.0 - smoothstep(0.0, H * 0.14, -sd);
    vec3 brass = vec3(0.76, 0.62, 0.38);
    brass = mix(brass, vec3(0.5, 0.42, 0.27), clamp(patina * 0.35 + edgeWear * 0.35, 0.0, 1.0));
    surface = Surface(onScrew ? vec3(0.32, 0.26, 0.17) : brass, onScrew ? 0.45 : 0.55, 0.3, 1.0);
  } else {
    vec3 brass = vec3(0.88, 0.72, 0.42) * (0.94 + streak * 0.1);
    float roughness = onScrew ? 0.3 : 0.32 + streak * 0.18;
    surface = Surface(onScrew ? brass * 0.92 : brass, roughness, 0.5, 1.0);
  }
  vec3 color = shade(normal, surface, 0.0);
  // A soft horizontal highlight band from the brushing (polished plate only).
  if (text <= 0.5 && u_aged < 0.5) color += toLinear(vec3(0.95, 0.82, 0.55)) * 0.06 * exp(-pow((p.y / H + 0.12) * 5.0, 2.0)) * (0.7 + streak * 0.6);

  vec3 srgb = toSrgb(color);
  // Plate over its own shadow (premultiplied).
  vec4 plate = vec4(srgb * coverage, coverage);
  vec4 under = vec4(0.0, 0.0, 0.0, shadow);
  outColor = plate + under * (1.0 - plate.a);
}
`;
