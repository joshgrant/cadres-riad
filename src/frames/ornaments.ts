/**
 * Moroccan ornament library, as GLSL height functions in rail space (rail
 * widths). Shared by Noyer sculpté's chip-carved band and Doré sculpté.
 *
 * Every element is a signed distance (negative inside) turned into relief by a
 * cut profile: a V-cut, a rounded relief or a flat-bottomed channel.
 */
export const ORNAMENTS_GLSL = /* glsl */ `
float sdBox2(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

vec2 rotate45(vec2 p) {
  return vec2(p.x - p.y, p.x + p.y) * 0.70710678;
}

// Khatam: the eight-point star, two squares a quarter-turn apart.
float sdEightPointStar(vec2 p, float r) {
  float square = r * 0.7071;
  return min(sdBox2(p, vec2(square)), sdBox2(rotate45(p), vec2(square)));
}

// A lozenge (rhombus) with half-diagonals a (along) and b (across).
float sdLozenge(vec2 p, vec2 ab) {
  p = abs(p);
  float h = clamp((-2.0 * dot(p, ab) + dot(ab, ab)) / dot(ab, ab), -1.0, 1.0);
  float d = length(p - 0.5 * ab * vec2(1.0 - h, 1.0 + h));
  return d * sign(p.x * ab.y + p.y * ab.x - ab.x * ab.y);
}

// Chip carving: a pocket whose walls slope straight down to a centre ridge,
// so each facet catches the overhead light differently.
float chipCut(float sd, float depth, float wallWidth) {
  if (sd >= 0.0) return 0.0;
  return -depth * clamp(-sd / wallWidth, 0.0, 1.0);
}

// A V-groove along a line at distance d.
float vCut(float d, float width, float depth) {
  return -depth * (1.0 - smoothstep(0.0, width, abs(d)));
}

// Rounded relief: rises inside the shape with a soft shoulder.
float roundRelief(float sd, float height, float shoulder) {
  float x = clamp(-sd / shoulder, 0.0, 1.0);
  return height * sqrt(1.0 - (1.0 - x) * (1.0 - x));
}

/**
 * Number of repeats of a motif along a band so an integer count fits between
 * the mitres (within a few percent of the nominal period), and the position
 * within the current cell: x in [-0.5, 0.5) of the cell, cell index in y.
 */
vec2 bandCell(float s, float bandCentre, float nominalPeriod) {
  float len = railLength() - 2.0 * bandCentre;
  float n = max(1.0, floor(len / nominalPeriod + 0.5));
  float period = len / n;
  float u = (s - bandCentre) / period;
  return vec2(fract(u) - 0.5, floor(u));
}

float bandPeriod(float bandCentre, float nominalPeriod) {
  float len = railLength() - 2.0 * bandCentre;
  return len / max(1.0, floor(len / nominalPeriod + 0.5));
}
`;
