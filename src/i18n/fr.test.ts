import { describe, expect, it } from 'vitest';
import { messages, t } from './fr';
import { NNBSP, formatNumber, frenchSpacing, smartQuotes, typeset } from './typography';

describe('frenchSpacing', () => {
  it('adds a narrow no-break space before high punctuation', () => {
    expect(frenchSpacing('Noël 2026 !')).toBe(`Noël 2026${NNBSP}!`);
    expect(frenchSpacing('Vraiment?')).toBe(`Vraiment${NNBSP}?`);
    expect(frenchSpacing('légende : texte')).toBe(`légende${NNBSP}: texte`);
    expect(frenchSpacing('50%')).toBe(`50${NNBSP}%`);
    expect(frenchSpacing('a;b')).toBe(`a${NNBSP};b`);
  });

  it('is idempotent', () => {
    const once = frenchSpacing('Quoi ?! Oui : 50 %');
    expect(frenchSpacing(once)).toBe(once);
    expect(once).toBe(`Quoi${NNBSP}?! Oui${NNBSP}: 50${NNBSP}%`);
  });

  it('leaves URLs, times and leading marks alone', () => {
    expect(frenchSpacing('https://example.com')).toBe('https://example.com');
    expect(frenchSpacing('à 12:30')).toBe('à 12:30');
    expect(frenchSpacing('!')).toBe('!');
  });

  it('keeps accented test strings intact', () => {
    expect(frenchSpacing('Été à Agadir — œuvre de François')).toBe('Été à Agadir — œuvre de François');
  });
});

describe('smartQuotes', () => {
  it('converts apostrophes', () => {
    expect(smartQuotes("L'équipe du Riad")).toBe('L’équipe du Riad');
  });

  it('converts double quotes to guillemets', () => {
    expect(smartQuotes('Le "Riad" ici')).toBe(`Le «${NNBSP}Riad${NNBSP}» ici`);
    expect(smartQuotes('" Riad "')).toBe(`«${NNBSP}Riad${NNBSP}»`);
  });

  it('combines with spacing in typeset', () => {
    expect(typeset("C'est \"top\"!")).toBe(`C’est «${NNBSP}top${NNBSP}»${NNBSP}!`);
  });
});

describe('formatNumber', () => {
  it('formats in French', () => {
    expect(formatNumber(1234.5)).toMatch(/^1\s234,5$/u);
  });
});

describe('messages', () => {
  it('never has a plain space or no space before : ; ! ? %', () => {
    for (const [key, value] of Object.entries(messages)) {
      expect(value, key).not.toMatch(/[^ ][:;!?%]/u);
      expect(value, key).not.toContain("'");
    }
  });

  it('fills placeholders', () => {
    expect(t('canvas.label', { frame: 'Doré sculpté', caption: 'Riad' })).toBe(
      `Photo dans un cadre Doré sculpté, légende${NNBSP}: Riad`,
    );
    expect(t('eta.minutes', { n: 3 })).toBe('environ 3 min restantes');
    expect(t('download.progress', { done: 42 })).toBe('42 Mo sur {total} Mo — {eta}');
  });
});
