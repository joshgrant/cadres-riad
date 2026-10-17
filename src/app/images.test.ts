import { describe, expect, it } from 'vitest';
import { alphaBounds } from './images';

/** A width×height RGBA image, transparent except the listed opaque pixels. */
function image(width: number, height: number, opaque: [number, number][]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of opaque) data[(y * width + x) * 4 + 3] = 255;
  return data;
}

describe('alphaBounds', () => {
  it('finds the box around the visible pixels', () => {
    expect(alphaBounds(image(10, 8, [[2, 3], [6, 5]]), 10, 8)).toEqual({ x: 2, y: 3, width: 5, height: 3 });
  });

  it('counts faint pixels as visible', () => {
    const data = image(4, 4, []);
    data[(1 * 4 + 1) * 4 + 3] = 1;
    expect(alphaBounds(data, 4, 4)).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  });

  it('gives the whole image when nothing is transparent at the edges', () => {
    expect(alphaBounds(image(3, 2, [[0, 0], [2, 1]]), 3, 2)).toEqual({ x: 0, y: 0, width: 3, height: 2 });
  });

  it('gives null for a fully transparent image', () => {
    expect(alphaBounds(image(5, 5, []), 5, 5)).toBeNull();
  });
});
