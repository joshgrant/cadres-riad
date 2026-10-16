/**
 * Derives the accent tokens from the system accent (tint) colour, so the UI
 * follows the user's choice while every text pair stays WCAG AA.
 */

type RGB = [number, number, number];

export interface AccentTokens {
  /** Rings, toggle fill, selection. At least 3:1 against the backgrounds. */
  accent: string;
  /** Fill behind white text (buttons). At least 4.5:1 with white. */
  accentButton: string;
  /** Accent-coloured text on surfaces. At least 4.5:1 against the backgrounds. */
  accentText: string;
}

// Backgrounds the accent sits on, per theme (from tokens.css).
const BACKGROUNDS = {
  light: ['#e8e8ed', '#f5f5f7', '#ffffff'],
  dark: ['#121214', '#1f1f21', '#2c2c2e'],
} as const;

export function parseHex(hex: string): RGB | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Parses `rgb(r, g, b)` / `rgb(r g b)` as returned by getComputedStyle. */
export function parseRgb(text: string): RGB | null {
  const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(text);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
}

function luminance([r, g, b]: RGB): number {
  const linear = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function mix(colour: RGB, towards: RGB, amount: number): RGB {
  return colour.map((v, i) => v + (towards[i]! - v) * amount) as RGB;
}

/** Moves the colour towards black or white in small steps until `ok` holds. */
function adjust(colour: RGB, towards: 'black' | 'white', ok: (c: RGB) => boolean): RGB {
  const target: RGB = towards === 'black' ? [0, 0, 0] : [255, 255, 255];
  for (let step = 0; step <= 50; step++) {
    const candidate = mix(colour, target, step / 50);
    if (ok(candidate)) return candidate;
  }
  return target;
}

export function deriveAccent(hex: string, theme: 'light' | 'dark'): AccentTokens | null {
  const base = parseHex(hex);
  if (!base) return null;
  const backgrounds = BACKGROUNDS[theme].map((b) => parseHex(b)!);
  const white: RGB = [255, 255, 255];
  const away = theme === 'light' ? 'black' : 'white';
  const against = (ratio: number) => (c: RGB) => backgrounds.every((b) => contrast(c, b) >= ratio);

  return {
    accent: toHex(adjust(base, away, against(3))),
    accentButton: toHex(adjust(base, 'black', (c) => contrast(c, white) >= 4.5)),
    accentText: toHex(adjust(base, away, against(4.5))),
  };
}

const STYLE_ID = 'system-accent';

/** Writes the derived tokens for both themes; null restores the defaults in tokens.css. */
export function applyAccent(hex: string | null): void {
  document.getElementById(STYLE_ID)?.remove();
  if (!hex) return;
  const light = deriveAccent(hex, 'light');
  const dark = deriveAccent(hex, 'dark');
  if (!light || !dark) return;
  const block = (t: AccentTokens) =>
    `--accent: ${t.accent}; --accent-button: ${t.accentButton}; --accent-text: ${t.accentText};`;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
:root { ${block(light)} }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${block(dark)} } }
[data-theme='dark'] { ${block(dark)} }
[data-theme='light'] { ${block(light)} }`;
  document.head.append(style);
}
