import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock getVolumioHost before importing LCD store
vi.mock('$lib/config', () => ({
  getVolumioHost: vi.fn(() => 'http://192.168.86.34:8080')
}));

// Import mocked fetch from setup
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  lcdState,
  lcdLoading,
  lcdActions,
  initLcdStore,
  cleanupLcdStore,
  type LcdState
} from '../lcd';

describe('LCD store', () => {
  beforeEach(() => {
    // Reset stores and mocks
    lcdState.set('unknown');
    lcdLoading.set(false);
    mockFetch.mockReset();
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
  });

  describe('lcdActions.getStatus', () => {
    it('should fetch status and update state to "on"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'on' })
      });

      const result = await lcdActions.getStatus();

      expect(result).toBe('on');
      expect(get(lcdState)).toBe('on');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/screen\/status$/),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Auth-Token': 'volumio-lcd-control'
          })
        })
      );
    });

    it('should fetch status and update state to "off"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'off' })
      });

      const result = await lcdActions.getStatus();

      expect(result).toBe('off');
      expect(get(lcdState)).toBe('off');
    });

    it('should return "unknown" on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await lcdActions.getStatus();

      expect(result).toBe('unknown');
      expect(get(lcdState)).toBe('unknown');
    });

    it('should return "unknown" on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await lcdActions.getStatus();

      expect(result).toBe('unknown');
      expect(get(lcdState)).toBe('unknown');
    });
  });

  describe('lcdActions.turnOff', () => {
    it('should call API and update state to "off" on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await lcdActions.turnOff();

      expect(result).toBe(true);
      expect(get(lcdState)).toBe('off');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/screen\/off$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Auth-Token': 'volumio-lcd-control',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should set loading state during operation', async () => {
      let loadingDuringFetch = false;

      mockFetch.mockImplementationOnce(async () => {
        loadingDuringFetch = get(lcdLoading);
        return {
          ok: true,
          json: () => Promise.resolve({ success: true })
        };
      });

      await lcdActions.turnOff();

      expect(loadingDuringFetch).toBe(true);
      expect(get(lcdLoading)).toBe(false); // Should be false after completion
    });

    it('should return false on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await lcdActions.turnOff();

      expect(result).toBe(false);
      expect(get(lcdLoading)).toBe(false);
    });

    it('should return false when success is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false })
      });

      const result = await lcdActions.turnOff();

      expect(result).toBe(false);
    });
  });

  describe('lcdActions.turnOn', () => {
    it('should call API and update state to "on" on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await lcdActions.turnOn();

      expect(result).toBe(true);
      expect(get(lcdState)).toBe('on');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/screen\/on$/),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should set loading state during operation', async () => {
      let loadingDuringFetch = false;

      mockFetch.mockImplementationOnce(async () => {
        loadingDuringFetch = get(lcdLoading);
        return {
          ok: true,
          json: () => Promise.resolve({ success: true })
        };
      });

      await lcdActions.turnOn();

      expect(loadingDuringFetch).toBe(true);
      expect(get(lcdLoading)).toBe(false);
    });

    it('should return false on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await lcdActions.turnOn();

      expect(result).toBe(false);
    });
  });

  describe('lcdActions.toggle', () => {
    it('should turn on when currently off', async () => {
      // First set state to off
      lcdState.set('off');

      // Mock the turnOn call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await lcdActions.toggle();

      expect(result).toBe(true);
      expect(get(lcdState)).toBe('on');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/screen/on'),
        expect.any(Object)
      );
    });

    it('should turn off when currently on', async () => {
      // First set state to on
      lcdState.set('on');

      // Mock the turnOff call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await lcdActions.toggle();

      expect(result).toBe(true);
      expect(get(lcdState)).toBe('off');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/screen/off'),
        expect.any(Object)
      );
    });

    it('should fetch status first when state is unknown', async () => {
      // State is unknown initially
      expect(get(lcdState)).toBe('unknown');

      // Mock getStatus call returning 'on'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'on' })
      });

      // Mock turnOff call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await lcdActions.toggle();

      expect(result).toBe(true);
      // Should have called getStatus first, then turnOff
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/api/screen/status'),
        expect.any(Object)
      );
    });
  });

  describe('initLcdStore', () => {
    it('should fetch initial status on init', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'on' })
      });

      initLcdStore();

      // Wait for async status fetch
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe('URL generation', () => {
    it('should generate correct LCD service URL from Volumio host', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'on' })
      });

      await lcdActions.getStatus();

      // Should use port 8081 instead of the default 8080
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/screen\/status$/),
        expect.any(Object)
      );
    });
  });
});
