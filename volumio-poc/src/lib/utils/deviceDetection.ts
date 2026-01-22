/**
 * Device type detection for responsive layouts.
 *
 * Supports four device types:
 * - lcd-panel: Wide, short displays like CarPlay-style screens (1920x440)
 * - desktop: Computer browsers (non-touch, large screens)
 * - tablet: Touch devices with medium screens
 * - phone: Small touch devices
 *
 * Detection priority:
 * 1. URL parameter override (?layout=lcd|desktop|tablet|phone)
 * 2. LCD panel detection (aspect ratio >= 2.5, height <= 600)
 * 3. Touch capability + screen size for mobile vs desktop
 */

export type DeviceType = 'lcd-panel' | 'desktop' | 'tablet' | 'phone';

/**
 * Check for forced layout mode via URL parameter.
 * Use ?layout=lcd to force LCD panel mode (useful for kiosk).
 * Use ?layout=desktop to force desktop mode.
 * Use ?layout=mobile or ?layout=phone to force phone mode.
 */
function getForcedLayoutMode(): DeviceType | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const layout = params.get('layout');

  if (layout === 'lcd' || layout === 'lcd-panel') {
    return 'lcd-panel';
  }
  if (layout === 'desktop') {
    return 'desktop';
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
 * Detect if the browser is on a mobile device using User-Agent.
 * This is more reliable than touch detection for distinguishing
 * desktop browsers from mobile browsers.
 */
function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';

  // Check for mobile keywords in user agent
  const mobileKeywords = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;

  return mobileKeywords.test(userAgent);
}

/**
 * Detect if the device has touch capability as primary input.
 * Note: Many laptops have touch screens but use mouse as primary.
 */
function hasPrimaryTouchInput(): boolean {
  if (typeof window === 'undefined') return false;

  // Check if any pointer is coarse (finger) vs fine (mouse)
  // This is the most reliable way to detect touch-primary devices
  if (window.matchMedia) {
    // Device has coarse pointer (touch) as primary input
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    // Device has no fine pointer (mouse)
    const hasNoFinePointer = !window.matchMedia('(pointer: fine)').matches;

    // Mobile devices typically have coarse pointer and no fine pointer
    if (hasCoarsePointer && hasNoFinePointer) {
      return true;
    }
  }

  return false;
}

/**
 * Detect the current device type based on screen dimensions and browser type.
 * Can be overridden with URL parameter: ?layout=lcd|desktop|tablet|phone
 *
 * Detection logic:
 * 1. URL override takes precedence
 * 2. LCD panel: aspect ratio >= 2.5, height <= 600 (CarPlay-style displays)
 * 3. Desktop: Non-mobile browser with large screen
 * 4. Phone: Mobile browser with small screen (min dimension < 500px)
 * 5. Tablet: Mobile browser with larger screen
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
    console.log(`🖥️ Device detected: lcd-panel (${width}x${height}, ratio=${aspectRatio.toFixed(2)})`);
    return 'lcd-panel';
  }

  // Check if this is a mobile browser (using User-Agent)
  const isMobile = isMobileBrowser();
  const isPrimaryTouch = hasPrimaryTouchInput();

  // Desktop: Not a mobile browser AND not touch-primary device
  // This captures computer browsers (Chrome, Firefox, Safari on macOS/Windows)
  if (!isMobile && !isPrimaryTouch) {
    console.log(`🖥️ Device detected: desktop (${width}x${height}, mobile=${isMobile}, touch=${isPrimaryTouch})`);
    return 'desktop';
  }

  // From here, we're dealing with mobile/tablet devices
  const minDimension = Math.min(width, height);

  // Phone: Mobile browser with small screen (min dimension < 500px)
  // This captures phones in both portrait (375x812) and landscape (812x375)
  if (minDimension < 500) {
    console.log(`📱 Device detected: phone (${width}x${height}, minDim=${minDimension})`);
    return 'phone';
  }

  // Tablet: Mobile browser with larger screen
  console.log(`📱 Device detected: tablet (${width}x${height}, minDim=${minDimension})`);
  return 'tablet';
}

/**
 * Get the display name for a device type.
 */
export function getDeviceTypeName(type: DeviceType): string {
  switch (type) {
    case 'lcd-panel':
      return 'LCD Panel';
    case 'desktop':
      return 'Desktop';
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
    case 'desktop':
      return isLandscape ? 5 : 4;
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
    case 'desktop':
      return 36; // Smaller for mouse interaction
    case 'tablet':
      return 48;
    case 'phone':
      return 48; // Larger for fingers
  }
}

/**
 * Check if the device type is a mobile device (phone or tablet).
 */
export function isMobileDeviceType(type: DeviceType): boolean {
  return type === 'phone' || type === 'tablet';
}

/**
 * Check if the device type uses the full-screen layout (not LCD horizontal bar).
 */
export function isFullScreenLayout(type: DeviceType): boolean {
  return type === 'desktop' || type === 'phone' || type === 'tablet';
}
