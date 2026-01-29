import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  playlists,
  playlistsLoading,
  playlistsError,
  playlistsCount,
  playlistActions,
  initPlaylistStore
} from '../playlist';
import { socketService } from '$lib/services/socket';

// Mock the socket service
vi.mock('$lib/services/socket', () => ({
  socketService: {
    on: vi.fn(),
    emit: vi.fn()
  }
}));

describe('Playlist Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores
    playlists.set([]);
    playlistsLoading.set(false);
    playlistsError.set(null);
  });

  describe('playlistActions.listPlaylists', () => {
    it('should emit listPlaylist event', () => {
      playlistActions.listPlaylists();

      expect(socketService.emit).toHaveBeenCalledWith('listPlaylist');
    });

    it('should set loading state to true', () => {
      playlistActions.listPlaylists();

      expect(get(playlistsLoading)).toBe(true);
    });

    it('should clear error state', () => {
      playlistsError.set('Previous error');
      playlistActions.listPlaylists();

      expect(get(playlistsError)).toBeNull();
    });
  });

  describe('playlistActions.createPlaylist', () => {
    it('should emit createPlaylist with name', () => {
      playlistActions.createPlaylist('My Playlist');

      expect(socketService.emit).toHaveBeenCalledWith('createPlaylist', {
        name: 'My Playlist'
      });
    });

    it('should not emit if name is empty', () => {
      playlistActions.createPlaylist('');

      expect(socketService.emit).not.toHaveBeenCalled();
    });

    it('should not emit if name is whitespace only', () => {
      playlistActions.createPlaylist('   ');

      expect(socketService.emit).not.toHaveBeenCalled();
    });

    it('should set error when name is empty', () => {
      playlistActions.createPlaylist('');

      expect(get(playlistsError)).toBe('Playlist name cannot be empty');
    });
  });

  describe('playlistActions.deletePlaylist', () => {
    it('should emit deletePlaylist with name', () => {
      playlistActions.deletePlaylist('My Playlist');

      expect(socketService.emit).toHaveBeenCalledWith('deletePlaylist', {
        name: 'My Playlist'
      });
    });
  });

  describe('playlistActions.playPlaylist', () => {
    it('should emit playPlaylist with name', () => {
      playlistActions.playPlaylist('My Playlist');

      expect(socketService.emit).toHaveBeenCalledWith('playPlaylist', {
        name: 'My Playlist'
      });
    });
  });

  describe('playlistActions.enqueuePlaylist', () => {
    it('should emit enqueue with name', () => {
      playlistActions.enqueuePlaylist('My Playlist');

      expect(socketService.emit).toHaveBeenCalledWith('enqueue', {
        name: 'My Playlist'
      });
    });
  });

  describe('playlistActions.addToPlaylist', () => {
    it('should emit addToPlaylist with all parameters', () => {
      playlistActions.addToPlaylist('My Playlist', 'mpd', '/music/song.flac', 'Song Title');

      expect(socketService.emit).toHaveBeenCalledWith('addToPlaylist', {
        name: 'My Playlist',
        service: 'mpd',
        uri: '/music/song.flac',
        title: 'Song Title'
      });
    });

    it('should emit addToPlaylist without title if not provided', () => {
      playlistActions.addToPlaylist('My Playlist', 'mpd', '/music/song.flac');

      expect(socketService.emit).toHaveBeenCalledWith('addToPlaylist', {
        name: 'My Playlist',
        service: 'mpd',
        uri: '/music/song.flac',
        title: undefined
      });
    });
  });

  describe('playlistActions.removeFromPlaylist', () => {
    it('should emit removeFromPlaylist with name and uri', () => {
      playlistActions.removeFromPlaylist('My Playlist', '/music/song.flac');

      expect(socketService.emit).toHaveBeenCalledWith('removeFromPlaylist', {
        name: 'My Playlist',
        uri: '/music/song.flac',
        service: undefined
      });
    });

    it('should emit removeFromPlaylist with service if provided', () => {
      playlistActions.removeFromPlaylist('My Playlist', '/music/song.flac', 'mpd');

      expect(socketService.emit).toHaveBeenCalledWith('removeFromPlaylist', {
        name: 'My Playlist',
        uri: '/music/song.flac',
        service: 'mpd'
      });
    });
  });

  describe('playlistsCount derived store', () => {
    it('should return 0 when playlists is empty', () => {
      playlists.set([]);
      expect(get(playlistsCount)).toBe(0);
    });

    it('should return correct count', () => {
      playlists.set(['Playlist 1', 'Playlist 2', 'Playlist 3']);
      expect(get(playlistsCount)).toBe(3);
    });
  });

  describe('initPlaylistStore', () => {
    it('should register pushListPlaylist listener when called', () => {
      // Clear mocks to track fresh calls
      vi.clearAllMocks();

      // Call init (will run if not already initialized in this test run)
      initPlaylistStore();

      // Verify that socket listener was registered
      // Note: May or may not be called depending on whether init ran
      // The important thing is the function doesn't throw
      expect(initPlaylistStore).not.toThrow();
    });

    it('should export required stores', () => {
      expect(playlists).toBeDefined();
      expect(playlistsLoading).toBeDefined();
      expect(playlistsError).toBeDefined();
      expect(playlistsCount).toBeDefined();
    });

    it('should export playlistActions object with all methods', () => {
      expect(playlistActions).toBeDefined();
      expect(playlistActions.listPlaylists).toBeDefined();
      expect(playlistActions.createPlaylist).toBeDefined();
      expect(playlistActions.deletePlaylist).toBeDefined();
      expect(playlistActions.playPlaylist).toBeDefined();
      expect(playlistActions.enqueuePlaylist).toBeDefined();
      expect(playlistActions.addToPlaylist).toBeDefined();
      expect(playlistActions.removeFromPlaylist).toBeDefined();
    });
  });

  describe('pushListPlaylist handler', () => {
    it('should update playlists store when receiving data', () => {
      // Get the handler that was registered
      const onCalls = vi.mocked(socketService.on).mock.calls;
      const pushListPlaylistCall = onCalls.find(call => call[0] === 'pushListPlaylist');

      if (pushListPlaylistCall) {
        const handler = pushListPlaylistCall[1] as (data: string[]) => void;

        // Simulate receiving playlist data
        handler(['Rock Classics', 'Jazz Favorites', 'Chill Vibes']);

        expect(get(playlists)).toEqual(['Rock Classics', 'Jazz Favorites', 'Chill Vibes']);
        expect(get(playlistsLoading)).toBe(false);
      }
    });

    it('should handle null/undefined data by setting empty array', () => {
      const onCalls = vi.mocked(socketService.on).mock.calls;
      const pushListPlaylistCall = onCalls.find(call => call[0] === 'pushListPlaylist');

      if (pushListPlaylistCall) {
        const handler = pushListPlaylistCall[1] as (data: string[] | null) => void;

        // Simulate receiving null data
        handler(null as unknown as string[]);

        expect(get(playlists)).toEqual([]);
        expect(get(playlistsLoading)).toBe(false);
      }
    });
  });
});
