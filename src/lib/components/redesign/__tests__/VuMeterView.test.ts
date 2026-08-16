import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import type { Readable } from 'svelte/store';

// Hoisted so the stores exist before vi.mock's factory runs (Vitest hoists the
// factory to the top of the file). The component reads $vuRmsL/$vuRmsR; the
// pure scale functions are NOT mocked — the point of these tests is that the
// needle lands where the real mapping says it should.
//
// The store is hand-rolled rather than svelte/store's `writable`: the hoisted
// block executes before this file's imports are initialized, so referencing an
// imported binding in here throws "Cannot access before initialization".
const { rmsL, rmsR } = vi.hoisted(() => {
  function mini(initial: number) {
    let value = initial;
    const subs = new Set<(v: number) => void>();
    return {
      subscribe(fn: (v: number) => void) {
        subs.add(fn);
        fn(value);
        return () => {
          subs.delete(fn);
        };
      },
      set(v: number) {
        value = v;
        subs.forEach((fn) => fn(value));
      },
    };
  }
  return { rmsL: mini(0), rmsR: mini(0) };
});

vi.mock('$lib/stores/spectrum', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/stores/spectrum')>();
  return {
    ...actual,
    vuRmsL: rmsL as Readable<number>,
    vuRmsR: rmsR as Readable<number>,
  };
});

import VuMeterView from '../VuMeterView.svelte';
import {
  rmsToMeterDb,
  meterDbToAngle,
  SCALE_POINTS_DB,
  ANGLE_MIN_DEG,
  SWEEP_DEG,
} from '$lib/stores/spectrum';

// ── RAF shim ─────────────────────────────────────────────────────────────
let rafCallbacks: FrameRequestCallback[] = [];
let rafTime = 0;

function flushRAF(advanceMs = 16) {
  rafTime += advanceMs;
  const pending = rafCallbacks;
  rafCallbacks = [];
  pending.forEach((cb) => cb(rafTime));
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  );
}

/** Pulls the degrees out of `rotate(<deg> <cx> <cy>)`. */
function needleAngle(container: HTMLElement, channel: 'l' | 'r'): number {
  const g = container.querySelector(`[data-testid="vu-meter-${channel}-needle"]`);
  expect(g).not.toBeNull();
  const transform = g!.getAttribute('transform') ?? '';
  const m = /rotate\(\s*(-?[\d.]+)/.exec(transform);
  expect(m, `unparsable transform: ${transform}`).not.toBeNull();
  return parseFloat(m![1]);
}

beforeEach(() => {
  rafCallbacks = [];
  rafTime = 0;
  rmsL.set(0);
  rmsR.set(0);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  mockReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('VuMeterView structure', () => {
  it('renders the view and both channel meters', () => {
    const { getByTestId } = render(VuMeterView);
    expect(getByTestId('vu-meter-view')).toBeTruthy();
    expect(getByTestId('vu-meter-l')).toBeTruthy();
    expect(getByTestId('vu-meter-r')).toBeTruthy();
  });

  it('engraves exactly the labelled scale points on each face', () => {
    const { getByTestId } = render(VuMeterView);
    for (const channel of ['l', 'r'] as const) {
      const face = getByTestId(`vu-meter-${channel}`);
      const numerals = Array.from(face.querySelectorAll('.numerals text')).map(
        (t) => t.textContent,
      );
      expect(numerals).toEqual(SCALE_POINTS_DB.map(String));
      expect(face.querySelectorAll('.ticks line')).toHaveLength(SCALE_POINTS_DB.length);
    }
  });

  it('exposes each channel as a meter reading in dB', () => {
    const { getByTestId } = render(VuMeterView);
    const l = getByTestId('vu-meter-l');
    expect(l.getAttribute('role')).toBe('meter');
    expect(Number(l.getAttribute('aria-valuemin'))).toBe(SCALE_POINTS_DB[0]);
    expect(Number(l.getAttribute('aria-valuemax'))).toBeGreaterThan(0);
    expect(getByTestId('vu-meter-r').getAttribute('aria-label')).toMatch(/RIGHT/);
  });
});

describe('VuMeterView needle position (reduced motion — no ballistics)', () => {
  beforeEach(() => mockReducedMotion(true));

  it('rests at the left end stop on silence', () => {
    const { container } = render(VuMeterView);
    expect(needleAngle(container, 'l')).toBeCloseTo(ANGLE_MIN_DEG, 2);
    expect(needleAngle(container, 'r')).toBeCloseTo(ANGLE_MIN_DEG, 2);
  });

  it('lands on the angle the calibrated scale mapping dictates', async () => {
    const { container } = render(VuMeterView);
    const rms = 0.12589254; // −18 dBFS → −10 on the calibrated face
    rmsL.set(rms);
    await Promise.resolve();
    expect(needleAngle(container, 'l')).toBeCloseTo(meterDbToAngle(-10), 2);
  });

  it('drives the two channels independently', async () => {
    const { container } = render(VuMeterView);
    rmsL.set(0.39810717); // −8 dBFS → 0 dB on the face
    rmsR.set(0);
    await Promise.resolve();
    expect(needleAngle(container, 'l')).toBeCloseTo(ANGLE_MIN_DEG + SWEEP_DEG, 2);
    expect(needleAngle(container, 'r')).toBeCloseTo(ANGLE_MIN_DEG, 2);
  });

  it('overshoots past the 0 dB tick at full scale instead of pinning on it', async () => {
    const { container } = render(VuMeterView);
    rmsL.set(1.0);
    await Promise.resolve();
    expect(needleAngle(container, 'l')).toBeGreaterThan(ANGLE_MIN_DEG + SWEEP_DEG);
  });
});

describe('VuMeterView ballistics', () => {
  it('rises smoothly towards the target rather than snapping to it', async () => {
    const { container } = render(VuMeterView);
    const target = meterDbToAngle(rmsToMeterDb(0.5));

    rmsL.set(0.5);
    await Promise.resolve();

    // First frame must NOT already be at the target — that would mean the
    // 300 ms integration is not being applied.
    flushRAF(16);
    await Promise.resolve();
    const first = needleAngle(container, 'l');
    expect(first).toBeLessThan(target);
    expect(first).toBeGreaterThan(ANGLE_MIN_DEG);

    let prev = first;
    for (let i = 0; i < 8; i++) {
      flushRAF(16);
      await Promise.resolve();
      const now = needleAngle(container, 'l');
      expect(now).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
    expect(prev).toBeGreaterThan(first);
    expect(prev).toBeLessThanOrEqual(target + 1e-6);
  });

  it('settles on the target after several time constants', async () => {
    const { container } = render(VuMeterView);
    const target = meterDbToAngle(rmsToMeterDb(0.5));

    rmsL.set(0.5);
    await Promise.resolve();
    // ~4.8 s ≈ 16τ. 5τ is only 99.3% of full deflection, and the dB scale
    // steepens towards 0 (the overshoot region runs at STEP/3 deg per dB,
    // twice the rate of the −12…−6 interval), so what is a rounding error in
    // linear amplitude is still a visible fraction of a degree up here.
    for (let i = 0; i < 300; i++) {
      flushRAF(16);
    }
    await Promise.resolve();
    expect(needleAngle(container, 'l')).toBeCloseTo(target, 1);
  });

  it('falls back towards rest when the signal stops', async () => {
    const { container } = render(VuMeterView);
    rmsL.set(0.5);
    await Promise.resolve();
    for (let i = 0; i < 100; i++) flushRAF(16);
    await Promise.resolve();
    const loud = needleAngle(container, 'l');

    rmsL.set(0);
    await Promise.resolve();
    for (let i = 0; i < 10; i++) flushRAF(16);
    await Promise.resolve();
    const quieter = needleAngle(container, 'l');

    expect(quieter).toBeLessThan(loud);
    expect(quieter).toBeGreaterThan(ANGLE_MIN_DEG);
  });
});
