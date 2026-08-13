import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { get } from 'svelte/store';

let pushStateHandler: ((state: any) => void) | null = null;

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (event === 'pushState') pushStateHandler = handler as any;
      return () => {};
    })
  }
}));

vi.mock('$lib/config', () => ({
  fixVolumioAssetUrl: vi.fn((url: string) => url)
}));

import { seek, duration, initPlayerStore, playerActions } from '../player';
import { socketService } from '$lib/services/socket';

beforeAll(() => {
  initPlayerStore();
});

/**
 * Seek is dead-reckoned between backend broadcasts, so the interpolator must
 * derive position from a monotonic timestamp rather than accumulating +1 per
 * timer tick. `vi.useFakeTimers()` advances `performance.now()` in lockstep
 * with the timer queue, so these tests exercise the real anchor arithmetic.
 */
describe('seek interpolation', () => {
  // One fake-timer session for the whole suite. Toggling per test would tear
  // down the timer queue while the store still holds the interval handle,
  // so interpolation would silently stop after the first test.
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('re-anchors when the backend reports a restarted track', () => {
    // The reported bug: the user restarts the current song. The backend now
    // broadcasts the rewound position; the client must snap back to it rather
    // than keep counting from where it was.
    pushStateHandler!({ status: 'play', seek: 242_000, duration: 715 });
    expect(get(seek)).toBe(242);

    vi.advanceTimersByTime(10_000);
    expect(get(seek)).toBe(252);

    pushStateHandler!({ status: 'play', seek: 0, duration: 715 });
    expect(get(seek)).toBe(0);

    vi.advanceTimersByTime(3_000);
    expect(get(seek)).toBe(3);
  });

  it('tracks real elapsed time rather than counting timer ticks', () => {
    // A +1-per-tick accumulator silently absorbs timer drift and throttling:
    // 120s of real time with throttled ticks would report far less. Anchoring
    // on a timestamp makes the reported position independent of tick count.
    pushStateHandler!({ status: 'play', seek: 0, duration: 715 });

    vi.advanceTimersByTime(120_000);
    expect(get(seek)).toBe(120);
  });

  it('does not advance while paused', () => {
    pushStateHandler!({ status: 'play', seek: 30_000, duration: 715 });
    vi.advanceTimersByTime(2_000);
    expect(get(seek)).toBe(32);

    pushStateHandler!({ status: 'pause', seek: 32_000, duration: 715 });
    vi.advanceTimersByTime(60_000);
    expect(get(seek)).toBe(32);
  });

  it('resumes from the position the backend reports after a pause', () => {
    pushStateHandler!({ status: 'pause', seek: 100_000, duration: 715 });
    vi.advanceTimersByTime(30_000);
    expect(get(seek)).toBe(100);

    pushStateHandler!({ status: 'play', seek: 100_000, duration: 715 });
    vi.advanceTimersByTime(5_000);
    expect(get(seek)).toBe(105);
  });

  it('clamps at the track duration', () => {
    pushStateHandler!({ status: 'play', seek: 710_000, duration: 715 });
    vi.advanceTimersByTime(60_000);
    expect(get(seek)).toBe(715);
  });

  it('re-anchors optimistically on a local seek so the bar does not snap back', () => {
    pushStateHandler!({ status: 'play', seek: 10_000, duration: 715 });

    playerActions.seekTo(400);
    expect(get(seek)).toBe(400);
    expect(socketService.emit).toHaveBeenCalledWith('seek', 400);

    // Interpolation must continue from the new anchor, not the stale one.
    vi.advanceTimersByTime(4_000);
    expect(get(seek)).toBe(404);
  });

  it('keeps duration in sync so the progress bar denominator is right', () => {
    pushStateHandler!({ status: 'play', seek: 0, duration: 715 });
    expect(get(duration)).toBe(715);
  });
});
