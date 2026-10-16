import { describe, expect, it } from 'vitest';
import { cleanCaption } from './CaptionEditor';

describe('cleanCaption', () => {
  it('collapses line breaks and converts quotes', () => {
    expect(cleanCaption("L'équipe\ndu Riad")).toBe('L’équipe du Riad');
    expect(cleanCaption('le "riad"')).toBe('le « riad »');
  });
});
