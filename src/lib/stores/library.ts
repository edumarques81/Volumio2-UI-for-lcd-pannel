/**
 * Library store
 * MPD-driven library browsing for albums, artists, and radio
 * Replaces folder-based browsing with metadata-based queries
 */

import { writable, derived, get } from 'svelte/store';
import { socketService, connectionState } from '$lib/services/socket';
import { fixVolumioAssetUrl } from '$lib/config';
import { viewActions } from '$lib/stores/navigation';
import { playerActions } from '$lib/stores/player';

/**
 * Emit a socket event only when the socket is connected.
 * If not connected yet, waits for the 'connected' state before emitting.
 * Also re-emits on reconnect if a reconnect handler is provided.
 */
function emitWhenConnected(event: string, data?: any): void {
  if (socketService.isConnected) {
    socketService.emit(event, data);
    return;
  }

  // Wait for connection
  const unsubscribe = connectionState.subscribe((state) => {
    if (state === 'connected') {
      // Use setTimeout to ensure we unsubscribe before emitting (avoids re-entrant issues)
      setTimeout(() => {
        unsubscribe();
        socketService.emit(event, data);
      }, 0);
    }
  });
}

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
  quality?: string;     // e.g. "192kHz/24bit FLAC"
  trackType?: string;   // e.g. "flac", "dsf"
  genre?: string;       // e.g. "Ambient / Post-Rock" — backfilled from MPD's genre tag
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

export interface CacheStatus {
  lastUpdated: string;
  albumCount: number;
  artistCount: number;
  trackCount: number;
  artworkCached: number;
  artworkMissing: number;
  radioCount: number;
  isBuilding: boolean;
  buildProgress: number;
  schemaVersion: string;
}

export interface CacheUpdatedEvent {
  timestamp: string;
  albumCount: number;
  artistCount: number;
  trackCount: number;
  updateDuration: number;
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

// ----- Library page kind (M2.C) ---------------------------------------------
// Drives the renderer switch inside LibraryView. Add 'qobuz' here when M3.A
// lands; the wrap-modulo cyclePageKind handles arbitrary list lengths.
export const LIBRARY_PAGE_KINDS = ['albums', 'artists'] as const;
export type LibraryPageKind = typeof LIBRARY_PAGE_KINDS[number];
export const libraryPageKind = writable<LibraryPageKind>('albums');

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

// Cache status store state
export const libraryCacheStatus = writable<CacheStatus | null>(null);
export const libraryCacheLoading = writable<boolean>(false);
export const libraryCacheBuilding = writable<boolean>(false);

// Replace-queue-and-play reentry guard. Each call increments replaceRequestId;
// any older in-flight subscription bails out via myId !== replaceRequestId.
// currentReplaceUnsub is module-scoped so a second tap also tears down the
// first subscription immediately.
let currentReplaceUnsub: (() => void) | null = null;
let replaceRequestId = 0;

/**
 * Current album index for the redesign Library screen. Survives navigating
 * away to Player and back (spec decision 73). Reset to 0 when albums refetch.
 */
export const currentLibraryIndex = writable<number>(0);

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
      // Reset Library screen index whenever the album list refreshes.
      currentLibraryIndex.set(0);
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

  // Cache status response
  socketService.on<CacheStatus>('pushLibraryCacheStatus', (data) => {
    console.log('[Library] Received pushLibraryCacheStatus:', data);
    if (data) {
      libraryCacheStatus.set(data);
      libraryCacheBuilding.set(data.isBuilding);
    }
    libraryCacheLoading.set(false);
  });

  // Cache updated event (broadcast when cache rebuild completes)
  socketService.on<CacheUpdatedEvent>('library:cache:updated', (data) => {
    console.log('[Library] Cache updated:', data);
    if (data) {
      libraryCacheBuilding.set(false);
      // Refresh the cache status after update
      libraryActions.getCacheStatus();
    }
  });

  // Re-fetch library data on reconnect (socket may have dropped the initial fetch)
  let wasConnected = false;
  connectionState.subscribe((state) => {
    if (state === 'connected') {
      if (wasConnected) {
        // This is a reconnect — re-fetch albums if the store is empty
        const currentAlbums = get(libraryAlbums);
        if (currentAlbums.length === 0) {
          console.log('[Library] Reconnected with empty albums, re-fetching...');
          libraryActions.fetchAlbums();
        }
      }
      wasConnected = true;
    }
  });

  // Implicitly clear any active artist filter when the user swipes back to
  // ArtistsPage. The ✕ button on MetadataBlock is the explicit path; this
  // subscriber catches the "I'm leaving the filtered context" case.
  libraryPageKind.subscribe((kind) => {
    if (kind === 'artists' && get(selectedArtist) !== null) {
      libraryActions.clearArtistFilter();
    }
  });

  // Kick off initial albums fetch. Without this, a fresh boot — including
  // the post-`pushClientsReload` `location.reload()` triggered by the
  // refresh-button flow — registers listeners but never requests data,
  // leaving libraryAlbums stuck at []. emitWhenConnected handles the
  // not-yet-connected case by queueing until 'connected'.
  libraryActions.fetchAlbums();
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
      sort: options.sort || 'by_artist',
      query: options.query || '',
      page: options.page || 1,
      limit: options.limit || 200
    };

    console.log('[Library] Fetching albums:', payload);
    emitWhenConnected('library:albums:list', payload);
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
    emitWhenConnected('library:artists:list', payload);
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

    const payload: Record<string, string> = {
      album: album.title,
      albumArtist: album.artist
    };
    // Include URI to scope tracks to this specific folder (avoids mixing quality versions)
    if (album.uri) {
      payload.uri = album.uri;
    }

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
    emitWhenConnected('library:radio:list', payload);
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
   * Replace the queue with this album's tracks, auto-play from track 1, then
   * navigate back to Player. Used by the Library screen tap-to-play flow
   * (spec decision 50).
   *
   * Reentry-safe: rapid double-tap (or tapping a different album mid-fetch)
   * cancels the prior in-flight subscription via replaceRequestId so old
   * tracks never dispatch. Skips Svelte's synchronous initial-value emission
   * via firstFire to avoid a stale-on-subscribe dispatch when the store
   * already holds tracks from a prior view that happen to match by title.
   */
  replaceQueueAndPlay(album: Album) {
    const myId = ++replaceRequestId;
    if (currentReplaceUnsub) {
      currentReplaceUnsub();
      currentReplaceUnsub = null;
    }
    libraryActions.fetchAlbumTracks(album);
    let firstFire = true;
    currentReplaceUnsub = libraryAlbumTracks.subscribe((tracks) => {
      if (firstFire) { firstFire = false; return; }
      if (myId !== replaceRequestId) return;
      if (!tracks || tracks.length === 0) return;
      const sel = get(selectedLibraryAlbum);
      if (!sel || sel.title !== album.title) return;
      setTimeout(() => {
        currentReplaceUnsub?.();
        currentReplaceUnsub = null;
      }, 0);
      const uris = tracks.map((t) => t.uri).filter(Boolean);
      socketService.emit('clearQueue');
      socketService.emit('addToQueue', { uri: uris });
      socketService.emit('play', { value: 0 });
      viewActions.goToPlayer();
    });
  },

  /**
   * Play an album
   *
   * Optimistically flips the player store to the new album metadata before
   * the socket emit so the UI shows the new title/artist/cover the moment
   * the user taps — defending against a one-frame flash of the previous
   * album while we wait for the backend's pushState round-trip. The next
   * pushState bypasses the change-gate and overwrites with the
   * authoritative state (see `playerActions.optimisticAlbumStart`).
   */
  playAlbum(album: Album) {
    console.log('[Library] Playing album:', album.title);
    playerActions.optimisticAlbumStart(album);
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
   * Play album next (insert after current track)
   */
  playAlbumNext(album: Album) {
    console.log('[Library] Playing album next:', album.title);
    socketService.emit('playNext', {
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
   * Add track to queue (at end)
   */
  addTrackToQueue(track: Track) {
    console.log('[Library] Adding track to queue:', track.title);
    socketService.emit('addToQueue', {
      service: 'mpd',
      type: 'song',
      title: track.title,
      uri: track.uri
    });
  },

  /**
   * Play track next (insert after current track)
   */
  playTrackNext(track: Track) {
    console.log('[Library] Playing track next:', track.title);
    socketService.emit('playNext', {
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
   * Cycle the library page kind by `delta` (+1 forward, -1 backward).
   * Wrap-modulo over LIBRARY_PAGE_KINDS so adding M3.A's 'qobuz' is
   * a single-character change.
   */
  cyclePageKind(delta: 1 | -1) {
    const kinds = LIBRARY_PAGE_KINDS;
    const len = kinds.length;
    libraryPageKind.update((k) => {
      const idx = kinds.indexOf(k);
      return kinds[((idx + delta) % len + len) % len];
    });
  },

  /**
   * Clear the active per-artist filter. Called when the user taps the
   * inline ✕ on MetadataBlock OR implicitly when the page-kind subscriber
   * fires on 'albums' → 'artists'.
   */
  clearArtistFilter() {
    selectedArtist.set(null);
    artistAlbums.set([]);
    currentLibraryIndex.set(0);
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
  },

  /**
   * Get cache status
   */
  getCacheStatus() {
    libraryCacheLoading.set(true);
    console.log('[Library] Fetching cache status');
    socketService.emit('library:cache:status', {});
  },

  /**
   * Trigger cache rebuild
   */
  rebuildCache() {
    libraryCacheBuilding.set(true);
    console.log('[Library] Triggering cache rebuild');
    socketService.emit('library:cache:rebuild', {});
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

// Cache status derived stores
export const cacheAlbumCount = derived(libraryCacheStatus, ($status) =>
  $status?.albumCount ?? 0
);

export const cacheArtistCount = derived(libraryCacheStatus, ($status) =>
  $status?.artistCount ?? 0
);

export const cacheLastUpdated = derived(libraryCacheStatus, ($status) =>
  $status?.lastUpdated ?? null
);
