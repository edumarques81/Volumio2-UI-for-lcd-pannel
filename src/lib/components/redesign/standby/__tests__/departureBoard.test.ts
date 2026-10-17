import { describe, it, expect } from 'vitest';
import {
  RAIL_CELLS,
  railLine,
  qualityLabel,
  railMessages,
  formatLongDate,
  clockParts
} from '../departureBoard';

describe('railLine', () => {
  it('pads a short message to exactly RAIL_CELLS cells', () => {
    const line = railLine('ok');
    expect(line).toHaveLength(RAIL_CELLS);
    expect(line.trimEnd()).toBe('OK');
  });

  it('truncates a long message to exactly RAIL_CELLS cells', () => {
    const line = railLine('A'.repeat(RAIL_CELLS + 20));
    expect(line).toHaveLength(RAIL_CELLS);
  });

  it('collapses runs of whitespace so the board never shows a gap it did not mean', () => {
    expect(railLine('  the   dark   side  ').trimEnd()).toBe('THE DARK SIDE');
  });
});

describe('qualityLabel', () => {
  const cases: Array<{
    name: string;
    album: Record<string, unknown> | null;
    want: string;
  }> = [
    { name: 'null album', album: null, want: '' },
    {
      name: 'full spec',
      album: { trackType: 'flac', bitDepth: '24 bit', sampleRate: '192 kHz' },
      want: 'FLAC 24/192'
    },
    {
      name: 'fractional rate keeps its decimals',
      album: { trackType: 'dsf', bitDepth: '1 bit', sampleRate: '2.8 MHz' },
      want: 'DSF 1/2.8'
    },
    { name: 'kind only', album: { trackType: 'wav' }, want: 'WAV' },
    { name: 'nothing usable', album: {}, want: '' }
  ];

  for (const c of cases) {
    it(c.name, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(qualityLabel(c.album as any)).toBe(c.want);
    });
  }
});

describe('railMessages', () => {
  it('always offers the wake prompt, even with no last-played album', () => {
    const messages = railMessages(null);
    expect(messages).toHaveLength(1);
    expect(messages[0].trimEnd()).toBe('TOUCH ANYWHERE TO WAKE');
  });

  it('leads with the last-played album and every line is exactly one board width', () => {
    const messages = railMessages({
      album: 'Kind of Blue',
      artist: 'Miles Davis',
      trackType: 'flac',
      bitDepth: '24 bit',
      sampleRate: '192 kHz'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(messages[0].trimEnd()).toBe('LAST PLAYED KIND OF BLUE');
    expect(messages[1].trimEnd()).toBe('TOUCH ANYWHERE TO WAKE');
    expect(messages[2].trimEnd()).toBe('MILES DAVIS FLAC 24/192');
    for (const line of messages) expect(line).toHaveLength(RAIL_CELLS);
  });

  it('omits the quality suffix when the backend sent no format fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = railMessages({ artist: 'Bill Evans' } as any);
    expect(messages[1].trimEnd()).toBe('BILL EVANS');
  });
});

describe('formatLongDate', () => {
  it('formats as DAY D MON', () => {
    expect(formatLongDate(new Date(2026, 9, 18, 12, 0, 0))).toBe('SUN 18 OCT');
  });
});

describe('clockParts', () => {
  it('zero-pads 24h parts', () => {
    expect(clockParts(new Date(2026, 9, 18, 7, 5, 3))).toEqual({
      hh: '07',
      mm: '05',
      ss: '03'
    });
  });

  it('folds midnight to 12 in 12-hour mode rather than showing 00', () => {
    expect(clockParts(new Date(2026, 9, 18, 0, 30, 0), true).hh).toBe('12');
  });

  it('wraps the afternoon in 12-hour mode', () => {
    expect(clockParts(new Date(2026, 9, 18, 23, 30, 0), true).hh).toBe('11');
  });
});
