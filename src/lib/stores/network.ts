import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

export interface NetworkStatus {
  type: 'wifi' | 'ethernet' | 'none';
  ssid: string;
  signal: number;      // 0-100
  ip: string;
  strength: number;    // 0-3 for icon level
}

const defaultStatus: NetworkStatus = {
  type: 'none',
  ssid: '',
  signal: 0,
  ip: '',
  strength: 0
};

export const networkStatus = writable<NetworkStatus>(defaultStatus);

// Derived store for the network icon name
export const networkIcon = derived(networkStatus, ($status) => {
  if ($status.type === 'ethernet') {
    return 'ethernet';
  }
  if ($status.type === 'wifi') {
    switch ($status.strength) {
      case 3: return 'wifi';    // Full signal
      case 2: return 'wifi-3';  // Two arcs (medium)
      case 1: return 'wifi-2';  // One arc (weak)
      default: return 'wifi-1'; // Just dot (very weak)
    }
  }
  return 'wifi-off';
});

// Derived store for connection status
export const isConnected = derived(networkStatus, ($status) =>
  $status.type !== 'none'
);

let initialized = false;

export function initNetworkStore() {
  if (initialized) return;
  initialized = true;

  // Listen for network status updates via Socket.IO
  // Backend pushes initial state on connection, no need for manual request
  socketService.on<NetworkStatus>('pushNetworkStatus', (status) => {
    networkStatus.set(status);
  });
}

export function cleanupNetworkStore() {
  // No cleanup needed - Socket.IO handlers are managed by the socket service
  initialized = false;
}
