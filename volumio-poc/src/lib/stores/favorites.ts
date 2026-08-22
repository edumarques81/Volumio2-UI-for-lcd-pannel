import { writable } from 'svelte/store';
import { socketService } from '$lib/services/socket';

// Whether the current track is a favorite
export const isFavorite = writable<boolean>(false);

/**
 * Favorites actions
 */
export const favoritesActions = {
  /**
   * Add current track to favorites
   */
  addCurrentToFavorites() {
    console.log('[Favorites] Adding current track to favorites');
    socketService.emit('addToFavourites', {});
  },

  /**
   * Add a specific item to favorites
   */
  addToFavorites(service: string, uri: string, title?: string) {
    console.log('[Favorites] Adding to favorites:', title || uri);
    socketService.emit('addToFavourites', {
      service,
      uri,
      title,
    });
  },

  /**
   * Remove current track from favorites
   */
  removeCurrentFromFavorites() {
    console.log('[Favorites] Removing current track from favorites');
    socketService.emit('removeFromFavourites', {});
  },

  /**
   * Remove a specific item from favorites
   */
  removeFromFavorites(service: string, uri: string) {
    console.log('[Favorites] Removing from favorites:', uri);
    socketService.emit('removeFromFavourites', {
      service,
      uri,
    });
  },

  /**
   * Toggle favorite status for current track
   */
  toggleCurrentFavorite(currentlyFavorite: boolean) {
    if (currentlyFavorite) {
      this.removeCurrentFromFavorites();
    } else {
      this.addCurrentToFavorites();
    }
  },

  /**
   * Play all favorites
   */
  playFavorites() {
    console.log('[Favorites] Playing favorites');
    socketService.emit('playFavourites');
  },
};

/**
 * Initialize favorites store - set up socket listeners
 */
let initialized = false;

export function initFavoritesStore() {
  if (initialized) return;
  initialized = true;

  console.log('[Favorites] Initializing store...');

  // Listen for favorite status updates (sent when track changes)
  socketService.on<{ favourite: boolean }>('urifavourites', (data) => {
    console.log('[Favorites] Favorite status:', data.favourite);
    isFavorite.set(data.favourite);
  });
}
