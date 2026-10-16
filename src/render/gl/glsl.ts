/**
 * Shared GLSL for the moulding shaders: noise, wood grain and the rail-space
 * conventions. Everything is seeded and resolution independent, so a frame looks
 * identical in the preview, the sidebar tile and the 2400px export.
 */

export const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * valueNoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.1;
    amp *= 0.5;
  }
  return sum;
}

// Distance to the nearest cell edge of a jittered grid (for crazing and checks).
float cellEdge(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash21(i + g), hash21(i + g + 31.7));
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return d2 - d1;
}

/**
 * Straight-grained (rift-sawn) wood. q.x runs along the rail, q.y across, both
 * in rail widths. Returns x: latewood line strength 0..1, y: pore (open grain) 0..1.
 */
vec2 woodGrain(vec2 q, float seed, float density) {
  // Growth rings run the length of the board: broad, uneven bands that drift
  // slowly across it, with finer fibres inside them.
  float drift = fbm(vec2(q.x * 0.18 + seed, q.y * 0.9 - seed)) * 2.2;
  float y = q.y * density + drift + seed * 3.1;
  float band = abs(fract(y) - 0.5) * 2.0;
  float latewood = smoothstep(0.35, 1.0, band);
  latewood *= 0.55 + 0.45 * valueNoise(vec2(q.x * 0.6 + seed, y * 0.7));
  float fibre = valueNoise(vec2(q.x * 3.0 + seed * 5.0, q.y * density * 6.0 + drift * 4.0)) - 0.5;
  latewood = clamp(latewood + fibre * 0.25, 0.0, 1.0);
  // Open pores: sparse short dashes running with the grain, mostly in the latewood.
  float pores = valueNoise(vec2(q.x * 7.0 + seed * 7.0, q.y * density * 9.0 + drift * 6.0));
  pores = smoothstep(0.8, 0.95, pores) * (0.25 + 0.75 * latewood);
  return vec2(latewood, pores);
}

float triangleWave(float x) {
  return 1.0 - 4.0 * abs(fract(x + 0.25) - 0.5);
}
`;


export const LIGHTING_GLSL = /* glsl */ `
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }

struct Surface {
  vec3 albedo;
  float roughness;
  float specular;
  float metal;
};

// A soft studio softbox overhead, seen in reflections on metal.
vec3 environment(vec3 r) {
  float overhead = smoothstep(-0.1, 0.75, -r.y) * smoothstep(-0.4, 0.5, r.z);
  float band = exp(-pow((r.x) * 2.2, 2.0)) * 0.35;
  float floorBounce = smoothstep(0.2, 0.9, r.y) * 0.12;
  return vec3(0.07) + vec3(1.0, 0.98, 0.95) * (overhead * (0.75 + band)) + vec3(0.8, 0.85, 0.95) * floorBounce;
}


// One key light from above, tilted 20° towards the viewer; a cool fill from
// below at 12%; ambient reduced in cavities. Metals reflect the studio. Linear in, linear out.
vec3 shade(vec3 normal, Surface surface, float cavity) {
  vec3 albedo = toLinear(surface.albedo);
  float roughness = surface.roughness;
  float specular = surface.specular;
  vec3 keyDir = normalize(vec3(0.0, -0.342, 0.94));
  vec3 fillDir = normalize(vec3(0.0, 0.5, 0.866));
  vec3 view = vec3(0.0, 0.0, 1.0);
  float key = max(dot(normal, keyDir), 0.0);
  float fill = max(dot(normal, fillDir), 0.0) * 0.12;
  float ambient = 0.22 * (1.0 - cavity * 0.75);
  vec3 diffuse = albedo * (key * 0.8 + ambient) + albedo * vec3(0.85, 0.9, 1.0) * fill;

  vec3 halfway = normalize(keyDir + view);
  // Soft studio light: a broad highlight whose peak grows only gently with gloss.
  float shininess = mix(160.0, 8.0, roughness);
  float spec = pow(max(dot(normal, halfway), 0.0), shininess) * specular * mix(3.0, 1.0, roughness);
  vec3 color = diffuse + vec3(spec) * (1.0 - cavity * 0.8);

  // Metals: tinted reflections of the studio, plus the key light's highlight.
  if (surface.metal > 0.0) {
    vec3 reflected = reflect(-view, normal);
    vec3 env = environment(reflected);
    // Rougher metal blurs the softbox towards its average.
    env = mix(env, vec3(0.42), roughness * 0.6);
    vec3 metalColor = albedo * env * (1.0 - cavity * 0.7) + albedo * spec * 2.0;
    color = mix(color, metalColor, surface.metal);
  }
  return color;
}
`;


export const VERTEX_GLSL = /* glsl */ `#version 300 es
in vec2 a_position;   // frame-local device pixels
in vec2 a_local;      // rail space: x along the rail from its outer start, y across from the outer edge (pixels)
uniform vec2 u_size;
out vec2 v_local;
out vec2 v_image;
void main() {
  v_local = a_local;
  v_image = a_position;
  vec2 clip = a_position / u_size * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

/**
 * The lighting half of every moulding shader. A material supplies
 *   float frameHeight(vec2 q)            height in rail widths, q in rail widths
 *   void frameSurface(vec2 q, float h, float cavity, out Surface s)
 *   float frameAlpha(vec2 q)             coverage, 1 for a clean edge
 *   float jointOffset(vec2 q)            pixels added to the mitre gap (0 for a tight joint)
 * and may call captionMaskAt(q) / captionCut(q, blurPx) for the caption on the bottom rail.
 */
export function fragmentShader(material: string): string {
  return /* glsl */ `#version 300 es
precision highp float;
in vec2 v_local;
in vec2 v_image;
out vec4 outColor;

uniform float u_railWidth;    // pixels
uniform float u_railLength;   // pixels, along the outer edge
uniform vec2 u_along;         // image-space unit vector along the rail
uniform vec2 u_inward;        // image-space unit vector from outer edge to window
uniform float u_seed;
uniform float u_pixel;        // one pixel in rail widths
uniform float u_startMitre;   // neighbour width / own width at the rail's start corner
uniform float u_endMitre;
uniform int u_rail;           // 0 top, 1 right, 2 bottom, 3 left

uniform sampler2D u_caption;  // text mask (alpha), drawn upright in image space
uniform vec4 u_captionRect;   // x, y, w, h in frame-local pixels
uniform float u_captionOn;    // 1 on the bottom rail when there is a caption mask
uniform float u_captionDepth; // engraving depth in rail widths (0: the material uses the mask itself)
uniform float u_captionBlur;  // pixels
uniform float u_captionHalf;  // half the caption's width plus margin, in rail widths (bottom rail only)

${NOISE_GLSL}
${LIGHTING_GLSL}

float railLength() { return u_railLength / u_railWidth; }

// Rail space (rail widths) to frame-local image pixels.
vec2 imageAt(vec2 q) {
  vec2 delta = (q - v_local / u_railWidth) * u_railWidth;
  return v_image + delta.x * u_along + delta.y * u_inward;
}

// The caption mask at q: x sharp text, y soft halo, z wide blur. 0 off the bottom rail.
vec3 captionMaskAt(vec2 q) {
  if (u_captionOn < 0.5) return vec3(0.0);
  vec2 uv = (imageAt(q) - u_captionRect.xy) / u_captionRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
  return texture(u_caption, uv).rgb;
}

// The sharp mask softened by a few pixels, for the walls of an engraved cut.
float captionCut(vec2 q, float blurPx) {
  if (u_captionOn < 0.5) return 0.0;
  vec2 uv = (imageAt(q) - u_captionRect.xy) / u_captionRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  vec2 texel = blurPx / u_captionRect.zw;
  float sum = texture(u_caption, uv).r * 4.0;
  sum += texture(u_caption, uv + vec2(texel.x, 0.0)).r * 2.0;
  sum += texture(u_caption, uv - vec2(texel.x, 0.0)).r * 2.0;
  sum += texture(u_caption, uv + vec2(0.0, texel.y)).r * 2.0;
  sum += texture(u_caption, uv - vec2(0.0, texel.y)).r * 2.0;
  sum += texture(u_caption, uv + texel).r;
  sum += texture(u_caption, uv - texel).r;
  sum += texture(u_caption, uv + vec2(texel.x, -texel.y)).r;
  sum += texture(u_caption, uv + vec2(-texel.x, texel.y)).r;
  return sum / 16.0;
}

${material}

// Height including the engraving, sampled in rail space.
float surfaceHeight(vec2 q) {
  float h = frameHeight(q);
  if (u_captionDepth > 0.0) h -= captionCut(q, u_captionBlur) * u_captionDepth;
  return h;
}

void main() {
  vec2 q = v_local / u_railWidth;
  float alpha = frameAlpha(q);
  if (alpha <= 0.0) discard;

  float e = max(u_pixel, 0.0015);
  float h = surfaceHeight(q);
  float hx = surfaceHeight(q + vec2(e, 0.0)) - surfaceHeight(q - vec2(e, 0.0));
  float hy = surfaceHeight(q + vec2(0.0, e)) - surfaceHeight(q - vec2(0.0, e));
  vec2 slope = vec2(hx, hy) / (2.0 * e);

  // Rail space to image space: the same carving faces up on the top rail and down on the bottom one.
  vec2 gradient = slope.x * u_along + slope.y * u_inward;
  vec3 normal = normalize(vec3(-gradient, 1.0));

  // Cavity: how far below its surroundings this point sits.
  float r = 0.06;
  float around = (surfaceHeight(q + vec2(r, 0.0)) + surfaceHeight(q - vec2(r, 0.0)) +
                  surfaceHeight(q + vec2(0.0, r)) + surfaceHeight(q - vec2(0.0, r))) * 0.25;
  float cavity = clamp((around - h) * 14.0, 0.0, 1.0);

  Surface surface = Surface(vec3(0.5), 0.5, 0.04, 0.0);
  frameSurface(q, h, cavity, surface);
  vec3 color = shade(normal, surface, cavity);

  // Hairline mitre joints where the rails meet.
  float s = v_local.x;
  float d = v_local.y;
  float startGap = (s - d * u_startMitre) * 0.7071;
  float endGap = (u_railLength - s - d * u_endMitre) * 0.7071;
  float joint = min(startGap, endGap) - jointOffset(q);
  color *= mix(0.62, 1.0, smoothstep(0.0, 1.2, joint));
  // An open joint shows the dark gap between the rails.
  color *= mix(0.25, 1.0, smoothstep(-1.0, 0.0, joint));

  outColor = vec4(toSrgb(color) * alpha, alpha);
}
`;
}
