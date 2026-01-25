import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  audirvanaInstalled,
  audirvanaService,
  audirvanaInstances,
  audirvanaLoading,
  audirvanaError,
  audirvanaAvailable,
  audirvanaInstanceCount,
  audirvanaFullStatus,
  audirvanaActions,
  initAudirvanaStore,
  cleanupAudirvanaStore
} from '../audirvana';
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

describe('Audirvana Store', () => {
  beforeEach(() => {
    // Reset all stores
    audirvanaActions.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupAudirvanaStore();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      expect(get(audirvanaInstalled)).toBe(false);
      expect(get(audirvanaService)).toEqual({
        loaded: false,
        enabled: false,
        active: false,
        running: false
      });
      expect(get(audirvanaInstances)).toEqual([]);
      expect(get(audirvanaLoading)).toBe(false);
      expect(get(audirvanaError)).toBeNull();
    });
  });

  describe('derived stores', () => {
    it('should compute audirvanaAvailable correctly', () => {
      expect(get(audirvanaAvailable)).toBe(false);

      audirvanaInstalled.set(true);
      expect(get(audirvanaAvailable)).toBe(false);

      audirvanaService.set({
        loaded: true,
        enabled: true,
        active: true,
        running: true,
        pid: 1234
      });
      expect(get(audirvanaAvailable)).toBe(true);

      audirvanaInstalled.set(false);
      expect(get(audirvanaAvailable)).toBe(false);
    });

    it('should compute audirvanaInstanceCount correctly', () => {
      expect(get(audirvanaInstanceCount)).toBe(0);

      audirvanaInstances.set([
        {
          name: 'stellar',
          hostname: 'stellar.local',
          address: '192.168.86.34',
          port: 39887,
          protocol_version: '4.1.0',
          os: 'Linux'
        }
      ]);
      expect(get(audirvanaInstanceCount)).toBe(1);

      audirvanaInstances.set([
        {
          name: 'stellar',
          hostname: 'stellar.local',
          address: '192.168.86.34',
          port: 39887,
          protocol_version: '4.1.0',
          os: 'Linux'
        },
        {
          name: 'desktop',
          hostname: 'desktop.local',
          address: '192.168.86.28',
          port: 57768,
          protocol_version: '4.1.0',
          os: 'Win'
        }
      ]);
      expect(get(audirvanaInstanceCount)).toBe(2);
    });

    it('should compute audirvanaFullStatus correctly', () => {
      const status = get(audirvanaFullStatus);
      expect(status).toEqual({
        installed: false,
        service: {
          loaded: false,
          enabled: false,
          active: false,
          running: false
        },
        instances: [],
        error: undefined
      });
    });
  });

  describe('actions', () => {
    it('refresh should emit getAudirvanaStatus and set loading', () => {
      audirvanaActions.refresh();

      expect(get(audirvanaLoading)).toBe(true);
      expect(get(audirvanaError)).toBeNull();
      expect(socketService.emit).toHaveBeenCalledWith('getAudirvanaStatus');
    });

    it('startService should emit audirvanaStartService', () => {
      audirvanaActions.startService();
      expect(socketService.emit).toHaveBeenCalledWith('audirvanaStartService');
    });

    it('stopService should emit audirvanaStopService', () => {
      audirvanaActions.stopService();
      expect(socketService.emit).toHaveBeenCalledWith('audirvanaStopService');
    });

    it('clearError should clear error state', () => {
      audirvanaError.set('Some error');
      expect(get(audirvanaError)).toBe('Some error');

      audirvanaActions.clearError();
      expect(get(audirvanaError)).toBeNull();
    });

    it('reset should restore initial state', () => {
      // Set some state
      audirvanaInstalled.set(true);
      audirvanaService.set({
        loaded: true,
        enabled: true,
        active: true,
        running: true,
        pid: 1234
      });
      audirvanaInstances.set([
        {
          name: 'test',
          hostname: 'test.local',
          address: '192.168.1.1',
          port: 12345,
          protocol_version: '1.0',
          os: 'Linux'
        }
      ]);
      audirvanaLoading.set(true);
      audirvanaError.set('Error');

      // Reset
      audirvanaActions.reset();

      // Verify reset
      expect(get(audirvanaInstalled)).toBe(false);
      expect(get(audirvanaService)).toEqual({
        loaded: false,
        enabled: false,
        active: false,
        running: false
      });
      expect(get(audirvanaInstances)).toEqual([]);
      expect(get(audirvanaLoading)).toBe(false);
      expect(get(audirvanaError)).toBeNull();
    });
  });

  describe('initialization', () => {
    it('should register event handlers on init', () => {
      initAudirvanaStore();

      expect(socketService.on).toHaveBeenCalledWith(
        'pushAudirvanaStatus',
        expect.any(Function)
      );
      expect(socketService.emit).toHaveBeenCalledWith('getAudirvanaStatus');
    });

    it('should unregister event handlers on cleanup', () => {
      initAudirvanaStore();
      cleanupAudirvanaStore();

      expect(socketService.off).toHaveBeenCalledWith(
        'pushAudirvanaStatus',
        expect.any(Function)
      );
    });

    it('should not double-initialize', () => {
      initAudirvanaStore();
      initAudirvanaStore();

      // Should only register once
      expect(socketService.on).toHaveBeenCalledTimes(1);
    });
  });

  describe('event handling', () => {
    it('should update stores on pushAudirvanaStatus', () => {
      initAudirvanaStore();

      // Get the registered handler
      const onCall = vi.mocked(socketService.on).mock.calls.find(
        call => call[0] === 'pushAudirvanaStatus'
      );
      expect(onCall).toBeDefined();
      const handler = onCall![1] as (status: AudiorvanaStatus) => void;

      // Simulate receiving status
      const mockStatus: AudiorvanaStatus = {
        installed: true,
        service: {
          loaded: true,
          enabled: true,
          active: true,
          running: true,
          pid: 6448
        },
        instances: [
          {
            name: 'stellar',
            hostname: 'stellar.local',
            address: '192.168.86.34',
            port: 39887,
            protocol_version: '4.1.0',
            os: 'Linux'
          }
        ]
      };

      audirvanaLoading.set(true);
      handler(mockStatus);

      expect(get(audirvanaLoading)).toBe(false);
      expect(get(audirvanaInstalled)).toBe(true);
      expect(get(audirvanaService)).toEqual(mockStatus.service);
      expect(get(audirvanaInstances)).toEqual(mockStatus.instances);
      expect(get(audirvanaError)).toBeNull();
    });

    it('should handle error in status', () => {
      initAudirvanaStore();

      const onCall = vi.mocked(socketService.on).mock.calls.find(
        call => call[0] === 'pushAudirvanaStatus'
      );
      const handler = onCall![1] as (status: AudiorvanaStatus) => void;

      const mockStatus: AudiorvanaStatus = {
        installed: false,
        service: {
          loaded: false,
          enabled: false,
          active: false,
          running: false
        },
        instances: [],
        error: 'Failed to detect Audirvana'
      };

      handler(mockStatus);

      expect(get(audirvanaError)).toBe('Failed to detect Audirvana');
    });
  });
});
