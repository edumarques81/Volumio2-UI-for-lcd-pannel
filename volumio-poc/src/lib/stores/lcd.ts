import { writable, derived } from 'svelte/store';
import { getVolumioHost } from '$lib/config';

export type LcdState = 'on' | 'off' | 'unknown';

// LCD state store
export const lcdState = writable<LcdState>('unknown');
export const lcdLoading = writable<boolean>(false);

// Get the LCD control service URL (same host, port 8081)
function getLcdServiceUrl(): string {
  const volumioHost = getVolumioHost();
  // Extract host without port and protocol
  const baseHost = volumioHost.replace(/:\d+$/, '').replace(/^https?:\/\//, '');
  return `http://${baseHost}:8081`;
}

// Auth token (can be configured)
const AUTH_TOKEN = 'volumio-lcd-control'; // Default token

/**
 * LCD control actions
 */
export const lcdActions = {
  /**
   * Fetch current LCD status
   */
  async getStatus(): Promise<LcdState> {
    try {
      const url = `${getLcdServiceUrl()}/api/screen/status`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Auth-Token': AUTH_TOKEN
        }
      });

      if (response.ok) {
        const data = await response.json();
        const state = data.status as LcdState;
        lcdState.set(state);
        return state;
      }
    } catch (error) {
      console.warn('[LCD] Failed to get status:', error);
    }

    lcdState.set('unknown');
    return 'unknown';
  },

  /**
   * Turn LCD off
   */
  async turnOff(): Promise<boolean> {
    lcdLoading.set(true);
    try {
      const url = `${getLcdServiceUrl()}/api/screen/off`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Auth-Token': AUTH_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          lcdState.set('off');
          return true;
        }
      }
    } catch (error) {
      console.error('[LCD] Failed to turn off:', error);
    } finally {
      lcdLoading.set(false);
    }
    return false;
  },

  /**
   * Turn LCD on
   */
  async turnOn(): Promise<boolean> {
    lcdLoading.set(true);
    try {
      const url = `${getLcdServiceUrl()}/api/screen/on`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Auth-Token': AUTH_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          lcdState.set('on');
          return true;
        }
      }
    } catch (error) {
      console.error('[LCD] Failed to turn on:', error);
    } finally {
      lcdLoading.set(false);
    }
    return false;
  },

  /**
   * Toggle LCD state
   */
  async toggle(): Promise<boolean> {
    // First get current state if unknown
    let currentState: LcdState;
    const storeValue = await new Promise<LcdState>((resolve) => {
      const unsub = lcdState.subscribe((v) => {
        resolve(v);
        setTimeout(() => unsub(), 0);
      });
    });

    currentState = storeValue;

    // If unknown, fetch status first
    if (currentState === 'unknown') {
      currentState = await this.getStatus();
    }

    // Toggle
    if (currentState === 'off') {
      return this.turnOn();
    } else {
      return this.turnOff();
    }
  }
};

/**
 * Initialize LCD state monitoring
 */
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function initLcdStore() {
  // Get initial status
  lcdActions.getStatus();

  // Poll status every 10 seconds
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  pollInterval = setInterval(() => {
    lcdActions.getStatus();
  }, 10000);
}

export function cleanupLcdStore() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
