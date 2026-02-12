import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  audioEngineState,
  activeEngine,
  engineSwitching,
  audioEngineActions,
  initAudioEngineStore,
  cleanupAudioEngineStore
} from '../audioEngine';
import { audirvanaService, audirvanaInstalled } from '../audirvana';
import { socketService } from '../../services/socket';
import type { AudiorvanaStatus } from '../../services/audirvana';

// Mock socket service
vi.mock('../../services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}));

// Mock audirvana stores
vi.mock('../audirvana', async (importOriginal) => {
  const { writable, derived } = await import('svelte/store');

  const audirvanaInstalledStore = writable(false);
  const audirvanaServiceStore = writable({
    loaded: false,
    enabled: false,
    active: false,
    running: false
  });

  return {
    audirvanaInstalled: audirvanaInstalledStore,
    audirvanaService: audirvanaServiceStore,
    audirvanaAvailable: derived(
      [audirvanaInstalledStore, audirvanaServiceStore],
      ([$installed, $service]) => $installed && $service.running
    )
  };
});

describe('AudioEngine Store', () => {
  beforeEach(() => {
    audioEngineActions.reset();
    audirvanaService.set({
      loaded: false,
      enabled: false,
      active: false,
      running: false
    });
    audirvanaInstalled.set(false);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupAudioEngineStore();
  });

  describe('initial state', () => {
    it('should have MPD as default active engine', () => {
      expect(get(activeEngine)).toBe('mpd');
      expect(get(engineSwitching)).toBe(false);
      expect(get(audioEngineState).error).toBeNull();
    });
  });

  describe('switchTo', () => {
    it('should return true when already on the same engine', async () => {
      const result = await audioEngineActions.switchTo('mpd');
      expect(result).toBe(true);
      expect(socketService.emit).not.toHaveBeenCalled();
    });

    it('should reject switching to audirvana when not available', async () => {
      audirvanaInstalled.set(false);
      audirvanaService.set({ loaded: false, enabled: false, active: false, running: false });

      const result = await audioEngineActions.switchTo('audirvana');

      expect(result).toBe(false);
      expect(get(audioEngineState).error).toContain('Audirvana is not available');
    });

    it('should set switching state during transition', async () => {
      // Setup: Audirvana available
      audirvanaInstalled.set(true);
      audirvanaService.set({ loaded: true, enabled: true, active: true, running: true });

      // Mock the socket response
      vi.mocked(socketService.on).mockImplementation((event, handler) => {
        if (event === 'pushAudirvanaStatus') {
          // Simulate delayed response
          setTimeout(() => {
            (handler as (status: AudiorvanaStatus) => void)({
              installed: true,
              service: { loaded: true, enabled: true, active: true, running: true },
              instances: []
            });
          }, 100);
        }
        return () => {};
      });

      const switchPromise = audioEngineActions.switchTo('audirvana');

      // Should be switching immediately
      expect(get(engineSwitching)).toBe(true);

      await switchPromise;

      // Should be done switching
      expect(get(engineSwitching)).toBe(false);
    });

    it.skip('should not allow concurrent switches', async () => {
      // Setup: Start from audirvana engine, and Audirvana is available
      audirvanaInstalled.set(true);
      audirvanaService.set({ loaded: true, enabled: true, active: true, running: true });
      audioEngineState.update(s => ({ ...s, active: 'audirvana' }));

      // Mock slow response - never resolves immediately
      vi.mocked(socketService.on).mockImplementation(() => { return () => {}; });

      // Start first switch to MPD (don't await)
      const promise1 = audioEngineActions.switchTo('mpd');

      // Wait for the switch to enter the switching state
      await new Promise(r => setTimeout(r, 10));
      expect(get(engineSwitching)).toBe(true);

      // Try to start second switch while first is in progress
      // This should be rejected because we're already switching
      const result2 = await audioEngineActions.switchTo('audirvana');

      // Second switch should be rejected because we're already switching
      expect(result2).toBe(false);

      // Manually resolve the first promise by updating the store to show audirvana stopped
      audirvanaService.set({ loaded: true, enabled: true, active: false, running: false });

      // Wait for promise to resolve (via polling)
      await promise1;
    });
  });

  describe('stopAudirvana with confirmation', () => {
    it('should wait for pushAudirvanaStatus confirmation', async () => {
      // Setup: Currently on Audirvana
      audirvanaInstalled.set(true);
      audirvanaService.set({ loaded: true, enabled: true, active: true, running: true });
      audioEngineState.update(s => ({ ...s, active: 'audirvana' }));

      let statusHandler: ((status: AudiorvanaStatus) => void) | null = null;
      vi.mocked(socketService.on).mockImplementation((event, handler) => {
        if (event === 'pushAudirvanaStatus') {
          statusHandler = handler as (status: AudiorvanaStatus) => void;
        }
        return () => {};
      });

      const switchPromise = audioEngineActions.switchTo('mpd');

      // Emit should be called
      expect(socketService.emit).toHaveBeenCalledWith('audirvanaStopService');

      // Simulate backend confirming Audirvana stopped
      await new Promise(r => setTimeout(r, 100));
      if (statusHandler) {
        (statusHandler as (status: AudiorvanaStatus) => void)({
          installed: true,
          service: { loaded: true, enabled: true, active: false, running: false },
          instances: []
        });
      }

      const result = await switchPromise;
      expect(result).toBe(true);
      expect(get(activeEngine)).toBe('mpd');
    });

    it('should resolve when audirvanaService store shows not running', async () => {
      // Setup: Currently on Audirvana
      audirvanaInstalled.set(true);
      audirvanaService.set({ loaded: true, enabled: true, active: true, running: true });
      audioEngineState.update(s => ({ ...s, active: 'audirvana' }));

      const switchPromise = audioEngineActions.switchTo('mpd');

      // Simulate service stopping via store update (polling check)
      await new Promise(r => setTimeout(r, 100));
      audirvanaService.set({ loaded: true, enabled: true, active: false, running: false });

      const result = await switchPromise;
      expect(result).toBe(true);
    });
  });

  describe('startAudirvana with confirmation', () => {
    it('should wait for pushAudirvanaStatus confirmation of running', async () => {
      // Setup: Audirvana installed and running (so canUseAudirvana returns true)
      // The switch will stop MPD first, then start Audirvana
      audirvanaInstalled.set(true);
      audirvanaService.set({ loaded: true, enabled: true, active: true, running: true });

      let statusHandler: ((status: AudiorvanaStatus) => void) | null = null;
      vi.mocked(socketService.on).mockImplementation((event, handler) => {
        if (event === 'pushAudirvanaStatus') {
          statusHandler = handler as (status: AudiorvanaStatus) => void;
        }
        return () => {};
      });

      const switchPromise = audioEngineActions.switchTo('audirvana');

      // Wait for the switch process to start and emit
      await new Promise(r => setTimeout(r, 600)); // Wait for stopMpd timeout (500ms) + buffer

      // Now audirvanaStartService should be emitted
      expect(socketService.emit).toHaveBeenCalledWith('audirvanaStartService');

      // Simulate backend confirming Audirvana started
      if (statusHandler) {
        (statusHandler as (status: AudiorvanaStatus) => void)({
          installed: true,
          service: { loaded: true, enabled: true, active: true, running: true },
          instances: []
        });
      }

      const result = await switchPromise;
      expect(result).toBe(true);
      expect(get(activeEngine)).toBe('audirvana');
    });
  });

  describe('error handling', () => {
    it('clearError should reset error state', () => {
      audioEngineState.update(s => ({ ...s, error: 'Test error' }));
      expect(get(audioEngineState).error).toBe('Test error');

      audioEngineActions.clearError();
      expect(get(audioEngineState).error).toBeNull();
    });

    it('reset should restore initial state', () => {
      audioEngineState.update(s => ({
        ...s,
        active: 'audirvana',
        switching: true,
        error: 'Error'
      }));

      audioEngineActions.reset();

      expect(get(activeEngine)).toBe('mpd');
      expect(get(engineSwitching)).toBe(false);
      expect(get(audioEngineState).error).toBeNull();
    });
  });
});
