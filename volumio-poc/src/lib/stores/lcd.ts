import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import { lcdStandbyMode } from './settings';

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
   * Toggle LCD state based on the configured standby mode
   * - 'css' mode: Uses standby()/wake() for instant, reliable touch-to-wake
   * - 'hardware' mode: Uses turnOff()/turnOn() with wlr-randr backend commands
   */
  toggle(): void {
    const mode = get(lcdStandbyMode);

    if (mode === 'css') {
      // CSS dimmed standby mode - check brightness level
      const currentBrightness = get(brightness);
      if (currentBrightness <= STANDBY_BRIGHTNESS) {
        this.wake();
      } else {
        this.standby();
      }
    } else {
      // Hardware mode - check lcdState
      const currentState = get(lcdState);
      if (currentState === 'off') {
        this.turnOn();
      } else {
        this.turnOff();
      }
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
   * Put display into dimmed standby mode (CSS overlay only - no backend call)
   * Dims to STANDBY_BRIGHTNESS (20%) instead of fully black.
   * This keeps the browser running so touch-to-wake works reliably.
   * Use turnOff() for actual hardware power off.
   */
  standby(): void {
    // Save current brightness as working brightness before dimming
    const currentBrightness = get(brightness);
    if (currentBrightness > STANDBY_BRIGHTNESS) {
      workingBrightness.set(currentBrightness);
    }

    console.log(`📺 LCD standby (dimming to ${STANDBY_BRIGHTNESS}%)`);
    brightness.set(STANDBY_BRIGHTNESS);
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
