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
      logoId: 'logo-abc',
      logo: { x: 0.5, y: 0.25, width: 0.4 },
      collapsed: { frame: true, background: false, logo: true },
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

  it('fills in the logo for prefs saved before it existed', () => {
    const { logoId: _id, logo: _logo, ...older } = defaultPrefs();
    const parsed = parsePrefs(JSON.stringify({ ...older, frame: 'noir', collapsed: { frame: true, background: true } }));
    expect(parsed.logoId).toBe('default');
    expect(parsed.logo).toEqual({ x: 0.03, y: 0.04, width: 0.2 });
    expect(parsed.collapsed).toEqual({ frame: true, background: true, logo: false });
    expect(parsed.frame).toBe('noir');
  });

  it('rejects a logo placement outside the window', () => {
    for (const logo of [{ x: -1, y: 0, width: 0.2 }, { x: 0, y: 0, width: 0 }, { x: 0, y: 0 }, 'top-left']) {
      expect(parsePrefs(JSON.stringify({ version: 1, logo })).logo).toEqual(defaultPrefs().logo);
    }
  });

  it('keeps an empty caption but caps length at 60', () => {
    expect(parsePrefs(JSON.stringify({ version: 1, caption: '' })).caption).toBe('');
    expect(parsePrefs(JSON.stringify({ version: 1, caption: 'x'.repeat(80) })).caption).toHaveLength(60);
  });
});
