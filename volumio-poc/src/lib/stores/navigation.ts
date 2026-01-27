import { writable, derived } from 'svelte/store';

/**
 * Available views in the application
 */
export type ViewType =
  | 'home'
  | 'player'
  | 'browse'
  | 'queue'
  | 'settings'
  | 'localMusic'
  | 'audirvana'
  // MPD-driven library views
  | 'allAlbums'
  | 'nasAlbums'
  | 'artists'
  | 'artistAlbums'
  | 'albumDetail'
  | 'radio';

/**
 * Layout modes:
 * - 'compact': Player bar always visible at bottom, content above
 * - 'full': Full-screen views that replace the player bar
 */
export type LayoutMode = 'compact' | 'full';

/**
 * Browse navigation state for hierarchical browsing
 */
export interface BrowseLocation {
  uri: string;
  title: string;
}

// Current active view
export const currentView = writable<ViewType>('home');

// Layout mode preference
export const layoutMode = writable<LayoutMode>('full');

// Browse navigation stack (for back navigation)
export const browseStack = writable<BrowseLocation[]>([]);

// Current browse location
export const currentBrowseLocation = derived(browseStack, ($stack) => {
  return $stack.length > 0 ? $stack[$stack.length - 1] : null;
});

/**
 * Navigation actions
 */
export const navigationActions = {
  /**
   * Navigate to a view
   */
  goto(view: ViewType) {
    currentView.set(view);
  },

  /**
   * Navigate to home screen
   */
  goHome() {
    currentView.set('home');
  },

  /**
   * Navigate to player view
   */
  goToPlayer() {
    currentView.set('player');
  },

  /**
   * Navigate to browse view, optionally to a specific location
   */
  goToBrowse(uri?: string, title?: string) {
    if (uri && title) {
      browseStack.update(stack => [...stack, { uri, title }]);
    }
    currentView.set('browse');
  },

  /**
   * Navigate to queue view
   */
  goToQueue() {
    currentView.set('queue');
  },

  /**
   * Navigate to settings view
   */
  goToSettings() {
    currentView.set('settings');
  },

  /**
   * Navigate to local music view (local + USB only, no NAS/streaming)
   */
  goToLocalMusic() {
    currentView.set('localMusic');
  },

  /**
   * Navigate to Audirvana view
   */
  goToAudirvana() {
    currentView.set('audirvana');
  },

  /**
   * Navigate to all albums view (Music Library - MPD-driven)
   */
  goToAllAlbums() {
    currentView.set('allAlbums');
  },

  /**
   * Navigate to NAS albums view (MPD-driven)
   */
  goToNASAlbums() {
    currentView.set('nasAlbums');
  },

  /**
   * Navigate to artists view (MPD-driven)
   */
  goToArtists() {
    currentView.set('artists');
  },

  /**
   * Navigate to artist albums view (MPD-driven)
   */
  goToArtistAlbums() {
    currentView.set('artistAlbums');
  },

  /**
   * Navigate to album detail view (MPD-driven)
   */
  goToAlbumDetail() {
    currentView.set('albumDetail');
  },

  /**
   * Navigate to radio view (MPD-driven)
   */
  goToRadio() {
    currentView.set('radio');
  },

  /**
   * Go back in browse navigation
   */
  browseBack() {
    browseStack.update(stack => {
      if (stack.length > 1) {
        return stack.slice(0, -1);
      }
      return stack;
    });
  },

  /**
   * Reset browse to root - use empty URI to show all sources
   * Empty URI triggers getBrowseSources which returns top-level items
   * (Music Library, Favourites, Playlists, etc.)
   */
  browseRoot() {
    browseStack.set([{ uri: '', title: 'Browse' }]);
  },

  /**
   * Push a new browse location
   */
  browseTo(uri: string, title: string) {
    browseStack.update(stack => [...stack, { uri, title }]);
  },

  /**
   * Toggle layout mode
   */
  toggleLayoutMode() {
    layoutMode.update(mode => mode === 'compact' ? 'full' : 'compact');
  },

  /**
   * Set layout mode
   */
  setLayoutMode(mode: LayoutMode) {
    layoutMode.set(mode);
  }
};

// Initialize browse stack with root
navigationActions.browseRoot();
