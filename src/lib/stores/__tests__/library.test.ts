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
vi.mock('$lib/services/socket', () => ({
  socketService: {
    on: vi.fn(),
    emit: vi.fn()
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
        sort: 'alphabetical',
        query: '',
        page: 1,
        limit: 50
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
        limit: 50
      });
    });

    it('should emit library:albums:list with query', () => {
      libraryActions.fetchAlbums({ query: 'jazz' });

      expect(socketService.emit).toHaveBeenCalledWith('library:albums:list', {
        scope: 'all',
        sort: 'alphabetical',
        query: 'jazz',
        page: 1,
        limit: 50
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
        limit: 50
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
        albumArtist: 'Miles Davis'
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
});
