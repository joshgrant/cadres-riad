import { describe, expect, it } from 'vitest';
import { FRAME_GEOMETRY } from '../frames/geometry';
import { FRAME_IDS } from '../frames/ids';
import { fitFrame, frameProportions } from './layout';

describe('frameProportions', () => {
  for (const id of FRAME_IDS) {
    for (const orientation of ['landscape', 'portrait'] as const) {
      it(`${id} ${orientation}: rails are the right fraction of the short side`, () => {
        const geometry = FRAME_GEOMETRY[id];
        const { width, height, rails } = frameProportions(geometry, orientation);
        const short = Math.min(width, height);
        expect(rails.left / short).toBeCloseTo(geometry.rail, 10);
        expect(rails.bottom / short).toBeCloseTo(geometry.bottomRail ?? geometry.rail, 10);
        expect(rails.top / short).toBeCloseTo(geometry.topRail ?? geometry.rail, 10);
        const windowWidth = width - rails.left - rails.right;
        const windowHeight = height - rails.top - rails.bottom;
        expect(windowWidth / windowHeight).toBeCloseTo(geometry.windowAspect ?? (orientation === 'landscape' ? 4 / 3 : 3 / 4), 10);
      });
    }
  }
});

describe('fitFrame', () => {
  it('fits and centres inside the bounds', () => {
    const bounds = { x: 10, y: 20, width: 800, height: 400 };
    const layout = fitFrame(bounds, FRAME_GEOMETRY.dore, 'landscape');
    expect(layout.frame.height).toBeCloseTo(400);
    expect(layout.frame.width).toBeLessThanOrEqual(800);
    expect(layout.frame.x + layout.frame.width / 2).toBeCloseTo(410);
    expect(layout.window.width / layout.window.height).toBeCloseTo(4 / 3);
  });

  it('collapses to nothing in an empty box', () => {
    const layout = fitFrame({ x: 0, y: 0, width: 0, height: 100 }, FRAME_GEOMETRY.noir, 'portrait');
    expect(layout.frame.width).toBe(0);
    expect(layout.window.height).toBe(0);
  });
});

describe('polaroid', () => {
  it('is an 88 × 107 card with a square picture', () => {
    const { width, height } = frameProportions(FRAME_GEOMETRY.polaroid, 'portrait');
    expect(width / height).toBeCloseTo(88 / 107, 10);
  });
});
