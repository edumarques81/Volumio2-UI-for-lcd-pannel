import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock socket service before any store imports
vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(() => () => {})
  }
}));

import {
  nasShares,
  nasSharesLoading,
  lastShareResult,
  discoveredDevices,
  discoveryLoading,
  discoveryError,
  browsedShares,
  browseLoading,
  browseError,
  mountedNasShares,
  unmountedNasShares,
  sourcesActions,
  initSourcesStore,
  cleanupSourcesStore,
  type NasShare,
  type NasDevice,
  type ShareInfo,
  type SourceResult,
  type DiscoverResult,
  type BrowseSharesResult,
  type AddNasShareRequest
} from '../sources';
import { socketService } from '$lib/services/socket';

// Helper to extract a registered handler by event name
function getHandler<T>(eventName: string): ((payload: T) => void) | undefined {
  const onMock = vi.mocked(socketService.on);
  const call = onMock.mock.calls.find(c => c[0] === eventName);
  return call?.[1] as ((payload: T) => void) | undefined;
}

const sampleShare: NasShare = {
  id: 'abc',
  name: 'Music NAS',
  ip: '192.168.1.10',
  path: '/music',
  fstype: 'cifs',
  mounted: true,
  mountPoint: '/mnt/NAS/Music NAS'
};

const unmountedShare: NasShare = {
  id: 'def',
  name: 'Backup NAS',
  ip: '192.168.1.11',
  path: '/backup',
  fstype: 'nfs',
  mounted: false,
  mountPoint: ''
};

describe('Sources store (NAS share management)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupSourcesStore();
  });

  afterEach(() => {
    cleanupSourcesStore();
  });

  // -----------------------------------------------------------------------
  // 1. listShares() emits getListNasShares and sets nasSharesLoading = true
  // -----------------------------------------------------------------------
  describe('listShares()', () => {
    it('emits getListNasShares', () => {
      sourcesActions.listShares();
      expect(socketService.emit).toHaveBeenCalledWith('getListNasShares');
    });

    it('sets nasSharesLoading to true', () => {
      sourcesActions.listShares();
      expect(get(nasSharesLoading)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 2. pushListNasShares listener updates nasShares and clears loading
  // -----------------------------------------------------------------------
  describe('pushListNasShares handler', () => {
    it('updates nasShares with received payload', () => {
      initSourcesStore();
      const handler = getHandler<NasShare[]>('pushListNasShares');
      expect(handler).toBeDefined();

      handler!([sampleShare]);
      expect(get(nasShares)).toEqual([sampleShare]);
    });

    it('sets nasSharesLoading to false after receiving list', () => {
      initSourcesStore();
      nasSharesLoading.set(true);

      const handler = getHandler<NasShare[]>('pushListNasShares');
      handler!([sampleShare]);

      expect(get(nasSharesLoading)).toBe(false);
    });

    it('handles empty list', () => {
      initSourcesStore();
      nasShares.set([sampleShare]);

      const handler = getHandler<NasShare[]>('pushListNasShares');
      handler!([]);

      expect(get(nasShares)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 3. addShare(req) emits addNasShare with the exact request object
  // -----------------------------------------------------------------------
  describe('addShare()', () => {
    it('emits addNasShare with the full request object', () => {
      const req: AddNasShareRequest = {
        name: 'Music',
        ip: '192.168.1.10',
        path: '/music',
        fstype: 'cifs',
        username: 'user',
        password: 'pass',
        options: 'vers=3.0'
      };
      sourcesActions.addShare(req);
      expect(socketService.emit).toHaveBeenCalledWith('addNasShare', req);
    });

    it('emits addNasShare with minimal required fields', () => {
      const req: AddNasShareRequest = {
        name: 'NFS Share',
        ip: '10.0.0.5',
        path: '/exports/media',
        fstype: 'nfs'
      };
      sourcesActions.addShare(req);
      expect(socketService.emit).toHaveBeenCalledWith('addNasShare', req);
    });
  });

  // -----------------------------------------------------------------------
  // 4. pushNasShareResult updates lastShareResult
  // -----------------------------------------------------------------------
  describe('pushNasShareResult handler', () => {
    it('updates lastShareResult on success', () => {
      initSourcesStore();
      const result: SourceResult = { success: true, message: 'Share added' };

      const handler = getHandler<SourceResult>('pushNasShareResult');
      expect(handler).toBeDefined();
      handler!(result);

      expect(get(lastShareResult)).toEqual(result);
    });

    it('updates lastShareResult on failure', () => {
      initSourcesStore();
      const result: SourceResult = { success: false, error: 'Mount failed' };

      const handler = getHandler<SourceResult>('pushNasShareResult');
      handler!(result);

      expect(get(lastShareResult)).toEqual(result);
    });

    it('does not reset nasShares (backend pushes pushListNasShares separately)', () => {
      initSourcesStore();
      nasShares.set([sampleShare]);

      const handler = getHandler<SourceResult>('pushNasShareResult');
      handler!({ success: true });

      // nasShares must remain unchanged — the backend handles the list update separately
      expect(get(nasShares)).toEqual([sampleShare]);
    });
  });

  // -----------------------------------------------------------------------
  // 5. clearLastResult() resets lastShareResult to null
  // -----------------------------------------------------------------------
  describe('clearLastResult()', () => {
    it('resets lastShareResult to null', () => {
      lastShareResult.set({ success: true, message: 'ok' });
      sourcesActions.clearLastResult();
      expect(get(lastShareResult)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 6. deleteShare('abc') emits deleteNasShare with {id: 'abc'}
  // -----------------------------------------------------------------------
  describe('deleteShare()', () => {
    it('emits deleteNasShare with {id}', () => {
      sourcesActions.deleteShare('abc');
      expect(socketService.emit).toHaveBeenCalledWith('deleteNasShare', { id: 'abc' });
    });
  });

  // -----------------------------------------------------------------------
  // 7. mountShare('abc') emits mountNasShare with {id: 'abc'}
  // -----------------------------------------------------------------------
  describe('mountShare()', () => {
    it('emits mountNasShare with {id}', () => {
      sourcesActions.mountShare('abc');
      expect(socketService.emit).toHaveBeenCalledWith('mountNasShare', { id: 'abc' });
    });
  });

  // -----------------------------------------------------------------------
  // 8. unmountShare('abc') emits unmountNasShare with {id: 'abc'}
  // -----------------------------------------------------------------------
  describe('unmountShare()', () => {
    it('emits unmountNasShare with {id}', () => {
      sourcesActions.unmountShare('abc');
      expect(socketService.emit).toHaveBeenCalledWith('unmountNasShare', { id: 'abc' });
    });
  });

  // -----------------------------------------------------------------------
  // 9. discoverDevices() emits discoverNasDevices and toggles loading
  // -----------------------------------------------------------------------
  describe('discoverDevices()', () => {
    it('emits discoverNasDevices', () => {
      sourcesActions.discoverDevices();
      expect(socketService.emit).toHaveBeenCalledWith('discoverNasDevices');
    });

    it('sets discoveryLoading to true', () => {
      sourcesActions.discoverDevices();
      expect(get(discoveryLoading)).toBe(true);
    });

    it('clears discoveryError', () => {
      discoveryError.set('previous error');
      sourcesActions.discoverDevices();
      expect(get(discoveryError)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 10. pushNasDevices updates discoveredDevices and clears loading
  // -----------------------------------------------------------------------
  describe('pushNasDevices handler — success', () => {
    it('updates discoveredDevices', () => {
      initSourcesStore();
      const devices: NasDevice[] = [{ name: 'NAS-1', ip: '192.168.1.10' }];
      const payload: DiscoverResult = { devices };

      const handler = getHandler<DiscoverResult>('pushNasDevices');
      expect(handler).toBeDefined();
      handler!(payload);

      expect(get(discoveredDevices)).toEqual(devices);
    });

    it('sets discoveryLoading to false', () => {
      initSourcesStore();
      discoveryLoading.set(true);

      const handler = getHandler<DiscoverResult>('pushNasDevices');
      handler!({ devices: [] });

      expect(get(discoveryLoading)).toBe(false);
    });

    it('clears discoveryError on success', () => {
      initSourcesStore();
      discoveryError.set('stale error');

      const handler = getHandler<DiscoverResult>('pushNasDevices');
      handler!({ devices: [{ name: 'NAS-1', ip: '192.168.1.10' }] });

      expect(get(discoveryError)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 11. pushNasDevices with error field populates discoveryError
  // -----------------------------------------------------------------------
  describe('pushNasDevices handler — error', () => {
    it('sets discoveryError when payload contains error', () => {
      initSourcesStore();

      const handler = getHandler<DiscoverResult>('pushNasDevices');
      handler!({ devices: [], error: 'Network unreachable' });

      expect(get(discoveryError)).toBe('Network unreachable');
    });

    it('sets discoveredDevices to empty array when error and no devices', () => {
      initSourcesStore();
      discoveredDevices.set([{ name: 'stale', ip: '1.2.3.4' }]);

      const handler = getHandler<DiscoverResult>('pushNasDevices');
      handler!({ devices: [], error: 'Network unreachable' });

      expect(get(discoveredDevices)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 12. browseShares emits browseNasShares with {host, username, password}
  // -----------------------------------------------------------------------
  describe('browseShares()', () => {
    it('emits browseNasShares with host, username, and password', () => {
      sourcesActions.browseShares('192.168.1.5', 'u', 'p');
      expect(socketService.emit).toHaveBeenCalledWith('browseNasShares', {
        host: '192.168.1.5',
        username: 'u',
        password: 'p'
      });
    });

    it('emits browseNasShares without optional credentials', () => {
      sourcesActions.browseShares('192.168.1.5');
      expect(socketService.emit).toHaveBeenCalledWith('browseNasShares', {
        host: '192.168.1.5',
        username: undefined,
        password: undefined
      });
    });

    it('sets browseLoading to true', () => {
      sourcesActions.browseShares('192.168.1.5');
      expect(get(browseLoading)).toBe(true);
    });

    it('clears browseError', () => {
      browseError.set('previous error');
      sourcesActions.browseShares('192.168.1.5');
      expect(get(browseError)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 13. pushBrowseNasShares updates browsedShares and clears loading
  // -----------------------------------------------------------------------
  describe('pushBrowseNasShares handler', () => {
    it('updates browsedShares', () => {
      initSourcesStore();
      const shares: ShareInfo[] = [
        { name: 'music', type: 'disk', writable: true },
        { name: 'printer$', type: 'printer', writable: false }
      ];

      const handler = getHandler<BrowseSharesResult>('pushBrowseNasShares');
      expect(handler).toBeDefined();
      handler!({ shares });

      expect(get(browsedShares)).toEqual(shares);
    });

    it('sets browseLoading to false', () => {
      initSourcesStore();
      browseLoading.set(true);

      const handler = getHandler<BrowseSharesResult>('pushBrowseNasShares');
      handler!({ shares: [] });

      expect(get(browseLoading)).toBe(false);
    });

    it('sets browseError when payload contains error', () => {
      initSourcesStore();

      const handler = getHandler<BrowseSharesResult>('pushBrowseNasShares');
      handler!({ shares: [], error: 'Authentication failed' });

      expect(get(browseError)).toBe('Authentication failed');
    });

    it('clears browseError on success', () => {
      initSourcesStore();
      browseError.set('stale error');

      const handler = getHandler<BrowseSharesResult>('pushBrowseNasShares');
      handler!({ shares: [{ name: 'music', type: 'disk', writable: true }] });

      expect(get(browseError)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 14. mountedNasShares / unmountedNasShares derived stores
  // -----------------------------------------------------------------------
  describe('derived stores', () => {
    it('mountedNasShares returns only mounted shares', () => {
      nasShares.set([sampleShare, unmountedShare]);
      expect(get(mountedNasShares)).toEqual([sampleShare]);
    });

    it('unmountedNasShares returns only unmounted shares', () => {
      nasShares.set([sampleShare, unmountedShare]);
      expect(get(unmountedNasShares)).toEqual([unmountedShare]);
    });

    it('mountedNasShares is empty when no shares are mounted', () => {
      nasShares.set([unmountedShare]);
      expect(get(mountedNasShares)).toHaveLength(0);
    });

    it('unmountedNasShares is empty when all shares are mounted', () => {
      nasShares.set([sampleShare]);
      expect(get(unmountedNasShares)).toHaveLength(0);
    });

    it('both derived stores are empty when nasShares is empty', () => {
      nasShares.set([]);
      expect(get(mountedNasShares)).toHaveLength(0);
      expect(get(unmountedNasShares)).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 15. initSourcesStore() is idempotent (calling twice doesn't double-register)
  // -----------------------------------------------------------------------
  describe('initSourcesStore() idempotency', () => {
    it('registers each event handler exactly once even when called multiple times', () => {
      initSourcesStore();
      initSourcesStore();
      initSourcesStore();

      const onMock = vi.mocked(socketService.on);
      const pushListCalls = onMock.mock.calls.filter(c => c[0] === 'pushListNasShares');
      const pushResultCalls = onMock.mock.calls.filter(c => c[0] === 'pushNasShareResult');
      const pushDevicesCalls = onMock.mock.calls.filter(c => c[0] === 'pushNasDevices');
      const pushBrowseCalls = onMock.mock.calls.filter(c => c[0] === 'pushBrowseNasShares');

      expect(pushListCalls).toHaveLength(1);
      expect(pushResultCalls).toHaveLength(1);
      expect(pushDevicesCalls).toHaveLength(1);
      expect(pushBrowseCalls).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 16. cleanupSourcesStore() resets state and allows re-init
  // -----------------------------------------------------------------------
  describe('cleanupSourcesStore()', () => {
    it('resets nasShares to empty array', () => {
      nasShares.set([sampleShare]);
      cleanupSourcesStore();
      expect(get(nasShares)).toEqual([]);
    });

    it('resets nasSharesLoading to false', () => {
      nasSharesLoading.set(true);
      cleanupSourcesStore();
      expect(get(nasSharesLoading)).toBe(false);
    });

    it('resets lastShareResult to null', () => {
      lastShareResult.set({ success: true });
      cleanupSourcesStore();
      expect(get(lastShareResult)).toBeNull();
    });

    it('resets discoveredDevices to empty array', () => {
      discoveredDevices.set([{ name: 'NAS', ip: '1.2.3.4' }]);
      cleanupSourcesStore();
      expect(get(discoveredDevices)).toEqual([]);
    });

    it('resets discoveryLoading to false', () => {
      discoveryLoading.set(true);
      cleanupSourcesStore();
      expect(get(discoveryLoading)).toBe(false);
    });

    it('resets discoveryError to null', () => {
      discoveryError.set('err');
      cleanupSourcesStore();
      expect(get(discoveryError)).toBeNull();
    });

    it('resets browsedShares to empty array', () => {
      browsedShares.set([{ name: 'music', type: 'disk', writable: true }]);
      cleanupSourcesStore();
      expect(get(browsedShares)).toEqual([]);
    });

    it('resets browseLoading to false', () => {
      browseLoading.set(true);
      cleanupSourcesStore();
      expect(get(browseLoading)).toBe(false);
    });

    it('resets browseError to null', () => {
      browseError.set('err');
      cleanupSourcesStore();
      expect(get(browseError)).toBeNull();
    });

    it('allows re-initialization after cleanup', () => {
      initSourcesStore();
      cleanupSourcesStore();

      vi.clearAllMocks();
      initSourcesStore();

      const onMock = vi.mocked(socketService.on);
      const pushListCalls = onMock.mock.calls.filter(c => c[0] === 'pushListNasShares');
      expect(pushListCalls).toHaveLength(1);
    });
  });
});
