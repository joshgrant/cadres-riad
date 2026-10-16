import type { FrameLayout, Rect } from '../layout';
import { VERTEX_GLSL, fragmentShader } from './glsl';
import { PLAQUE_FRAGMENT } from './plaque';

/**
 * Renders a frame's four mitred rails with a material shader into a shared
 * WebGL2 canvas, then composites the result onto a 2D canvas. One GL context
 * serves the preview, the sidebar tiles and the export.
 */

export interface MaterialShader {
  /** GLSL defining frameHeight, frameSurface and frameAlpha. */
  glsl: string;
  /** Engraving depth in rail widths, when the caption is cut into the rail. */
  captionDepth?: number;
}

export interface CaptionMask {
  /** Upright text, white on transparent, in frame-local pixels at render scale. */
  canvas: HTMLCanvasElement;
  rect: Rect;
}

/** Render at twice the target resolution and downsample, for clean fine detail. */
const SUPERSAMPLE = 2;
const MAX_GL_SIZE = 4096;

interface Gl {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  programs: Map<string, WebGLProgram>;
  buffer: WebGLBuffer;
  captionTexture: WebGLTexture;
  emptyTexture: WebGLTexture;
}

let shared: Gl | null | undefined;

function createGl(): Gl | null {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  canvas.addEventListener('webglcontextlost', () => {
    shared = undefined;
  });
  const buffer = gl.createBuffer()!;
  const makeTexture = () => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  };
  const captionTexture = makeTexture();
  const emptyTexture = makeTexture();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  return { canvas, gl, programs: new Map(), buffer, captionTexture, emptyTexture };
}

function context(): Gl | null {
  if (shared === undefined) shared = createGl();
  return shared;
}

export function webglAvailable(): boolean {
  return context() !== null;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function program(state: Gl, key: string, fragment: string): WebGLProgram {
  const cached = state.programs.get(key);
  if (cached) return cached;
  const { gl } = state;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERTEX_GLSL));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(prog, 0, 'a_position');
  gl.bindAttribLocation(prog, 1, 'a_local');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Shader link failed: ${gl.getProgramInfoLog(prog)}`);
  state.programs.set(key, prog);
  return prog;
}

interface RailGeometry {
  /** Outer start corner, along and inward unit vectors, in frame-local units. */
  origin: [number, number];
  along: [number, number];
  inward: [number, number];
  length: number;
  width: number;
  startNeighbour: number;
  endNeighbour: number;
}

/** Rails clockwise from the top; each runs along its outer edge, grain following it. */
function rails(width: number, height: number, r: FrameLayout['rails']): RailGeometry[] {
  return [
    { origin: [0, 0], along: [1, 0], inward: [0, 1], length: width, width: r.top, startNeighbour: r.left, endNeighbour: r.right },
    { origin: [width, 0], along: [0, 1], inward: [-1, 0], length: height, width: r.right, startNeighbour: r.top, endNeighbour: r.bottom },
    { origin: [width, height], along: [-1, 0], inward: [0, -1], length: width, width: r.bottom, startNeighbour: r.right, endNeighbour: r.left },
    { origin: [0, height], along: [0, -1], inward: [1, 0], length: height, width: r.left, startNeighbour: r.bottom, endNeighbour: r.top },
  ];
}

/**
 * Draws the moulding for `layout` onto `ctx` (whose transform maps layout units to
 * device pixels). `key` identifies the material for program caching.
 */
export function drawMoulding(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  key: string,
  material: MaterialShader,
  seed: number,
  caption?: (scale: number) => CaptionMask | null,
  plaque?: Rect | null,
): boolean {
  const state = context();
  if (!state) return false;
  const { gl, canvas } = state;
  const { frame } = layout;
  const deviceScale = Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1;
  const scale = Math.min(deviceScale * SUPERSAMPLE, MAX_GL_SIZE / Math.max(frame.width, frame.height));
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  let prog: WebGLProgram;
  try {
    prog = program(state, key, fragmentShader(material.glsl));
  } catch (error) {
    console.error(error);
    return false;
  }

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const uniform = (name: string) => gl.getUniformLocation(prog, name);
  gl.uniform2f(uniform('u_size'), width, height);

  // Caption mask, upright in image space, for engraved and burned captions.
  const mask = caption?.(scale) ?? null;
  gl.activeTexture(gl.TEXTURE0);
  if (mask) {
    gl.bindTexture(gl.TEXTURE_2D, state.captionTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask.canvas);
    gl.uniform4f(uniform('u_captionRect'), mask.rect.x, mask.rect.y, mask.rect.width, mask.rect.height);
  } else {
    gl.bindTexture(gl.TEXTURE_2D, state.emptyTexture);
    gl.uniform4f(uniform('u_captionRect'), 0, 0, 1, 1);
  }
  gl.uniform1i(uniform('u_caption'), 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

  rails(frame.width, frame.height, layout.rails).forEach((rail, index) => {
    const w = rail.width * scale;
    const L = rail.length * scale;
    const [ox, oy] = [rail.origin[0] * scale, rail.origin[1] * scale];
    const [ax, ay] = rail.along;
    const [ix, iy] = rail.inward;
    const startRatio = rail.startNeighbour / rail.width;
    const endRatio = rail.endNeighbour / rail.width;
    // Trapezoid: the outer edge, and the inner edge cut back by the mitres.
    const point = (s: number, d: number): number[] => [ox + ax * s + ix * d, oy + ay * s + iy * d, s, d];
    const outerStart = point(0, 0);
    const outerEnd = point(L, 0);
    const innerEnd = point(L - w * endRatio, w);
    const innerStart = point(w * startRatio, w);
    const vertices = new Float32Array([...outerStart, ...outerEnd, ...innerEnd, ...outerStart, ...innerEnd, ...innerStart]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    gl.uniform1f(uniform('u_railWidth'), w);
    gl.uniform1f(uniform('u_railLength'), L);
    gl.uniform2f(uniform('u_along'), ax, ay);
    gl.uniform2f(uniform('u_inward'), ix, iy);
    gl.uniform1f(uniform('u_seed'), seed + index * 13.37);
    gl.uniform1f(uniform('u_pixel'), 1 / w);
    gl.uniform1f(uniform('u_startMitre'), startRatio);
    gl.uniform1f(uniform('u_endMitre'), endRatio);
    gl.uniform1i(uniform('u_rail'), index);
    const onRail = mask !== null && index === 2;
    gl.uniform1f(uniform('u_captionOn'), onRail ? 1 : 0);
    gl.uniform1f(uniform('u_captionDepth'), onRail ? (material.captionDepth ?? 0) : 0);
    gl.uniform1f(uniform('u_captionBlur'), Math.max(1, w * 0.012));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  });

  if (plaque) drawPlaque(state, plaque, layout, scale, seed, mask);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, frame.x, frame.y, frame.width, frame.height);
  ctx.restore();
  return true;
}

/** The brass plaque, drawn over the rails on the same GL canvas. */
function drawPlaque(state: Gl, rect: Rect, layout: FrameLayout, scale: number, seed: number, mask: CaptionMask | null): void {
  const { gl } = state;
  let prog: WebGLProgram;
  try {
    prog = program(state, 'plaque', PLAQUE_FRAGMENT);
  } catch (error) {
    console.error(error);
    return;
  }
  gl.useProgram(prog);
  const uniform = (name: string) => gl.getUniformLocation(prog, name);
  gl.uniform2f(uniform('u_size'), state.canvas.width, state.canvas.height);
  const w = rect.width * scale;
  const h = rect.height * scale;
  const x = (rect.x - layout.frame.x) * scale;
  const y = (rect.y - layout.frame.y) * scale;
  const m = h * 0.2;
  gl.uniform2f(uniform('u_plaque'), w, h);
  gl.uniform1f(uniform('u_seed'), seed);
  gl.uniform1f(uniform('u_scale'), scale);
  gl.uniform1i(uniform('u_caption'), 0);
  gl.uniform1f(uniform('u_captionOn'), mask ? 1 : 0);
  if (mask) gl.uniform4f(uniform('u_captionRect'), mask.rect.x, mask.rect.y, mask.rect.width, mask.rect.height);
  const vertex = (px: number, py: number) => [x + px, y + py, px, py];
  const a = vertex(-m, -m);
  const b = vertex(w + m, -m);
  const c = vertex(w + m, h + m);
  const d = vertex(-m, h + m);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
