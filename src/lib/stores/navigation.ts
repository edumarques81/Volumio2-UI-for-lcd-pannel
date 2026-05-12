import { writable, derived } from 'svelte/store';

/**
 * Available views in the application
 */
export type ViewType = 'player' | 'library' | 'queue' | 'settings' | 'vu-meter';

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
   * Navigate to settings view
   */
  goToSettings() {
    currentView.set('settings');
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
 * VU Meter routes to the VU view via currentView (M1.E).
 * Settings (v2, 2026-05-09) routes to the Settings view via currentView.
 * Refresh and Power callbacks are owned by Plan 5; default to no-op here
 * and overridable via `setViewActionHandlers`.
 */
const NOOP = () => {};
let _onRefresh: () => void = NOOP;
let _onPower: () => void = NOOP;

/**
 * Wires NavColumn's Refresh and Power intents to App-level handlers.
 *
 * Must be called BEFORE the first NavColumn render and exactly once per
 * App lifecycle. Subsequent calls overwrite the previous handlers without
 * warning (last-writer-wins). Pair with {@link clearViewActionHandlers}
 * on App unmount to avoid stale closures across HMR remounts.
 */
export function setViewActionHandlers(handlers: { onRefresh?: () => void; onPower?: () => void }) {
  if (handlers.onRefresh) _onRefresh = handlers.onRefresh;
  if (handlers.onPower) _onPower = handlers.onPower;
}

/**
 * Resets the Refresh / Power handlers to no-op. Called from App.svelte's
 * onMount cleanup so HMR remounts don't leave stale closures wired up.
 */
export function clearViewActionHandlers() {
  _onRefresh = NOOP;
  _onPower = NOOP;
}

export const viewActions = {
  goToPlayer: () => currentView.set('player'),
  goToLibrary: () => currentView.set('library'),
  goToSettings: () => currentView.set('settings'),
  tapVuMeter: () => currentView.set('vu-meter'),
  tapSettings: () => currentView.set('settings'),
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
// Intentionally module-global: tracks a backend operation, not per-component UI state.
export const refreshInProgress = writable<boolean>(false);
