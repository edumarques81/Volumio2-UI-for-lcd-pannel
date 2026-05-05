import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// We need to mock window before importing the module
let originalInnerWidth: number;
let originalInnerHeight: number;

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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    setWindowSize(originalInnerWidth, originalInnerHeight);
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

    it('isLcdPanel should be false for desktop', async () => {
      const { deviceType, isLcdPanel } = await importDeviceStore();
      deviceType.set('desktop');
      expect(get(isLcdPanel)).toBe(false);
    });

    it('isDesktop should be true for desktop', async () => {
      const { deviceType, isDesktop } = await importDeviceStore();
      deviceType.set('desktop');
      expect(get(isDesktop)).toBe(true);
    });

    it('isDesktop should be false for lcd-panel', async () => {
      const { deviceType, isDesktop } = await importDeviceStore();
      deviceType.set('lcd-panel');
      expect(get(isDesktop)).toBe(false);
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
      expect(get(gridColumns)).toBe(8);

      deviceType.set('desktop');
      screenDimensions.set({ width: 1920, height: 1080 });
      expect(get(gridColumns)).toBe(6);
    });

    it('touchTargetSize should return correct value based on device', async () => {
      const { deviceType, touchTargetSize } = await importDeviceStore();

      deviceType.set('lcd-panel');
      expect(get(touchTargetSize)).toBe(44);

      deviceType.set('desktop');
      expect(get(touchTargetSize)).toBe(40);
    });

    it('deviceClass should return correct class string', async () => {
      const { deviceType, deviceClass } = await importDeviceStore();

      deviceType.set('lcd-panel');
      expect(get(deviceClass)).toBe('device-lcd-panel');

      deviceType.set('desktop');
      expect(get(deviceClass)).toBe('device-desktop');
    });
  });

  describe('initDeviceStore', () => {
    it('should detect lcd-panel from wide short viewport (1920x440)', async () => {
      setWindowSize(1920, 440);
      const { deviceType, initDeviceStore } = await importDeviceStore();

      initDeviceStore();

      expect(get(deviceType)).toBe('lcd-panel');
    });

    it('should detect desktop for phone-sized viewports (collapsed from phone type)', async () => {
      setWindowSize(375, 812);
      const { deviceType, initDeviceStore } = await importDeviceStore();

      initDeviceStore();

      expect(get(deviceType)).toBe('desktop');
    });

    it('should detect desktop for tablet-sized viewports (collapsed from tablet type)', async () => {
      setWindowSize(1024, 768);
      const { deviceType, initDeviceStore } = await importDeviceStore();

      initDeviceStore();

      expect(get(deviceType)).toBe('desktop');
    });

    it('should detect desktop with large monitor dimensions', async () => {
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
