import { describe, it, expect } from 'vitest';
import { parseFilename, looksLikeFilename } from '../filenameParsing';

describe('parseFilename', () => {
  it('parses "NN - Artist - Title.ext" format', () => {
    const result = parseFilename('06 - Skeewiff - Mah Na Mah Na.flac');
    expect(result.title).toBe('Mah Na Mah Na');
    expect(result.artist).toBe('Skeewiff');
  });

  it('strips macOS resource fork prefix', () => {
    const result = parseFilename('._06 - Skeewiff - Mah Na Mah Na.flac');
    expect(result.title).toBe('Mah Na Mah Na');
    expect(result.artist).toBe('Skeewiff');
  });

  it('parses "NN - Title" format (no artist)', () => {
    const result = parseFilename('06 - Mah Na Mah Na.flac');
    expect(result.title).toBe('Mah Na Mah Na');
    expect(result.artist).toBeNull();
  });

  it('parses "NN Title" format', () => {
    const result = parseFilename('06 Mah Na Mah Na.flac');
    expect(result.title).toBe('Mah Na Mah Na');
    expect(result.artist).toBeNull();
  });

  it('parses "Artist - Title" format (no track number)', () => {
    const result = parseFilename('Skeewiff - Mah Na Mah Na.flac');
    expect(result.title).toBe('Mah Na Mah Na');
    expect(result.artist).toBe('Skeewiff');
  });

  it('handles plain filename', () => {
    const result = parseFilename('My Song.flac');
    expect(result.title).toBe('My Song');
    expect(result.artist).toBeNull();
  });

  it('strips path before filename', () => {
    const result = parseFilename('NAS/Music/06 - Skeewiff - Mah Na Mah Na.flac');
    expect(result.title).toBe('Mah Na Mah Na');
    expect(result.artist).toBe('Skeewiff');
  });

  it('handles various audio extensions', () => {
    for (const ext of ['.flac', '.dsf', '.wav', '.mp3', '.m4a', '.ogg', '.aiff']) {
      const result = parseFilename(`My Song${ext}`);
      expect(result.title).toBe('My Song');
    }
  });

  it('returns empty for empty input', () => {
    const result = parseFilename('');
    expect(result.title).toBe('');
    expect(result.artist).toBeNull();
  });
});

describe('looksLikeFilename', () => {
  it('detects audio extensions', () => {
    expect(looksLikeFilename('song.flac')).toBe(true);
    expect(looksLikeFilename('song.mp3')).toBe(true);
  });

  it('detects macOS resource fork prefix', () => {
    expect(looksLikeFilename('._something')).toBe(true);
  });

  it('detects path separators', () => {
    expect(looksLikeFilename('NAS/Music/song')).toBe(true);
  });

  it('returns false for clean metadata', () => {
    expect(looksLikeFilename('Mah Na Mah Na')).toBe(false);
    expect(looksLikeFilename('')).toBe(false);
  });
});
