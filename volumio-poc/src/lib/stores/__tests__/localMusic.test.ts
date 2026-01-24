import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock the socket service
vi.mock('$lib/services/socket', () => {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    socketService: {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      }),
      off: vi.fn((event: string) => {
        delete handlers[event];
      }),
      emit: vi.fn(),
      _handlers: handlers,
      _trigger: (event: string, ...args: unknown[]) => {
        handlers[event]?.forEach(handler => handler(...args));
      }
    }
  };
});

// Mock fixVolumioAssetUrl
vi.mock('$lib/config', () => ({
  fixVolumioAssetUrl: vi.fn((url: string) => url)
}));

// Import after mocking
import {
  localAlbums,
  lastPlayedTracks,
  localMusicLoading,
  localMusicError,
  selectedAlbum,
  albumTracks,
  albumTracksLoading,
  albumSortOrder,
  trackSortOrder,
  hasLocalAlbums,
  hasLastPlayed,
  localMusicActions,
  initLocalMusicListeners,
  cleanupLocalMusicListeners,
  type LocalAlbum,
  type AlbumTrack,
  type AlbumTracksResponse
} from '../localMusic';
import { socketService } from '$lib/services/socket';

describe('LocalMusic Store', () => {
  beforeEach(() => {
    // Reset stores to initial state
    localAlbums.set([]);
    lastPlayedTracks.set([]);
    localMusicLoading.set(false);
    localMusicError.set(null);
    selectedAlbum.set(null);
    albumTracks.set([]);
    albumTracksLoading.set(false);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupLocalMusicListeners();
  });

  describe('Initial State', () => {
    it('should have empty albums initially', () => {
      expect(get(localAlbums)).toEqual([]);
    });

    it('should have empty last played tracks initially', () => {
      expect(get(lastPlayedTracks)).toEqual([]);
    });

    it('should have loading as false initially', () => {
      expect(get(localMusicLoading)).toBe(false);
    });

    it('should have no error initially', () => {
      expect(get(localMusicError)).toBeNull();
    });

    it('should have no selected album initially', () => {
      expect(get(selectedAlbum)).toBeNull();
    });

    it('should have empty album tracks initially', () => {
      expect(get(albumTracks)).toEqual([]);
    });

    it('should derive hasLocalAlbums from albums', () => {
      expect(get(hasLocalAlbums)).toBe(false);

      localAlbums.set([{ id: '1', title: 'Album', artist: 'Artist', uri: 'uri', albumArt: '', trackCount: 1, source: 'local' }]);
      expect(get(hasLocalAlbums)).toBe(true);
    });

    it('should derive hasLastPlayed from tracks', () => {
      expect(get(hasLastPlayed)).toBe(false);
    });
  });

  describe('initLocalMusicListeners', () => {
    it('should register socket event listeners', () => {
      initLocalMusicListeners();

      expect(socketService.on).toHaveBeenCalledWith('pushLocalAlbums', expect.any(Function));
      expect(socketService.on).toHaveBeenCalledWith('pushLastPlayedTracks', expect.any(Function));
      expect(socketService.on).toHaveBeenCalledWith('pushHistoryCleared', expect.any(Function));
      expect(socketService.on).toHaveBeenCalledWith('pushAlbumTracks', expect.any(Function));
    });

    it('should only initialize once', () => {
      initLocalMusicListeners();
      initLocalMusicListeners();
      initLocalMusicListeners();

      // Should only call on() 4 times (one for each event)
      expect(socketService.on).toHaveBeenCalledTimes(4);
    });
  });

  describe('cleanupLocalMusicListeners', () => {
    it('should remove socket event listeners', () => {
      initLocalMusicListeners();
      cleanupLocalMusicListeners();

      expect(socketService.off).toHaveBeenCalledWith('pushLocalAlbums');
      expect(socketService.off).toHaveBeenCalledWith('pushLastPlayedTracks');
      expect(socketService.off).toHaveBeenCalledWith('pushHistoryCleared');
      expect(socketService.off).toHaveBeenCalledWith('pushAlbumTracks');
    });
  });

  describe('pushAlbumTracks event', () => {
    it('should update album tracks when received', () => {
      initLocalMusicListeners();
      albumTracksLoading.set(true);

      const response: AlbumTracksResponse = {
        tracks: [
          {
            id: '1',
            title: 'Track One',
            artist: 'Artist',
            album: 'Album',
            uri: 'INTERNAL/Album/track1.flac',
            trackNumber: 1,
            duration: 240,
            albumArt: '/albumart?path=track1.flac',
            source: 'local'
          },
          {
            id: '2',
            title: 'Track Two',
            artist: 'Artist',
            album: 'Album',
            uri: 'INTERNAL/Album/track2.flac',
            trackNumber: 2,
            duration: 180,
            albumArt: '/albumart?path=track2.flac',
            source: 'local'
          }
        ],
        totalCount: 2,
        albumUri: 'INTERNAL/Album'
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushAlbumTracks', response);

      expect(get(albumTracksLoading)).toBe(false);
      expect(get(albumTracks)).toHaveLength(2);
      expect(get(albumTracks)[0].title).toBe('Track One');
      expect(get(albumTracks)[1].title).toBe('Track Two');
      expect(get(localMusicError)).toBeNull();
    });

    it('should handle error in response', () => {
      initLocalMusicListeners();
      albumTracksLoading.set(true);

      const response: AlbumTracksResponse = {
        tracks: [],
        totalCount: 0,
        albumUri: 'INTERNAL/NonExistent',
        error: 'Album not found'
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushAlbumTracks', response);

      expect(get(albumTracksLoading)).toBe(false);
      expect(get(localMusicError)).toBe('Album not found');
    });

    it('should handle empty tracks array', () => {
      initLocalMusicListeners();

      const response: AlbumTracksResponse = {
        tracks: [],
        totalCount: 0,
        albumUri: 'INTERNAL/EmptyAlbum'
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushAlbumTracks', response);

      expect(get(albumTracks)).toEqual([]);
    });

    it('should handle null tracks in response', () => {
      initLocalMusicListeners();

      const response = {
        tracks: null,
        totalCount: 0,
        albumUri: 'INTERNAL/Album'
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushAlbumTracks', response);

      expect(get(albumTracks)).toEqual([]);
    });
  });

  describe('localMusicActions.selectAlbum', () => {
    it('should set selected album and request tracks', () => {
      const album: LocalAlbum = {
        id: '1',
        title: 'Test Album',
        artist: 'Test Artist',
        uri: 'INTERNAL/TestAlbum',
        albumArt: '/albumart?path=test',
        trackCount: 5,
        source: 'local'
      };

      localMusicActions.selectAlbum(album);

      expect(get(selectedAlbum)).toEqual(album);
      expect(get(albumTracksLoading)).toBe(true);
      expect(get(localMusicError)).toBeNull();
      expect(socketService.emit).toHaveBeenCalledWith('getAlbumTracks', { albumUri: 'INTERNAL/TestAlbum' });
    });
  });

  describe('localMusicActions.deselectAlbum', () => {
    it('should clear selected album and tracks', () => {
      const album: LocalAlbum = {
        id: '1',
        title: 'Test Album',
        artist: 'Test Artist',
        uri: 'INTERNAL/TestAlbum',
        albumArt: '/albumart?path=test',
        trackCount: 5,
        source: 'local'
      };

      selectedAlbum.set(album);
      albumTracks.set([
        { id: '1', title: 'Track', artist: 'Artist', album: 'Album', uri: 'uri', trackNumber: 1, duration: 100, albumArt: '', source: 'local' }
      ]);

      localMusicActions.deselectAlbum();

      expect(get(selectedAlbum)).toBeNull();
      expect(get(albumTracks)).toEqual([]);
    });
  });

  describe('localMusicActions.playAlbumTrack', () => {
    it('should emit replaceAndPlay with track data', () => {
      const track: AlbumTrack = {
        id: '1',
        title: 'Track One',
        artist: 'Test Artist',
        album: 'Test Album',
        uri: 'INTERNAL/Album/track1.flac',
        trackNumber: 1,
        duration: 240,
        albumArt: '/albumart?path=track1.flac',
        source: 'local'
      };

      localMusicActions.playAlbumTrack(track);

      expect(socketService.emit).toHaveBeenCalledWith('replaceAndPlay', {
        uri: 'INTERNAL/Album/track1.flac',
        title: 'Track One',
        artist: 'Test Artist',
        album: 'Test Album',
        albumart: '/albumart?path=track1.flac',
        origin: 'manual_track'
      });
    });
  });

  describe('localMusicActions.playAlbum', () => {
    it('should emit replaceAndPlay with album data', () => {
      const album: LocalAlbum = {
        id: '1',
        title: 'Test Album',
        artist: 'Test Artist',
        uri: 'INTERNAL/TestAlbum',
        albumArt: '/albumart?path=test',
        trackCount: 5,
        source: 'local'
      };

      localMusicActions.playAlbum(album);

      expect(socketService.emit).toHaveBeenCalledWith('replaceAndPlay', {
        uri: 'INTERNAL/TestAlbum',
        title: 'Test Album',
        artist: 'Test Artist',
        albumart: '/albumart?path=test',
        origin: 'album_context'
      });
    });
  });

  describe('localMusicActions.fetchAlbums', () => {
    it('should emit getLocalAlbums event', () => {
      localMusicActions.fetchAlbums();

      expect(get(localMusicLoading)).toBe(true);
      expect(get(localMusicError)).toBeNull();
      expect(socketService.emit).toHaveBeenCalledWith('getLocalAlbums', {});
    });

    it('should include sort parameter when provided', () => {
      localMusicActions.fetchAlbums('alphabetical');

      expect(socketService.emit).toHaveBeenCalledWith('getLocalAlbums', { sort: 'alphabetical' });
    });

    it('should include query and limit when provided', () => {
      localMusicActions.fetchAlbums('by_artist', 'jazz', 20);

      expect(socketService.emit).toHaveBeenCalledWith('getLocalAlbums', {
        sort: 'by_artist',
        query: 'jazz',
        limit: 20
      });
    });
  });

  describe('localMusicActions.setAlbumSort', () => {
    it('should update sort order and refetch albums', () => {
      localMusicActions.setAlbumSort('by_artist');

      expect(get(albumSortOrder)).toBe('by_artist');
      expect(socketService.emit).toHaveBeenCalledWith('getLocalAlbums', { sort: 'by_artist' });
    });
  });

  describe('localMusicActions.clearError', () => {
    it('should clear error state', () => {
      localMusicError.set('Some error');

      localMusicActions.clearError();

      expect(get(localMusicError)).toBeNull();
    });
  });

  describe('pushLocalAlbums event', () => {
    it('should update albums when received', () => {
      initLocalMusicListeners();
      localMusicLoading.set(true);

      const response = {
        albums: [
          { id: '1', title: 'Album 1', artist: 'Artist 1', uri: 'uri1', albumArt: '/art1', trackCount: 10, source: 'local' },
          { id: '2', title: 'Album 2', artist: 'Artist 2', uri: 'uri2', albumArt: '/art2', trackCount: 8, source: 'usb' }
        ],
        totalCount: 2,
        filteredOut: 0
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushLocalAlbums', response);

      expect(get(localMusicLoading)).toBe(false);
      expect(get(localAlbums)).toHaveLength(2);
      expect(get(localAlbums)[0].title).toBe('Album 1');
      expect(get(localMusicError)).toBeNull();
    });

    it('should handle error in albums response', () => {
      initLocalMusicListeners();

      const response = {
        albums: [],
        totalCount: 0,
        filteredOut: 0,
        error: 'Failed to fetch albums'
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushLocalAlbums', response);

      expect(get(localMusicError)).toBe('Failed to fetch albums');
    });
  });

  describe('pushHistoryCleared event', () => {
    it('should clear last played tracks on success', () => {
      initLocalMusicListeners();
      lastPlayedTracks.set([
        { id: '1', trackURI: 'uri', title: 'Track', artist: 'Artist', album: 'Album', albumArt: '', source: 'local', origin: 'manual_track', playedAt: '2024-01-01', playCount: 1 }
      ]);

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushHistoryCleared', { success: true });

      expect(get(lastPlayedTracks)).toEqual([]);
    });

    it('should not clear tracks on failure', () => {
      initLocalMusicListeners();
      const tracks = [
        { id: '1', trackURI: 'uri', title: 'Track', artist: 'Artist', album: 'Album', albumArt: '', source: 'local' as const, origin: 'manual_track' as const, playedAt: '2024-01-01', playCount: 1 }
      ];
      lastPlayedTracks.set(tracks);

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushHistoryCleared', { success: false });

      expect(get(lastPlayedTracks)).toEqual(tracks);
    });
  });
});
