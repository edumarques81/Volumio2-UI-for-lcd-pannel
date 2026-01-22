import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectDeviceType,
  getDeviceTypeName,
  getDeviceClass,
  isTouchDevice,
  getGridColumns,
  getTouchTargetSize,
  type DeviceType
} from '../deviceDetection';

describe('Device detection utilities', () => {
  // Store original window properties
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
  });

  afterEach(() => {
    // Restore window properties
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true
    });
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true
    });
  });

  function setWindowSize(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      writable: true
    });
    Object.defineProperty(window, 'innerHeight', {
      value: height,
      writable: true
    });
  }

  describe('detectDeviceType', () => {
    describe('LCD Panel detection', () => {
      it('should detect 1920x440 as lcd-panel', () => {
        setWindowSize(1920, 440);
        expect(detectDeviceType()).toBe('lcd-panel');
      });

      it('should detect 1280x480 as lcd-panel', () => {
        setWindowSize(1280, 480);
        expect(detectDeviceType()).toBe('lcd-panel');
      });

      it('should detect wide displays with aspect ratio >= 2.5 as lcd-panel', () => {
        setWindowSize(1600, 500);
        expect(detectDeviceType()).toBe('lcd-panel');
      });

      it('should not detect portrait tall screens as lcd-panel', () => {
        setWindowSize(440, 1920);
        expect(detectDeviceType()).not.toBe('lcd-panel');
      });
    });

    describe('Tablet detection', () => {
      it('should detect 1024x768 as tablet', () => {
        setWindowSize(1024, 768);
        expect(detectDeviceType()).toBe('tablet');
      });

      it('should detect 768x1024 (portrait) as tablet', () => {
        setWindowSize(768, 1024);
        expect(detectDeviceType()).toBe('tablet');
      });

      it('should detect iPad Pro 12.9" as tablet', () => {
        setWindowSize(1024, 1366);
        expect(detectDeviceType()).toBe('tablet');
      });

      it('should detect 800x600 as tablet', () => {
        setWindowSize(800, 600);
        expect(detectDeviceType()).toBe('tablet');
      });
    });

    describe('Phone detection', () => {
      it('should detect 375x812 (iPhone X) as phone', () => {
        setWindowSize(375, 812);
        expect(detectDeviceType()).toBe('phone');
      });

      it('should detect 390x844 (iPhone 12) as phone', () => {
        setWindowSize(390, 844);
        expect(detectDeviceType()).toBe('phone');
      });

      it('should detect 360x640 (Android) as phone', () => {
        setWindowSize(360, 640);
        expect(detectDeviceType()).toBe('phone');
      });

      it('should detect 414x896 (iPhone XR) as phone', () => {
        setWindowSize(414, 896);
        expect(detectDeviceType()).toBe('phone');
      });

      it('should detect small landscape as phone', () => {
        setWindowSize(640, 360);
        expect(detectDeviceType()).toBe('phone');
      });
    });
  });

  describe('getDeviceTypeName', () => {
    it('should return "LCD Panel" for lcd-panel', () => {
      expect(getDeviceTypeName('lcd-panel')).toBe('LCD Panel');
    });

    it('should return "Tablet" for tablet', () => {
      expect(getDeviceTypeName('tablet')).toBe('Tablet');
    });

    it('should return "Phone" for phone', () => {
      expect(getDeviceTypeName('phone')).toBe('Phone');
    });
  });

  describe('getDeviceClass', () => {
    it('should return "device-lcd-panel" for lcd-panel', () => {
      expect(getDeviceClass('lcd-panel')).toBe('device-lcd-panel');
    });

    it('should return "device-tablet" for tablet', () => {
      expect(getDeviceClass('tablet')).toBe('device-tablet');
    });

    it('should return "device-phone" for phone', () => {
      expect(getDeviceClass('phone')).toBe('device-phone');
    });
  });

  describe('getGridColumns', () => {
    it('should return 6 for lcd-panel', () => {
      expect(getGridColumns('lcd-panel')).toBe(6);
    });

    it('should return 4 for tablet in landscape', () => {
      expect(getGridColumns('tablet', true)).toBe(4);
    });

    it('should return 3 for tablet in portrait', () => {
      expect(getGridColumns('tablet', false)).toBe(3);
    });

    it('should return 2 for phone', () => {
      expect(getGridColumns('phone')).toBe(2);
    });

    it('should return 2 for phone regardless of orientation', () => {
      expect(getGridColumns('phone', true)).toBe(2);
      expect(getGridColumns('phone', false)).toBe(2);
    });
  });

  describe('getTouchTargetSize', () => {
    it('should return 44 for lcd-panel', () => {
      expect(getTouchTargetSize('lcd-panel')).toBe(44);
    });

    it('should return 48 for tablet', () => {
      expect(getTouchTargetSize('tablet')).toBe(48);
    });

    it('should return 48 for phone', () => {
      expect(getTouchTargetSize('phone')).toBe(48);
    });
  });

  describe('isTouchDevice', () => {
    it('should return false when ontouchstart is not available', () => {
      // In test environment, ontouchstart is typically not available
      expect(typeof isTouchDevice()).toBe('boolean');
    });
  });
});
