import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';

// Mock the spectrum store before importing the view.
const mocks = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return {
    vuLevelL: writable(0),
    vuLevelR: writable(0),
  };
});

vi.mock('$lib/stores/spectrum', () => ({
  vuLevelL: mocks.vuLevelL,
  vuLevelR: mocks.vuLevelR,
}));

import VuMeterView from '../VuMeterView.svelte';

// RAF shim — capture callbacks and let tests flush them on demand.
let rafCallbacks: FrameRequestCallback[] = [];
let rafTime = 0;
function flushRAF(advanceMs = 16) {
  rafTime += advanceMs;
  const due = rafCallbacks;
  rafCallbacks = [];
  due.forEach((cb) => cb(rafTime));
}

beforeEach(() => {
  rafCallbacks = [];
  rafTime = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  mocks.vuLevelL.set(0);
  mocks.vuLevelR.set(0);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

describe('VuMeterView', () => {
  it('renders root, L, and R test-ids', () => {
    mockReducedMotion(true);
    const { getByTestId } = render(VuMeterView);
    expect(getByTestId('vu-meter-view')).toBeTruthy();
    expect(getByTestId('vu-meter-l')).toBeTruthy();
    expect(getByTestId('vu-meter-r')).toBeTruthy();
  });

  it('renders exactly 40 segments per bar', () => {
    mockReducedMotion(true);
    const { container } = render(VuMeterView);
    const lSegments = container.querySelectorAll('[data-testid^="vu-meter-l-segment-"]');
    const rSegments = container.querySelectorAll('[data-testid^="vu-meter-r-segment-"]');
    expect(lSegments).toHaveLength(40);
    expect(rSegments).toHaveLength(40);
  });

  describe('reduced motion (synchronous off-frame)', () => {
    beforeEach(() => mockReducedMotion(true));

    it('lights all L segments when vuLevelL = 1.0', async () => {
      const { container } = render(VuMeterView);
      mocks.vuLevelL.set(1.0);
      await tick();
      const lit = container.querySelectorAll('[data-testid^="vu-meter-l-segment-"].lit');
      expect(lit).toHaveLength(40);
    });

    it('lights zero L segments when vuLevelL = 0', async () => {
      const { container } = render(VuMeterView);
      mocks.vuLevelL.set(0);
      await tick();
      const lit = container.querySelectorAll('[data-testid^="vu-meter-l-segment-"].lit');
      expect(lit).toHaveLength(0);
    });

    it('lights ~half of R segments when vuLevelR = 0.5', async () => {
      const { container } = render(VuMeterView);
      mocks.vuLevelR.set(0.5);
      await tick();
      const lit = container.querySelectorAll('[data-testid^="vu-meter-r-segment-"].lit');
      // 40 segments, i/40 < 0.5 → i in 0..19 → 20 lit
      expect(lit).toHaveLength(20);
    });
  });

  describe('animated mode (RAF smoothing)', () => {
    beforeEach(() => mockReducedMotion(false));

    it('lit-segment count increases monotonically as RAF advances toward target', async () => {
      const { container } = render(VuMeterView);
      mocks.vuLevelL.set(1.0);
      await tick();

      const counts: number[] = [];
      for (let i = 0; i < 8; i++) {
        flushRAF(16);
        await tick();
        counts.push(
          container.querySelectorAll('[data-testid^="vu-meter-l-segment-"].lit').length,
        );
      }
      // Smoothing approaches 1.0 — each successive sample is ≥ the previous,
      // and the final value is strictly greater than the first.
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
      }
      expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
    });
  });
});
