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
  sourcesLoading,
  sourcesError,
  initSourcesStore,
  cleanupSourcesStore,
  sourcesActions,
  type NasShare,
  type SourceResult
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
    sourcesLoading.set(false);
    sourcesError.set(null);
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
      expect(socketService.on).toHaveBeenCalledTimes(2); // 2 event types (pushListNasShares, pushNasShareResult)
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
      expect(socketService.on).toHaveBeenCalledTimes(2);

      cleanupSourcesStore();

      vi.clearAllMocks();
      initSourcesStore();

      // Should register again after cleanup
      expect(socketService.on).toHaveBeenCalledTimes(2);
    });
  });
});
