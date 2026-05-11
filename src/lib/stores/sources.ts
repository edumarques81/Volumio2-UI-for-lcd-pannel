import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

// -------------------------------------------------------------------------
// Types — mirror the Stellar Go backend structs exactly
// -------------------------------------------------------------------------

export interface NasShare {
  id: string;
  name: string;
  ip: string;
  path: string;
  /** Backend treats fstype as a free string; pin to known values for consumers. */
  fstype: 'cifs' | 'nfs' | string;
  username?: string;
  options?: string;
  mounted: boolean;
  mountPoint: string;
}

export interface NasDevice {
  name: string;
  ip: string;
  hostname?: string;
}

export interface ShareInfo {
  name: string;
  /** 'disk' | 'printer' | 'ipc' or other backend values */
  type: string;
  comment?: string;
  writable: boolean;
}

export interface DiscoverResult {
  devices: NasDevice[];
  error?: string;
}

export interface BrowseSharesResult {
  shares: ShareInfo[];
  error?: string;
}

export interface SourceResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface AddNasShareRequest {
  name: string;
  ip: string;
  path: string;
  fstype: 'cifs' | 'nfs' | string;
  username?: string;
  password?: string;
  options?: string;
}

// -------------------------------------------------------------------------
// Writables (state)
// -------------------------------------------------------------------------

/** Last list received from backend via pushListNasShares. */
export const nasShares = writable<NasShare[]>([]);

/** True between a listShares() call and the pushListNasShares response. */
export const nasSharesLoading = writable<boolean>(false);

/**
 * Last pushNasShareResult received. Consumers read once then call
 * sourcesActions.clearLastResult() to clear.
 */
export const lastShareResult = writable<SourceResult | null>(null);

/** Last set of devices from pushNasDevices (discovery). */
export const discoveredDevices = writable<NasDevice[]>([]);

/** True between discoverDevices() and pushNasDevices arrival. */
export const discoveryLoading = writable<boolean>(false);

/** Error string from the last pushNasDevices payload, or null. */
export const discoveryError = writable<string | null>(null);

/** Last share list from pushBrowseNasShares. */
export const browsedShares = writable<ShareInfo[]>([]);

/** True between browseShares() and pushBrowseNasShares arrival. */
export const browseLoading = writable<boolean>(false);

/** Error string from the last pushBrowseNasShares payload, or null. */
export const browseError = writable<string | null>(null);

/** The host most recently passed to browseShares(). Used so the UI can re-issue the request on retry. Cleared on cleanup. */
export const lastBrowseHostAttempt = writable<string | null>(null);

/**
 * Map of share id → in-flight mount/unmount operation.
 * Set by mountShare()/unmountShare() before the emit; cleared when
 * pushListNasShares arrives (success path) or when pushNasShareResult
 * arrives with success: false (failure path — clears all entries since
 * the result payload doesn't carry the share id).
 */
export const mountInFlight = writable<Record<string, 'mounting' | 'unmounting'>>({});

/**
 * Discriminated label for whichever mutation is currently in flight, or null
 * when none is. Set synchronously at the top of each mutation action and
 * cleared by any path that finishes the operation: pushNasShareResult,
 * pushListNasShares, the timeout-fire fallback, and cleanup. UI consumers
 * render a "working…" indicator while this is non-null — it covers the
 * normal 3-7s wait (NFS handshake etc.) before either a real result or the
 * 8s timeout fallback arrives.
 *
 * Mutually exclusive with lastShareResult in the UI by precedence: when
 * non-null, the in-progress strip takes priority over the result strip.
 */
export const shareOperationInProgress = writable<{
  action: 'add' | 'mount' | 'unmount' | 'delete';
  startedAt: number;
} | null>(null);

// -------------------------------------------------------------------------
// Per-action timeout constants (exported so consumers/tests can read them)
// -------------------------------------------------------------------------

/** Discovery times out and surfaces an error after this many ms. */
export const DISCOVERY_TIMEOUT_MS = 8000;

/** Browse times out and surfaces an error after this many ms. */
export const BROWSE_TIMEOUT_MS = 8000;

/**
 * Mutation (add / mount / unmount / delete) times out and surfaces a sticky
 * failure result after this many ms. Fallback for when the backend hangs in
 * a kernel syscall (e.g. NFS-mounting a non-NFS host) and never emits
 * pushNasShareResult or pushListNasShares.
 */
export const SHARE_OPERATION_TIMEOUT_MS = 8000;

// Module-level handles for the pending discovery/browse/mutation timers.
// Held outside the action object so the listener and cleanup paths can clear
// them too. Only one mutation timer is tracked: from the user's perspective
// only one mutation should sensibly be outstanding at a time, and firing a
// second mutation cancels the first's fallback.
let discoveryTimeoutId: ReturnType<typeof setTimeout> | null = null;
let browseTimeoutId: ReturnType<typeof setTimeout> | null = null;
let shareOperationTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearDiscoveryTimeout(): void {
  if (discoveryTimeoutId !== null) {
    clearTimeout(discoveryTimeoutId);
    discoveryTimeoutId = null;
  }
}

function clearBrowseTimeout(): void {
  if (browseTimeoutId !== null) {
    clearTimeout(browseTimeoutId);
    browseTimeoutId = null;
  }
}

function clearShareOperationTimeout(): void {
  if (shareOperationTimeoutId !== null) {
    clearTimeout(shareOperationTimeoutId);
    shareOperationTimeoutId = null;
  }
}

/**
 * Per-action copy for the timeout-fire synthetic failure. The user knows
 * which operation actually timed out. Mirrors the discover/browse copy
 * pattern ("X timed out — try again"); the em-dash and trailing
 * "— try again" are kept verbatim for cross-flow consistency.
 */
const TIMEOUT_MESSAGES: Record<
  'add' | 'mount' | 'unmount' | 'delete',
  string
> = {
  add: 'Add timed out — try again',
  mount: 'Mount timed out — try again',
  unmount: 'Unmount timed out — try again',
  delete: 'Delete timed out — try again'
};

/**
 * Begin a mutation operation: publishes the in-progress label and arms the
 * fallback timer. Cancels any previously-pending mutation timer first so a
 * fresh action always gets a fresh deadline. On timer fire: surfaces a
 * sticky per-action failure result, clears mountInFlight (mirrors the
 * pushNasShareResult listener's failure path), and clears the in-progress
 * label so the UI returns to the result strip.
 */
function beginShareOperation(
  action: 'add' | 'mount' | 'unmount' | 'delete'
): void {
  clearShareOperationTimeout();
  shareOperationInProgress.set({ action, startedAt: Date.now() });
  shareOperationTimeoutId = setTimeout(() => {
    shareOperationTimeoutId = null;
    lastShareResult.set({
      success: false,
      error: TIMEOUT_MESSAGES[action]
    } satisfies SourceResult);
    mountInFlight.set({});
    shareOperationInProgress.set(null);
  }, SHARE_OPERATION_TIMEOUT_MS);
}

// -------------------------------------------------------------------------
// Derived stores
// -------------------------------------------------------------------------

export const mountedNasShares = derived(nasShares, ($list) =>
  $list.filter((s) => s.mounted)
);

export const unmountedNasShares = derived(nasShares, ($list) =>
  $list.filter((s) => !s.mounted)
);

// -------------------------------------------------------------------------
// Actions
// -------------------------------------------------------------------------

export const sourcesActions = {
  /** Request the current list of NAS shares from the backend. */
  listShares(): void {
    nasSharesLoading.set(true);
    socketService.emit('getListNasShares');
  },

  /** Add a new NAS share. Backend broadcasts pushListNasShares on success. */
  addShare(req: AddNasShareRequest): void {
    beginShareOperation('add');
    socketService.emit('addNasShare', req);
  },

  /** Delete an existing share by id. Backend broadcasts pushListNasShares on success. */
  deleteShare(id: string): void {
    beginShareOperation('delete');
    socketService.emit('deleteNasShare', { id });
  },

  /** Mount a share by id. Backend broadcasts pushListNasShares on success. */
  mountShare(id: string): void {
    mountInFlight.update((m) => ({ ...m, [id]: 'mounting' }));
    beginShareOperation('mount');
    socketService.emit('mountNasShare', { id });
  },

  /** Unmount a share by id. Backend broadcasts pushListNasShares on success. */
  unmountShare(id: string): void {
    mountInFlight.update((m) => ({ ...m, [id]: 'unmounting' }));
    beginShareOperation('unmount');
    socketService.emit('unmountNasShare', { id });
  },

  /**
   * Discover NAS devices on the local network. Surfaces a timeout error
   * after DISCOVERY_TIMEOUT_MS if no pushNasDevices arrives.
   */
  discoverDevices(): void {
    clearDiscoveryTimeout();
    discoveryLoading.set(true);
    discoveryError.set(null);
    socketService.emit('discoverNasDevices');
    discoveryTimeoutId = setTimeout(() => {
      discoveryTimeoutId = null;
      discoveryLoading.set(false);
      discoveryError.set('Discovery timed out — try again');
    }, DISCOVERY_TIMEOUT_MS);
  },

  /**
   * Browse shares exposed by a specific host. Surfaces a timeout error
   * after BROWSE_TIMEOUT_MS if no pushBrowseNasShares arrives.
   */
  browseShares(host: string, username?: string, password?: string): void {
    clearBrowseTimeout();
    browseLoading.set(true);
    browseError.set(null);
    lastBrowseHostAttempt.set(host);
    socketService.emit('browseNasShares', { host, username, password });
    browseTimeoutId = setTimeout(() => {
      browseTimeoutId = null;
      browseLoading.set(false);
      browseError.set('Browse timed out — try again');
    }, BROWSE_TIMEOUT_MS);
  },

  /** Clear the last share operation result after the consumer has read it. */
  clearLastResult(): void {
    lastShareResult.set(null);
  }
};

// -------------------------------------------------------------------------
// Init / cleanup
// -------------------------------------------------------------------------

let initialized = false;

/**
 * Register all Socket.IO listeners for the sources store.
 * Idempotent — safe to call multiple times; listeners are only attached once.
 * Call this from App.svelte alongside the other store inits.
 */
export function initSourcesStore(): void {
  if (initialized) return;
  initialized = true;

  console.log('[Sources] Initializing sources store...');

  socketService.on<NasShare[]>('pushListNasShares', (shares) => {
    // A fresh share list is the natural "operation finished" signal for any
    // pending mount/unmount — the backend broadcasts pushListNasShares on
    // every successful mutation. Cancel the mutation fallback timer so it
    // doesn't synthesize a "timed out" failure on top of a real success,
    // and drop the in-progress label so the UI returns to the result strip.
    clearShareOperationTimeout();
    shareOperationInProgress.set(null);
    nasShares.set(shares ?? []);
    nasSharesLoading.set(false);
    mountInFlight.set({});
  });

  socketService.on<SourceResult>('pushNasShareResult', (result) => {
    // A real result arrived — cancel the mutation fallback timer so it
    // doesn't overwrite this result with a synthetic timeout failure, and
    // drop the in-progress label so the UI returns to the result strip.
    clearShareOperationTimeout();
    shareOperationInProgress.set(null);
    lastShareResult.set(result);
    // Do NOT touch nasShares here — the backend separately broadcasts
    // pushListNasShares to all clients on successful mutations.
    // On failure, no pushListNasShares follows, so clear in-flight here.
    // The result payload doesn't carry the share id, so clear all entries
    // (acceptable for this iteration — the user can simply retry).
    if (result && result.success === false) {
      mountInFlight.set({});
    }
  });

  socketService.on<DiscoverResult>('pushNasDevices', (payload) => {
    clearDiscoveryTimeout();
    discoveredDevices.set(payload.devices ?? []);
    discoveryLoading.set(false);
    discoveryError.set(payload.error ?? null);
  });

  socketService.on<BrowseSharesResult>('pushBrowseNasShares', (payload) => {
    clearBrowseTimeout();
    browsedShares.set(payload.shares ?? []);
    browseLoading.set(false);
    browseError.set(payload.error ?? null);
  });

  // Request the initial share list immediately after registering listeners.
  sourcesActions.listShares();

  console.log('[Sources] Sources store initialized.');
}

/**
 * Reset all state to defaults and clear the initialized flag.
 * Allows the store to be re-initialized cleanly (e.g. in tests).
 */
export function cleanupSourcesStore(): void {
  clearDiscoveryTimeout();
  clearBrowseTimeout();
  clearShareOperationTimeout();
  nasShares.set([]);
  nasSharesLoading.set(false);
  lastShareResult.set(null);
  discoveredDevices.set([]);
  discoveryLoading.set(false);
  discoveryError.set(null);
  browsedShares.set([]);
  browseLoading.set(false);
  browseError.set(null);
  lastBrowseHostAttempt.set(null);
  mountInFlight.set({});
  shareOperationInProgress.set(null);
  initialized = false;
}
