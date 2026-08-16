import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Hoisted so it's initialized BEFORE vi.mock's factory (which Vitest hoists
// to the top of the file). VuMeterView.test.ts uses the same pattern.
// Explicit signature so `mock.calls` destructures have known tuple shape
// (event: string, handler: fn) under `strict` tsc.
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
  rmsToMeterDb,
  meterDbToAngle,
  rmsToAngle,
  spectrumFrame,
  vuRmsL,
  vuRmsR,
  SCALE_POINTS_DB,
  SWEEP_DEG,
  ANGLE_MIN_DEG,
  OVERSHOOT_DB,
  CALIBRATION_OFFSET_DB,
  SIGNAL_TIMEOUT_MS,
  initSpectrumStore,
  type SpectrumFrame,
} from '../spectrum';

const STEP = SWEEP_DEG / (SCALE_POINTS_DB.length - 1);   // 90/7 ≈ 12.857°

describe('rmsToMeterDb', () => {
  it.each([
    [0, -40],           // silence rests at the left end stop
    [undefined, -40],
    [-0.1, -40],        // defensive — RMS must never be negative
    [0.001, -40],       // −60 dBFS → −52 on the face → clamped to the stop
    [0.12589254, -10],  // −18 dBFS, the usual mastering target → −10 on the face
    [0.39810717, 0],    // −8 dBFS → dead on 0, the calibration reference
    [1.0, OVERSHOOT_DB],   // 0 dBFS → past 0, clamped to the overshoot limit
    [2.0, OVERSHOOT_DB],   // impossible, still clamps
  ])('rmsToMeterDb(%s) ≈ %s dB', (rms, expected) => {
    expect(rmsToMeterDb(rms as number | undefined)).toBeCloseTo(expected, 3);
  });

  it('applies the calibration offset — an honest dBFS read would park the needle off-scale', () => {
    // −18 dBFS is ordinary programme material. Uncalibrated it lands at −18 on
    // an eight-point scale whose midpoint is −18; calibrated it lands at −10,
    // in the meaty part of the sweep. This is the whole reason the offset exists.
    const rms = 0.12589254;   // −18 dBFS
    expect(rmsToMeterDb(rms, 0)).toBeCloseTo(-18, 3);
    expect(rmsToMeterDb(rms)).toBeCloseTo(-18 + CALIBRATION_OFFSET_DB, 3);
  });

  it('keeps the loudest album in the library off the end stop', () => {
    // Regression guard for "the needle goes past the limit and stays there".
    // Queens Of The Stone Age measures −6.7 LUFS gated-integrated, the hottest
    // of the 49 albums surveyed on 2026-08-17. A needle welded to the stop for
    // a whole album is the failure this calibration exists to prevent, so the
    // clamp must sit above the loudest programme level, not below it.
    const loudestDbfs = -6.7;
    const rms = Math.pow(10, loudestDbfs / 20);
    const ceiling = SCALE_POINTS_DB[SCALE_POINTS_DB.length - 1] + OVERSHOOT_DB;

    expect(rmsToMeterDb(rms)).toBeLessThan(ceiling);
    expect(rmsToMeterDb(rms)).toBeGreaterThan(-6);   // and still up at the hot end
  });

  it('keeps the quietest album in the library off the left stop', () => {
    // The other side of the same trade: an HRx transfer at −40.7 LUFS must
    // still visibly move rather than lying dead on the rest position.
    const quietestDbfs = -40.7;
    const rms = Math.pow(10, quietestDbfs / 20);
    expect(rmsToMeterDb(rms)).toBeGreaterThan(SCALE_POINTS_DB[0]);
  });
});

describe('meterDbToAngle', () => {
  it('places every engraved scale point at an equal angular step', () => {
    SCALE_POINTS_DB.forEach((db, i) => {
      expect(meterDbToAngle(db)).toBeCloseTo(ANGLE_MIN_DEG + i * STEP, 6);
    });
  });

  it('is symmetric about vertical across the printed scale', () => {
    expect(meterDbToAngle(SCALE_POINTS_DB[0])).toBeCloseTo(-SWEEP_DEG / 2, 6);
    expect(meterDbToAngle(0)).toBeCloseTo(SWEEP_DEG / 2, 6);
  });

  it.each([
    [-35, ANGLE_MIN_DEG + 0.5 * STEP],   // halfway through the −40…−30 interval
    [-27, ANGLE_MIN_DEG + 1.5 * STEP],   // halfway through −30…−24
    [-1.5, ANGLE_MIN_DEG + 6.5 * STEP],  // halfway through −3…0
  ])('interpolates linearly inside an interval: %s dB', (db, expected) => {
    expect(meterDbToAngle(db)).toBeCloseTo(expected, 6);
  });

  it('overshoots past 0 dB at the final interval rate rather than pinning flat', () => {
    const zero = meterDbToAngle(0);
    expect(meterDbToAngle(1)).toBeGreaterThan(zero);
    // The −3…0 interval spans one STEP over 3 dB, so the overshoot region
    // continues at STEP/3 degrees per dB.
    expect(meterDbToAngle(OVERSHOOT_DB)).toBeCloseTo(zero + (OVERSHOOT_DB / 3) * STEP, 6);
  });

  it('clamps hard at both end stops', () => {
    expect(meterDbToAngle(-1000)).toBeCloseTo(ANGLE_MIN_DEG, 6);
    expect(meterDbToAngle(999)).toBeCloseTo(meterDbToAngle(OVERSHOOT_DB), 6);
    expect(meterDbToAngle(NaN)).toBeCloseTo(ANGLE_MIN_DEG, 6);
  });

  it('is monotonic across the full travel', () => {
    let prev = -Infinity;
    for (let db = -50; db <= 10; db += 0.25) {
      const a = meterDbToAngle(db);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });
});

describe('rmsToAngle', () => {
  it('composes the calibration and the scale mapping', () => {
    expect(rmsToAngle(0)).toBeCloseTo(ANGLE_MIN_DEG, 6);
    expect(rmsToAngle(0.12589254)).toBeCloseTo(meterDbToAngle(-10), 4);
    expect(rmsToAngle(1)).toBeCloseTo(meterDbToAngle(OVERSHOOT_DB), 6);
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
  function handler() {
    initSpectrumStore();
    const h = onMock.mock.calls.find(([event]) => event === 'pushSpectrum')?.[1] as
      | ((frame: SpectrumFrame) => void)
      | undefined;
    expect(h).toBeTypeOf('function');
    return h!;
  }

  it('sets spectrumFrame and exposes raw linear RMS per channel', () => {
    const push = handler();
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
    push(frame);

    expect(get(spectrumFrame)).toEqual(frame);
    // Linear, not dB — the 300 ms ballistics run before the scale mapping.
    expect(get(vuRmsL)).toBeCloseTo(0.5, 6);
    expect(get(vuRmsR)).toBeCloseTo(0.1, 6);
  });

  it('replaces the frame on a second push', () => {
    const push = handler();
    push({
      binsL: [], binsR: [], peakL: 0, peakR: 0, rmsL: 0.5, rmsR: 0.5, sampleRate: 44100, ts: 1,
    } as unknown as SpectrumFrame);
    push({
      binsL: [], binsR: [], peakL: 0, peakR: 0, rmsL: 0.01, rmsR: 1.0, sampleRate: 44100, ts: 2,
    } as unknown as SpectrumFrame);

    expect(get(vuRmsL)).toBeCloseTo(0.01, 6);
    expect(get(vuRmsR)).toBeCloseTo(1.0, 6);
  });

  it('falls back to rest when frames stop arriving', () => {
    // MPD stops writing the FIFO the moment playback pauses, so the backend
    // simply stops emitting. There is no pause event and no silence frame on
    // this path — without the timeout the needles freeze wherever the music
    // left them, which on a loud passage means pinned hard right.
    vi.useFakeTimers();
    try {
      const push = handler();
      push({
        binsL: [0.4, 0.2], binsR: [0.3, 0.1],
        peakL: 0.9, peakR: 0.8, rmsL: 0.5, rmsR: 0.6, sampleRate: 44100, ts: 1,
      } as unknown as SpectrumFrame);

      vi.advanceTimersByTime(SIGNAL_TIMEOUT_MS - 1);
      expect(get(vuRmsL)).toBeCloseTo(0.5, 6);   // still coasting

      vi.advanceTimersByTime(2);
      expect(get(vuRmsL)).toBe(0);
      expect(get(vuRmsR)).toBe(0);

      const frame = get(spectrumFrame)!;
      expect(frame.peakL).toBe(0);
      expect(frame.binsL).toEqual([0, 0]);
      expect(frame.ts).toBe(1);   // last real frame's stamp is preserved
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not drop to rest while frames keep arriving', () => {
    vi.useFakeTimers();
    try {
      const push = handler();
      for (let i = 0; i < 10; i++) {
        push({
          binsL: [], binsR: [], peakL: 0, peakR: 0,
          rmsL: 0.5, rmsR: 0.5, sampleRate: 44100, ts: i,
        } as unknown as SpectrumFrame);
        vi.advanceTimersByTime(50);   // the real 20 fps cadence
      }
      expect(get(vuRmsL)).toBeCloseTo(0.5, 6);
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats a missing or malformed rms as silence rather than NaN-ing the needle', () => {
    const push = handler();
    push({
      binsL: [], binsR: [], peakL: 0, peakR: 0, sampleRate: 44100, ts: 3,
    } as unknown as SpectrumFrame);

    expect(get(vuRmsL)).toBe(0);
    expect(rmsToAngle(get(vuRmsL))).toBeCloseTo(ANGLE_MIN_DEG, 6);
  });
});
