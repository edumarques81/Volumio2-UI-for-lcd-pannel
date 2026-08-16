import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * Per-frame audio analysis payload pushed at 20 fps by the backend, which
 * reads MPD's `/tmp/mpd_spectrum.fifo` in-process (the `stellar-spectrum`
 * sidecar that used to do this was retired 2026-08-16). The VU meter consumes
 * only `rmsL`/`rmsR`; the bin arrays are carried for a future spectrum
 * analyzer view (no second listener).
 */
export interface SpectrumFrame {
  binsL: number[];   // 64 log-binned FFT magnitudes
  binsR: number[];
  peakL: number;     // 0..1 linear
  peakR: number;
  rmsL: number;      // 0..1 linear  ← VU meter
  rmsR: number;
  sampleRate: number;
  ts: number;        // backend ms
}

/** Latest pushSpectrum frame, or null if none has arrived yet. */
export const spectrumFrame = writable<SpectrumFrame | null>(null);

/**
 * Raw linear RMS per channel, 0..1.
 *
 * Deliberately *not* pre-converted to dB. A moving-coil VU movement
 * integrates rectified current, so the meter's 300 ms ballistics belong in
 * the linear amplitude domain; the non-linear dB scale is just ink on the
 * faceplate, applied after smoothing. Smoothing in the dB domain instead
 * gives the needle the wrong fall-off character (too slow off peaks, too
 * eager off the floor).
 */
export const vuRmsL = derived(spectrumFrame, ($f) => clampRms($f?.rmsL));
export const vuRmsR = derived(spectrumFrame, ($f) => clampRms($f?.rmsR));

function clampRms(rms: number | undefined): number {
  if (!rms || rms <= 0 || Number.isNaN(rms)) return 0;
  return Math.min(1, rms);
}

/**
 * The printed scale, in the dB values engraved on the faceplate.
 *
 * These are the eight labels on the reference instrument. Their *angular*
 * spacing is even — the reference photograph's pixel spacing tapers
 * (62/53/51/45/44/45/60 px), but that is the camera's oblique angle, not the
 * instrument. A straight-on meter with a linear-in-dB region compressed at
 * both ends would be an odd thing to manufacture; even steps between engraved
 * points is the conventional layout, so that is what we reconstruct.
 */
export const SCALE_POINTS_DB = [-40, -30, -24, -18, -12, -6, -3, 0] as const;

/**
 * Total needle travel between the first and last engraved point, degrees.
 *
 * The reference photo is oblique, which foreshortens vertically: it flattens
 * the label arc while preserving its horizontal span, so measuring the sweep
 * off the image gives an impossible instrument (shallow arc + wide label row +
 * an on-face pivot cannot all hold at once). 90° is the conventional sweep
 * that satisfies the two features the photo does establish — a hub sitting on
 * the faceplate, and ticks that visibly fan.
 */
export const SWEEP_DEG = 90;

/** Angle at −40 dB. Symmetric about vertical, so 0 dB sits at +30°. */
export const ANGLE_MIN_DEG = -SWEEP_DEG / 2;

const STEP_DEG = SWEEP_DEG / (SCALE_POINTS_DB.length - 1);

/**
 * How far past the last engraved point (0 dB) the needle may travel before it
 * hits the end stop. Real meters over-swing the printed scale rather than
 * freezing dead on the final tick, and a needle that pins flat looks broken.
 */
export const OVERSHOOT_DB = 2;

/**
 * Level offset applied before reading the faceplate, in dB.
 *
 * Without it the meter reads honest dBFS and looks dead: well-mastered
 * material sits around −18 dBFS RMS, which is off the left of an eight-point
 * scale that only reaches −40. Broadcast VU has always been a *calibrated*
 * instrument — 0 VU is a chosen reference level, not digital full scale.
 * +12 puts −18 dBFS at −6 on the face and −12 dBFS at 0, so ordinary music
 * lives in the −10…0 region and only genuinely loud passages peg the needle.
 * Retune here if the meter reads consistently hot or cold.
 */
export const CALIBRATION_OFFSET_DB = 12;

/**
 * Converts a linear 0..1 RMS amplitude to a position on the printed scale,
 * in dB, clamped to what the instrument can physically display.
 *
 * Pure function, exported for unit test.
 */
export function rmsToMeterDb(
  rms: number | undefined,
  offsetDb: number = CALIBRATION_OFFSET_DB,
): number {
  const floor = SCALE_POINTS_DB[0];
  const v = clampRms(rms);
  if (v <= 0) return floor;
  const db = 20 * Math.log10(v) + offsetDb;
  const ceiling = SCALE_POINTS_DB[SCALE_POINTS_DB.length - 1] + OVERSHOOT_DB;
  return Math.max(floor, Math.min(ceiling, db));
}

/**
 * Maps a scale position in dB to a needle angle in degrees, clockwise-positive
 * from vertical (matching SVG's `rotate()`), so −40 dB is up-left at −30° and
 * 0 dB is up-right at +30°.
 *
 * Piecewise-linear between engraved points: each labelled interval gets the
 * same angular slice regardless of how many dB it spans, which is what makes
 * the crowding towards 0 dB on the faceplate. Past 0 dB the final interval's
 * rate is extrapolated into the overshoot region.
 *
 * Pure function, exported for unit test.
 */
export function meterDbToAngle(db: number): number {
  const pts = SCALE_POINTS_DB;
  const lastIdx = pts.length - 1;

  if (!Number.isFinite(db) || db <= pts[0]) return ANGLE_MIN_DEG;

  const maxAngle = ANGLE_MIN_DEG + SWEEP_DEG;
  if (db >= pts[lastIdx]) {
    const finalSpanDb = pts[lastIdx] - pts[lastIdx - 1];   // 3 dB
    const degPerDb = STEP_DEG / finalSpanDb;
    const over = Math.min(db - pts[lastIdx], OVERSHOOT_DB);
    return maxAngle + over * degPerDb;
  }

  for (let i = 1; i <= lastIdx; i++) {
    if (db <= pts[i]) {
      const frac = (db - pts[i - 1]) / (pts[i] - pts[i - 1]);
      return ANGLE_MIN_DEG + (i - 1 + frac) * STEP_DEG;
    }
  }
  /* c8 ignore next */
  return maxAngle;
}

/** Convenience composition: linear RMS straight through to needle angle. */
export function rmsToAngle(rms: number | undefined): number {
  return meterDbToAngle(rmsToMeterDb(rms));
}

let initialized = false;

/**
 * Wires the `pushSpectrum` Socket.IO listener. Idempotent — second call is a
 * no-op. Called from App.svelte:onMount alongside the other init* stores.
 *
 * No console.log in the handler: `pushSpectrum` at 20 fps × broadcast-to-all
 * is hot-path (see docs/SOCKET-CONTRACT.md).
 */
export function initSpectrumStore() {
  if (initialized) return;
  initialized = true;
  socketService.on<SpectrumFrame>('pushSpectrum', (frame) => {
    spectrumFrame.set(frame);
  });
}
