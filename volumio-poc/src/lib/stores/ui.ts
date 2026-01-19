import { writable, derived } from 'svelte/store';
import type { BrowseItem } from '$lib/stores/browse';
import type { QueueItem } from '$lib/stores/queue';

/**
 * Context menu item type
 */
export type ContextMenuItem = BrowseItem | QueueItem;

/**
 * Context menu state
 */
export interface ContextMenuState {
  isOpen: boolean;
  item: ContextMenuItem | null;
  itemType: 'browse' | 'queue' | null;
  itemIndex?: number; // For queue items
  position: { x: number; y: number };
}

/**
 * Playlist selector state
 */
export interface PlaylistSelectorState {
  isOpen: boolean;
  item: ContextMenuItem | null;
  itemType: 'browse' | 'queue' | null;
}

/**
 * Track info modal state
 */
export interface TrackInfoModalState {
  isOpen: boolean;
  item: ContextMenuItem | null;
}

// Context menu state
export const contextMenu = writable<ContextMenuState>({
  isOpen: false,
  item: null,
  itemType: null,
  position: { x: 0, y: 0 },
});

// Playlist selector state
export const playlistSelector = writable<PlaylistSelectorState>({
  isOpen: false,
  item: null,
  itemType: null,
});

// Track info modal state
export const trackInfoModal = writable<TrackInfoModalState>({
  isOpen: false,
  item: null,
});

// Any modal is open
export const anyModalOpen = derived(
  [contextMenu, playlistSelector, trackInfoModal],
  ([$contextMenu, $playlistSelector, $trackInfoModal]) =>
    $contextMenu.isOpen || $playlistSelector.isOpen || $trackInfoModal.isOpen
);

/**
 * UI actions
 */
export const uiActions = {
  /**
   * Open context menu for an item
   */
  openContextMenu(
    item: ContextMenuItem,
    itemType: 'browse' | 'queue',
    position: { x: number; y: number },
    itemIndex?: number
  ) {
    contextMenu.set({
      isOpen: true,
      item,
      itemType,
      itemIndex,
      position,
    });
  },

  /**
   * Close context menu
   */
  closeContextMenu() {
    contextMenu.update((state) => ({
      ...state,
      isOpen: false,
    }));
  },

  /**
   * Open playlist selector for an item
   */
  openPlaylistSelector(item: ContextMenuItem, itemType: 'browse' | 'queue') {
    // Close context menu first
    this.closeContextMenu();

    playlistSelector.set({
      isOpen: true,
      item,
      itemType,
    });
  },

  /**
   * Close playlist selector
   */
  closePlaylistSelector() {
    playlistSelector.update((state) => ({
      ...state,
      isOpen: false,
    }));
  },

  /**
   * Open track info modal
   */
  openTrackInfoModal(item: ContextMenuItem) {
    // Close context menu first
    this.closeContextMenu();

    trackInfoModal.set({
      isOpen: true,
      item,
    });
  },

  /**
   * Close track info modal
   */
  closeTrackInfoModal() {
    trackInfoModal.update((state) => ({
      ...state,
      isOpen: false,
    }));
  },

  /**
   * Close all modals
   */
  closeAllModals() {
    this.closeContextMenu();
    this.closePlaylistSelector();
    this.closeTrackInfoModal();
  },
};
