import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';

export type LcdState = 'on' | 'off' | 'unknown';

export interface LCDStatus {
  isOn: boolean;
}

// LCD state store
export const lcdState = writable<LcdState>('unknown');
export const lcdLoading = writable<boolean>(false);

// Brightness constants
export const STANDBY_BRIGHTNESS = 20;  // Dimmed standby mode (20%)
export const DEFAULT_BRIGHTNESS = 100; // Full brightness

// Brightness store (0-100, CSS overlay based since no hardware backlight)
export const brightness = writable<number>(DEFAULT_BRIGHTNESS);

// Working brightness - the brightness to restore to when waking from standby
export const workingBrightness = writable<number>(DEFAULT_BRIGHTNESS);

// Derived stores for quick boolean access
export const isLcdOn = derived(lcdState, ($state) => $state === 'on');
export const isStandby = derived(lcdState, ($state) => $state === 'off');
export const isDimmed = derived(
  [lcdState, brightness],
  ([$state, $brightness]) => $state === 'on' && $brightness < 100
);
// Dimmed standby mode - screen is dimmed to standby level, touch to wake
export const isDimmedStandby = derived(
  brightness,
  ($brightness) => $brightness <= STANDBY_BRIGHTNESS
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
   * Toggle LCD hardware power state via backend socket events.
   * Always uses turnOff()/turnOn() regardless of standby mode setting.
   * (CSS dimmed standby is handled separately by StandbyOverlay for auto-dim on idle.)
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
   * Put display into standby mode (CSS full-black overlay - no backend call).
   * Sets brightness to 0 so the screen appears completely off.
   * Touch-to-wake still works because the display hardware stays connected.
   * Use turnOff() for actual hardware power off (disables HDMI output).
   */
  standby(): void {
    const currentBrightness = get(brightness);
    if (currentBrightness > 0) {
      workingBrightness.set(currentBrightness);
    }

    console.log('📺 LCD standby (full black)');
    brightness.set(0);
    lcdLoading.set(false);
  },

  /**
   * Wake display from dimmed standby and restore working brightness (CSS overlay only)
   * This is instant since it's just adjusting the CSS overlay.
   */
  wake(): void {
    const targetBrightness = get(workingBrightness);
    console.log(`📺 LCD wake (restoring to ${targetBrightness}%)`);
    brightness.set(targetBrightness);
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
