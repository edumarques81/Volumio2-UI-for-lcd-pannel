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
});
