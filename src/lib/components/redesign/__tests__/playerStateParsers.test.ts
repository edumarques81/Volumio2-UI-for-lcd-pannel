import { describe, it, expect } from 'vitest';
import {
  parseBitDepth,
  parseSampleRate,
  normalizeCodec,
  dsdRate,
} from '../playerStateParsers';

describe('parseBitDepth', () => {
  it('returns null for null/undefined/empty', () => {
    expect(parseBitDepth(null)).toBeNull();
    expect(parseBitDepth(undefined)).toBeNull();
    expect(parseBitDepth('')).toBeNull();
  });

  it('parses bare integer strings', () => {
    expect(parseBitDepth('24')).toBe(24);
    expect(parseBitDepth('16')).toBe(16);
    expect(parseBitDepth('32')).toBe(32);
  });

  it('parses Volumio-style "N bit" / "N-bit"', () => {
    expect(parseBitDepth('24 bit')).toBe(24);
    expect(parseBitDepth('16-bit')).toBe(16);
    expect(parseBitDepth('32 bits')).toBe(32);
  });

  it('returns null for malformed input with no digits', () => {
    expect(parseBitDepth('abc')).toBeNull();
    expect(parseBitDepth('--')).toBeNull();
  });

  // Regression: AlbumPage passes the backend's composite `album.quality`
  // label straight into this parser. A first-digit-run match reads the
  // SAMPLE RATE into the bit-depth slot ("44.1kHz/16bit FLAC" -> 44), which
  // both printed "44-bit" on the LCD and tripped the >= 24 HI-RES branch in
  // pickBadgeKind, badging Red Book audio as hi-res.
  // Strings below are exactly what `formatQualityLabel`
  // (internal/domain/library/cached_service.go) produces.
  it('reads the bit depth, not the sample rate, out of a composite quality label', () => {
    expect(parseBitDepth('44.1kHz/16bit FLAC')).toBe(16);
    expect(parseBitDepth('192kHz/24bit FLAC')).toBe(24);
    expect(parseBitDepth('96kHz/24bit FLAC')).toBe(24);
    expect(parseBitDepth('352.8kHz/24bit FLAC')).toBe(24);
    expect(parseBitDepth('44.1kHz/16bit WAV')).toBe(16);
  });

  it('returns null for DSD labels, which carry no PCM bit depth', () => {
    // "DSD64" previously parsed as 64 and rendered "64-bit".
    expect(parseBitDepth('DSD64')).toBeNull();
    expect(parseBitDepth('DSD128')).toBeNull();
    expect(parseBitDepth('DSD256')).toBeNull();
    expect(parseBitDepth('DSD')).toBeNull();
  });

  it('returns null for a rate-only or codec-only label', () => {
    // No bit-depth information present — must not invent one from the rate.
    expect(parseBitDepth('44.1kHz')).toBeNull();
    expect(parseBitDepth('192kHz FLAC')).toBeNull();
    expect(parseBitDepth('flac')).toBeNull();
    // Real label from the live library: rate + codec, no bit depth. Used to
    // render "352-bit".
    expect(parseBitDepth('352.8kHz WAV')).toBeNull();
  });

  // The complete set of distinct `quality` strings present in the live
  // library (66 albums, enumerated on the Pi 2026-08-12). Every shape the
  // renderer can actually receive is pinned here.
  it.each([
    ['DSD', null],
    ['44.1kHz/16bit FLAC', 16],
    ['96kHz/24bit FLAC', 24],
    ['44.1kHz/24bit FLAC', 24],
    ['352.8kHz/24bit FLAC', 24],
    ['192kHz/24bit FLAC', 24],
    ['48kHz/24bit FLAC', 24],
    ['352.8kHz WAV', null],
    ['176.4kHz/24bit FLAC', 24],
    ['44.1kHz/32bit WAV', 32],
    ['44.1kHz/16bit WAV', 16],
  ])('parses the live-library label %s as %s', (label, expected) => {
    expect(parseBitDepth(label as string)).toBe(expected);
  });
});

describe('parseSampleRate', () => {
  it('returns null for null/undefined/empty', () => {
    expect(parseSampleRate(null)).toBeNull();
    expect(parseSampleRate(undefined)).toBeNull();
    expect(parseSampleRate('')).toBeNull();
  });

  it('treats large bare numbers as Hz', () => {
    expect(parseSampleRate('44100')).toBe(44100);
    expect(parseSampleRate('48000')).toBe(48000);
    expect(parseSampleRate('48000.0')).toBe(48000);
  });

  it('treats small bare numbers as kHz', () => {
    expect(parseSampleRate('96')).toBe(96000);
    expect(parseSampleRate('44.1')).toBe(44100);
  });

  it('parses kHz unit (case-insensitive, with/without space)', () => {
    expect(parseSampleRate('96 kHz')).toBe(96000);
    expect(parseSampleRate('96kHz')).toBe(96000);
    expect(parseSampleRate('44.1 khz')).toBe(44100);
    expect(parseSampleRate('192 KHZ')).toBe(192000);
  });

  it('parses MHz unit (case-insensitive)', () => {
    expect(parseSampleRate('2.8 mhz')).toBe(2_800_000);
    expect(parseSampleRate('2.8 MHz')).toBe(2_800_000);
    expect(parseSampleRate('5.6mhz')).toBe(5_600_000);
  });

  it('returns null when input has no digits', () => {
    expect(parseSampleRate('garbage')).toBeNull();
    expect(parseSampleRate('kHz')).toBeNull();
  });

  // Regression: a DSD quality label is a MULTIPLIER, not a rate. Reading
  // "DSD64" as a bare 64 produced 64 kHz, which then round-tripped through
  // dsdRate() as "DSD1" on the badge.
  it('resolves a DSD multiplier label to its true rate', () => {
    expect(parseSampleRate('DSD64')).toBe(2_822_400);
    expect(parseSampleRate('DSD128')).toBe(5_644_800);
    expect(parseSampleRate('DSD256')).toBe(11_289_600);
    expect(dsdRate(parseSampleRate('DSD64')!)).toBe('DSD64');
    expect(dsdRate(parseSampleRate('DSD128')!)).toBe('DSD128');
  });

  it('returns null for a bare "DSD" label carrying no rate', () => {
    // Both strips guard on `sampleRate != null` before rendering the DSD
    // badge, so null correctly suppresses it rather than showing "DSD0".
    expect(parseSampleRate('DSD')).toBeNull();
  });

  it('reads the rate out of a composite quality label', () => {
    expect(parseSampleRate('44.1kHz/16bit FLAC')).toBe(44_100);
    expect(parseSampleRate('192kHz/24bit FLAC')).toBe(192_000);
    expect(parseSampleRate('352.8kHz/24bit FLAC')).toBe(352_800);
  });
});

describe('normalizeCodec', () => {
  it('returns null for null/undefined/empty/whitespace-only', () => {
    expect(normalizeCodec(null)).toBeNull();
    expect(normalizeCodec(undefined)).toBeNull();
    expect(normalizeCodec('')).toBeNull();
    expect(normalizeCodec('   ')).toBeNull();
  });

  it('collapses any DSD variant to "DSD"', () => {
    expect(normalizeCodec('DSD')).toBe('DSD');
    expect(normalizeCodec('dsd')).toBe('DSD');
    expect(normalizeCodec('DSD64')).toBe('DSD');
    expect(normalizeCodec('DSD128')).toBe('DSD');
    expect(normalizeCodec('dsd256')).toBe('DSD');
  });

  it('returns "MQA" for MQA (case-insensitive)', () => {
    expect(normalizeCodec('MQA')).toBe('MQA');
    expect(normalizeCodec('mqa')).toBe('MQA');
  });

  it('uppercases other codecs', () => {
    expect(normalizeCodec('FLAC')).toBe('FLAC');
    expect(normalizeCodec('flac')).toBe('FLAC');
    expect(normalizeCodec('aac')).toBe('AAC');
    expect(normalizeCodec('mp3')).toBe('MP3');
  });

  it('passes unknown codec strings through uppercased', () => {
    // Defensive: parser stays neutral about unknown values
    expect(normalizeCodec('ogg')).toBe('OGG');
    expect(normalizeCodec('alac')).toBe('ALAC');
  });
});

describe('dsdRate', () => {
  it('maps DSD64 base rate (2.8224 MHz) to "DSD64"', () => {
    expect(dsdRate(2_822_400)).toBe('DSD64');
  });

  it('maps DSD128 base rate (5.6448 MHz) to "DSD128"', () => {
    expect(dsdRate(5_644_800)).toBe('DSD128');
  });

  it('maps DSD256 base rate (11.2896 MHz) to "DSD256"', () => {
    expect(dsdRate(11_289_600)).toBe('DSD256');
  });

  it('rounds intermediate values to nearest multiplier', () => {
    // Within rounding tolerance of DSD64
    expect(dsdRate(2_822_399)).toBe('DSD64');
    expect(dsdRate(2_822_401)).toBe('DSD64');
  });

  it('returns "DSD0" for 0 Hz (degenerate input)', () => {
    expect(dsdRate(0)).toBe('DSD0');
  });

  it('returns "DSDNaN" for non-finite input (defensive)', () => {
    // dsdRate is only meant to run on a real Hz number; document the
    // current behavior so a future caller does not silently regress.
    expect(dsdRate(Number.NaN)).toBe('DSDNaN');
  });
});
