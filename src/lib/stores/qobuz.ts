/**
 * Qobuz streaming service store
 * Manages Qobuz authentication status and login/logout actions
 */

import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

// Types
export interface QobuzStatus {
  loggedIn: boolean;
  email?: string;
  subscription?: string;
  country?: string;
  error?: string;
}

export interface QobuzLoginResult {
  success: boolean;
  message?: string;
  error?: string;
  status?: QobuzStatus;
}

// Store state
const initialStatus: QobuzStatus = {
  loggedIn: false,
};

// Create writable store
export const qobuzStatus = writable<QobuzStatus>(initialStatus);

// Loading state for login operations
export const qobuzLoading = writable<boolean>(false);

// Login error message
export const qobuzError = writable<string | null>(null);

// Derived store for checking if Qobuz is available
export const isQobuzLoggedIn = derived(qobuzStatus, ($status) => $status.loggedIn);

// Socket event listeners
let listenersInitialized = false;

export function initQobuzListeners(): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  // Listen for status updates
  socketService.on('pushQobuzStatus', (status: QobuzStatus) => {
    console.log('← pushQobuzStatus', status);
    qobuzStatus.set(status);
    if (status.error) {
      qobuzError.set(status.error);
    }
  });

  // Listen for login result
  socketService.on('pushQobuzLoginResult', (result: QobuzLoginResult) => {
    console.log('← pushQobuzLoginResult', result);
    qobuzLoading.set(false);

    if (result.success) {
      qobuzError.set(null);
      if (result.status) {
        qobuzStatus.set(result.status);
      }
    } else {
      qobuzError.set(result.error || 'Login failed');
    }
  });

  // Listen for logout result
  socketService.on('pushQobuzLogoutResult', (result: { success: boolean; error?: string }) => {
    console.log('← pushQobuzLogoutResult', result);
    qobuzLoading.set(false);

    if (result.success) {
      qobuzStatus.set({ loggedIn: false });
      qobuzError.set(null);
    } else {
      qobuzError.set(result.error || 'Logout failed');
    }
  });

  // Request initial status
  socketService.emit('getQobuzStatus');
}

// Actions
export const qobuzActions = {
  /**
   * Login to Qobuz with email and password
   */
  login: (email: string, password: string): void => {
    console.log('→ qobuzLogin', { email });
    qobuzLoading.set(true);
    qobuzError.set(null);
    socketService.emit('qobuzLogin', { email, password });
  },

  /**
   * Logout from Qobuz
   */
  logout: (): void => {
    console.log('→ qobuzLogout');
    qobuzLoading.set(true);
    qobuzError.set(null);
    socketService.emit('qobuzLogout');
  },

  /**
   * Request current Qobuz status
   */
  getStatus: (): void => {
    console.log('→ getQobuzStatus');
    socketService.emit('getQobuzStatus');
  },

  /**
   * Clear any error messages
   */
  clearError: (): void => {
    qobuzError.set(null);
  },
};

// Cleanup function
export function cleanupQobuzListeners(): void {
  socketService.off('pushQobuzStatus');
  socketService.off('pushQobuzLoginResult');
  socketService.off('pushQobuzLogoutResult');
  listenersInitialized = false;
}
