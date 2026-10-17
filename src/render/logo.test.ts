import { describe, expect, it } from 'vitest';
import { clampLogo, logoRect, moveLogo, resizeLogo, scaleLogo, MIN_LOGO_WIDTH } from './logo';

const window = { width: 800, height: 600 };
const aspect = 2; // twice as wide as tall

/** The logo's box in window pixels. */
function box(placement: { x: number; y: number; width: number }) {
  return logoRect(placement, { x: 0, y: 0, ...window }, aspect);
}

function inside(placement: { x: number; y: number; width: number }) {
  const r = box(placement);
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(window.width + 1e-9);
  expect(r.y + r.height).toBeLessThanOrEqual(window.height + 1e-9);
}

describe('clampLogo', () => {
  it('keeps a placement that fits', () => {
    expect(clampLogo({ x: 0.03, y: 0.04, width: 0.2 }, window, aspect)).toEqual({ x: 0.03, y: 0.04, width: 0.2 });
  });

  it('pulls the logo back inside the window', () => {
    const clamped = clampLogo({ x: 0.95, y: 0.99, width: 0.3 }, window, aspect);
    inside(clamped);
    expect(box(clamped).x + box(clamped).width).toBeCloseTo(window.width);
  });

  it('limits the size to what fits, in both directions', () => {
    // A tall logo in a wide window is limited by the height.
    const tall = clampLogo({ x: 0, y: 0, width: 1 }, window, 0.5);
    expect(tall.width * window.width).toBeCloseTo(window.height * 0.5);
    expect(clampLogo({ x: 0, y: 0, width: 0.001 }, window, aspect).width).toBe(MIN_LOGO_WIDTH);
  });
});

describe('moveLogo', () => {
  it('moves by window pixels', () => {
    const moved = moveLogo({ x: 0.1, y: 0.1, width: 0.2 }, 80, 60, window, aspect);
    expect(moved.x).toBeCloseTo(0.2);
    expect(moved.y).toBeCloseTo(0.2);
  });

  it('never leaves the window', () => {
    inside(moveLogo({ x: 0.1, y: 0.1, width: 0.2 }, 5000, -5000, window, aspect));
    inside(moveLogo({ x: 0.1, y: 0.1, width: 0.2 }, -5000, 5000, window, aspect));
  });
});

describe('resizeLogo', () => {
  const start = { x: 0.25, y: 0.25, width: 0.25 }; // 200×100 at (200, 150)

  it('keeps the aspect and the opposite corner', () => {
    const se = box(resizeLogo(start, 'se', 100, 50, window, aspect));
    expect(se.x).toBeCloseTo(200);
    expect(se.y).toBeCloseTo(150);
    expect(se.width).toBeCloseTo(300);
    expect(se.width / se.height).toBeCloseTo(aspect);

    const nw = box(resizeLogo(start, 'nw', -100, -50, window, aspect));
    expect(nw.x + nw.width).toBeCloseTo(400);
    expect(nw.y + nw.height).toBeCloseTo(250);
    expect(nw.width).toBeCloseTo(300);

    const ne = box(resizeLogo(start, 'ne', -100, 50, window, aspect));
    expect(ne.x).toBeCloseTo(200);
    expect(ne.y + ne.height).toBeCloseTo(250);
    expect(ne.width).toBeCloseTo(100);
  });

  it('follows the drag along the diagonal only', () => {
    // Moving across the diagonal changes nothing.
    const across = box(resizeLogo(start, 'se', 50, -100, window, aspect));
    expect(across.width).toBeCloseTo(200);
  });

  it('stops at the window edge and at the minimum size', () => {
    const big = resizeLogo(start, 'se', 5000, 5000, window, aspect);
    inside(big);
    expect(box(big).x).toBeCloseTo(200);
    expect(box(big).width).toBeCloseTo(600); // the right edge is reached first

    const small = box(resizeLogo(start, 'sw', 5000, -5000, window, aspect));
    expect(small.width).toBeCloseTo(MIN_LOGO_WIDTH * window.width);
    expect(small.x + small.width).toBeCloseTo(400);
  });
});

describe('scaleLogo', () => {
  it('scales around the centre', () => {
    const before = box({ x: 0.25, y: 0.25, width: 0.25 });
    const after = box(scaleLogo({ x: 0.25, y: 0.25, width: 0.25 }, 1.5, window, aspect));
    expect(after.width).toBeCloseTo(before.width * 1.5);
    expect(after.x + after.width / 2).toBeCloseTo(before.x + before.width / 2);
    expect(after.y + after.height / 2).toBeCloseTo(before.y + before.height / 2);
  });
});
