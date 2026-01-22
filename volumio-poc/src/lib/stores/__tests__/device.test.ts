import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// We need to mock window before importing the module
let originalInnerWidth: number;
let originalInnerHeight: number;
let originalUserAgent: string;

function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    writable: true,
    configurable: true
  });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    writable: true,
    configurable: true
  });
}

function setMobileUserAgent() {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    writable: true,
    configurable: true
  });
}

function setDesktopUserAgent() {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    writable: true,
    configurable: true
  });
}

describe('Device store', () => {
  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalUserAgent = navigator.userAgent;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    setWindowSize(originalInnerWidth, originalInnerHeight);
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
      configurable: true
    });
  });

  // Import fresh module for each test
  async function importDeviceStore() {
    // Clear module cache
    vi.resetModules();
    return import('../device');
  }

  describe('initial state', () => {
    it('should have lcd-panel as default deviceType', async () => {
      const { deviceType } = await importDeviceStore();
      expect(get(deviceType)).toBe('lcd-panel');
    });

    it('should have default screen dimensions', async () => {
      const { screenDimensions } = await importDeviceStore();
      const dims = get(screenDimensions);
      expect(dims.width).toBe(1920);
      expect(dims.height).toBe(440);
    });
  });

  describe('derived stores', () => {
    it('isLcdPanel should be true for lcd-panel', async () => {
      const { deviceType, isLcdPanel } = await importDeviceStore();
      deviceType.set('lcd-panel');
      expect(get(isLcdPanel)).toBe(true);
    });

    it('isLcdPanel should be false for tablet', async () => {
      const { deviceType, isLcdPanel } = await importDeviceStore();
      deviceType.set('tablet');
      expect(get(isLcdPanel)).toBe(false);
    });

    it('isTablet should be true for tablet', async () => {
      const { deviceType, isTablet } = await importDeviceStore();
      deviceType.set('tablet');
      expect(get(isTablet)).toBe(true);
    });

    it('isPhone should be true for phone', async () => {
      const { deviceType, isPhone } = await importDeviceStore();
      deviceType.set('phone');
      expect(get(isPhone)).toBe(true);
    });

    it('isMobile should be true for phone and tablet', async () => {
      const { deviceType, isMobile } = await importDeviceStore();

      deviceType.set('phone');
      expect(get(isMobile)).toBe(true);

      deviceType.set('tablet');
      expect(get(isMobile)).toBe(true);

      deviceType.set('lcd-panel');
      expect(get(isMobile)).toBe(false);
    });

    it('isLandscape should be derived from screenDimensions', async () => {
      const { screenDimensions, isLandscape } = await importDeviceStore();

      screenDimensions.set({ width: 1920, height: 440 });
      expect(get(isLandscape)).toBe(true);

      screenDimensions.set({ width: 440, height: 1920 });
      expect(get(isLandscape)).toBe(false);
    });

    it('gridColumns should return correct value based on device and orientation', async () => {
      const { deviceType, screenDimensions, gridColumns } = await importDeviceStore();

      deviceType.set('lcd-panel');
      expect(get(gridColumns)).toBe(6);

      deviceType.set('tablet');
      screenDimensions.set({ width: 1024, height: 768 });
      expect(get(gridColumns)).toBe(4);

      deviceType.set('tablet');
      screenDimensions.set({ width: 768, height: 1024 });
      expect(get(gridColumns)).toBe(3);

      deviceType.set('phone');
      expect(get(gridColumns)).toBe(2);
    });

    it('touchTargetSize should return correct value based on device', async () => {
      const { deviceType, touchTargetSize } = await importDeviceStore();

      deviceType.set('lcd-panel');
      expect(get(touchTargetSize)).toBe(44);

      deviceType.set('tablet');
      expect(get(touchTargetSize)).toBe(48);

      deviceType.set('phone');
      expect(get(touchTargetSize)).toBe(48);
    });

    it('deviceClass should return correct class string', async () => {
      const { deviceType, deviceClass } = await importDeviceStore();

      deviceType.set('lcd-panel');
      expect(get(deviceClass)).toBe('device-lcd-panel');

      deviceType.set('tablet');
      expect(get(deviceClass)).toBe('device-tablet');

      deviceType.set('phone');
      expect(get(deviceClass)).toBe('device-phone');
    });
  });

  describe('initDeviceStore', () => {
    it('should detect device type from window dimensions', async () => {
      setWindowSize(1920, 440);
      const { deviceType, initDeviceStore } = await importDeviceStore();

      initDeviceStore();

      expect(get(deviceType)).toBe('lcd-panel');
    });

    it('should detect tablet dimensions with mobile User-Agent', async () => {
      setWindowSize(1024, 768);
      setMobileUserAgent();
      const { deviceType, initDeviceStore } = await importDeviceStore();

      initDeviceStore();

      expect(get(deviceType)).toBe('tablet');
    });

    it('should detect phone dimensions with mobile User-Agent', async () => {
      setWindowSize(375, 812);
      setMobileUserAgent();
      const { deviceType, initDeviceStore } = await importDeviceStore();

      initDeviceStore();

      expect(get(deviceType)).toBe('phone');
    });

    it('should detect desktop with desktop User-Agent', async () => {
      setWindowSize(1920, 1080);
      setDesktopUserAgent();
      const { deviceType, initDeviceStore } = await importDeviceStore();

      initDeviceStore();

      expect(get(deviceType)).toBe('desktop');
    });

    it('should update screenDimensions', async () => {
      setWindowSize(1024, 768);
      const { screenDimensions, initDeviceStore } = await importDeviceStore();

      initDeviceStore();

      const dims = get(screenDimensions);
      expect(dims.width).toBe(1024);
      expect(dims.height).toBe(768);
    });
  });

  describe('cleanupDeviceStore', () => {
    it('should remove event listeners', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      setWindowSize(1920, 440);
      const { initDeviceStore, cleanupDeviceStore } = await importDeviceStore();

      initDeviceStore();
      cleanupDeviceStore();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
