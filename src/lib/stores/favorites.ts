import { writable } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import type { BrowseItem, BrowseResponse } from '$lib/stores/browse';

// ─── Stores ─────────────────────────────────────────────────────────────────

/** Whether the currently playing track is a favourite */
export const isFavorite = writable<boolean>(false);

/** The list of favourited items */
export const favoritesList = writable<BrowseItem[]>([]);

/** Loading state while fetching the list */
export const favoritesLoading = writable<boolean>(false);

/** Error while fetching */
export const favoritesError = writable<string | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeFavItem(raw: BrowseItem): BrowseItem {
  return {
    ...raw,
    title: raw.title || raw.name || 'Unknown',
  };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

let pendingFetch = false; // flag so we only capture the response we triggered

export const favoritesActions = {
  /** Fetch the full favourites list from Volumio */
  fetchFavorites() {
    pendingFetch = true;
    favoritesLoading.set(true);
    favoritesError.set(null);
    socketService.emit('browseLibrary', { uri: 'favourites' });
  },

  /** Play a single favourite item */
  playItem(item: BrowseItem) {
    socketService.emit('replaceAndPlay', {
      service: item.service,
      type: item.type,
      title: item.title,
      uri: item.uri,
    });
  },

  /** Add item to the current queue */
  addItemToQueue(item: BrowseItem) {
    socketService.emit('addToQueue', {
      service: item.service,
      type: item.type,
      title: item.title,
      uri: item.uri,
    });
  },

  /** Play all favourites from the beginning */
  playAll() {
    socketService.emit('playFavourites');
  },

  /** Add current track to favourites */
  addCurrentToFavorites() {
    socketService.emit('addToFavourites', {});
  },

  /** Add a specific item to favourites */
  addToFavorites(service: string, uri: string, title?: string) {
    socketService.emit('addToFavourites', { service, uri, title });
  },

  /** Remove a specific item from favourites (optimistic update) */
  removeFavorite(item: BrowseItem) {
    socketService.emit('removeFromFavourites', {
      service: item.service,
      uri: item.uri,
    });
    // Optimistic: remove from the local list immediately
    favoritesList.update((list) => list.filter((f) => f.uri !== item.uri));
  },

  /** Remove current track from favourites */
  removeCurrentFromFavorites() {
    socketService.emit('removeFromFavourites', {});
  },

  /** Toggle current track's favourite status */
  toggleCurrentFavorite(currentlyFavorite: boolean) {
    if (currentlyFavorite) this.removeCurrentFromFavorites();
    else this.addCurrentToFavorites();
  },
};

// ─── Init ────────────────────────────────────────────────────────────────────

let initialized = false;

export function initFavoritesStore() {
  if (initialized) return;
  initialized = true;

  /** Current track favourite status */
  socketService.on<{ favourite: boolean }>('urifavourites', (data) => {
    isFavorite.set(data.favourite);
  });

  /** Capture browseLibrary response only when we triggered it */
  socketService.on<BrowseResponse>('pushBrowseLibrary', (data) => {
    if (!pendingFetch) return;
    pendingFetch = false;

    favoritesLoading.set(false);

    try {
      const lists = data?.navigation?.lists ?? [];
      // Flatten all items from all lists
      const items: BrowseItem[] = lists.flatMap((list) =>
        (list.items ?? []).map(normalizeFavItem)
      );
      favoritesList.set(items);
    } catch {
      favoritesError.set('Failed to load favourites');
      favoritesList.set([]);
    }
  });
}
