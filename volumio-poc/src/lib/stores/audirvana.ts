/**
 * Audirvana Store
 *
 * Manages Audirvana Studio detection and discovery state.
 * This store provides reactive access to Audirvana status on the network.
 */

import { writable, derived, get } from 'svelte/store';
import { socketService } from '../services/socket';
import type { AudiorvanaInstance, AudiorvanaServiceStatus, AudiorvanaStatus } from '../services/audirvana';

// Re-export types for convenience
export type { AudiorvanaInstance, AudiorvanaServiceStatus, AudiorvanaStatus };

// ============================================================================
// State
// ============================================================================

/** Whether Audirvana Studio is installed on the local device */
export const audirvanaInstalled = writable<boolean>(false);

/** Systemd service status */
export const audirvanaService = writable<AudiorvanaServiceStatus>({
  loaded: false,
  enabled: false,
  active: false,
  running: false
});

/** Discovered Audirvana instances on the network */
export const audirvanaInstances = writable<AudiorvanaInstance[]>([]);

/** Loading state for status refresh */
export const audirvanaLoading = writable<boolean>(false);

/** Error message if any */
export const audirvanaError = writable<string | null>(null);

/** Last refresh timestamp */
export const audirvanaLastRefresh = writable<Date | null>(null);

// ============================================================================
// Derived Stores
// ============================================================================

/** Whether Audirvana is available (installed and running) */
export const audirvanaAvailable = derived(
  [audirvanaInstalled, audirvanaService],
  ([$installed, $service]) => $installed && $service.running
);

/** Count of discovered instances */
export const audirvanaInstanceCount = derived(
  audirvanaInstances,
  ($instances) => $instances.length
);

/** Combined status for easy access */
export const audirvanaFullStatus = derived(
  [audirvanaInstalled, audirvanaService, audirvanaInstances, audirvanaError],
  ([$installed, $service, $instances, $error]): AudiorvanaStatus => ({
    installed: $installed,
    service: $service,
    instances: $instances,
    error: $error || undefined
  })
);

// ============================================================================
// Actions
// ============================================================================

export const audirvanaActions = {
  /**
   * Request Audirvana status from backend
   */
  refresh(): void {
    audirvanaLoading.set(true);
    audirvanaError.set(null);
    socketService.emit('getAudirvanaStatus');
  },

  /**
   * Start the Audirvana service (requires backend support)
   */
  startService(): void {
    socketService.emit('audirvanaStartService');
  },

  /**
   * Stop the Audirvana service (requires backend support)
   */
  stopService(): void {
    socketService.emit('audirvanaStopService');
  },

  /**
   * Clear error state
   */
  clearError(): void {
    audirvanaError.set(null);
  },

  /**
   * Reset store to initial state
   */
  reset(): void {
    audirvanaInstalled.set(false);
    audirvanaService.set({
      loaded: false,
      enabled: false,
      active: false,
      running: false
    });
    audirvanaInstances.set([]);
    audirvanaLoading.set(false);
    audirvanaError.set(null);
    audirvanaLastRefresh.set(null);
  }
};

// ============================================================================
// Socket Event Handlers
// ============================================================================

function handlePushAudirvanaStatus(status: AudiorvanaStatus): void {
  audirvanaLoading.set(false);
  audirvanaLastRefresh.set(new Date());

  if (status.error) {
    audirvanaError.set(status.error);
  } else {
    audirvanaError.set(null);
  }

  audirvanaInstalled.set(status.installed);
  audirvanaService.set(status.service);
  audirvanaInstances.set(status.instances || []);
}

// ============================================================================
// Initialization
// ============================================================================

let initialized = false;

/**
 * Initialize the Audirvana store
 * Registers socket event handlers and requests initial status
 */
export function initAudirvanaStore(): void {
  if (initialized) {
    return;
  }

  // Register event handlers
  socketService.on('pushAudirvanaStatus', handlePushAudirvanaStatus);

  // Request initial status
  audirvanaActions.refresh();

  initialized = true;
}

/**
 * Cleanup the Audirvana store
 * Removes socket event handlers
 */
export function cleanupAudirvanaStore(): void {
  if (!initialized) {
    return;
  }

  socketService.off('pushAudirvanaStatus', handlePushAudirvanaStatus);
  audirvanaActions.reset();

  initialized = false;
}
