import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Hoisted so it's initialized BEFORE vi.mock's factory (which Vitest hoists
// to the top of the file). The plan's Task 4 (VuMeterView test) uses the
// same pattern. Explicit signature so `mock.calls` destructures have known
// tuple shape (event: string, handler: fn) under `strict` tsc.
const { onMock } = vi.hoisted(() => ({
  onMock: vi.fn<(event: string, handler: (data: unknown) => void) => () => void>(
    () => () => {},
  ),
}));

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: onMock,
  },
}));

import {
  rmsToBarFill,
  spectrumFrame,
  vuLevelL,
  vuLevelR,
  initSpectrumStore,
  type SpectrumFrame,
} from '../spectrum';

describe('rmsToBarFill', () => {
  it.each([
    [0, 0],
    [undefined, 0],
    [-0.1, 0],          // defensive — RMS must never be negative
    [0.001, 0],         // exactly at the −60 dB floor → clamps to 0
    [0.01, 1 / 3],      // −40 dB → 20/60 from the floor
    [0.1, 2 / 3],       // −20 dB → 40/60 from the floor
    [1.0, 1],           // 0 dBFS → full scale
    [2.0, 1],           // impossible but clamps high
  ])('rmsToBarFill(%s) ≈ %s', (rms, expected) => {
    const got = rmsToBarFill(rms as number | undefined);
    expect(got).toBeCloseTo(expected, 4);
  });
});

describe('initSpectrumStore', () => {
  beforeEach(() => {
    onMock.mockClear();
  });

  it('registers a single pushSpectrum listener and is idempotent on second call', () => {
    initSpectrumStore();
    initSpectrumStore();
    const pushCalls = onMock.mock.calls.filter(([event]) => event === 'pushSpectrum');
    expect(pushCalls).toHaveLength(1);
  });
});

describe('spectrum store frame handling', () => {
  it('sets spectrumFrame and updates derived vuLevelL/R when a frame arrives', () => {
    initSpectrumStore();
    const pushHandler = onMock.mock.calls.find(([event]) => event === 'pushSpectrum')?.[1] as
      | ((frame: SpectrumFrame) => void)
      | undefined;
    expect(pushHandler).toBeTypeOf('function');

    const frame: SpectrumFrame = {
      binsL: new Array(64).fill(0),
      binsR: new Array(64).fill(0),
      peakL: 0.6,
      peakR: 0.2,
      rmsL: 0.5,
      rmsR: 0.1,
      sampleRate: 44100,
      ts: Date.now(),
    };
    pushHandler!(frame);

    expect(get(spectrumFrame)).toEqual(frame);
    expect(get(vuLevelL)).toBeCloseTo(rmsToBarFill(0.5), 4);
    expect(get(vuLevelR)).toBeCloseTo(rmsToBarFill(0.1), 4);
  });

  it('replaces the frame on a second push', () => {
    initSpectrumStore();
    const pushHandler = onMock.mock.calls.find(([event]) => event === 'pushSpectrum')?.[1] as
      | ((frame: SpectrumFrame) => void)
      | undefined;
    expect(pushHandler).toBeTypeOf('function');

    pushHandler!({
      binsL: [], binsR: [], peakL: 0, peakR: 0, rmsL: 0.5, rmsR: 0.5, sampleRate: 44100, ts: 1,
    } as unknown as SpectrumFrame);
    pushHandler!({
      binsL: [], binsR: [], peakL: 0, peakR: 0, rmsL: 0.01, rmsR: 1.0, sampleRate: 44100, ts: 2,
    } as unknown as SpectrumFrame);

    expect(get(vuLevelL)).toBeCloseTo(rmsToBarFill(0.01), 4);
    expect(get(vuLevelR)).toBeCloseTo(rmsToBarFill(1.0), 4);
  });
});
