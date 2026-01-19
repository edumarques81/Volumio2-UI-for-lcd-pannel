import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * Browse item from Volumio API
 */
export interface BrowseItem {
  service: string;
  type: string;
  title: string;
  artist?: string;
  album?: string;
  uri: string;
  albumart?: string;
  icon?: string;
  tracknumber?: number;
  duration?: number;
}

/**
 * Browse list response from Volumio
 */
export interface BrowseList {
  title: string;
  icon?: string;
  availableListViews: string[];
  items: BrowseItem[];
}

/**
 * Browse response from Volumio
 */
export interface BrowseResponse {
  navigation: {
    lists: BrowseList[];
    prev?: {
      uri: string;
    };
  };
}

// Current browse data
export const browseData = writable<BrowseResponse | null>(null);

// Loading state
export const browseLoading = writable<boolean>(false);

// Error state
export const browseError = writable<string | null>(null);

// Flattened items from all lists
export const browseItems = derived(browseData, ($data) => {
  if (!$data?.navigation?.lists) return [];
  return $data.navigation.lists.flatMap(list => list.items);
});

// Lists with their titles
export const browseLists = derived(browseData, ($data) => {
  if (!$data?.navigation?.lists) return [];
  return $data.navigation.lists;
});

/**
 * Browse actions
 */
export const browseActions = {
  /**
   * Browse to a URI
   */
  browse(uri: string = '') {
    browseLoading.set(true);
    browseError.set(null);

    console.log('[Browse] Fetching:', uri || 'root');
    socketService.emit('browseLibrary', { uri });
  },

  /**
   * Play an item
   */
  play(item: BrowseItem) {
    console.log('[Browse] Playing:', item.title);
    socketService.emit('replaceAndPlay', {
      service: item.service,
      type: item.type,
      title: item.title,
      uri: item.uri
    });
  },

  /**
   * Add item to queue
   */
  addToQueue(item: BrowseItem) {
    console.log('[Browse] Adding to queue:', item.title);
    socketService.emit('addToQueue', {
      service: item.service,
      type: item.type,
      title: item.title,
      uri: item.uri
    });
  },

  /**
   * Add item to playlist
   */
  addToPlaylist(item: BrowseItem, playlistName: string) {
    console.log('[Browse] Adding to playlist:', item.title, '->', playlistName);
    socketService.emit('addToPlaylist', {
      name: playlistName,
      service: item.service,
      uri: item.uri
    });
  },

  /**
   * Search the library
   */
  search(query: string) {
    if (!query.trim()) return;

    browseLoading.set(true);
    browseError.set(null);

    console.log('[Browse] Searching:', query);
    socketService.emit('search', { value: query });
  }
};

/**
 * Initialize browse store - set up socket listeners
 */
export function initBrowseStore() {
  // Listen for browse results
  socketService.on<BrowseResponse>('pushBrowseLibrary', (data) => {
    console.log('[Browse] Received data:', data);
    browseData.set(data);
    browseLoading.set(false);
  });

  // Listen for search results (same format as browse)
  socketService.on<BrowseResponse>('pushBrowseLibrary', (data) => {
    browseData.set(data);
    browseLoading.set(false);
  });

  // Fetch root on init
  browseActions.browse('');
}
