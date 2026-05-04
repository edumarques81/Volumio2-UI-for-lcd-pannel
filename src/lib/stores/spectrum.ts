import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * Spectrum store — receives real-time FFT data from the backend via
 * "pushSpectrum" Socket.IO events. Falls back to fake generated data
 * if no real data arrives within 2 seconds.
 */

// Number of frequency bins (matches backend Config.NumBins)
export const SPECTRUM_NUM_BINS = 64;

// How long to wait for real data before falling back to fake generation
const FALLBACK_TIMEOUT_MS = 2000;

/** Whether we're receiving real spectrum data from the backend. */
export const spectrumIsReal = writable<boolean>(false);

/** Raw frequency bin data — Float32Array of SPECTRUM_NUM_BINS values, each 0.0-1.0. */
export const spectrumData = writable<Float32Array>(new Float32Array(SPECTRUM_NUM_BINS));

/** Overall peak level 0.0-1.0. */
export const spectrumPeak = writable<number>(0);

/** Overall RMS level 0.0-1.0. */
export const spectrumRms = writable<number>(0);

/** Derived L/R levels from spectrum bins (odd/even split) for VU meters. */
export const spectrumLevelL = derived(spectrumData, ($data) => {
  let sum = 0;
  for (let i = 0; i < $data.length; i += 2) sum += $data[i];
  return Math.min(1, (sum / ($data.length / 2)) * 2.2);
});

export const spectrumLevelR = derived(spectrumData, ($data) => {
  let sum = 0;
  for (let i = 1; i < $data.length; i += 2) sum += $data[i];
  return Math.min(1, (sum / ($data.length / 2)) * 2.2);
});

// ─── Fake data generation (fallback) ───

let fakeAnimId = 0;
let fakeStartTime = 0;
let noisePhase = 0;

function generateFakeSpectrum(time: number): Float32Array {
  const bins = new Float32Array(SPECTRUM_NUM_BINS);
  noisePhase += 0.008;
  for (let i = 0; i < SPECTRUM_NUM_BINS; i++) {
    const freq = i / SPECTRUM_NUM_BINS;
    const bass = Math.pow(Math.sin(time * 1.2 + i * 0.05), 2) * (1 - freq * 0.6);
    const mid = Math.sin(time * 2.8 + i * 0.12) * 0.5 * Math.exp(-Math.pow(freq - 0.35, 2) * 20);
    const treble = Math.sin(time * 4.5 + i * 0.25) * 0.3 * freq;
    const noise = (Math.sin(noisePhase * 3.7 + i * 1.3) * 0.5 + 0.5) * 0.2;
    const pulse = Math.pow(Math.sin(time * 0.7), 4) * 0.25 * (1 - freq);
    bins[i] = Math.max(0.02, Math.min(1, bass + mid + treble + noise + pulse));
  }
  return bins;
}

function startFakeData() {
  if (fakeAnimId) return;
  fakeStartTime = performance.now();
  function tick() {
    const time = (performance.now() - fakeStartTime) / 1000;
    const bins = generateFakeSpectrum(time);
    spectrumData.set(bins);

    // Compute fake peak/rms
    let peak = 0, sumSq = 0;
    for (let i = 0; i < bins.length; i++) {
      if (bins[i] > peak) peak = bins[i];
      sumSq += bins[i] * bins[i];
    }
    spectrumPeak.set(peak);
    spectrumRms.set(Math.sqrt(sumSq / bins.length));

    fakeAnimId = requestAnimationFrame(tick);
  }
  fakeAnimId = requestAnimationFrame(tick);
}

function stopFakeData() {
  if (fakeAnimId) {
    cancelAnimationFrame(fakeAnimId);
    fakeAnimId = 0;
  }
}

// ─── Init ───

let initialized = false;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let lastRealDataTime = 0;

export function initSpectrumStore() {
  if (initialized) return;
  initialized = true;

  // Listen for real spectrum data from backend
  socketService.on<{ bins: number[]; peak: number; rms: number }>('pushSpectrum', (data) => {
    lastRealDataTime = Date.now();

    // Switch from fake to real data
    if (!getStoreValue(spectrumIsReal)) {
      stopFakeData();
      spectrumIsReal.set(true);
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    }

    // Update stores with real data
    const bins = new Float32Array(data.bins.length);
    for (let i = 0; i < data.bins.length; i++) {
      bins[i] = data.bins[i];
    }
    spectrumData.set(bins);
    spectrumPeak.set(data.peak);
    spectrumRms.set(data.rms);
  });

  // Start fallback timer — if no real data within 2s, use fake data
  fallbackTimer = setTimeout(() => {
    if (lastRealDataTime === 0) {
      spectrumIsReal.set(false);
      startFakeData();
    }
    fallbackTimer = null;
  }, FALLBACK_TIMEOUT_MS);

  // Monitor: if real data stops arriving for 2s, fall back to fake
  setInterval(() => {
    if (lastRealDataTime > 0 && Date.now() - lastRealDataTime > FALLBACK_TIMEOUT_MS) {
      if (getStoreValue(spectrumIsReal)) {
        spectrumIsReal.set(false);
        startFakeData();
        lastRealDataTime = 0; // Reset so we don't keep toggling
      }
    }
  }, 1000);
}

// Helper to synchronously read a store value
function getStoreValue<T>(store: { subscribe: (fn: (val: T) => void) => () => void }): T {
  let val: T;
  const unsub = store.subscribe((v) => { val = v; });
  unsub();
  return val!;
}
