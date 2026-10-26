import { describe, expect, it } from 'vitest';
import { LAYOUT_SIZE, NIL, STRIP_COUNT, archRadius, dotCentre, nilLayoutGlsl, strip } from './nilLayout';

describe('Le Nil Bleu layout', () => {
  it('puts strip 0 on the corner diagonal', () => {
    const { top, foot } = strip(0);
    expect(top[0]).toBeCloseTo(top[1], 10);
    expect(foot[0]).toBeCloseTo(foot[1], 10);
  });

  it('pads every dot equally from the band edge and both arches beside it', () => {
    for (let k = 0; k < LAYOUT_SIZE - 1; k++) {
      const dot = dotCentre(k);
      const toBand = dot[1] - NIL.bandIn;
      for (const n of [k, k + 1]) {
        const arch = strip(n).top;
        const rim = (archRadius(k) + archRadius(k + 1)) / 2;
        expect(Math.hypot(dot[0] - arch[0], dot[1] - arch[1]) - rim).toBeCloseTo(toBand, 6);
      }
      expect(toBand).toBeGreaterThan(NIL.dotRadius);
    }
  });

  it('covers past the middle of the rail', () => {
    expect(LAYOUT_SIZE).toBeGreaterThan(STRIP_COUNT / 2 + 1);
    expect(nilLayoutGlsl()).toContain(`NIL_STRIPS[${LAYOUT_SIZE}]`);
  });
});
