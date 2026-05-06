import { get } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import { refreshInProgress } from '$lib/stores/navigation';
import { libraryActions, selectedLibraryAlbum } from '$lib/stores/library';
import { bioActions } from '$lib/stores/bios';

/**
 * Module-scoped handle to the active `library:cache:updated` subscription.
 * Hoisted out of the App.svelte closure so:
 *  1. A tap arriving before the previous listener fires can clear it
 *     before re-subscribing (belt-and-braces under the reentrancy guard).
 *  2. App.svelte's onMount cleanup can stop the listener on unmount/HMR.
 */
let cacheUpdatedStop: (() => void) | null = null;

/**
 * Performs a NavColumn-Refresh round-trip:
 *  - Marks {@link refreshInProgress} so the icon spins.
 *  - Emits library:cache:rebuild and (if an album is in view) refreshes its bio.
 *  - Subscribes ONCE to library:cache:updated; the subscription tears itself
 *    down on first fire.
 *
 * Reentrancy is the load-bearing invariant: rapid taps must not stack
 * listeners. This is the same class of bug Plan 4 fixed in
 * replaceQueueAndPlay (commit 05bac627).
 */
export function triggerLibraryRefresh(): void {
  // Reentrancy guard: if a refresh is already in flight, drop this tap.
  if (get(refreshInProgress)) return;

  // Belt-and-braces: kill any lingering listener whose flag was cleared
  // out-of-band before re-subscribing.
  cacheUpdatedStop?.();
  cacheUpdatedStop = null;

  refreshInProgress.set(true);
  socketService.emit('library:cache:rebuild');

  // Invalidate the bio of whatever album is currently displayed in Library
  const sel = get(selectedLibraryAlbum);
  if (sel?.artist && sel?.title) {
    bioActions.refreshBio(sel.artist, sel.title);
  }

  cacheUpdatedStop = socketService.on('library:cache:updated', () => {
    libraryActions.fetchAlbums();
    refreshInProgress.set(false);
    cacheUpdatedStop?.();
    cacheUpdatedStop = null;
  });
}

/**
 * Tears down any active library:cache:updated subscription and resets the
 * spin flag. Called from App.svelte's onMount cleanup so HMR remounts don't
 * leak listeners.
 */
export function cancelLibraryRefresh(): void {
  cacheUpdatedStop?.();
  cacheUpdatedStop = null;
  refreshInProgress.set(false);
}

/** Test-only: inspect whether a listener is currently registered. */
export function _hasActiveCacheUpdatedListener(): boolean {
  return cacheUpdatedStop !== null;
}
