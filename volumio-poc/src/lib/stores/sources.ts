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

// NOTE: NasDevice and UsbDrive interfaces will be added in Phase 2/3

// Stores
export const nasShares = writable<NasShare[]>([]);
export const sourcesLoading = writable<boolean>(false);
export const sourcesError = writable<string | null>(null);

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

  // NOTE: pushNasDevices and pushUsbDrives listeners will be added in Phase 2/3

  console.log('✅ Sources store initialized');
}

/**
 * Clean up the sources store
 */
export function cleanupSourcesStore(): void {
  initialized = false;
  nasShares.set([]);
  sourcesLoading.set(false);
  sourcesError.set(null);
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
  }

  // NOTE: discoverNas, listUsbDrives, and safeEjectUsb will be added in Phase 2/3
};
