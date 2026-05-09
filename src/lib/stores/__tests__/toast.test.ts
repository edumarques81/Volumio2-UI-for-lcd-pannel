import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

import {
  toasts,
  toastActions,
  TOAST_DEDUPE_WINDOW_MS,
  TOAST_THROTTLE_MS,
  TOAST_MAX_VISIBLE,
} from '../toast';

describe('toast store', () => {
  beforeEach(() => {
    toastActions.clearAll();
    vi.useFakeTimers();
    // Anchor the fake clock so dedupe/throttle timestamps are deterministic.
    vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts empty', () => {
    expect(get(toasts)).toEqual([]);
  });

  it('toastActions.info appends an info toast', () => {
    toastActions.info('Hello', 'World');
    const list = get(toasts);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'info', title: 'Hello', message: 'World' });
    expect(typeof list[0].id).toBe('number');
    expect(typeof list[0].duration).toBe('number');
  });

  it('toastActions.error appends an error toast', () => {
    toastActions.error('Boom', 'something failed');
    const list = get(toasts);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'error', title: 'Boom', message: 'something failed' });
  });

  it('toastActions.success/warning append the right type', () => {
    toastActions.success('S');
    // Advance past the throttle window so the warning isn't gated.
    vi.advanceTimersByTime(TOAST_THROTTLE_MS + 100);
    toastActions.warning('W');
    const list = get(toasts);
    expect(list.map((t) => t.type)).toEqual(['success', 'warning']);
  });

  it('dedupes same error title within the dedupe window', () => {
    toastActions.error('Same Title', 'first');
    expect(get(toasts)).toHaveLength(1);

    // Advance past throttle but stay inside dedupe window.
    vi.advanceTimersByTime(TOAST_THROTTLE_MS + 100);
    toastActions.error('Same Title', 'second');

    // Still only the original — dedupe blocked the second insert.
    expect(get(toasts)).toHaveLength(1);
    expect(get(toasts)[0].message).toBe('first');
  });

  it('allows the same error after the dedupe window expires', () => {
    toastActions.error('Repeat', 'first');
    expect(get(toasts)).toHaveLength(1);

    vi.advanceTimersByTime(TOAST_DEDUPE_WINDOW_MS + 1000);
    toastActions.error('Repeat', 'second');
    // First one auto-dismissed long ago; second one is now in the list.
    const list = get(toasts);
    expect(list).toHaveLength(1);
    expect(list[0].message).toBe('second');
  });

  it('throttles non-success toasts within the throttle window', () => {
    toastActions.warning('Warn 1');
    // No time advance — second warning is within throttle window.
    toastActions.warning('Warn 2');
    expect(get(toasts).map((t) => t.title)).toEqual(['Warn 1']);
  });

  it('does NOT throttle success toasts', () => {
    toastActions.success('Yay 1');
    toastActions.success('Yay 2');
    expect(get(toasts).map((t) => t.title)).toEqual(['Yay 1', 'Yay 2']);
  });

  it('truncates the visible list to MAX_TOASTS', () => {
    // Use success to bypass throttle; advance time tiny amounts to avoid dedupe collisions.
    for (let i = 0; i < TOAST_MAX_VISIBLE + 2; i++) {
      toastActions.success(`Toast ${i}`);
    }
    const list = get(toasts);
    expect(list).toHaveLength(TOAST_MAX_VISIBLE);
    // The earliest entries should have been dropped, latest preserved.
    expect(list[list.length - 1].title).toBe(`Toast ${TOAST_MAX_VISIBLE + 1}`);
  });

  it('dismiss removes a toast by id', () => {
    toastActions.success('A');
    toastActions.success('B');
    const [a] = get(toasts);
    toastActions.dismiss(a.id);
    expect(get(toasts).map((t) => t.title)).toEqual(['B']);
  });

  it('clearAll empties the list', () => {
    toastActions.success('A');
    toastActions.success('B');
    expect(get(toasts).length).toBeGreaterThan(0);
    toastActions.clearAll();
    expect(get(toasts)).toEqual([]);
  });

  it('auto-dismisses after the supplied duration', () => {
    toastActions.info('Auto', undefined, 1000);
    expect(get(toasts)).toHaveLength(1);
    vi.advanceTimersByTime(1500);
    expect(get(toasts)).toHaveLength(0);
  });

  it('duration <= 0 disables auto-dismiss', () => {
    toastActions.info('Sticky', undefined, 0);
    vi.advanceTimersByTime(60_000);
    expect(get(toasts)).toHaveLength(1);
  });
});
