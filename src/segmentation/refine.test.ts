import { describe, expect, it } from 'vitest';
import { boxBlur, refineCutout } from './refine';

describe('boxBlur', () => {
  it('keeps a flat field flat and spreads a step', () => {
    const flat = new Float32Array(25).fill(0.5);
    expect(Array.from(boxBlur(flat, 5, 5, 1)).every((v) => Math.abs(v - 0.5) < 1e-6)).toBe(true);
    const step = new Float32Array([0, 0, 1, 1]);
    const out = boxBlur(step, 4, 1, 1);
    expect(out[1]).toBeCloseTo(1 / 3);
    expect(out[2]).toBeCloseTo(2 / 3);
  });
});

describe('refineCutout', () => {
  /** A red person on the left, a green background on the right, a soft edge between. */
  function sample() {
    const width = 20;
    const height = 3;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const a = x < 9 ? 1 : x > 11 ? 0 : (11 - x) / 3;
        // Edge pixels are contaminated: mixed with the green background.
        rgba[i] = Math.round(255 * a);
        rgba[i + 1] = Math.round(255 * (1 - a));
        rgba[i + 2] = 0;
        rgba[i + 3] = Math.round(255 * a);
      }
    }
    return { rgba, width, height };
  }

  it('pulls edge colour towards the interior and keeps the inside untouched', () => {
    const { rgba, width, height } = sample();
    const edgeBefore = [rgba[(width + 10) * 4], rgba[(width + 10) * 4 + 1]];
    refineCutout(rgba, width, height, 4);
    const edge = (width + 10) * 4;
    expect(rgba[edge]!).toBeGreaterThan(edgeBefore[0]!);
    expect(rgba[edge + 1]!).toBeLessThan(edgeBefore[1]!);
    const inside = (width + 2) * 4;
    expect([rgba[inside], rgba[inside + 1], rgba[inside + 3]]).toEqual([255, 0, 255]);
  });

  it('feathers the alpha edge by about a pixel', () => {
    const width = 6;
    const rgba = new Uint8ClampedArray(width * 4);
    for (let x = 0; x < width; x++) rgba[x * 4 + 3] = x < 3 ? 255 : 0;
    refineCutout(rgba, width, 1, 2);
    expect(rgba[2 * 4 + 3]).toBe(170);
    expect(rgba[3 * 4 + 3]).toBe(85);
  });
});
