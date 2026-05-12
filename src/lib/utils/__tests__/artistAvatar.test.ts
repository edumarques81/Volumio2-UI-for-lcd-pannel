import { describe, it, expect } from 'vitest';
import { artistInitial, artistHashColor } from '../artistAvatar';

describe('artistInitial', () => {
  it.each<[string, string]>([
    ['Hollow Tides', 'H'],
    ['  the Beatles', 'T'],
    ['nils frahm', 'N'],
    ['Æthel & Ash', 'Æ'],
    ['', '?'],
    ['   ', '?'],
  ])('artistInitial(%j) === %j', (input, expected) => {
    expect(artistInitial(input)).toBe(expected);
  });
});

describe('artistHashColor', () => {
  it('returns a deterministic HSL string for the same input', () => {
    expect(artistHashColor('Nils Frahm')).toBe(artistHashColor('Nils Frahm'));
  });

  it('returns different hues for different names (non-trivial dispersion)', () => {
    const a = artistHashColor('A');
    const b = artistHashColor('B');
    const c = artistHashColor('Hollow Tides');
    const d = artistHashColor('The Midnight Sun');
    const all = new Set([a, b, c, d]);
    expect(all.size).toBeGreaterThanOrEqual(3);
  });

  it('matches the hsl(<0-359>, 45%, 35%) shape', () => {
    const out = artistHashColor('Lunar Ways');
    expect(out).toMatch(/^hsl\((\d{1,3}), 45%, 35%\)$/);
    const hue = Number(out.match(/^hsl\((\d{1,3}),/)?.[1]);
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });

  it('handles empty string without throwing', () => {
    expect(() => artistHashColor('')).not.toThrow();
    expect(artistHashColor('')).toMatch(/^hsl\(\d{1,3}, 45%, 35%\)$/);
  });
});
