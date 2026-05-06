import { writable, derived } from 'svelte/store';

/**
 * Available views in the application
 */
export type ViewType = 'player' | 'library' | 'queue';

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
export const currentView = writable<ViewType>('player');

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
   * Navigate to player view
   */
  goToPlayer() {
    currentView.set('player');
  },

  /**
   * Navigate to library view
   */
  goToLibrary() {
    currentView.set('library');
  },

  /**
   * Navigate to queue view
   */
  goToQueue() {
    currentView.set('queue');
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

/**
 * High-level intent dispatch for the redesign's NavColumn.
 * VU Meter and Settings are silent no-ops in v1 (spec decision 35).
 * Refresh and Power callbacks are owned by Plan 5; default to no-op here
 * and overridable via `setViewActionHandlers`.
 */
let _onRefresh: () => void = () => {};
let _onPower: () => void = () => {};

export function setViewActionHandlers(handlers: { onRefresh?: () => void; onPower?: () => void }) {
  if (handlers.onRefresh) _onRefresh = handlers.onRefresh;
  if (handlers.onPower) _onPower = handlers.onPower;
}

export const viewActions = {
  goToPlayer: () => currentView.set('player'),
  goToLibrary: () => currentView.set('library'),
  tapVuMeter: () => { /* silent no-op v1 */ },
  tapSettings: () => { /* silent no-op v1 */ },
  tapRefresh: () => _onRefresh(),
  tapPower: () => _onPower(),
};

/**
 * Power modal visibility — driven by NavColumn's Power cell. Confirmation
 * IS the modal: tapping Shutdown/Reset executes immediately (spec
 * decision 70). Dismissable via tap-outside (spec decision 69).
 */
export const powerModalOpen = writable<boolean>(false);

export const modalActions = {
  openPower:  () => powerModalOpen.set(true),
  closePower: () => powerModalOpen.set(false),
};

/**
 * True while a backend cache rebuild is in flight, so NavColumn's Refresh
 * cell can show a spinning icon. Reset on library:cache:updated arrival.
 */
export const refreshInProgress = writable<boolean>(false);
