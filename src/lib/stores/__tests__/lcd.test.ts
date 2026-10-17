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
  lcdMode,
  lcdLoading,
  lcdActions,
  initLcdStore,
  cleanupLcdStore,
  isLcdOn,
  type LCDStatus
} from '../lcd';
import { socketService } from '$lib/services/socket';

/** Pull the handler registered for an event out of the socket mock. */
function handlerFor(event: string): (payload: LCDStatus) => void {
  const calls = vi.mocked(socketService.on).mock.calls;
  const found = calls.find((call) => call[0] === event)?.[1];
  expect(found).toBeDefined();
  return found as unknown as (payload: LCDStatus) => void;
}

describe('LCD store (Socket.IO)', () => {
  beforeEach(() => {
    lcdState.set('unknown');
    lcdMode.set('unknown');
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

    it('should have unknown mode initially', () => {
      expect(get(lcdMode)).toBe('unknown');
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

  describe('lcdActions.setMode', () => {
    // A bare string makes the backend handler return silently, which on the
    // wire is indistinguishable from a hung backend. The object is the contract.
    it('sends the mode as an object, not a bare string', () => {
      lcdActions.setMode('standby');
      expect(socketService.emit).toHaveBeenCalledWith('lcdSetMode', { mode: 'standby' });
    });

    it('updates mode and state optimistically', () => {
      lcdActions.setMode('standby');
      expect(get(lcdMode)).toBe('standby');
      // Standby still drives the output: it is lit, just not showing the UI.
      expect(get(lcdState)).toBe('on');
    });

    it('marks off as not lit', () => {
      lcdActions.setMode('off');
      expect(get(lcdMode)).toBe('off');
      expect(get(lcdState)).toBe('off');
    });

    it('sets loading until the push arrives', () => {
      lcdActions.setMode('live');
      expect(get(lcdLoading)).toBe(true);
    });
  });

  describe('lcdActions.turnOff', () => {
    it('should ask for the off mode', () => {
      lcdActions.turnOff();
      expect(socketService.emit).toHaveBeenCalledWith('lcdSetMode', { mode: 'off' });
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
    it('should ask for the live mode', () => {
      lcdActions.turnOn();
      expect(socketService.emit).toHaveBeenCalledWith('lcdSetMode', { mode: 'live' });
    });

    it('should optimistically set state to on', () => {
      lcdActions.turnOn();
      expect(get(lcdState)).toBe('on');
    });
  });

  describe('lcdActions.toggle', () => {
    it('should turn on when currently off', () => {
      lcdState.set('off');
      lcdActions.toggle();
      expect(socketService.emit).toHaveBeenCalledWith('lcdSetMode', { mode: 'live' });
      expect(get(lcdState)).toBe('on');
    });

    it('should turn off when currently on', () => {
      lcdState.set('on');
      lcdActions.toggle();
      expect(socketService.emit).toHaveBeenCalledWith('lcdSetMode', { mode: 'off' });
      expect(get(lcdState)).toBe('off');
    });

    it('should turn off when state is unknown (defaults to assuming on)', () => {
      lcdState.set('unknown');
      lcdActions.toggle();
      expect(socketService.emit).toHaveBeenCalledWith('lcdSetMode', { mode: 'off' });
    });
  });

  describe('lcdActions.reportActivity', () => {
    it('emits lcdActivity so the night schedule sees the touch', () => {
      lcdActions.reportActivity();
      expect(socketService.emit).toHaveBeenCalledWith('lcdActivity');
    });
  });

  describe('initLcdStore', () => {
    it('should register pushLcdStatus event handler', () => {
      initLcdStore();
      expect(socketService.on).toHaveBeenCalledWith('pushLcdStatus', expect.any(Function));
    });

    it('should not make redundant initial request (backend pushes on connection)', () => {
      initLcdStore();
      expect(socketService.emit).not.toHaveBeenCalledWith('getLcdStatus');
    });
  });

  describe('pushLcdStatus handler', () => {
    beforeEach(() => {
      initLcdStore();
    });

    it('should update state to on when isOn is true', () => {
      handlerFor('pushLcdStatus')({ isOn: true, mode: 'live' });
      expect(get(lcdState)).toBe('on');
      expect(get(lcdMode)).toBe('live');
    });

    it('should update state to off when isOn is false', () => {
      handlerFor('pushLcdStatus')({ isOn: false, mode: 'off' });
      expect(get(lcdState)).toBe('off');
      expect(get(lcdMode)).toBe('off');
    });

    it('carries the standby mode while the output stays lit', () => {
      handlerFor('pushLcdStatus')({ isOn: true, mode: 'standby' });
      expect(get(lcdState)).toBe('on');
      expect(get(lcdMode)).toBe('standby');
    });

    // An older backend sends isOn only; the UI must not be left on 'unknown'.
    it('derives a mode when the payload has none', () => {
      handlerFor('pushLcdStatus')({ isOn: true });
      expect(get(lcdMode)).toBe('live');

      handlerFor('pushLcdStatus')({ isOn: false });
      expect(get(lcdMode)).toBe('off');
    });

    it('ignores a mode it does not recognise', () => {
      handlerFor('pushLcdStatus')({ isOn: true, mode: 'dimmed' as never });
      expect(get(lcdMode)).toBe('live');
    });

    it('should clear loading state on pushLcdStatus', () => {
      lcdLoading.set(true);
      handlerFor('pushLcdStatus')({ isOn: true, mode: 'live' });
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
