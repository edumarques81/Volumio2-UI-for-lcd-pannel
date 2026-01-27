/**
 * Library store
 * MPD-driven library browsing for albums, artists, and radio
 * Replaces folder-based browsing with metadata-based queries
 */

import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import { fixVolumioAssetUrl } from '$lib/config';

// Types
export type Scope = 'all' | 'nas' | 'local' | 'usb';
export type SortOrder = 'alphabetical' | 'by_artist' | 'recently_added' | 'year';
export type SourceType = 'local' | 'usb' | 'nas' | 'streaming';

export interface Album {
  id: string;
  title: string;
  artist: string;
  uri: string;
  albumArt: string;
  trackCount: number;
  source: SourceType;
  year?: number;
  addedAt?: string;
}

export interface Artist {
  name: string;
  albumCount: number;
  albumArt?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  uri: string;
  trackNumber: number;
  duration: number;
  albumArt: string;
  source: SourceType;
}

export interface RadioStation {
  id: string;
  name: string;
  uri: string;
  icon?: string;
  genre?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface AlbumsResponse {
  albums: Album[];
  pagination: Pagination;
}

export interface ArtistsResponse {
  artists: Artist[];
  pagination: Pagination;
}

export interface ArtistAlbumsResponse {
  artist: string;
  albums: Album[];
  pagination: Pagination;
}

export interface AlbumTracksResponse {
  album: string;
  albumArtist: string;
  tracks: Track[];
  totalDuration: number;
  error?: string;
}

export interface RadioResponse {
  stations: RadioStation[];
  pagination: Pagination;
}

// Initialize flag
let initialized = false;

// Albums store state
export const libraryAlbums = writable<Album[]>([]);
export const libraryAlbumsLoading = writable<boolean>(false);
export const libraryAlbumsError = writable<string | null>(null);
export const libraryAlbumsPagination = writable<Pagination | null>(null);

// Artists store state
export const libraryArtists = writable<Artist[]>([]);
export const libraryArtistsLoading = writable<boolean>(false);
export const libraryArtistsError = writable<string | null>(null);
export const libraryArtistsPagination = writable<Pagination | null>(null);

// Artist albums store state
export const selectedArtist = writable<string | null>(null);
export const artistAlbums = writable<Album[]>([]);
export const artistAlbumsLoading = writable<boolean>(false);
export const artistAlbumsError = writable<string | null>(null);

// Album tracks store state
export const selectedLibraryAlbum = writable<Album | null>(null);
export const libraryAlbumTracks = writable<Track[]>([]);
export const libraryAlbumTracksLoading = writable<boolean>(false);
export const libraryAlbumTracksError = writable<string | null>(null);
export const libraryAlbumTotalDuration = writable<number>(0);

// Radio store state
export const radioStations = writable<RadioStation[]>([]);
export const radioLoading = writable<boolean>(false);
export const radioError = writable<string | null>(null);
export const radioPagination = writable<Pagination | null>(null);

// Current scope and sort preferences (persisted)
const storedScope = typeof localStorage !== 'undefined'
  ? localStorage.getItem('libraryScope') as Scope
  : null;
export const libraryScope = writable<Scope>(storedScope || 'all');

const storedSort = typeof localStorage !== 'undefined'
  ? localStorage.getItem('librarySort') as SortOrder
  : null;
export const librarySort = writable<SortOrder>(storedSort || 'alphabetical');

// Persist preferences
libraryScope.subscribe((scope) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('libraryScope', scope);
  }
});

librarySort.subscribe((sort) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('librarySort', sort);
  }
});

// Helper to fix album art URLs
function fixAlbumArt<T extends { albumArt?: string }>(item: T): T {
  if (item.albumArt) {
    return { ...item, albumArt: fixVolumioAssetUrl(item.albumArt) };
  }
  return item;
}

/**
 * Initialize library store - set up socket listeners
 */
export function initLibraryStore() {
  if (initialized) {
    console.log('[Library] Store already initialized, skipping');
    return;
  }
  initialized = true;
  console.log('[Library] Initializing store...');

  // Albums response
  socketService.on<AlbumsResponse>('pushLibraryAlbums', (data) => {
    console.log('[Library] Received pushLibraryAlbums:', data?.albums?.length, 'albums');
    if (data?.albums) {
      libraryAlbums.set(data.albums.map(fixAlbumArt));
      libraryAlbumsPagination.set(data.pagination);
    }
    libraryAlbumsLoading.set(false);
  });

  // Artists response
  socketService.on<ArtistsResponse>('pushLibraryArtists', (data) => {
    console.log('[Library] Received pushLibraryArtists:', data?.artists?.length, 'artists');
    if (data?.artists) {
      libraryArtists.set(data.artists.map(fixAlbumArt));
      libraryArtistsPagination.set(data.pagination);
    }
    libraryArtistsLoading.set(false);
  });

  // Artist albums response
  socketService.on<ArtistAlbumsResponse>('pushLibraryArtistAlbums', (data) => {
    console.log('[Library] Received pushLibraryArtistAlbums:', data?.artist, data?.albums?.length, 'albums');
    if (data?.albums) {
      artistAlbums.set(data.albums.map(fixAlbumArt));
    }
    artistAlbumsLoading.set(false);
  });

  // Album tracks response
  socketService.on<AlbumTracksResponse>('pushLibraryAlbumTracks', (data) => {
    console.log('[Library] Received pushLibraryAlbumTracks:', data?.album, data?.tracks?.length, 'tracks');
    if (data?.error) {
      libraryAlbumTracksError.set(data.error);
    } else if (data?.tracks) {
      libraryAlbumTracks.set(data.tracks.map(fixAlbumArt));
      libraryAlbumTotalDuration.set(data.totalDuration);
      libraryAlbumTracksError.set(null);
    }
    libraryAlbumTracksLoading.set(false);
  });

  // Radio stations response
  socketService.on<RadioResponse>('pushLibraryRadio', (data) => {
    console.log('[Library] Received pushLibraryRadio:', data?.stations?.length, 'stations');
    if (data?.stations) {
      radioStations.set(data.stations);
      radioPagination.set(data.pagination);
    }
    radioLoading.set(false);
  });
}

/**
 * Library actions
 */
export const libraryActions = {
  /**
   * Fetch albums with optional filtering
   */
  fetchAlbums(options: {
    scope?: Scope;
    sort?: SortOrder;
    query?: string;
    page?: number;
    limit?: number;
  } = {}) {
    libraryAlbumsLoading.set(true);
    libraryAlbumsError.set(null);

    const payload = {
      scope: options.scope || 'all',
      sort: options.sort || 'alphabetical',
      query: options.query || '',
      page: options.page || 1,
      limit: options.limit || 50
    };

    console.log('[Library] Fetching albums:', payload);
    socketService.emit('library:albums:list', payload);
  },

  /**
   * Fetch NAS albums
   */
  fetchNASAlbums(options: { sort?: SortOrder; query?: string; page?: number } = {}) {
    this.fetchAlbums({ ...options, scope: 'nas' });
  },

  /**
   * Fetch all albums (Music Library)
   */
  fetchAllAlbums(options: { sort?: SortOrder; query?: string; page?: number } = {}) {
    this.fetchAlbums({ ...options, scope: 'all' });
  },

  /**
   * Fetch artists
   */
  fetchArtists(options: { query?: string; page?: number; limit?: number } = {}) {
    libraryArtistsLoading.set(true);
    libraryArtistsError.set(null);

    const payload = {
      query: options.query || '',
      page: options.page || 1,
      limit: options.limit || 50
    };

    console.log('[Library] Fetching artists:', payload);
    socketService.emit('library:artists:list', payload);
  },

  /**
   * Fetch albums by artist
   */
  fetchArtistAlbums(artist: string, options: { sort?: SortOrder; page?: number } = {}) {
    artistAlbumsLoading.set(true);
    artistAlbumsError.set(null);
    selectedArtist.set(artist);

    const payload = {
      artist,
      sort: options.sort || 'alphabetical',
      page: options.page || 1,
      limit: 50
    };

    console.log('[Library] Fetching artist albums:', payload);
    socketService.emit('library:artist:albums', payload);
  },

  /**
   * Fetch tracks for an album
   */
  fetchAlbumTracks(album: Album) {
    libraryAlbumTracksLoading.set(true);
    libraryAlbumTracksError.set(null);
    selectedLibraryAlbum.set(album);

    const payload = {
      album: album.title,
      albumArtist: album.artist
    };

    console.log('[Library] Fetching album tracks:', payload);
    socketService.emit('library:album:tracks', payload);
  },

  /**
   * Fetch radio stations
   */
  fetchRadioStations(options: { query?: string; page?: number; limit?: number } = {}) {
    radioLoading.set(true);
    radioError.set(null);

    const payload = {
      query: options.query || '',
      page: options.page || 1,
      limit: options.limit || 50
    };

    console.log('[Library] Fetching radio stations:', payload);
    socketService.emit('library:radio:list', payload);
  },

  /**
   * Play a radio station
   */
  playRadioStation(station: RadioStation) {
    console.log('[Library] Playing radio station:', station.name, station.uri);
    socketService.emit('replaceAndPlay', {
      service: 'webradio',
      type: 'webradio',
      title: station.name,
      uri: station.uri
    });
  },

  /**
   * Play an album
   */
  playAlbum(album: Album) {
    console.log('[Library] Playing album:', album.title);
    socketService.emit('replaceAndPlay', {
      service: 'mpd',
      type: 'folder',
      title: album.title,
      uri: album.uri
    });
  },

  /**
   * Add album to queue
   */
  addAlbumToQueue(album: Album) {
    console.log('[Library] Adding album to queue:', album.title);
    socketService.emit('addToQueue', {
      service: 'mpd',
      type: 'folder',
      title: album.title,
      uri: album.uri
    });
  },

  /**
   * Play a track from an album
   */
  playTrack(track: Track) {
    console.log('[Library] Playing track:', track.title);
    socketService.emit('replaceAndPlay', {
      service: 'mpd',
      type: 'song',
      title: track.title,
      uri: track.uri
    });
  },

  /**
   * Clear selected album
   */
  clearSelectedAlbum() {
    selectedLibraryAlbum.set(null);
    libraryAlbumTracks.set([]);
    libraryAlbumTotalDuration.set(0);
  },

  /**
   * Clear selected artist
   */
  clearSelectedArtist() {
    selectedArtist.set(null);
    artistAlbums.set([]);
  },

  /**
   * Set sort order
   */
  setSort(sort: SortOrder) {
    librarySort.set(sort);
  },

  /**
   * Set scope
   */
  setScope(scope: Scope) {
    libraryScope.set(scope);
  }
};

// Derived stores for convenience
export const hasMoreAlbums = derived(libraryAlbumsPagination, ($pagination) =>
  $pagination?.hasMore ?? false
);

export const hasMoreArtists = derived(libraryArtistsPagination, ($pagination) =>
  $pagination?.hasMore ?? false
);

export const hasMoreRadio = derived(radioPagination, ($pagination) =>
  $pagination?.hasMore ?? false
);

export const totalAlbumsCount = derived(libraryAlbumsPagination, ($pagination) =>
  $pagination?.total ?? 0
);

export const totalArtistsCount = derived(libraryArtistsPagination, ($pagination) =>
  $pagination?.total ?? 0
);
