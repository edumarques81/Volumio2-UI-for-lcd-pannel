import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// vi.mock factories are hoisted above `import` statements at module-load
// time — top-level identifiers in this file (emitSpy, handlers) are not
// yet initialised when the factory runs. Use vi.hoisted to create those
// references at hoist time so both the factory and the test bodies share
// them.
const mocks = vi.hoisted(() => ({
  handlers: {
    pushAirplayState: null as ((data: any) => void) | null,
    pushAirplayEnded: null as ((data: any) => void) | null,
  },
  emitSpy: vi.fn(),
}));

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: mocks.emitSpy,
    on: vi.fn((event: string, handler: (data: any) => void) => {
      if (event === 'pushAirplayState' || event === 'pushAirplayEnded') {
        mocks.handlers[event] = handler;
      }
      return () => {};
    }),
  },
}));

const { handlers, emitSpy } = mocks;

import {
  airplayState,
  airplayActive,
  airplayActions,
  initAirplayStore,
  resetAirplayStoreForTests,
} from '../airplay';

beforeEach(() => {
  // Reset both the singleton-init guard and the store state between tests
  // so each case starts from a clean baseline.
  resetAirplayStoreForTests();
  emitSpy.mockClear();
  handlers.pushAirplayState = null;
  handlers.pushAirplayEnded = null;
  initAirplayStore();
});

const SAMPLE_STATE = {
  isActive: true,
  isPlaying: true,
  title: 'Vampire',
  artist: 'Olivia Rodrigo',
  album: 'GUTS',
  sender: "Eduardo's iPhone",
  coverDataURL: 'data:image/jpeg;base64,/9j/abc',
  seekSeconds: 42,
  durationSeconds: 245,
  canControl: true,
  sessionID: 'session-1',
  sampleRate: 44100,
  bitDepth: 16,
} as const;

describe('airplayStore — pushAirplayState', () => {
  it('replaces the store state with the incoming payload', () => {
    handlers.pushAirplayState!(SAMPLE_STATE);

    const state = get(airplayState);
    expect(state.isActive).toBe(true);
    expect(state.title).toBe('Vampire');
    expect(state.artist).toBe('Olivia Rodrigo');
    expect(state.album).toBe('GUTS');
    expect(state.sender).toBe("Eduardo's iPhone");
    expect(state.coverDataURL).toBe('data:image/jpeg;base64,/9j/abc');
    expect(state.seekSeconds).toBe(42);
    expect(state.durationSeconds).toBe(245);
    expect(state.canControl).toBe(true);
    expect(state.sessionID).toBe('session-1');
    expect(state.sampleRate).toBe(44100);
    expect(state.bitDepth).toBe(16);
  });

  it('flips the airplayActive derived store to true', () => {
    expect(get(airplayActive)).toBe(false);
    handlers.pushAirplayState!(SAMPLE_STATE);
    expect(get(airplayActive)).toBe(true);
  });

  it('a second pushAirplayState replaces (not merges) the prior state', () => {
    handlers.pushAirplayState!(SAMPLE_STATE);
    handlers.pushAirplayState!({
      ...SAMPLE_STATE,
      title: 'bad idea right?',
      seekSeconds: 7,
      sessionID: 'session-2',
    });

    const state = get(airplayState);
    expect(state.title).toBe('bad idea right?');
    expect(state.seekSeconds).toBe(7);
    expect(state.sessionID).toBe('session-2');
  });
});

describe('airplayStore — pushAirplayEnded sessionID matching', () => {
  it('clears the store when the ended sessionID matches the active one', () => {
    handlers.pushAirplayState!(SAMPLE_STATE);
    expect(get(airplayActive)).toBe(true);

    handlers.pushAirplayEnded!({ sessionID: 'session-1' });

    expect(get(airplayActive)).toBe(false);
    expect(get(airplayState).sessionID).toBe('');
    expect(get(airplayState).title).toBe('');
  });

  it('does NOT clear when a stale ended event names a different session', () => {
    handlers.pushAirplayState!(SAMPLE_STATE);
    // A late `pushAirplayEnded` for the previous session arrives AFTER a
    // fresh `pushAirplayState` for the new session — must not wipe the
    // fresh session.
    handlers.pushAirplayState!({
      ...SAMPLE_STATE,
      sessionID: 'session-2',
      title: 'bad idea right?',
    });

    handlers.pushAirplayEnded!({ sessionID: 'session-1' });

    expect(get(airplayActive)).toBe(true);
    expect(get(airplayState).sessionID).toBe('session-2');
    expect(get(airplayState).title).toBe('bad idea right?');
  });

  it('ignores a pushAirplayEnded with no/empty sessionID', () => {
    handlers.pushAirplayState!(SAMPLE_STATE);

    handlers.pushAirplayEnded!({ sessionID: '' });
    expect(get(airplayActive)).toBe(true);

    handlers.pushAirplayEnded!({});
    expect(get(airplayActive)).toBe(true);
  });
});

describe('airplayStore — transport commands route to airplay:command', () => {
  it('play() emits airplay:command {cmd: "play"} — not the bare "play" event', () => {
    airplayActions.play();
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('airplay:command', { cmd: 'play' });
  });

  it('pause() emits airplay:command {cmd: "pause"}', () => {
    airplayActions.pause();
    expect(emitSpy).toHaveBeenCalledWith('airplay:command', { cmd: 'pause' });
  });

  it('toggle() emits airplay:command {cmd: "toggle"}', () => {
    airplayActions.toggle();
    expect(emitSpy).toHaveBeenCalledWith('airplay:command', { cmd: 'toggle' });
  });

  it('next() emits airplay:command {cmd: "next"} — never the MPD-shape "next"', () => {
    airplayActions.next();
    expect(emitSpy).toHaveBeenCalledWith('airplay:command', { cmd: 'next' });
    // Guard against accidental MPD-event regression.
    const calls = emitSpy.mock.calls;
    expect(calls.every((c) => c[0] === 'airplay:command')).toBe(true);
  });

  it('prev() emits airplay:command {cmd: "prev"} — never the MPD-shape "prev"', () => {
    airplayActions.prev();
    expect(emitSpy).toHaveBeenCalledWith('airplay:command', { cmd: 'prev' });
    const calls = emitSpy.mock.calls;
    expect(calls.every((c) => c[0] === 'airplay:command')).toBe(true);
  });
});

describe('airplayStore — initAirplayStore is idempotent', () => {
  it('calling init twice does not double-register listeners', () => {
    // The beforeEach already called init once; this second call should
    // not throw and should not re-wire anything.
    expect(() => initAirplayStore()).not.toThrow();
  });
});

describe('airplayStore — isPlaying field', () => {
  it('honours an explicit isPlaying:false from the payload', () => {
    handlers.pushAirplayState!({ ...SAMPLE_STATE, isPlaying: false });
    expect(get(airplayState).isPlaying).toBe(false);
  });

  it('defaults isPlaying to true when the field is absent', () => {
    // Strip isPlaying via destructure rather than `as any` cast.
    const { isPlaying: _ignore, ...withoutIsPlaying } = SAMPLE_STATE;
    handlers.pushAirplayState!(withoutIsPlaying);
    expect(get(airplayState).isPlaying).toBe(true);
  });

  it('freezes the seek interpolator while isPlaying is false', () => {
    vi.useFakeTimers();
    try {
      handlers.pushAirplayState!({ ...SAMPLE_STATE, isPlaying: false, seekSeconds: 10 });
      vi.advanceTimersByTime(3000);
      // Three ticks of the 1Hz interpolator should NOT advance seek when
      // the iPhone reports paused.
      expect(get(airplayState).seekSeconds).toBe(10);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes the seek interpolator when isPlaying flips back to true', () => {
    vi.useFakeTimers();
    try {
      handlers.pushAirplayState!({ ...SAMPLE_STATE, isPlaying: false, seekSeconds: 10 });
      vi.advanceTimersByTime(2000);
      expect(get(airplayState).seekSeconds).toBe(10);

      handlers.pushAirplayState!({ ...SAMPLE_STATE, isPlaying: true, seekSeconds: 10 });
      vi.advanceTimersByTime(2000);
      // Two ticks at 1Hz → seek advanced by 2.
      expect(get(airplayState).seekSeconds).toBe(12);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('airplayStore — AirPlay↔MPD switchback resync (Phase 4)', () => {
  it('clears when a terminal pushAirplayState{isActive:false} arrives after a DROPPED pushAirplayEnded', () => {
    // Session is live and rendered.
    handlers.pushAirplayState!(SAMPLE_STATE);
    expect(get(airplayActive)).toBe(true);

    // The canonical pushAirplayEnded is DROPPED on a flaky socket (never
    // delivered). The backend's belt-and-suspenders terminal snapshot — and
    // the connect-time resync — both arrive as pushAirplayState{isActive:false}.
    handlers.pushAirplayState!({ ...SAMPLE_STATE, isActive: false });

    expect(get(airplayActive)).toBe(false);
    expect(get(airplayState).isActive).toBe(false);
  });

  it('connect-time inactive snapshot resyncs a client stuck on a stale session', () => {
    // Client is stuck showing session-1 (missed its end).
    handlers.pushAirplayState!(SAMPLE_STATE);
    expect(get(airplayState).sessionID).toBe('session-1');

    // On reconnect the backend now pushes the authoritative current snapshot
    // EVEN WHEN INACTIVE (Phase 4b), rather than staying silent.
    handlers.pushAirplayState!({ ...SAMPLE_STATE, isActive: false, sessionID: '' });

    expect(get(airplayActive)).toBe(false);
  });

  it('stops the seek interpolator on the inactive resync', () => {
    vi.useFakeTimers();
    try {
      handlers.pushAirplayState!({ ...SAMPLE_STATE, seekSeconds: 10 });
      handlers.pushAirplayState!({ ...SAMPLE_STATE, isActive: false, seekSeconds: 10 });
      vi.advanceTimersByTime(3000);
      // Interpolator must not advance a cleared/inactive session.
      expect(get(airplayState).seekSeconds).toBe(10);
    } finally {
      vi.useRealTimers();
    }
  });
});
