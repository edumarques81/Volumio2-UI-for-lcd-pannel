import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// The store reads playback and device type at tick time; both are mocked so
// the idle rule can be driven without a socket or a real viewport.
const { mockIsPlaying, mockDeviceType } = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return {
    mockIsPlaying: writable(false),
    mockDeviceType: writable<'lcd-panel' | 'desktop' | 'mobile'>('lcd-panel')
  };
});

vi.mock('$lib/stores/player', () => ({ isPlaying: mockIsPlaying }));
vi.mock('../player', () => ({ isPlaying: mockIsPlaying }));
vi.mock('../device', () => ({ deviceType: mockDeviceType }));

// jsdom in this project exposes no localStorage at all (the store guards for
// exactly that), so persistence needs a stand-in to be asserted on.
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear()
  }
});

import {
  STANDBY_DEFAULT_BRIGHTNESS,
  STANDBY_DEFAULT_IDLE_MINUTES,
  STANDBY_TICK_MS,
  clampStandbyBrightness,
  clampIdleMinutes,
  shouldEnterStandby,
  standbyActive,
  standbyBrightness,
  standbyIdleMinutes,
  standbyActions,
  markStandbyActivity,
  initStandbyStore,
  cleanupStandbyStore
} from '../standby';

describe('clampStandbyBrightness', () => {
  const cases: Array<[string, number, number]> = [
    ['below the floor', 0, 8],
    ['at the floor', 8, 8],
    ['in range', 55, 55],
    ['above the ceiling', 140, 100],
    ['rounds fractions', 42.6, 43]
  ];
  for (const [name, input, want] of cases) {
    it(name, () => expect(clampStandbyBrightness(input)).toBe(want));
  }

  it('falls back to the default on NaN rather than producing a black screen', () => {
    expect(clampStandbyBrightness(Number.NaN)).toBe(STANDBY_DEFAULT_BRIGHTNESS);
  });
});

describe('clampIdleMinutes', () => {
  const cases: Array<[string, number, number]> = [
    ['zero means never and is preserved', 0, 0],
    ['negative clamps to never', -5, 0],
    ['in range', 30, 30],
    ['above the ceiling', 999, 240]
  ];
  for (const [name, input, want] of cases) {
    it(name, () => expect(clampIdleMinutes(input)).toBe(want));
  }

  it('falls back to the default on NaN', () => {
    expect(clampIdleMinutes(Number.NaN)).toBe(STANDBY_DEFAULT_IDLE_MINUTES);
  });
});

describe('shouldEnterStandby', () => {
  const base = { active: false, playing: false, elapsedMs: 0, idleMs: 60_000 };
  const cases: Array<[string, Partial<typeof base>, boolean]> = [
    ['idle long enough', { elapsedMs: 60_000 }, true],
    ['idle past the threshold', { elapsedMs: 120_000 }, true],
    ['not idle long enough', { elapsedMs: 59_999 }, false],
    ['already in standby', { active: true, elapsedMs: 600_000 }, false],
    ['playing never sleeps the screen', { playing: true, elapsedMs: 600_000 }, false],
    ['idleMs 0 disables the rule entirely', { idleMs: 0, elapsedMs: 600_000 }, false]
  ];
  for (const [name, patch, want] of cases) {
    it(name, () => expect(shouldEnterStandby({ ...base, ...patch })).toBe(want));
  }
});

describe('standbyActions', () => {
  beforeEach(() => {
    localStorage.clear();
    standbyActive.set(false);
  });

  it('enter and exit flip the overlay and are idempotent', () => {
    standbyActions.enter();
    expect(get(standbyActive)).toBe(true);
    standbyActions.enter();
    expect(get(standbyActive)).toBe(true);
    standbyActions.exit();
    expect(get(standbyActive)).toBe(false);
    standbyActions.exit();
    expect(get(standbyActive)).toBe(false);
  });

  it('setBrightness clamps and persists', () => {
    standbyActions.setBrightness(1000);
    expect(get(standbyBrightness)).toBe(100);
    expect(localStorage.getItem('stellar-standby-brightness')).toBe('100');
  });

  it('setIdleMinutes clamps and persists', () => {
    standbyActions.setIdleMinutes(45);
    expect(get(standbyIdleMinutes)).toBe(45);
    expect(localStorage.getItem('stellar-standby-idle-minutes')).toBe('45');
  });
});

describe('initStandbyStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanupStandbyStore();
    mockDeviceType.set('lcd-panel');
    mockIsPlaying.set(false);
    standbyIdleMinutes.set(1);
    standbyActive.set(false);
  });

  afterEach(() => {
    cleanupStandbyStore();
    vi.useRealTimers();
  });

  it('enters standby once the idle interval has elapsed', () => {
    initStandbyStore();
    markStandbyActivity();
    vi.advanceTimersByTime(STANDBY_TICK_MS * 5);
    expect(get(standbyActive)).toBe(false);
    vi.advanceTimersByTime(STANDBY_TICK_MS * 2);
    expect(get(standbyActive)).toBe(true);
  });

  it('never enters standby while music is playing', () => {
    mockIsPlaying.set(true);
    initStandbyStore();
    markStandbyActivity();
    vi.advanceTimersByTime(STANDBY_TICK_MS * 30);
    expect(get(standbyActive)).toBe(false);
  });

  it('restarts a full interval once playback stops', () => {
    mockIsPlaying.set(true);
    initStandbyStore();
    vi.advanceTimersByTime(STANDBY_TICK_MS * 30);
    mockIsPlaying.set(false);
    vi.advanceTimersByTime(STANDBY_TICK_MS * 3);
    expect(get(standbyActive)).toBe(false);
    vi.advanceTimersByTime(STANDBY_TICK_MS * 4);
    expect(get(standbyActive)).toBe(true);
  });

  it('a touch resets the countdown', () => {
    initStandbyStore();
    markStandbyActivity();
    vi.advanceTimersByTime(STANDBY_TICK_MS * 5);
    window.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(STANDBY_TICK_MS * 4);
    expect(get(standbyActive)).toBe(false);
  });

  it('does nothing on a phone or desktop browser', () => {
    mockDeviceType.set('desktop');
    initStandbyStore();
    markStandbyActivity();
    vi.advanceTimersByTime(STANDBY_TICK_MS * 30);
    expect(get(standbyActive)).toBe(false);
  });

  it('cleanup stops the watcher and clears the overlay', () => {
    initStandbyStore();
    standbyActions.enter();
    cleanupStandbyStore();
    expect(get(standbyActive)).toBe(false);
    markStandbyActivity();
    vi.advanceTimersByTime(STANDBY_TICK_MS * 30);
    expect(get(standbyActive)).toBe(false);
  });
});
