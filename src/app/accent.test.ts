import { describe, expect, it } from 'vitest';
import { contrast, deriveAccent, parseHex, parseRgb, toHex } from './accent';

const white = parseHex('#ffffff')!;

describe('deriveAccent', () => {
  for (const system of ['#007aff', '#ffc600', '#8c8c8c', '#e0465c', '#62ba46', '#0078d4']) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${system} in ${theme} keeps AA contrast`, () => {
        const tokens = deriveAccent(system, theme)!;
        const backgrounds = theme === 'light' ? ['#e8e8ed', '#f5f5f7', '#ffffff'] : ['#121214', '#1f1f21', '#2c2c2e'];
        for (const bg of backgrounds) {
          expect(contrast(parseHex(tokens.accentText)!, parseHex(bg)!)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(parseHex(tokens.accent)!, parseHex(bg)!)).toBeGreaterThanOrEqual(3);
        }
        expect(contrast(parseHex(tokens.accentButton)!, white)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('leaves an already-compliant accent unchanged', () => {
    expect(deriveAccent('#0060c0', 'light')!.accent).toBe('#0060c0');
  });

  it('rejects garbage', () => {
    expect(deriveAccent('blue', 'light')).toBeNull();
  });
});

describe('colour parsing', () => {
  it('round-trips hex and reads rgb()', () => {
    expect(toHex(parseHex('#0A84FF')!)).toBe('#0a84ff');
    expect(parseRgb('rgb(10, 132, 255)')).toEqual([10, 132, 255]);
    expect(parseRgb('rgb(10 132 255)')).toEqual([10, 132, 255]);
  });
});
