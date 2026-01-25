import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock socket service
vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(() => () => {})
  }
}));

import {
  lcdState,
  lcdLoading,
  lcdActions,
  initLcdStore,
  cleanupLcdStore,
  isLcdOn,
  brightness,
  isStandby,
  isDimmed,
  type LcdState,
  type LCDStatus
} from '../lcd';
import { socketService } from '$lib/services/socket';

describe('LCD store (Socket.IO)', () => {
  beforeEach(() => {
    // Reset stores and mocks
    lcdState.set('unknown');
    lcdLoading.set(false);
    vi.clearAllMocks();
    cleanupLcdStore();
  });

  afterEach(() => {
    cleanupLcdStore();
  });

  describe('initial state', () => {
    it('should have unknown state initially', () => {
      expect(get(lcdState)).toBe('unknown');
    });

    it('should not be loading initially', () => {
      expect(get(lcdLoading)).toBe(false);
    });

    it('should derive isLcdOn as false when unknown', () => {
      expect(get(isLcdOn)).toBe(false);
    });
  });

  describe('lcdActions.getStatus', () => {
    it('should emit getLcdStatus event', () => {
      lcdActions.getStatus();
      expect(socketService.emit).toHaveBeenCalledWith('getLcdStatus');
    });
  });

  describe('lcdActions.turnOff', () => {
    it('should emit lcdStandby event', () => {
      lcdActions.turnOff();
      expect(socketService.emit).toHaveBeenCalledWith('lcdStandby');
    });

    it('should optimistically set state to off', () => {
      lcdActions.turnOff();
      expect(get(lcdState)).toBe('off');
    });

    it('should set loading state', () => {
      lcdActions.turnOff();
      expect(get(lcdLoading)).toBe(true);
    });
  });

  describe('lcdActions.turnOn', () => {
    it('should emit lcdWake event', () => {
      lcdActions.turnOn();
      expect(socketService.emit).toHaveBeenCalledWith('lcdWake');
    });

    it('should optimistically set state to on', () => {
      lcdActions.turnOn();
      expect(get(lcdState)).toBe('on');
    });

    it('should set loading state', () => {
      lcdActions.turnOn();
      expect(get(lcdLoading)).toBe(true);
    });
  });

  describe('lcdActions.toggle', () => {
    it('should turn on when currently off', () => {
      lcdState.set('off');
      lcdActions.toggle();
      expect(socketService.emit).toHaveBeenCalledWith('lcdWake');
      expect(get(lcdState)).toBe('on');
    });

    it('should turn off when currently on', () => {
      lcdState.set('on');
      lcdActions.toggle();
      expect(socketService.emit).toHaveBeenCalledWith('lcdStandby');
      expect(get(lcdState)).toBe('off');
    });

    it('should turn off when state is unknown (defaults to assuming on)', () => {
      lcdState.set('unknown');
      lcdActions.toggle();
      expect(socketService.emit).toHaveBeenCalledWith('lcdStandby');
    });
  });

  describe('initLcdStore', () => {
    it('should register pushLcdStatus event handler', () => {
      initLcdStore();
      expect(socketService.on).toHaveBeenCalledWith('pushLcdStatus', expect.any(Function));
    });

    it('should not make redundant initial request (backend pushes on connection)', () => {
      initLcdStore();

      // Should NOT emit getLcdStatus - backend pushes initial state
      expect(socketService.emit).not.toHaveBeenCalledWith('getLcdStatus');
    });
  });

  describe('pushLcdStatus handler', () => {
    it('should update state to on when isOn is true', () => {
      initLcdStore();

      // Get the handler that was registered
      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushLcdStatus')?.[1] as ((status: LCDStatus) => void) | undefined;
      expect(handler).toBeDefined();

      // Simulate receiving pushLcdStatus
      handler!({ isOn: true });

      expect(get(lcdState)).toBe('on');
    });

    it('should update state to off when isOn is false', () => {
      initLcdStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushLcdStatus')?.[1] as ((status: LCDStatus) => void) | undefined;
      handler!({ isOn: false });

      expect(get(lcdState)).toBe('off');
    });

    it('should clear loading state on pushLcdStatus', () => {
      lcdLoading.set(true);
      initLcdStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushLcdStatus')?.[1] as ((status: LCDStatus) => void) | undefined;
      handler!({ isOn: true });

      expect(get(lcdLoading)).toBe(false);
    });
  });

  describe('isLcdOn derived store', () => {
    it('should be true when state is on', () => {
      lcdState.set('on');
      expect(get(isLcdOn)).toBe(true);
    });

    it('should be false when state is off', () => {
      lcdState.set('off');
      expect(get(isLcdOn)).toBe(false);
    });

    it('should be false when state is unknown', () => {
      lcdState.set('unknown');
      expect(get(isLcdOn)).toBe(false);
    });
  });

  describe('brightness store', () => {
    it('should have default brightness of 100', () => {
      expect(get(brightness)).toBe(100);
    });

    it('should update brightness via setBrightness action', () => {
      lcdActions.setBrightness(50);
      expect(get(brightness)).toBe(50);
    });

    it('should clamp brightness to 0-100 range', () => {
      lcdActions.setBrightness(150);
      expect(get(brightness)).toBe(100);

      lcdActions.setBrightness(-10);
      expect(get(brightness)).toBe(0);
    });
  });

  describe('extended state model (ON/DIMMED/STANDBY)', () => {
    beforeEach(() => {
      brightness.set(100);
    });

    it('should report isStandby when state is off', () => {
      lcdState.set('off');
      expect(get(isStandby)).toBe(true);
    });

    it('should not report isStandby when state is on', () => {
      lcdState.set('on');
      expect(get(isStandby)).toBe(false);
    });

    it('should report isDimmed when brightness < 100 and state is on', () => {
      lcdState.set('on');
      brightness.set(30);
      expect(get(isDimmed)).toBe(true);
    });

    it('should not report isDimmed when brightness is 100', () => {
      lcdState.set('on');
      brightness.set(100);
      expect(get(isDimmed)).toBe(false);
    });

    it('should not report isDimmed when in standby (even with low brightness)', () => {
      lcdState.set('off');
      brightness.set(30);
      expect(get(isDimmed)).toBe(false);
    });
  });

  describe('lcdActions.dim', () => {
    it('should set brightness to specified value', () => {
      lcdActions.dim(30);
      expect(get(brightness)).toBe(30);
    });

    it('should keep state as on when dimming', () => {
      lcdState.set('on');
      lcdActions.dim(30);
      expect(get(lcdState)).toBe('on');
    });
  });

  describe('lcdActions.standby (CSS overlay mode)', () => {
    it('should NOT emit backend events (CSS-only mode)', () => {
      lcdActions.standby();
      expect(socketService.emit).not.toHaveBeenCalled();
    });

    it('should set state to off', () => {
      lcdState.set('on');
      lcdActions.standby();
      expect(get(lcdState)).toBe('off');
    });

    it('should set brightness to 0 for full black overlay', () => {
      brightness.set(100);
      lcdActions.standby();
      expect(get(brightness)).toBe(0);
    });

    it('should not set loading state', () => {
      lcdActions.standby();
      expect(get(lcdLoading)).toBe(false);
    });
  });

  describe('lcdActions.wake (CSS overlay mode)', () => {
    it('should NOT emit backend events (CSS-only mode)', () => {
      lcdState.set('off');
      lcdActions.wake();
      expect(socketService.emit).not.toHaveBeenCalled();
    });

    it('should restore brightness to 100 when waking', () => {
      brightness.set(0);
      lcdState.set('off');
      lcdActions.wake();
      expect(get(brightness)).toBe(100);
    });

    it('should set state to on', () => {
      lcdState.set('off');
      lcdActions.wake();
      expect(get(lcdState)).toBe('on');
    });

    it('should not set loading state', () => {
      lcdActions.wake();
      expect(get(lcdLoading)).toBe(false);
    });
  });

  describe('lcdActions.resetBrightness', () => {
    it('should reset brightness to 100', () => {
      brightness.set(30);
      lcdActions.resetBrightness();
      expect(get(brightness)).toBe(100);
    });
  });
});
