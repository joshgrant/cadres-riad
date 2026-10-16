import { describe, expect, it } from 'vitest';
import { defaultPrefs, parsePrefs } from './prefs';

describe('parsePrefs', () => {
  it('gives defaults when nothing is stored', () => {
    expect(parsePrefs(null)).toEqual(defaultPrefs());
  });

  it('gives defaults on invalid JSON', () => {
    expect(parsePrefs('{nope')).toEqual(defaultPrefs());
  });

  it('gives defaults on an unknown version', () => {
    expect(parsePrefs(JSON.stringify({ ...defaultPrefs(), version: 2, frame: 'noir' }))).toEqual(defaultPrefs());
    expect(parsePrefs(JSON.stringify({ frame: 'noir' }))).toEqual(defaultPrefs());
    expect(parsePrefs('[]')).toEqual(defaultPrefs());
  });

  it('round-trips valid prefs', () => {
    const stored = {
      ...defaultPrefs(),
      frame: 'polaroid',
      orientation: 'portrait',
      backgroundId: 'bg-123',
      cutout: true,
      caption: 'Noël 2026 !',
      collapsed: { frame: true, background: false },
      hintDismissed: true,
    };
    expect(parsePrefs(JSON.stringify(stored))).toEqual(stored);
  });

  it('falls back field by field', () => {
    const parsed = parsePrefs(
      JSON.stringify({ version: 1, frame: 'gold', orientation: 'diagonal', cutout: 'yes', caption: 42, collapsed: null, hintDismissed: true }),
    );
    expect(parsed).toEqual({ ...defaultPrefs(), hintDismissed: true });
  });

  it('keeps an empty caption but caps length at 60', () => {
    expect(parsePrefs(JSON.stringify({ version: 1, caption: '' })).caption).toBe('');
    expect(parsePrefs(JSON.stringify({ version: 1, caption: 'x'.repeat(80) })).caption).toHaveLength(60);
  });
});
