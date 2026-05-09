import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  libraryAlbums,
  libraryAlbumsLoading,
  libraryAlbumsError,
  libraryArtists,
  libraryArtistsLoading,
  radioStations,
  radioLoading,
  selectedLibraryAlbum,
  libraryAlbumTracks,
  libraryActions,
  initLibraryStore,
  type Album,
  type Artist,
  type RadioStation,
  type Track
} from '../library';
import { socketService } from '$lib/services/socket';

// Mock the socket service
vi.mock('$lib/services/socket', () => {
  const { writable } = require('svelte/store');
  return {
    socketService: {
      on: vi.fn(),
      emit: vi.fn(),
      isConnected: true
    },
    connectionState: writable('connected')
  };
});

// Mock the navigation store. replaceQueueAndPlay calls viewActions.goToPlayer()
// after dispatching, so we need a stub. Real navigation logic is covered in
// navigation tests.
vi.mock('$lib/stores/navigation', () => ({
  viewActions: { goToPlayer: vi.fn() }
}));

// Mock the player store so we can assert that playAlbum calls
// playerActions.optimisticAlbumStart. The optimistic-update mechanics
// themselves are covered in player-optimistic.test.ts.
vi.mock('$lib/stores/player', () => ({
  playerActions: {
    optimisticAlbumStart: vi.fn()
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Library Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores
    libraryAlbums.set([]);
    libraryArtists.set([]);
    radioStations.set([]);
    libraryAlbumTracks.set([]);
    selectedLibraryAlbum.set(null);
    libraryAlbumsLoading.set(false);
    libraryArtistsLoading.set(false);
    radioLoading.set(false);
  });

  describe('libraryActions.fetchAlbums', () => {
    it('should emit library:albums:list with default params', () => {
      libraryActions.fetchAlbums();

      expect(socketService.emit).toHaveBeenCalledWith('library:albums:list', {
        scope: 'all',
        sort: 'by_artist',
        query: '',
        page: 1,
        limit: 200
      });
      expect(get(libraryAlbumsLoading)).toBe(true);
    });

    it('should emit library:albums:list with custom scope', () => {
      libraryActions.fetchAlbums({ scope: 'nas', sort: 'by_artist' });

      expect(socketService.emit).toHaveBeenCalledWith('library:albums:list', {
        scope: 'nas',
        sort: 'by_artist',
        query: '',
        page: 1,
        limit: 200
      });
    });

    it('should emit library:albums:list with query', () => {
      libraryActions.fetchAlbums({ query: 'jazz' });

      expect(socketService.emit).toHaveBeenCalledWith('library:albums:list', {
        scope: 'all',
        sort: 'by_artist',
        query: 'jazz',
        page: 1,
        limit: 200
      });
    });
  });

  describe('libraryActions.fetchNASAlbums', () => {
    it('should emit with scope=nas', () => {
      libraryActions.fetchNASAlbums({ sort: 'by_artist' });

      expect(socketService.emit).toHaveBeenCalledWith('library:albums:list', {
        scope: 'nas',
        sort: 'by_artist',
        query: '',
        page: 1,
        limit: 200
      });
    });
  });

  describe('libraryActions.fetchArtists', () => {
    it('should emit library:artists:list', () => {
      libraryActions.fetchArtists();

      expect(socketService.emit).toHaveBeenCalledWith('library:artists:list', {
        query: '',
        page: 1,
        limit: 50
      });
      expect(get(libraryArtistsLoading)).toBe(true);
    });

    it('should emit with query', () => {
      libraryActions.fetchArtists({ query: 'jazz' });

      expect(socketService.emit).toHaveBeenCalledWith('library:artists:list', {
        query: 'jazz',
        page: 1,
        limit: 50
      });
    });
  });

  describe('libraryActions.fetchArtistAlbums', () => {
    it('should emit library:artist:albums', () => {
      libraryActions.fetchArtistAlbums('Miles Davis');

      expect(socketService.emit).toHaveBeenCalledWith('library:artist:albums', {
        artist: 'Miles Davis',
        sort: 'alphabetical',
        page: 1,
        limit: 50
      });
    });
  });

  describe('libraryActions.fetchAlbumTracks', () => {
    it('should emit library:album:tracks', () => {
      const album: Album = {
        id: 'album1',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        uri: 'NAS/Jazz/Kind of Blue',
        albumArt: '/albumart?path=...',
        trackCount: 5,
        source: 'nas'
      };

      libraryActions.fetchAlbumTracks(album);

      expect(socketService.emit).toHaveBeenCalledWith('library:album:tracks', {
        album: 'Kind of Blue',
        albumArtist: 'Miles Davis',
        uri: 'NAS/Jazz/Kind of Blue'
      });
      expect(get(selectedLibraryAlbum)).toEqual(album);
    });
  });

  describe('libraryActions.fetchRadioStations', () => {
    it('should emit library:radio:list', () => {
      libraryActions.fetchRadioStations();

      expect(socketService.emit).toHaveBeenCalledWith('library:radio:list', {
        query: '',
        page: 1,
        limit: 50
      });
      expect(get(radioLoading)).toBe(true);
    });
  });

  describe('libraryActions.playRadioStation', () => {
    it('should emit replaceAndPlay for radio', () => {
      const station: RadioStation = {
        id: 'station1',
        name: 'Jazz FM',
        uri: 'http://jazz.fm/stream'
      };

      libraryActions.playRadioStation(station);

      expect(socketService.emit).toHaveBeenCalledWith('replaceAndPlay', {
        service: 'webradio',
        type: 'webradio',
        title: 'Jazz FM',
        uri: 'http://jazz.fm/stream'
      });
    });
  });

  describe('libraryActions.playAlbum', () => {
    it('should emit replaceAndPlay for album', () => {
      const album: Album = {
        id: 'album1',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        uri: 'NAS/Jazz/Kind of Blue',
        albumArt: '/albumart?path=...',
        trackCount: 5,
        source: 'nas'
      };

      libraryActions.playAlbum(album);

      expect(socketService.emit).toHaveBeenCalledWith('replaceAndPlay', {
        service: 'mpd',
        type: 'folder',
        title: 'Kind of Blue',
        uri: 'NAS/Jazz/Kind of Blue'
      });
    });

    it('should call playerActions.optimisticAlbumStart before emitting replaceAndPlay', async () => {
      const { playerActions } = await import('../player');
      const album: Album = {
        id: 'album1',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        uri: 'NAS/Jazz/Kind of Blue',
        albumArt: '/albumart?path=...',
        trackCount: 5,
        source: 'nas'
      };

      libraryActions.playAlbum(album);

      expect(playerActions.optimisticAlbumStart).toHaveBeenCalledWith(album);

      // Optimistic update must run before the socket emit so the UI flips
      // immediately on tap rather than waiting for the round-trip.
      const optimisticOrder = (playerActions.optimisticAlbumStart as any).mock.invocationCallOrder[0];
      const emitOrder = (socketService.emit as any).mock.invocationCallOrder[0];
      expect(optimisticOrder).toBeLessThan(emitOrder);
    });
  });

  describe('libraryActions.playTrack', () => {
    it('should emit replaceAndPlay for track', () => {
      const track: Track = {
        id: 'track1',
        title: 'So What',
        artist: 'Miles Davis',
        album: 'Kind of Blue',
        uri: 'NAS/Jazz/Kind of Blue/01 - So What.flac',
        trackNumber: 1,
        duration: 564,
        albumArt: '/albumart?path=...',
        source: 'nas'
      };

      libraryActions.playTrack(track);

      expect(socketService.emit).toHaveBeenCalledWith('replaceAndPlay', {
        service: 'mpd',
        type: 'song',
        title: 'So What',
        uri: 'NAS/Jazz/Kind of Blue/01 - So What.flac'
      });
    });
  });

  describe('libraryActions.clearSelectedAlbum', () => {
    it('should clear selected album and tracks', () => {
      // Set some data first
      selectedLibraryAlbum.set({
        id: 'album1',
        title: 'Test Album',
        artist: 'Test Artist',
        uri: 'test/uri',
        albumArt: '',
        trackCount: 1,
        source: 'local'
      });
      libraryAlbumTracks.set([{
        id: 'track1',
        title: 'Track 1',
        artist: 'Test Artist',
        album: 'Test Album',
        uri: 'test/track.flac',
        trackNumber: 1,
        duration: 180,
        albumArt: '',
        source: 'local'
      }]);

      libraryActions.clearSelectedAlbum();

      expect(get(selectedLibraryAlbum)).toBeNull();
      expect(get(libraryAlbumTracks)).toEqual([]);
    });
  });

  describe('libraryActions.addAlbumToQueue', () => {
    it('should emit addToQueue for album', () => {
      const album: Album = {
        id: 'album1',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        uri: 'NAS/Jazz/Kind of Blue',
        albumArt: '/albumart?path=...',
        trackCount: 5,
        source: 'nas'
      };

      libraryActions.addAlbumToQueue(album);

      expect(socketService.emit).toHaveBeenCalledWith('addToQueue', {
        service: 'mpd',
        type: 'folder',
        title: 'Kind of Blue',
        uri: 'NAS/Jazz/Kind of Blue'
      });
    });
  });

  describe('libraryActions.playAlbumNext', () => {
    it('should emit playNext with album URI', () => {
      const album: Album = {
        id: 'album1',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        uri: 'NAS/Jazz/Kind of Blue',
        albumArt: '/albumart?path=...',
        trackCount: 5,
        source: 'nas'
      };

      libraryActions.playAlbumNext(album);

      expect(socketService.emit).toHaveBeenCalledWith('playNext', {
        service: 'mpd',
        type: 'folder',
        title: 'Kind of Blue',
        uri: 'NAS/Jazz/Kind of Blue'
      });
    });
  });

  describe('libraryActions.addTrackToQueue', () => {
    it('should emit addToQueue for track', () => {
      const track: Track = {
        id: 'track1',
        title: 'So What',
        artist: 'Miles Davis',
        album: 'Kind of Blue',
        uri: 'NAS/Jazz/Kind of Blue/01 - So What.flac',
        trackNumber: 1,
        duration: 564,
        albumArt: '/albumart?path=...',
        source: 'nas'
      };

      libraryActions.addTrackToQueue(track);

      expect(socketService.emit).toHaveBeenCalledWith('addToQueue', {
        service: 'mpd',
        type: 'song',
        title: 'So What',
        uri: 'NAS/Jazz/Kind of Blue/01 - So What.flac'
      });
    });
  });

  describe('libraryActions.playTrackNext', () => {
    it('should emit playNext with track URI', () => {
      const track: Track = {
        id: 'track1',
        title: 'So What',
        artist: 'Miles Davis',
        album: 'Kind of Blue',
        uri: 'NAS/Jazz/Kind of Blue/01 - So What.flac',
        trackNumber: 1,
        duration: 564,
        albumArt: '/albumart?path=...',
        source: 'nas'
      };

      libraryActions.playTrackNext(track);

      expect(socketService.emit).toHaveBeenCalledWith('playNext', {
        service: 'mpd',
        type: 'song',
        title: 'So What',
        uri: 'NAS/Jazz/Kind of Blue/01 - So What.flac'
      });
    });
  });

  describe('libraryActions.replaceQueueAndPlay', () => {
    const albumA: Album = {
      id: 'a', title: 'A', artist: 'X', uri: 'mpd://a',
      albumArt: '', trackCount: 1, source: 'local',
    };
    const albumB: Album = {
      id: 'b', title: 'B', artist: 'Y', uri: 'mpd://b',
      albumArt: '', trackCount: 1, source: 'local',
    };

    it('cancels prior in-flight subscription on rapid re-call: only the second call dispatches', () => {
      // Fresh state: nothing selected, no tracks loaded.
      selectedLibraryAlbum.set(null);
      libraryAlbumTracks.set([]);

      // Tap album A — its subscription is now in-flight, waiting for tracks.
      libraryActions.replaceQueueAndPlay(albumA);

      // Before tracks for A arrive, tap album B — should cancel A's subscription.
      libraryActions.replaceQueueAndPlay(albumB);

      // Now simulate the BACKEND responding to album A first (out of order).
      // The store's pushLibraryAlbumTracks handler would normally update both
      // selectedLibraryAlbum and libraryAlbumTracks; here we simulate by hand
      // since initLibraryStore isn't wired up in this test.
      selectedLibraryAlbum.set(albumA);
      libraryAlbumTracks.set([
        { id: 't', title: 'T', artist: 'X', album: 'A', uri: 'a-track',
          trackNumber: 1, duration: 60, albumArt: '', source: 'local' }
      ]);

      // Album A's subscription was unsubscribed → no clearQueue/addToQueue/play
      // emitted for A. Verify by counting playback emits since the test started.
      const playbackEmits = (socketService.emit as any).mock.calls
        .filter((c: any[]) => c[0] === 'clearQueue' || c[0] === 'addToQueue' || c[0] === 'play');
      expect(playbackEmits.length).toBe(0);

      // Now simulate the response for album B. Both selected + tracks change.
      selectedLibraryAlbum.set(albumB);
      libraryAlbumTracks.set([
        { id: 't2', title: 'T2', artist: 'Y', album: 'B', uri: 'b-track',
          trackNumber: 1, duration: 60, albumArt: '', source: 'local' }
      ]);

      // Album B's subscription should fire and dispatch clearQueue + addToQueue + play.
      const allEmits = (socketService.emit as any).mock.calls;
      expect(allEmits.some((c: any[]) => c[0] === 'clearQueue')).toBe(true);
      expect(allEmits.some((c: any[]) =>
        c[0] === 'addToQueue' && c[1].uri.includes('b-track')
      )).toBe(true);
      expect(allEmits.some((c: any[]) => c[0] === 'play')).toBe(true);
    });

    it('skips Svelte synchronous initial-value emission (no stale-on-subscribe dispatch)', () => {
      // Pre-load tracks that would, if not for firstFire, dispatch immediately.
      selectedLibraryAlbum.set(albumA);
      libraryAlbumTracks.set([
        { id: 't', title: 'T', artist: 'X', album: 'A', uri: 'stale',
          trackNumber: 1, duration: 60, albumArt: '', source: 'local' }
      ]);

      // Now tap album A. Subscribe fires synchronously with the existing tracks
      // — but firstFire should swallow that emission, so no dispatch happens
      // until a fresh response arrives.
      const beforeEmits = (socketService.emit as any).mock.calls.length;
      libraryActions.replaceQueueAndPlay(albumA);

      // Only fetchAlbumTracks-related emits should have happened — no clearQueue.
      const afterEmits = (socketService.emit as any).mock.calls;
      const newEmits = afterEmits.slice(beforeEmits);
      expect(newEmits.some((c: any[]) => c[0] === 'clearQueue')).toBe(false);
    });
  });
});
