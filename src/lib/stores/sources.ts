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
    socketService.emit('addNasShare', req);
  },

  /** Delete an existing share by id. Backend broadcasts pushListNasShares on success. */
  deleteShare(id: string): void {
    socketService.emit('deleteNasShare', { id });
  },

  /** Mount a share by id. Backend broadcasts pushListNasShares on success. */
  mountShare(id: string): void {
    socketService.emit('mountNasShare', { id });
  },

  /** Unmount a share by id. Backend broadcasts pushListNasShares on success. */
  unmountShare(id: string): void {
    socketService.emit('unmountNasShare', { id });
  },

  /** Discover NAS devices on the local network. */
  discoverDevices(): void {
    discoveryLoading.set(true);
    discoveryError.set(null);
    socketService.emit('discoverNasDevices');
  },

  /** Browse shares exposed by a specific host. */
  browseShares(host: string, username?: string, password?: string): void {
    browseLoading.set(true);
    browseError.set(null);
    socketService.emit('browseNasShares', { host, username, password });
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
    nasShares.set(shares ?? []);
    nasSharesLoading.set(false);
  });

  socketService.on<SourceResult>('pushNasShareResult', (result) => {
    lastShareResult.set(result);
    // Do NOT touch nasShares here — the backend separately broadcasts
    // pushListNasShares to all clients on successful mutations.
  });

  socketService.on<DiscoverResult>('pushNasDevices', (payload) => {
    discoveredDevices.set(payload.devices ?? []);
    discoveryLoading.set(false);
    discoveryError.set(payload.error ?? null);
  });

  socketService.on<BrowseSharesResult>('pushBrowseNasShares', (payload) => {
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
  nasShares.set([]);
  nasSharesLoading.set(false);
  lastShareResult.set(null);
  discoveredDevices.set([]);
  discoveryLoading.set(false);
  discoveryError.set(null);
  browsedShares.set([]);
  browseLoading.set(false);
  browseError.set(null);
  initialized = false;
}
