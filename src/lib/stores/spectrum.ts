import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * Per-frame audio analysis payload pushed by the Pi-side `stellar-spectrum`
 * daemon (M1.B) at 20 fps. M1.E consumes only `rmsL` and `rmsR`; the bin
 * arrays are carried for a future spectrum analyzer view (no second listener).
 */
export interface SpectrumFrame {
  binsL: number[];   // 64 log-binned FFT magnitudes
  binsR: number[];
  peakL: number;     // 0..1 linear
  peakR: number;
  rmsL: number;      // 0..1 linear  ← M1.E
  rmsR: number;
  sampleRate: number;
  ts: number;        // backend ms
}

/** Latest pushSpectrum frame, or null if none has arrived yet. */
export const spectrumFrame = writable<SpectrumFrame | null>(null);

/**
 * Maps a 0..1 linear RMS amplitude to a 0..1 bar fill on a dBFS scale.
 * Floor at −60 dB → 0, full-scale (0 dB) → 1. Linear-on-dB between.
 *
 * Pure function, exported for unit test.
 */
export function rmsToBarFill(rms: number | undefined): number {
  if (!rms || rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  const FLOOR_DB = -60;
  if (db <= FLOOR_DB) return 0;
  return Math.min(1, (db - FLOOR_DB) / -FLOOR_DB);
}

export const vuLevelL = derived(spectrumFrame, ($f) => rmsToBarFill($f?.rmsL));
export const vuLevelR = derived(spectrumFrame, ($f) => rmsToBarFill($f?.rmsR));

let initialized = false;

/**
 * Wires the `pushSpectrum` Socket.IO listener. Idempotent — second call is a
 * no-op. Called from App.svelte:onMount alongside the other init* stores.
 *
 * No console.log in the handler: `pushSpectrum` at 20 fps × broadcast-to-all
 * is hot-path (see Volumio2-UI/CLAUDE.md "Socket.IO Performance Optimization").
 */
export function initSpectrumStore() {
  if (initialized) return;
  initialized = true;
  socketService.on<SpectrumFrame>('pushSpectrum', (frame) => {
    spectrumFrame.set(frame);
  });
}
