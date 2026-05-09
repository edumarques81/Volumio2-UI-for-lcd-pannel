import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Capture pushState handler so tests can drive it directly.
let pushStateHandler: ((state: any) => void) | null = null;

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (event === 'pushState') {
        pushStateHandler = handler as (s: any) => void;
      }
      return () => {};
    }),
  },
}));

vi.mock('$lib/config', () => ({
  fixVolumioAssetUrl: vi.fn((url: string | null | undefined) => url),
}));

import { playerState, playerActions, initPlayerStore } from '../player';
import type { Album } from '../library';

beforeAll(() => {
  initPlayerStore();
});

beforeEach(() => {
  // Reset to a clean baseline so optimisticPending state from a prior test
  // does not bleed across cases.
  playerState.set(null);
});

const SAMPLE_ALBUM: Album = {
  id: 'album-1',
  title: 'Kind of Blue',
  artist: 'Miles Davis',
  uri: 'NAS/Miles Davis/Kind of Blue',
  albumArt: '/albumart?path=miles/kob.jpg',
  trackCount: 5,
  source: 'nas',
};

describe('playerActions.optimisticAlbumStart', () => {
  it('immediately reflects the new album metadata in playerState', () => {
    playerActions.optimisticAlbumStart(SAMPLE_ALBUM);

    const state = get(playerState);
    expect(state).not.toBeNull();
    expect(state?.title).toBe('Kind of Blue');
    expect(state?.artist).toBe('Miles Davis');
    expect(state?.albumart).toBe('/albumart?path=miles/kob.jpg');
    expect(state?.status).toBe('play');
    expect(state?.seek).toBe(0);
    expect(state?.duration).toBe(0);
  });

  it('falls back to empty strings when album metadata is missing', () => {
    const sparseAlbum = {
      ...SAMPLE_ALBUM,
      artist: '',
      albumArt: '',
    } as Album;

    playerActions.optimisticAlbumStart(sparseAlbum);

    const state = get(playerState);
    expect(state?.artist).toBe('');
    expect(state?.albumart).toBe('');
    // still applied — title remained set
    expect(state?.title).toBe('Kind of Blue');
  });

  it('next pushState applies even when the diff would short-circuit', () => {
    if (!pushStateHandler) throw new Error('pushState handler not registered');

    // Optimistically start an album.
    playerActions.optimisticAlbumStart(SAMPLE_ALBUM);

    // Backend now pushes a state whose visible-diff fields all match what
    // we already optimistically set (same title/artist/albumart/status/uri),
    // but with a real backend-supplied position (queue index 0). Without the
    // optimisticPending bypass the change-gate would short-circuit because
    // every gated field matches. With the bypass, pushState MUST apply so
    // we get the authoritative backend state including position/seek/duration.
    const backendState = {
      status: 'play',
      title: 'Kind of Blue',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
      albumart: '/albumart?path=miles/kob.jpg',
      uri: 'NAS/Miles Davis/Kind of Blue/01 - So What.flac',
      service: 'mpd',
      trackType: 'flac',
      samplerate: '96000',
      bitdepth: '24',
      position: 0,
      seek: 0,
      duration: 545,
    };

    pushStateHandler(backendState);

    const state = get(playerState);
    // duration was 0 in the optimistic snapshot — if pushState applied, it
    // is now 545 (the backend-supplied value).
    expect(state?.duration).toBe(545);
    // uri was the album folder optimistically — pushState replaced it with
    // the actual track URI.
    expect(state?.uri).toBe('NAS/Miles Davis/Kind of Blue/01 - So What.flac');
    expect(state?.trackType).toBe('flac');
  });

  it('re-arms the change-gate after the suppressed pushState applies', () => {
    if (!pushStateHandler) throw new Error('pushState handler not registered');

    // Optimistic start.
    playerActions.optimisticAlbumStart(SAMPLE_ALBUM);

    // First pushState — bypass consumes the optimisticPending flag.
    pushStateHandler({
      status: 'play',
      title: 'Kind of Blue',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
      albumart: '/albumart?path=miles/kob.jpg',
      uri: 'NAS/Miles Davis/Kind of Blue/01.flac',
      service: 'mpd',
      trackType: 'flac',
      samplerate: '96000',
      bitdepth: '24',
      position: 0,
      seek: 0,
      duration: 545,
    });

    // Subscribe AFTER the bypass so we only count subsequent notifications.
    const setSpy = vi.fn();
    const unsub = playerState.subscribe(setSpy);
    setSpy.mockClear(); // ignore the initial subscription emission

    // Second pushState with NO visible diff (same values as state above) —
    // the normal change-gate must short-circuit because optimisticPending
    // was cleared by the first push.
    pushStateHandler({
      status: 'play',
      title: 'Kind of Blue',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
      albumart: '/albumart?path=miles/kob.jpg',
      uri: 'NAS/Miles Davis/Kind of Blue/01.flac',
      service: 'mpd',
      trackType: 'flac',
      samplerate: '96000',
      bitdepth: '24',
      position: 0,
      seek: 0,
      duration: 545,
    });

    expect(setSpy).not.toHaveBeenCalled();
    unsub();
  });

  it('a second optimistic start before pushState just overwrites — flag stays armed', () => {
    if (!pushStateHandler) throw new Error('pushState handler not registered');

    playerActions.optimisticAlbumStart(SAMPLE_ALBUM);

    const album2: Album = {
      id: 'album-2',
      title: 'Bitches Brew',
      artist: 'Miles Davis',
      uri: 'NAS/Miles Davis/Bitches Brew',
      albumArt: '/albumart?path=miles/bb.jpg',
      trackCount: 6,
      source: 'nas',
    };
    playerActions.optimisticAlbumStart(album2);

    // The store reflects the second album immediately.
    expect(get(playerState)?.title).toBe('Bitches Brew');

    // pushState that matches album2 byte-for-byte on the gated fields —
    // bypass MUST still apply (duration moves from 0 to 1700) because the
    // flag was never consumed.
    pushStateHandler({
      status: 'play',
      title: 'Bitches Brew',
      artist: 'Miles Davis',
      album: 'Bitches Brew',
      albumart: '/albumart?path=miles/bb.jpg',
      uri: 'NAS/Miles Davis/Bitches Brew/01 - Pharaoh\'s Dance.flac',
      service: 'mpd',
      trackType: 'flac',
      samplerate: '96000',
      bitdepth: '24',
      position: 0,
      seek: 0,
      duration: 1700,
    });

    expect(get(playerState)?.duration).toBe(1700);
  });
});
