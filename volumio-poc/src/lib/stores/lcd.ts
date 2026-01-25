import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';

export type LcdState = 'on' | 'off' | 'unknown';

export interface LCDStatus {
  isOn: boolean;
}

// LCD state store
export const lcdState = writable<LcdState>('unknown');
export const lcdLoading = writable<boolean>(false);

// Brightness store (0-100, CSS overlay based since no hardware backlight)
export const brightness = writable<number>(100);

// Derived stores for quick boolean access
export const isLcdOn = derived(lcdState, ($state) => $state === 'on');
export const isStandby = derived(lcdState, ($state) => $state === 'off');
export const isDimmed = derived(
  [lcdState, brightness],
  ([$state, $brightness]) => $state === 'on' && $brightness < 100
);

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
  },

  /**
   * Set brightness level (0-100)
   * Since there's no hardware backlight, this controls a CSS overlay
   */
  setBrightness(value: number): void {
    const clamped = Math.max(0, Math.min(100, value));
    console.log('📺 LCD brightness:', clamped);
    brightness.set(clamped);
  },

  /**
   * Dim the display to a specific brightness level
   * Keeps the display on but reduces brightness via CSS overlay
   */
  dim(level: number = 30): void {
    console.log('📺 LCD dim to:', level);
    this.setBrightness(level);
  },

  /**
   * Put display into standby mode (CSS overlay only - no backend call)
   * This keeps the browser running so touch-to-wake works reliably.
   * Use turnOff() for actual hardware power off.
   */
  standby(): void {
    console.log('📺 LCD standby (CSS overlay)');
    lcdState.set('off');
    brightness.set(0); // Full black overlay
    lcdLoading.set(false);
  },

  /**
   * Wake display from standby and restore full brightness (CSS overlay only)
   * This is instant since it's just removing the CSS overlay.
   */
  wake(): void {
    console.log('📺 LCD wake (CSS overlay)');
    lcdState.set('on');
    brightness.set(100); // Restore full brightness
    lcdLoading.set(false);
  },

  /**
   * Reset brightness to full (100%)
   */
  resetBrightness(): void {
    console.log('📺 LCD brightness reset');
    brightness.set(100);
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
