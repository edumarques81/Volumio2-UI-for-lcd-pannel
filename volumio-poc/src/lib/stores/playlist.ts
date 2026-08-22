import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import type {
  PlaylistListResponse,
  AddToPlaylistRequest,
  RemoveFromPlaylistRequest,
  CreatePlaylistRequest,
  DeletePlaylistRequest,
  PlayPlaylistRequest,
} from '$lib/types/playlist';

// List of playlist names
export const playlists = writable<string[]>([]);

// Loading state
export const playlistsLoading = writable<boolean>(false);

// Error state
export const playlistsError = writable<string | null>(null);

// Number of playlists
export const playlistsCount = derived(playlists, ($playlists) => $playlists.length);

/**
 * Playlist actions
 */
export const playlistActions = {
  /**
   * Fetch list of all playlists
   */
  listPlaylists() {
    playlistsLoading.set(true);
    playlistsError.set(null);
    console.log('[Playlist] Fetching playlists...');
    socketService.emit('listPlaylist');
  },

  /**
   * Create a new playlist
   */
  createPlaylist(name: string) {
    if (!name.trim()) {
      playlistsError.set('Playlist name cannot be empty');
      return;
    }

    console.log('[Playlist] Creating:', name);
    socketService.emit('createPlaylist', { name } as CreatePlaylistRequest);
  },

  /**
   * Delete a playlist
   */
  deletePlaylist(name: string) {
    console.log('[Playlist] Deleting:', name);
    socketService.emit('deletePlaylist', { name } as DeletePlaylistRequest);
  },

  /**
   * Add item to a playlist
   */
  addToPlaylist(playlistName: string, service: string, uri: string, title?: string) {
    console.log('[Playlist] Adding to', playlistName, ':', title || uri);
    socketService.emit('addToPlaylist', {
      name: playlistName,
      service,
      uri,
      title,
    } as AddToPlaylistRequest);
  },

  /**
   * Remove item from a playlist
   */
  removeFromPlaylist(playlistName: string, uri: string, service?: string) {
    console.log('[Playlist] Removing from', playlistName, ':', uri);
    socketService.emit('removeFromPlaylist', {
      name: playlistName,
      uri,
      service,
    } as RemoveFromPlaylistRequest);
  },

  /**
   * Play a playlist
   */
  playPlaylist(name: string) {
    console.log('[Playlist] Playing:', name);
    socketService.emit('playPlaylist', { name } as PlayPlaylistRequest);
  },

  /**
   * Enqueue a playlist (add to queue without playing)
   */
  enqueuePlaylist(name: string) {
    console.log('[Playlist] Enqueueing:', name);
    socketService.emit('enqueue', { name });
  },
};

/**
 * Initialize playlist store - set up socket listeners
 */
let initialized = false;

export function initPlaylistStore() {
  if (initialized) return;
  initialized = true;

  console.log('[Playlist] Initializing store...');

  // Listen for playlist list response
  socketService.on<PlaylistListResponse>('pushListPlaylist', (data) => {
    console.log('[Playlist] Received playlists:', data);
    playlists.set(data || []);
    playlistsLoading.set(false);
  });

  // Listen for toast messages (confirmations for create/delete/add/remove)
  // Toast handling is done in player.ts, but we can also listen here for state updates

  // Fetch playlists on init
  playlistActions.listPlaylists();
}
