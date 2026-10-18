import { describe, it, expect } from 'vitest';
import { castBlockReason, castBlockMessage, CAST_MAX_SAMPLE_RATE } from '../castPolicy';

describe('castBlockReason', () => {
  it('matches the backend ceiling', () => {
    expect(CAST_MAX_SAMPLE_RATE).toBe(192000);
  });

  const cases: Array<[string, any, string | null]> = [
    ['a CD-rate FLAC', { trackType: 'flac', sampleRate: 44100 }, null],
    ['192 kHz exactly — the measured ceiling, which plays', { trackType: 'flac', sampleRate: 192000 }, null],
    ['352.8 kHz FLAC', { trackType: 'flac', sampleRate: 352800 }, 'above the 192 kHz a Cast device accepts'],
    ['a DSF file', { trackType: 'dsf', sampleRate: 2822400 }, 'DSD cannot be played by a Cast device'],
    ['a DFF file', { trackType: 'dff' }, 'DSD cannot be played by a Cast device'],
    ['an extension written with its dot', { trackType: '.DSF' }, 'DSD cannot be played by a Cast device'],
    ['a 96 kHz WAV', { trackType: 'wav', sampleRate: 96000 }, null],
  ];

  for (const [name, album, want] of cases) {
    it(`${want === null ? 'passes' : 'blocks'} ${name}`, () => {
      expect(castBlockReason(album)).toBe(want);
    });
  }

  it('lets an unmeasured album through rather than hiding it on a guess', () => {
    expect(castBlockReason({})).toBeNull();
    expect(castBlockReason({ trackType: 'flac' })).toBeNull();
    expect(castBlockReason({ sampleRate: 0 })).toBeNull();
  });

  it('is null-safe', () => {
    expect(castBlockReason(null)).toBeNull();
    expect(castBlockReason(undefined)).toBeNull();
  });

  it('blocks DSD even when the rate alone would pass', () => {
    // A DSD64 album whose cached sampleRate was never filled in must still be
    // blocked by format — the rate check cannot carry it.
    expect(castBlockReason({ trackType: 'dsf', sampleRate: 0 })).toBe('DSD cannot be played by a Cast device');
  });
});

describe('castBlockMessage', () => {
  it('is null for an album the device can play', () => {
    expect(castBlockMessage({ trackType: 'flac', sampleRate: 96000 }, 'Living Room Display')).toBeNull();
  });

  it('names the device and the missing decoder for DSD', () => {
    expect(castBlockMessage({ trackType: 'dsf', sampleRate: 2822400 }, 'Living Room Display'))
      .toBe('Living Room Display has no DSD decoder, so this album cannot be cast.');
  });

  it('quotes the actual rate against the ceiling', () => {
    expect(castBlockMessage({ trackType: 'flac', sampleRate: 352800 }, 'Living Room Display'))
      .toBe('352.8 kHz is above the 192 kHz Living Room Display accepts.');
  });

  it('drops a trailing .0 on a whole-kHz rate', () => {
    expect(castBlockMessage({ trackType: 'wav', sampleRate: 384000 }, 'Hub'))
      .toBe('384 kHz is above the 192 kHz Hub accepts.');
  });

  it('falls back to a generic noun when the device has no name', () => {
    expect(castBlockMessage({ trackType: 'dff' }, ''))
      .toBe('this Cast device has no DSD decoder, so this album cannot be cast.');
  });
});
