import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';

export type LcdState = 'on' | 'off' | 'unknown';

export interface LCDStatus {
  isOn: boolean;
}

// LCD state store
export const lcdState = writable<LcdState>('unknown');
export const lcdLoading = writable<boolean>(false);

// Derived store for quick boolean access
export const isLcdOn = derived(lcdState, ($state) => $state === 'on');

/**
 * LCD control actions (Socket.IO based)
 */
export const lcdActions = {
  /**
   * Request current LCD status from backend via Socket.IO
   */
  getStatus(): void {
    socketService.emit('getLcdStatus');
  },

  /**
   * Turn LCD off (standby mode)
   */
  turnOff(): void {
    console.log('📺 LCD standby');
    lcdLoading.set(true);
    lcdState.set('off'); // Optimistic update
    socketService.emit('lcdStandby');
    // Loading cleared when pushLcdStatus arrives
  },

  /**
   * Turn LCD on (wake from standby)
   */
  turnOn(): void {
    console.log('📺 LCD wake');
    lcdLoading.set(true);
    lcdState.set('on'); // Optimistic update
    socketService.emit('lcdWake');
    // Loading cleared when pushLcdStatus arrives
  },

  /**
   * Toggle LCD state
   */
  toggle(): void {
    const currentState = get(lcdState);
    if (currentState === 'off') {
      this.turnOn();
    } else {
      this.turnOff();
    }
  }
};

let initialized = false;

/**
 * Initialize LCD state monitoring via Socket.IO
 * Replaces the old HTTP polling implementation
 */
export function initLcdStore() {
  if (initialized) return;
  initialized = true;

  console.log('📺 Initializing LCD store (Socket.IO)...');

  // Listen for LCD status updates via Socket.IO
  // Backend pushes initial state on connection, no need for manual request
  socketService.on<LCDStatus>('pushLcdStatus', (status) => {
    console.log('📺 LCD status update:', status);
    lcdState.set(status.isOn ? 'on' : 'off');
    lcdLoading.set(false);
  });

  console.log('✅ LCD store initialized (no polling)');
}

export function cleanupLcdStore() {
  // No cleanup needed - Socket.IO handlers are managed by the socket service
  initialized = false;
}
