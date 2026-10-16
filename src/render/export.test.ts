import { describe, expect, it } from 'vitest';
import { FRAME_IDS } from '../frames/ids';
import { EXPORT_LONG_EDGE, exportFileName, exportGeometry } from './export';

describe('exportFileName', () => {
  const date = new Date(2026, 9, 16);
  it('slugs the caption and strips accents and apostrophes', () => {
    expect(exportFileName('Riad Les Chtis D’Agadir 2026', date)).toBe('Riad-Les-Chtis-DAgadir-2026_2026-10-16.jpg');
    expect(exportFileName('Été à Agadir — œuvre de François', date)).toBe('Ete-a-Agadir-oeuvre-de-Francois_2026-10-16.jpg');
    expect(exportFileName('Noël 2026 !', date)).toBe('Noel-2026_2026-10-16.jpg');
  });

  it('falls back when the caption is empty', () => {
    expect(exportFileName('', date)).toBe('photo-encadree_2026-10-16.jpg');
    expect(exportFileName(' !? ', date)).toBe('photo-encadree_2026-10-16.jpg');
  });
});

describe('exportGeometry', () => {
  for (const frame of FRAME_IDS) {
    for (const orientation of ['landscape', 'portrait'] as const) {
      it(`${frame} ${orientation}: long edge is 2400px with the frame inside its margins`, () => {
        const { width, height, frameBox } = exportGeometry(frame, orientation);
        expect(Math.max(width, height)).toBe(EXPORT_LONG_EDGE);
        expect(frameBox.x).toBeGreaterThanOrEqual(frameBox.width * 0.03 - 0.5);
        expect(frameBox.y).toBeGreaterThanOrEqual(frameBox.width * 0.03 - 0.5);
        expect(width - (frameBox.x + frameBox.width)).toBeCloseTo(frameBox.x, 0);
        expect(height - (frameBox.y + frameBox.height)).toBeGreaterThanOrEqual(frameBox.width * 0.06 - 0.5);
      });
    }
  }
});

