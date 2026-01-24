import { writable } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * NAS Share configuration
 */
export interface NasShare {
  id: string;
  name: string;
  ip: string;
  path: string;
  fstype: 'cifs' | 'nfs';
  username?: string;
  options?: string;
  mounted: boolean;
  mountPoint: string;
}

/**
 * Request to add a NAS share
 */
export interface AddNasShareRequest {
  name: string;
  ip: string;
  path: string;
  fstype: 'cifs' | 'nfs';
  username?: string;
  password?: string;
  options?: string;
}

/**
 * Result of a source operation
 */
export interface SourceResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Discovered NAS device on the network (Phase 2)
 */
export interface NasDevice {
  name: string;
  ip: string;
  hostname?: string;
}

/**
 * Available share on a NAS device (Phase 2)
 */
export interface ShareInfo {
  name: string;
  type: string; // "disk", "printer", "ipc"
  comment?: string;
  writable: boolean;
}

/**
 * Result of NAS discovery
 */
export interface DiscoverResult {
  devices: NasDevice[];
  error?: string;
}

/**
 * Result of browsing NAS shares
 */
export interface BrowseSharesResult {
  shares: ShareInfo[];
  error?: string;
}

// NOTE: UsbDrive interface will be added in Phase 3

// Stores
export const nasShares = writable<NasShare[]>([]);
export const nasDevices = writable<NasDevice[]>([]); // Phase 2: Discovered devices
export const nasSharesList = writable<ShareInfo[]>([]); // Phase 2: Available shares on selected device
export const sourcesLoading = writable<boolean>(false);
export const sourcesError = writable<string | null>(null);
export const discoveryInProgress = writable<boolean>(false); // Phase 2: Discovery state

// Track initialization
let initialized = false;

/**
 * Initialize the sources store and set up socket listeners
 */
export function initSourcesStore(): void {
  if (initialized) return;
  initialized = true;

  console.log('📁 Initializing sources store...');

  // Listen for NAS shares list
  socketService.on<NasShare[]>('pushListNasShares', (shares) => {
    console.log('📁 NAS shares received:', shares);
    nasShares.set(shares || []);
    sourcesLoading.set(false);
  });

  // Listen for NAS operation results
  socketService.on<SourceResult>('pushNasShareResult', (result) => {
    console.log('📁 NAS operation result:', result);
    sourcesLoading.set(false);
    if (!result.success && result.error) {
      sourcesError.set(result.error);
      // Clear error after 5 seconds
      setTimeout(() => sourcesError.set(null), 5000);
    } else {
      sourcesError.set(null);
    }
  });

  // Phase 2: Listen for discovered NAS devices
  socketService.on<DiscoverResult>('pushNasDevices', (result) => {
    console.log('📁 NAS devices discovered:', result);
    discoveryInProgress.set(false);
    if (result.error) {
      sourcesError.set(result.error);
      setTimeout(() => sourcesError.set(null), 5000);
    } else {
      nasDevices.set(result.devices || []);
      sourcesError.set(null);
    }
  });

  // Phase 2: Listen for browsed NAS shares
  socketService.on<BrowseSharesResult>('pushBrowseNasShares', (result) => {
    console.log('📁 NAS shares browsed:', result);
    sourcesLoading.set(false);
    if (result.error) {
      sourcesError.set(result.error);
      setTimeout(() => sourcesError.set(null), 5000);
    } else {
      nasSharesList.set(result.shares || []);
      sourcesError.set(null);
    }
  });

  // NOTE: pushUsbDrives listener will be added in Phase 3

  console.log('✅ Sources store initialized');
}

/**
 * Clean up the sources store
 */
export function cleanupSourcesStore(): void {
  initialized = false;
  nasShares.set([]);
  nasDevices.set([]);
  nasSharesList.set([]);
  sourcesLoading.set(false);
  sourcesError.set(null);
  discoveryInProgress.set(false);
}

/**
 * Sources actions for managing NAS shares
 */
export const sourcesActions = {
  /**
   * Fetch the list of configured NAS shares
   */
  listNasShares(): void {
    console.log('📁 Fetching NAS shares...');
    sourcesLoading.set(true);
    socketService.emit('getListNasShares');
  },

  /**
   * Add a new NAS share
   */
  addNasShare(request: AddNasShareRequest): void {
    console.log('📁 Adding NAS share:', request.name);
    sourcesLoading.set(true);
    sourcesError.set(null);
    socketService.emit('addNasShare', request);
  },

  /**
   * Delete a NAS share
   */
  deleteNasShare(id: string): void {
    console.log('📁 Deleting NAS share:', id);
    sourcesLoading.set(true);
    sourcesError.set(null);
    socketService.emit('deleteNasShare', { id });
  },

  /**
   * Mount a NAS share
   */
  mountNasShare(id: string): void {
    console.log('📁 Mounting NAS share:', id);
    sourcesLoading.set(true);
    sourcesError.set(null);
    socketService.emit('mountNasShare', { id });
  },

  /**
   * Unmount a NAS share
   */
  unmountNasShare(id: string): void {
    console.log('📁 Unmounting NAS share:', id);
    sourcesLoading.set(true);
    sourcesError.set(null);
    socketService.emit('unmountNasShare', { id });
  },

  // ============================================================
  // Phase 2: NAS Discovery Actions
  // ============================================================

  /**
   * Discover NAS devices on the network
   */
  discoverNasDevices(): void {
    console.log('📁 Discovering NAS devices...');
    discoveryInProgress.set(true);
    sourcesError.set(null);
    nasDevices.set([]);
    socketService.emit('discoverNasDevices');
  },

  /**
   * Browse shares on a NAS device
   */
  browseNasShares(host: string, username?: string, password?: string): void {
    console.log('📁 Browsing NAS shares:', host);
    sourcesLoading.set(true);
    sourcesError.set(null);
    nasSharesList.set([]);
    socketService.emit('browseNasShares', { host, username, password });
  },

  /**
   * Clear discovered devices and shares
   */
  clearDiscovery(): void {
    nasDevices.set([]);
    nasSharesList.set([]);
    discoveryInProgress.set(false);
  }

  // NOTE: listUsbDrives and safeEjectUsb will be added in Phase 3
};
