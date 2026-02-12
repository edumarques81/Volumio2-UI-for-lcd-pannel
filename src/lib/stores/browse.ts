import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import { fixVolumioAssetUrl } from '$lib/config';

/**
 * Browse item from Volumio API
 */
export interface BrowseItem {
  service?: string;
  type?: string;
  title?: string;
  name?: string;  // Root sources use 'name' instead of 'title'
  artist?: string;
  album?: string;
  uri: string;
  albumart?: string;
  icon?: string;
  tracknumber?: number;
  duration?: number;
  plugin_type?: string;
  plugin_name?: string;
}

/**
 * Browse list response from Volumio
 * Note: Volumio has two response structures:
 * 1. Root/sources: lists array contains source objects directly (no items array)
 * 2. Folders: lists array contains objects with items array
 */
export interface BrowseList {
  title?: string;
  name?: string;  // Root sources use 'name' instead of 'title'
  icon?: string;
  albumart?: string;
  uri?: string;
  availableListViews?: string[];
  items?: BrowseItem[];
  plugin_type?: string;
  plugin_name?: string;
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

// View mode type
export type BrowseViewMode = 'list' | 'grid';

// Initialization flag
let initialized = false;

// Current browse data
export const browseData = writable<BrowseResponse | null>(null);

// Browse sources (top-level items like Music Library, Favourites, Playlists)
export const browseSources = writable<BrowseItem[]>([]);

// Loading state
export const browseLoading = writable<boolean>(false);

// Error state
export const browseError = writable<string | null>(null);

// View mode - persisted to localStorage
const storedViewMode = typeof localStorage !== 'undefined'
  ? localStorage.getItem('browseViewMode') as BrowseViewMode
  : null;
export const browseViewMode = writable<BrowseViewMode>(storedViewMode || 'list');

// Persist view mode changes to localStorage
browseViewMode.subscribe((mode) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('browseViewMode', mode);
  }
});


/**
 * Check if a list element is a source (root browse) vs a container with items
 * Root sources have 'uri' directly on the list element, no 'items' array
 */
function isSourceElement(list: BrowseList): boolean {
  return !!list.uri && !list.items;
}

/**
 * Normalize browse item - handle 'name' vs 'title' and other variations
 */
function normalizeBrowseItem(item: BrowseItem | BrowseList): BrowseItem {
  const asItem = item as BrowseItem;
  const asList = item as BrowseList;
  return {
    ...item,
    title: item.title || asList.name || '',
    type: asItem.type || 'folder',
    service: asItem.service || asList.plugin_name || '',
    albumart: fixVolumioAssetUrl(item.albumart)
  } as BrowseItem;
}

/**
 * Process browse response to fix album art URLs and normalize structure
 * Handles both root browse (sources are list elements) and folder browse (items inside lists)
 */
function processBrowseResponse(data: BrowseResponse): BrowseResponse {
  if (!data?.navigation?.lists) return data;

  return {
    ...data,
    navigation: {
      ...data.navigation,
      lists: data.navigation.lists.map(list => ({
        ...list,
        albumart: fixVolumioAssetUrl(list.albumart),
        items: list.items ? list.items.map(normalizeBrowseItem) : undefined
      }))
    }
  };
}

/**
 * Flattened items from all lists
 * Handles both response structures:
 * - Root browse: lists ARE the items (sources)
 * - Folder browse: lists contain items arrays
 */
export const browseItems = derived(browseData, ($data) => {
  if (!$data?.navigation?.lists) return [];

  const lists = $data.navigation.lists;

  // Check if this is a root browse (sources) or folder browse (items)
  // Root browse: first list element has 'uri' but no 'items'
  const isRootBrowse = lists.length > 0 && isSourceElement(lists[0]);

  if (isRootBrowse) {
    // Root browse: convert list elements to items
    return lists.map(normalizeBrowseItem);
  } else {
    // Folder browse: flatten items from all lists
    return lists.flatMap(list => list.items || []);
  }
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
   * Toggle between list and grid view
   */
  toggleViewMode() {
    browseViewMode.update((mode) => (mode === 'list' ? 'grid' : 'list'));
  },

  /**
   * Set view mode explicitly
   */
  setViewMode(mode: BrowseViewMode) {
    browseViewMode.set(mode);
  },

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
 * Note: Does NOT fetch initial data - let components trigger browse when they mount
 * (which happens after socket is connected, avoiding race conditions)
 */
export function initBrowseStore() {
  if (initialized) {
    console.log('[Browse] Store already initialized, skipping');
    return;
  }
  initialized = true;
  console.log('[Browse] Initializing store...');

  // Listen for browse results
  socketService.on<BrowseResponse>('pushBrowseLibrary', (data) => {
    console.log('[Browse] Received pushBrowseLibrary:', data?.navigation?.lists?.length, 'lists');
    // Process response to fix album art URLs
    const processedData = processBrowseResponse(data);
    browseData.set(processedData);
    browseLoading.set(false);
  });

  // Listen for browse sources (root level items)
  socketService.on<BrowseItem[]>('pushBrowseSources', (sources) => {
    console.log('[Browse] Received pushBrowseSources:', sources?.length, 'sources');
    if (sources && Array.isArray(sources)) {
      const normalizedSources = sources.map(source => normalizeBrowseItem(source));
      browseSources.set(normalizedSources);
    }
    browseLoading.set(false);
  });

  // Request browse sources on init (these are the top-level items like Music Library, Favourites, etc.)
  console.log('[Browse] Requesting initial browse sources...');
  socketService.emit('getBrowseSources');
}
