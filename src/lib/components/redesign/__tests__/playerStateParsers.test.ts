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
