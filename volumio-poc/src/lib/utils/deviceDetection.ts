/**
 * Device type detection for responsive layouts.
 *
 * Supports three device types:
 * - lcd-panel: Wide, short displays like CarPlay-style screens (1920x440)
 * - tablet: Medium-sized screens (768px+ width)
 * - phone: Small screens (< 768px width)
 */

export type DeviceType = 'lcd-panel' | 'tablet' | 'phone';

/**
 * Check for forced layout mode via URL parameter.
 * Use ?layout=lcd to force LCD panel mode (useful for kiosk).
 * Use ?layout=mobile to force mobile mode (useful for testing).
 */
function getForcedLayoutMode(): DeviceType | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const layout = params.get('layout');

  if (layout === 'lcd' || layout === 'lcd-panel') {
    return 'lcd-panel';
  }
  if (layout === 'tablet') {
    return 'tablet';
  }
  if (layout === 'phone' || layout === 'mobile') {
    return 'phone';
  }

  return null;
}

/**
 * Detect the current device type based on screen dimensions.
 * Can be overridden with URL parameter: ?layout=lcd|tablet|phone
 */
export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') {
    return 'lcd-panel'; // Default for SSR
  }

  // Check for forced layout mode first
  const forcedMode = getForcedLayoutMode();
  if (forcedMode) {
    console.log(`📱 Layout forced via URL: ${forcedMode}`);
    return forcedMode;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;
  const aspectRatio = width / height;

  // LCD Panel: Wide landscape display (aspect ratio >= 2.5, typical CarPlay is ~4.36)
  // Or specifically 1920x440 or similar very wide displays
  if (width >= 1200 && height <= 600 && isLandscape && aspectRatio >= 2.5) {
    return 'lcd-panel';
  }

  // Determine the smaller dimension (for phones this is typically width in portrait)
  const minDimension = Math.min(width, height);

  // Phone: Small devices where the smaller dimension is < 500px
  // This captures phones in both portrait (375x812) and landscape (812x375)
  if (minDimension < 500) {
    return 'phone';
  }

  // Tablet: Everything else (medium screens with min dimension >= 500px)
  return 'tablet';
}

/**
 * Get the display name for a device type.
 */
export function getDeviceTypeName(type: DeviceType): string {
  switch (type) {
    case 'lcd-panel':
      return 'LCD Panel';
    case 'tablet':
      return 'Tablet';
    case 'phone':
      return 'Phone';
  }
}

/**
 * Get CSS class suffix for a device type.
 */
export function getDeviceClass(type: DeviceType): string {
  return `device-${type}`;
}

/**
 * Check if the device is a touch device.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - for older browsers
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Get recommended grid columns based on device type and orientation.
 */
export function getGridColumns(type: DeviceType, isLandscape: boolean = true): number {
  switch (type) {
    case 'lcd-panel':
      return 6;
    case 'tablet':
      return isLandscape ? 4 : 3;
    case 'phone':
      return 2;
  }
}

/**
 * Get minimum touch target size based on device type.
 */
export function getTouchTargetSize(type: DeviceType): number {
  switch (type) {
    case 'lcd-panel':
      return 44; // Standard Apple guidelines
    case 'tablet':
      return 48;
    case 'phone':
      return 48; // Larger for fingers
  }
}
