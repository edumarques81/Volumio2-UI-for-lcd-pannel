import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// vi.mock factories hoist above the imports, so the shared references have to
// be created at hoist time (same pattern as airplay.test.ts).
const mocks = vi.hoisted(() => ({
  handlers: {
    pushCastState: null as ((data: any) => void) | null,
    pushCastDevices: null as ((data: any) => void) | null,
  },
  emitSpy: vi.fn(),
  /** Ack the next emit with this response; set per test. */
  nextAck: { value: null as any },
}));

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn((event: string, payload?: any, callback?: (r: any) => void) => {
      mocks.emitSpy(event, payload);
      if (callback) callback(mocks.nextAck.value);
    }),
    on: vi.fn((event: string, handler: (data: any) => void) => {
      if (event === 'pushCastState' || event === 'pushCastDevices') {
        mocks.handlers[event] = handler;
      }
      return () => {};
    }),
  },
}));

const { handlers, emitSpy, nextAck } = mocks;

import {
  castState,
  castActive,
  castDevices,
  castDiscovering,
  castSkipped,
  castActions,
  initCastStore,
  resetCastStoreForTests,
} from '../cast';

const SNAPSHOT = {
  active: true,
  deviceId: 'hub-1',
  deviceName: 'Living Room Display',
  status: 'play' as const,
  title: 'So What',
  artist: 'Miles Davis',
  album: 'Kind of Blue',
  albumart: '/albumart?path=USB%2FKind+of+Blue',
  uri: 'USB/Kind of Blue/01.flac',
  seek: 42000,
  duration: 545,
  volume: 35,
  mute: false,
  queueIndex: 0,
  queueLength: 5,
};

beforeEach(() => {
  resetCastStoreForTests();
  emitSpy.mockClear();
  nextAck.value = { ok: true };
  handlers.pushCastState = null;
  handlers.pushCastDevices = null;
  initCastStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('pushCastState', () => {
  it('replaces the snapshot rather than merging it', () => {
    handlers.pushCastState?.(SNAPSHOT);
    expect(get(castState).title).toBe('So What');
    expect(get(castActive)).toBe(true);

    // A later frame with no title must clear it, not ghost the old one under
    // the new track.
    handlers.pushCastState?.({ ...SNAPSHOT, title: undefined, artist: undefined });
    expect(get(castState).title).toBe('');
    expect(get(castState).artist).toBe('');
  });

  it('defaults every omitted field', () => {
    // The backend uses omitempty, so a stopped session arrives as {active:false}.
    handlers.pushCastState?.({ active: false });
    expect(get(castState)).toEqual({
      active: false,
      deviceId: '',
      deviceName: '',
      status: 'stop',
      title: '',
      artist: '',
      album: '',
      albumart: '',
      uri: '',
      seek: 0,
      duration: 0,
      volume: 0,
      mute: false,
      queueIndex: 0,
      queueLength: 0,
    });
  });

  it('falls back to stop on an unrecognised status', () => {
    handlers.pushCastState?.({ ...SNAPSHOT, status: 'BUFFERING' });
    expect(get(castState).status).toBe('stop');
  });

  it('tolerates a null payload', () => {
    handlers.pushCastState?.(null);
    expect(get(castActive)).toBe(false);
  });

  it('clears the skip list when the session ends', () => {
    handlers.pushCastState?.(SNAPSHOT);
    castSkipped.set([{ title: 'A', uri: 'a.dsf', reason: 'DSD' }]);

    handlers.pushCastState?.({ active: false });
    expect(get(castSkipped)).toEqual([]);
  });
});

describe('seek interpolation', () => {
  it('advances seek between snapshots while playing', () => {
    vi.useFakeTimers();
    handlers.pushCastState?.(SNAPSHOT);

    vi.advanceTimersByTime(3000);
    expect(get(castState).seek).toBe(45000);
  });

  it('freezes while paused', () => {
    vi.useFakeTimers();
    handlers.pushCastState?.({ ...SNAPSHOT, status: 'pause' });

    vi.advanceTimersByTime(5000);
    expect(get(castState).seek).toBe(42000);
  });

  it('stops at the end of the track rather than running past the duration', () => {
    vi.useFakeTimers();
    handlers.pushCastState?.({ ...SNAPSHOT, seek: 544_000, duration: 545 });

    vi.advanceTimersByTime(10_000);
    expect(get(castState).seek).toBe(545_000);
  });

  it('stops once the session ends', () => {
    vi.useFakeTimers();
    handlers.pushCastState?.(SNAPSHOT);
    handlers.pushCastState?.({ active: false });

    vi.advanceTimersByTime(5000);
    expect(get(castState).seek).toBe(0);
  });
});

describe('pushCastDevices', () => {
  it('stores the broadcast list', () => {
    handlers.pushCastDevices?.([{ id: 'hub-1', name: 'Living Room Display', model: 'Google Nest Hub' }]);
    expect(get(castDevices)).toHaveLength(1);
  });

  it('ignores a malformed payload instead of breaking the picker', () => {
    handlers.pushCastDevices?.({ nope: true });
    expect(get(castDevices)).toEqual([]);
  });
});

describe('castActions', () => {
  it('listDevices stores the acked list and clears the progress flag', async () => {
    nextAck.value = { ok: true, devices: [{ id: 'hub-1', name: 'Living Room Display' }] };

    const devices = await castActions.listDevices();

    expect(devices).toHaveLength(1);
    expect(get(castDevices)).toHaveLength(1);
    expect(get(castDiscovering)).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith('cast:listDevices', {});
  });

  it('listDevices keeps the cached list when the request itself fails', async () => {
    // A stale entry the user can tap beats an empty list that reads as
    // "nothing is out there".
    castDevices.set([{ id: 'hub-1', name: 'Living Room Display' }]);
    nextAck.value = { ok: false, error: 'no response' };

    const devices = await castActions.listDevices();

    expect(devices).toHaveLength(1);
    expect(get(castDevices)).toHaveLength(1);
    expect(get(castDiscovering)).toBe(false);
  });

  it('listDevices accepts an empty list from a successful browse', async () => {
    // Nothing on the LAN is a real answer, and it must clear a device that
    // has been unplugged.
    castDevices.set([{ id: 'gone', name: 'Old Speaker' }]);
    nextAck.value = { ok: true, devices: [] };

    await castActions.listDevices();

    expect(get(castDevices)).toEqual([]);
  });

  it('playAlbum records what the policy refused', async () => {
    nextAck.value = {
      ok: true,
      skipped: [{ title: 'Blue in Green', uri: 'USB/x/03.dsf', reason: 'DSD is not supported' }],
    };

    const response = await castActions.playAlbum({
      album: 'Kind of Blue',
      albumArtist: 'Miles Davis',
      uri: 'USB/Kind of Blue',
      sampleRate: 44100,
      startIndex: 2,
    });

    expect(response.ok).toBe(true);
    expect(get(castSkipped)).toHaveLength(1);
    expect(emitSpy).toHaveBeenCalledWith('cast:playAlbum', {
      album: 'Kind of Blue',
      albumArtist: 'Miles Davis',
      uri: 'USB/Kind of Blue',
      sampleRate: 44100,
      startIndex: 2,
    });
  });

  it('playAlbum keeps the reasons when nothing is playable', async () => {
    nextAck.value = {
      ok: false,
      error: 'cast: none of those tracks can be cast',
      skipped: [{ title: 'A', uri: 'a.dsf', reason: 'DSD is not supported' }],
    };

    const response = await castActions.playAlbum({ album: 'All DSD' });

    expect(response.ok).toBe(false);
    expect(get(castSkipped)).toHaveLength(1);
  });

  it('resolves rather than hanging when the backend never acks', async () => {
    nextAck.value = undefined;
    const response = await castActions.connect('hub-1');
    expect(response.ok).toBe(false);
  });

  it('sends transport commands over cast:command, never the MPD events', () => {
    castActions.play();
    castActions.pause();
    castActions.toggle();
    castActions.next();
    castActions.prev();

    const events = emitSpy.mock.calls.map((c) => c[0]);
    expect(events).toEqual(Array(5).fill('cast:command'));
    expect(emitSpy.mock.calls.map((c) => c[1].cmd)).toEqual(['play', 'pause', 'toggle', 'next', 'prev']);
  });

  it('seekTo sends whole seconds and never a negative position', () => {
    castActions.seekTo(45.7);
    castActions.seekTo(-10);

    expect(emitSpy.mock.calls[0][1]).toEqual({ cmd: 'seek', value: 46 });
    expect(emitSpy.mock.calls[1][1]).toEqual({ cmd: 'seek', value: 0 });
  });

  it('setVolume clamps to 0..100', () => {
    castActions.setVolume(-5);
    castActions.setVolume(250);
    castActions.setVolume(37.4);

    expect(emitSpy.mock.calls.map((c) => c[1].value)).toEqual([0, 100, 37]);
  });

  it('connect, disconnect and stop each hit their own event', async () => {
    await castActions.connect('hub-1');
    await castActions.disconnect();
    await castActions.stop();

    expect(emitSpy.mock.calls.map((c) => c[0])).toEqual([
      'cast:connect',
      'cast:disconnect',
      'cast:stop',
    ]);
    expect(emitSpy.mock.calls[0][1]).toEqual({ deviceId: 'hub-1' });
  });

  it('refresh re-pulls the snapshot', () => {
    castActions.refresh();
    expect(emitSpy).toHaveBeenCalledWith('getCastState', undefined);
  });
});

describe('initCastStore', () => {
  it('is idempotent', () => {
    initCastStore();
    initCastStore();
    handlers.pushCastState?.(SNAPSHOT);
    expect(get(castState).title).toBe('So What');
  });
});
