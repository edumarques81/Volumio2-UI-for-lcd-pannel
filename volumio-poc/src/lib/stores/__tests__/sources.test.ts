import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock socket service
vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(() => () => {})
  }
}));

// Import store after mock is defined
import {
  nasShares,
  nasDevices,
  nasSharesList,
  sourcesLoading,
  sourcesError,
  discoveryInProgress,
  initSourcesStore,
  cleanupSourcesStore,
  sourcesActions,
  type NasShare,
  type NasDevice,
  type ShareInfo,
  type SourceResult,
  type DiscoverResult,
  type BrowseSharesResult
} from '../sources';
import { socketService } from '$lib/services/socket';

describe('Sources store', () => {
  const mockNasShare: NasShare = {
    id: 'test-id-123',
    name: 'TestNAS',
    ip: '192.168.1.100',
    path: 'Music',
    fstype: 'cifs',
    username: 'user',
    mounted: true,
    mountPoint: '/mnt/NAS/TestNAS'
  };

  beforeEach(() => {
    // Reset stores
    nasShares.set([]);
    nasDevices.set([]);
    nasSharesList.set([]);
    sourcesLoading.set(false);
    sourcesError.set(null);
    discoveryInProgress.set(false);
    vi.clearAllMocks();
    cleanupSourcesStore();
  });

  afterEach(() => {
    cleanupSourcesStore();
  });

  describe('initial state', () => {
    it('should have empty nasShares initially', () => {
      expect(get(nasShares)).toEqual([]);
    });

    it('should have loading false initially', () => {
      expect(get(sourcesLoading)).toBe(false);
    });

    it('should have no error initially', () => {
      expect(get(sourcesError)).toBeNull();
    });
  });

  describe('initSourcesStore', () => {
    it('should register pushListNasShares event handler', () => {
      initSourcesStore();
      expect(socketService.on).toHaveBeenCalledWith('pushListNasShares', expect.any(Function));
    });

    it('should register pushNasShareResult event handler', () => {
      initSourcesStore();
      expect(socketService.on).toHaveBeenCalledWith('pushNasShareResult', expect.any(Function));
    });

    it('should not register multiple handlers on repeated init calls', () => {
      initSourcesStore();
      initSourcesStore();
      initSourcesStore();

      // Should only register once due to initialized flag
      // 4 event types: pushListNasShares, pushNasShareResult, pushNasDevices, pushBrowseNasShares
      expect(socketService.on).toHaveBeenCalledTimes(4);
    });
  });

  describe('pushListNasShares handler', () => {
    it('should update nasShares when receiving shares', () => {
      initSourcesStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushListNasShares')?.[1] as ((shares: NasShare[]) => void) | undefined;
      expect(handler).toBeDefined();

      handler!([mockNasShare]);

      expect(get(nasShares)).toEqual([mockNasShare]);
      expect(get(sourcesLoading)).toBe(false);
    });

    it('should handle empty shares array', () => {
      initSourcesStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushListNasShares')?.[1] as ((shares: NasShare[]) => void) | undefined;

      handler!([]);

      expect(get(nasShares)).toEqual([]);
    });

    it('should handle null shares', () => {
      initSourcesStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushListNasShares')?.[1] as ((shares: NasShare[] | null) => void) | undefined;

      handler!(null as any);

      expect(get(nasShares)).toEqual([]);
    });
  });

  describe('pushNasShareResult handler', () => {
    it('should clear loading on success', () => {
      sourcesLoading.set(true);
      initSourcesStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushNasShareResult')?.[1] as ((result: SourceResult) => void) | undefined;

      handler!({ success: true, message: 'Share added' });

      expect(get(sourcesLoading)).toBe(false);
      expect(get(sourcesError)).toBeNull();
    });

    it('should set error on failure', () => {
      initSourcesStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushNasShareResult')?.[1] as ((result: SourceResult) => void) | undefined;

      handler!({ success: false, error: 'Mount failed' });

      expect(get(sourcesLoading)).toBe(false);
      expect(get(sourcesError)).toBe('Mount failed');
    });
  });

  describe('sourcesActions', () => {
    describe('listNasShares', () => {
      it('should emit getListNasShares', () => {
        sourcesActions.listNasShares();
        expect(socketService.emit).toHaveBeenCalledWith('getListNasShares');
      });

      it('should set loading to true', () => {
        sourcesActions.listNasShares();
        expect(get(sourcesLoading)).toBe(true);
      });
    });

    describe('addNasShare', () => {
      it('should emit addNasShare with request data', () => {
        const request = {
          name: 'TestNAS',
          ip: '192.168.1.100',
          path: 'Music',
          fstype: 'cifs' as const,
          username: 'user',
          password: 'pass'
        };

        sourcesActions.addNasShare(request);

        expect(socketService.emit).toHaveBeenCalledWith('addNasShare', request);
        expect(get(sourcesLoading)).toBe(true);
        expect(get(sourcesError)).toBeNull();
      });
    });

    describe('deleteNasShare', () => {
      it('should emit deleteNasShare with id', () => {
        sourcesActions.deleteNasShare('test-id-123');

        expect(socketService.emit).toHaveBeenCalledWith('deleteNasShare', { id: 'test-id-123' });
        expect(get(sourcesLoading)).toBe(true);
      });
    });

    describe('mountNasShare', () => {
      it('should emit mountNasShare with id', () => {
        sourcesActions.mountNasShare('test-id-123');

        expect(socketService.emit).toHaveBeenCalledWith('mountNasShare', { id: 'test-id-123' });
        expect(get(sourcesLoading)).toBe(true);
      });
    });

    describe('unmountNasShare', () => {
      it('should emit unmountNasShare with id', () => {
        sourcesActions.unmountNasShare('test-id-123');

        expect(socketService.emit).toHaveBeenCalledWith('unmountNasShare', { id: 'test-id-123' });
        expect(get(sourcesLoading)).toBe(true);
      });
    });
  });

  describe('cleanupSourcesStore', () => {
    it('should reset all stores', () => {
      // Set some values
      nasShares.set([mockNasShare]);
      sourcesLoading.set(true);
      sourcesError.set('some error');

      cleanupSourcesStore();

      expect(get(nasShares)).toEqual([]);
      expect(get(sourcesLoading)).toBe(false);
      expect(get(sourcesError)).toBeNull();
    });

    it('should allow re-initialization after cleanup', () => {
      initSourcesStore();
      expect(socketService.on).toHaveBeenCalledTimes(4); // Updated for Phase 2: 4 event types

      cleanupSourcesStore();

      vi.clearAllMocks();
      initSourcesStore();

      // Should register again after cleanup
      expect(socketService.on).toHaveBeenCalledTimes(4);
    });

    it('should reset Phase 2 stores on cleanup', () => {
      // Set some Phase 2 values
      nasDevices.set([{ name: 'NAS1', ip: '192.168.1.10' }]);
      nasSharesList.set([{ name: 'Music', type: 'disk', writable: true }]);
      discoveryInProgress.set(true);

      cleanupSourcesStore();

      expect(get(nasDevices)).toEqual([]);
      expect(get(nasSharesList)).toEqual([]);
      expect(get(discoveryInProgress)).toBe(false);
    });
  });

  // ============================================================
  // Phase 2: NAS Discovery Tests
  // ============================================================

  describe('Phase 2: NAS Discovery', () => {
    describe('initSourcesStore with discovery events', () => {
      it('should register pushNasDevices event handler', () => {
        initSourcesStore();
        expect(socketService.on).toHaveBeenCalledWith('pushNasDevices', expect.any(Function));
      });

      it('should register pushBrowseNasShares event handler', () => {
        initSourcesStore();
        expect(socketService.on).toHaveBeenCalledWith('pushBrowseNasShares', expect.any(Function));
      });
    });

    describe('pushNasDevices handler', () => {
      const mockDevices: NasDevice[] = [
        { name: 'NAS1', ip: '192.168.1.10', hostname: 'nas1.local' },
        { name: 'NAS2', ip: '192.168.1.20', hostname: 'nas2.local' }
      ];

      it('should update nasDevices when receiving devices', () => {
        discoveryInProgress.set(true);
        initSourcesStore();

        const onMock = vi.mocked(socketService.on);
        const handler = onMock.mock.calls.find(call => call[0] === 'pushNasDevices')?.[1] as ((result: DiscoverResult) => void) | undefined;
        expect(handler).toBeDefined();

        handler!({ devices: mockDevices });

        expect(get(nasDevices)).toEqual(mockDevices);
        expect(get(discoveryInProgress)).toBe(false);
      });

      it('should handle empty devices array', () => {
        initSourcesStore();

        const onMock = vi.mocked(socketService.on);
        const handler = onMock.mock.calls.find(call => call[0] === 'pushNasDevices')?.[1] as ((result: DiscoverResult) => void) | undefined;

        handler!({ devices: [] });

        expect(get(nasDevices)).toEqual([]);
      });

      it('should set error on discovery failure', () => {
        initSourcesStore();

        const onMock = vi.mocked(socketService.on);
        const handler = onMock.mock.calls.find(call => call[0] === 'pushNasDevices')?.[1] as ((result: DiscoverResult) => void) | undefined;

        handler!({ devices: [], error: 'Network scan failed' });

        expect(get(nasDevices)).toEqual([]);
        expect(get(sourcesError)).toBe('Network scan failed');
      });
    });

    describe('pushBrowseNasShares handler', () => {
      const mockShares: ShareInfo[] = [
        { name: 'Music', type: 'disk', comment: 'Music files', writable: true },
        { name: 'Videos', type: 'disk', comment: 'Video files', writable: true }
      ];

      it('should update nasSharesList when receiving shares', () => {
        sourcesLoading.set(true);
        initSourcesStore();

        const onMock = vi.mocked(socketService.on);
        const handler = onMock.mock.calls.find(call => call[0] === 'pushBrowseNasShares')?.[1] as ((result: BrowseSharesResult) => void) | undefined;
        expect(handler).toBeDefined();

        handler!({ shares: mockShares });

        expect(get(nasSharesList)).toEqual(mockShares);
        expect(get(sourcesLoading)).toBe(false);
      });

      it('should set error on auth failure', () => {
        initSourcesStore();

        const onMock = vi.mocked(socketService.on);
        const handler = onMock.mock.calls.find(call => call[0] === 'pushBrowseNasShares')?.[1] as ((result: BrowseSharesResult) => void) | undefined;

        handler!({ shares: [], error: 'authentication required' });

        expect(get(nasSharesList)).toEqual([]);
        expect(get(sourcesError)).toBe('authentication required');
      });
    });

    describe('sourcesActions.discoverNasDevices', () => {
      it('should emit discoverNasDevices event', () => {
        sourcesActions.discoverNasDevices();
        expect(socketService.emit).toHaveBeenCalledWith('discoverNasDevices');
      });

      it('should set discoveryInProgress to true', () => {
        sourcesActions.discoverNasDevices();
        expect(get(discoveryInProgress)).toBe(true);
      });

      it('should clear existing devices', () => {
        nasDevices.set([{ name: 'OldNAS', ip: '192.168.1.99' }]);
        sourcesActions.discoverNasDevices();
        expect(get(nasDevices)).toEqual([]);
      });
    });

    describe('sourcesActions.browseNasShares', () => {
      it('should emit browseNasShares with host', () => {
        sourcesActions.browseNasShares('192.168.1.10');
        expect(socketService.emit).toHaveBeenCalledWith('browseNasShares', {
          host: '192.168.1.10',
          username: undefined,
          password: undefined
        });
      });

      it('should emit browseNasShares with credentials', () => {
        sourcesActions.browseNasShares('192.168.1.10', 'user', 'pass');
        expect(socketService.emit).toHaveBeenCalledWith('browseNasShares', {
          host: '192.168.1.10',
          username: 'user',
          password: 'pass'
        });
      });

      it('should set loading to true', () => {
        sourcesActions.browseNasShares('192.168.1.10');
        expect(get(sourcesLoading)).toBe(true);
      });

      it('should clear existing shares list', () => {
        nasSharesList.set([{ name: 'OldShare', type: 'disk', writable: true }]);
        sourcesActions.browseNasShares('192.168.1.10');
        expect(get(nasSharesList)).toEqual([]);
      });
    });

    describe('sourcesActions.clearDiscovery', () => {
      it('should clear all discovery state', () => {
        nasDevices.set([{ name: 'NAS1', ip: '192.168.1.10' }]);
        nasSharesList.set([{ name: 'Music', type: 'disk', writable: true }]);
        discoveryInProgress.set(true);

        sourcesActions.clearDiscovery();

        expect(get(nasDevices)).toEqual([]);
        expect(get(nasSharesList)).toEqual([]);
        expect(get(discoveryInProgress)).toBe(false);
      });
    });
  });
});
