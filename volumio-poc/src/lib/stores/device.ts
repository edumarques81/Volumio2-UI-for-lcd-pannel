import { writable, derived } from 'svelte/store';
import { detectDeviceType, type DeviceType, getGridColumns, getTouchTargetSize } from '$lib/utils/deviceDetection';

// Main device type store
export const deviceType = writable<DeviceType>('lcd-panel');

// Screen dimensions store
export const screenDimensions = writable<{ width: number; height: number }>({
  width: 1920,
  height: 440
});

// Derived stores
export const isLcdPanel = derived(deviceType, $type => $type === 'lcd-panel');
export const isTablet = derived(deviceType, $type => $type === 'tablet');
export const isPhone = derived(deviceType, $type => $type === 'phone');
export const isMobile = derived(deviceType, $type => $type === 'tablet' || $type === 'phone');

export const isLandscape = derived(screenDimensions, $dims => $dims.width > $dims.height);

export const gridColumns = derived(
  [deviceType, isLandscape],
  ([$type, $isLandscape]) => getGridColumns($type, $isLandscape)
);

export const touchTargetSize = derived(deviceType, $type => getTouchTargetSize($type));

// Device class for CSS
export const deviceClass = derived(deviceType, $type => `device-${$type}`);

// Cleanup function reference
let resizeHandler: (() => void) | null = null;

/**
 * Initialize device detection with resize listener.
 */
export function initDeviceStore() {
  if (typeof window === 'undefined') return;

  // Update initial values
  const initialType = detectDeviceType();
  deviceType.set(initialType);
  screenDimensions.set({
    width: window.innerWidth,
    height: window.innerHeight
  });

  console.log(`📱 Device detected: ${initialType} (${window.innerWidth}x${window.innerHeight})`);

  // Debounced resize handler
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  resizeHandler = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(() => {
      const newType = detectDeviceType();
      const currentType = detectDeviceType(); // Get fresh value

      screenDimensions.set({
        width: window.innerWidth,
        height: window.innerHeight
      });

      deviceType.set(newType);

      console.log(`📱 Device type: ${newType} (${window.innerWidth}x${window.innerHeight})`);
    }, 150);
  };

  window.addEventListener('resize', resizeHandler);
  window.addEventListener('orientationchange', resizeHandler);
}

/**
 * Cleanup device store listeners.
 */
export function cleanupDeviceStore() {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    window.removeEventListener('orientationchange', resizeHandler);
    resizeHandler = null;
  }
}
