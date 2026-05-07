import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Capture handlers + emit calls without spinning up a real socket.
// vi.hoisted runs before vi.mock factories so we can reference shared state.
const { emitMock, getPushHandler, setPushHandler } = vi.hoisted(() => {
  let h: ((p: any) => void) | null = null;
  return {
    emitMock: vi.fn(),
    getPushHandler: () => h,
    setPushHandler: (fn: ((p: any) => void) | null) => { h = fn; },
  };
});

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: emitMock,
    on: vi.fn((event: string, handler: Function) => {
      if (event === 'pushLastPlayedAlbum') {
        setPushHandler(handler as (p: any) => void);
      }
      return () => {};
    }),
  },
}));

vi.mock('$lib/config', () => ({
  fixVolumioAssetUrl: vi.fn((url: string | null | undefined) =>
    url ? `http://pi.local${url}` : url
  ),
}));

import {
  lastPlayedAlbum,
  playerActions,
  initPlayerStore,
  type LastPlayedAlbum,
} from '../player';

beforeAll(() => {
  initPlayerStore();
});

beforeEach(() => {
  emitMock.mockClear();
  lastPlayedAlbum.set(null);
});

const SAMPLE: LastPlayedAlbum = {
  artist: 'Miles Davis',
  album: 'Kind of Blue',
  albumArt: '/albumart?path=miles/kob/01.flac',
  trackUri: 'NAS/Miles Davis/Kind of Blue/01.flac',
  trackType: 'flac',
  sampleRate: '96000',
  bitDepth: '24',
};

describe('lastPlayedAlbum store hydration', () => {
  it('populates the store from a pushLastPlayedAlbum payload', () => {
    const pushLastPlayedHandler = getPushHandler();
    if (!pushLastPlayedHandler) throw new Error('pushLastPlayedAlbum handler not registered');
    pushLastPlayedHandler(SAMPLE);
    const got = get(lastPlayedAlbum);
    expect(got).not.toBeNull();
    expect(got?.artist).toBe('Miles Davis');
    expect(got?.album).toBe('Kind of Blue');
    expect(got?.trackUri).toBe('NAS/Miles Davis/Kind of Blue/01.flac');
  });

  it('rewrites albumArt through fixVolumioAssetUrl so dev-mode URLs work', () => {
    const pushLastPlayedHandler = getPushHandler();
    if (!pushLastPlayedHandler) throw new Error('pushLastPlayedAlbum handler not registered');
    pushLastPlayedHandler(SAMPLE);
    const got = get(lastPlayedAlbum);
    expect(got?.albumArt).toBe('http://pi.local/albumart?path=miles/kob/01.flac');
  });

  it('clears the store when the backend pushes null (no resume available)', () => {
    const handler = getPushHandler();
    if (!handler) throw new Error('pushLastPlayedAlbum handler not registered');
    handler(SAMPLE);
    expect(get(lastPlayedAlbum)).not.toBeNull();
    handler(null);
    expect(get(lastPlayedAlbum)).toBeNull();
  });
});

describe('playerActions.playLastPlayed', () => {
  it('emits addPlay with the saved trackUri when last-played is set', () => {
    lastPlayedAlbum.set(SAMPLE);
    playerActions.playLastPlayed();
    expect(emitMock).toHaveBeenCalledWith('addPlay', { uri: SAMPLE.trackUri });
    expect(emitMock).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no last-played row is set', () => {
    lastPlayedAlbum.set(null);
    playerActions.playLastPlayed();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('is a no-op when the saved row has no trackUri', () => {
    lastPlayedAlbum.set({ ...SAMPLE, trackUri: '' });
    playerActions.playLastPlayed();
    expect(emitMock).not.toHaveBeenCalled();
  });
});
