/**
 * Local Music store
 * Manages local-only music (local disk + USB), excludes NAS and streaming sources
 * Tracks playback history with play origin (manual vs album context)
 */

import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import { fixVolumioAssetUrl } from '$lib/config';

// Types
export type SourceType = 'local' | 'usb' | 'nas' | 'mounted' | 'streaming' | 'unknown';
export type PlayOrigin = 'manual_track' | 'album_context' | 'autoplay_next' | 'queue';
export type AlbumSortOrder = 'recently_added' | 'alphabetical' | 'by_artist';
export type TrackSortOrder = 'last_played' | 'alphabetical' | 'most_played';

export interface LocalAlbum {
  id: string;
  title: string;
  artist: string;
  uri: string;
  albumArt: string;
  trackCount: number;
  source: SourceType;
  addedAt?: string;
}

export interface AlbumTrack {
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

export interface PlayHistoryEntry {
  id: string;
  trackURI: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  source: SourceType;
  origin: PlayOrigin;
  playedAt: string;
  playCount: number;
}

export interface LocalAlbumsResponse {
  albums: LocalAlbum[];
  totalCount: number;
  filteredOut: number;
  error?: string;
}

export interface LastPlayedResponse {
  tracks: PlayHistoryEntry[];
  totalCount: number;
  error?: string;
}

export interface AlbumTracksResponse {
  tracks: AlbumTrack[];
  totalCount: number;
  albumUri: string;
  error?: string;
}

// Store state
export const localAlbums = writable<LocalAlbum[]>([]);
export const lastPlayedTracks = writable<PlayHistoryEntry[]>([]);
export const localMusicLoading = writable<boolean>(false);
export const localMusicError = writable<string | null>(null);

// Album detail state
export const selectedAlbum = writable<LocalAlbum | null>(null);
export const albumTracks = writable<AlbumTrack[]>([]);
export const albumTracksLoading = writable<boolean>(false);

// Album sort preference
const storedAlbumSort = typeof localStorage !== 'undefined'
  ? localStorage.getItem('localMusicAlbumSort') as AlbumSortOrder
  : null;
export const albumSortOrder = writable<AlbumSortOrder>(storedAlbumSort || 'alphabetical');

// Track sort preference
const storedTrackSort = typeof localStorage !== 'undefined'
  ? localStorage.getItem('localMusicTrackSort') as TrackSortOrder
  : null;
export const trackSortOrder = writable<TrackSortOrder>(storedTrackSort || 'last_played');

// Persist sort preferences
albumSortOrder.subscribe((sort) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('localMusicAlbumSort', sort);
  }
});

trackSortOrder.subscribe((sort) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('localMusicTrackSort', sort);
  }
});

// Derived stores
export const hasLocalAlbums = derived(localAlbums, ($albums) => $albums.length > 0);
export const hasLastPlayed = derived(lastPlayedTracks, ($tracks) => $tracks.length > 0);

// Process album art URLs
function processAlbum(album: LocalAlbum): LocalAlbum {
  return {
    ...album,
    albumArt: fixVolumioAssetUrl(album.albumArt)
  };
}

function processTrack(track: PlayHistoryEntry): PlayHistoryEntry {
  return {
    ...track,
    albumArt: fixVolumioAssetUrl(track.albumArt)
  };
}

function processAlbumTrack(track: AlbumTrack): AlbumTrack {
  return {
    ...track,
    albumArt: fixVolumioAssetUrl(track.albumArt)
  };
}

// Socket event listeners
let listenersInitialized = false;

export function initLocalMusicListeners(): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  // Listen for local albums response
  socketService.on('pushLocalAlbums', (response: LocalAlbumsResponse) => {
    console.log('[LocalMusic] pushLocalAlbums:', response?.albums?.length, 'albums');
    localMusicLoading.set(false);

    if (response.error) {
      localMusicError.set(response.error);
      return;
    }

    const processedAlbums = (response.albums || []).map(processAlbum);
    localAlbums.set(processedAlbums);
    localMusicError.set(null);
  });

  // Listen for last played tracks response
  socketService.on('pushLastPlayedTracks', (response: LastPlayedResponse) => {
    console.log('[LocalMusic] pushLastPlayedTracks:', response?.tracks?.length, 'tracks');
    localMusicLoading.set(false);

    if (response.error) {
      localMusicError.set(response.error);
      return;
    }

    const processedTracks = (response.tracks || []).map(processTrack);
    lastPlayedTracks.set(processedTracks);
    localMusicError.set(null);
  });

  // Listen for history cleared confirmation
  socketService.on('pushHistoryCleared', (result: { success: boolean }) => {
    console.log('[LocalMusic] pushHistoryCleared:', result);
    if (result.success) {
      lastPlayedTracks.set([]);
    }
  });

  // Listen for album tracks response
  socketService.on('pushAlbumTracks', (response: AlbumTracksResponse) => {
    console.log('[LocalMusic] pushAlbumTracks:', response?.tracks?.length, 'tracks');
    albumTracksLoading.set(false);

    if (response.error) {
      localMusicError.set(response.error);
      return;
    }

    const processedTracks = (response.tracks || []).map(processAlbumTrack);
    albumTracks.set(processedTracks);
    localMusicError.set(null);
  });
}

// Actions
export const localMusicActions = {
  /**
   * Fetch local albums (local disk + USB only)
   */
  fetchAlbums: (sort?: AlbumSortOrder, query?: string, limit?: number): void => {
    console.log('[LocalMusic] Fetching albums...');
    localMusicLoading.set(true);
    localMusicError.set(null);

    const params: Record<string, unknown> = {};
    if (sort) params.sort = sort;
    if (query) params.query = query;
    if (limit) params.limit = limit;

    socketService.emit('getLocalAlbums', params);
  },

  /**
   * Fetch last played tracks (manual plays from local sources)
   */
  fetchLastPlayed: (sort?: TrackSortOrder, limit?: number): void => {
    console.log('[LocalMusic] Fetching last played...');
    localMusicLoading.set(true);
    localMusicError.set(null);

    const params: Record<string, unknown> = {};
    if (sort) params.sort = sort;
    if (limit) params.limit = limit;

    socketService.emit('getLastPlayedTracks', params);
  },

  /**
   * Record a track play event
   */
  recordPlay: (
    uri: string,
    title: string,
    artist: string,
    album: string,
    albumArt: string,
    origin: PlayOrigin = 'manual_track'
  ): void => {
    console.log('[LocalMusic] Recording play:', title, 'origin:', origin);
    socketService.emit('recordTrackPlay', {
      uri,
      title,
      artist,
      album,
      albumArt,
      origin
    });
  },

  /**
   * Play an album from local music
   */
  playAlbum: (album: LocalAlbum): void => {
    console.log('[LocalMusic] Playing album:', album.title);
    socketService.emit('replaceAndPlay', {
      uri: album.uri,
      title: album.title,
      artist: album.artist,
      albumart: album.albumArt,
      origin: 'album_context'
    });
  },

  /**
   * Select an album to view its tracks
   */
  selectAlbum: (album: LocalAlbum): void => {
    console.log('[LocalMusic] Selecting album:', album.title);
    selectedAlbum.set(album);
    albumTracksLoading.set(true);
    localMusicError.set(null);
    socketService.emit('getAlbumTracks', { albumUri: album.uri });
  },

  /**
   * Deselect album (go back to album list)
   */
  deselectAlbum: (): void => {
    console.log('[LocalMusic] Deselecting album');
    selectedAlbum.set(null);
    albumTracks.set([]);
  },

  /**
   * Play a specific track from an album
   */
  playAlbumTrack: (track: AlbumTrack): void => {
    console.log('[LocalMusic] Playing track:', track.title);
    socketService.emit('replaceAndPlay', {
      uri: track.uri,
      title: track.title,
      artist: track.artist,
      album: track.album,
      albumart: track.albumArt,
      origin: 'manual_track'
    });
  },

  /**
   * Play a track from history
   */
  playTrack: (track: PlayHistoryEntry): void => {
    console.log('[LocalMusic] Playing track:', track.title);
    socketService.emit('replaceAndPlay', {
      uri: track.trackURI,
      title: track.title,
      artist: track.artist,
      album: track.album,
      albumart: track.albumArt,
      origin: 'manual_track'
    });
  },

  /**
   * Set album sort order and refetch
   */
  setAlbumSort: (sort: AlbumSortOrder): void => {
    albumSortOrder.set(sort);
    localMusicActions.fetchAlbums(sort);
  },

  /**
   * Set track sort order and refetch
   */
  setTrackSort: (sort: TrackSortOrder): void => {
    trackSortOrder.set(sort);
    localMusicActions.fetchLastPlayed(sort);
  },

  /**
   * Clear playback history
   */
  clearHistory: (): void => {
    console.log('[LocalMusic] Clearing history');
    socketService.emit('clearHistory');
  },

  /**
   * Clear error state
   */
  clearError: (): void => {
    localMusicError.set(null);
  },

  /**
   * Refresh all data
   */
  refresh: (): void => {
    let currentAlbumSort: AlbumSortOrder = 'alphabetical';
    let currentTrackSort: TrackSortOrder = 'last_played';

    albumSortOrder.subscribe(s => currentAlbumSort = s)();
    trackSortOrder.subscribe(s => currentTrackSort = s)();

    localMusicActions.fetchAlbums(currentAlbumSort);
    localMusicActions.fetchLastPlayed(currentTrackSort);
  }
};

// Cleanup function
export function cleanupLocalMusicListeners(): void {
  socketService.off('pushLocalAlbums');
  socketService.off('pushLastPlayedTracks');
  socketService.off('pushHistoryCleared');
  socketService.off('pushAlbumTracks');
  listenersInitialized = false;
}
