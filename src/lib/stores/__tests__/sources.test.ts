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
  lastBrowseHostAttempt,
  mountInFlight,
  shareOperationInProgress,
  mountedNasShares,
  unmountedNasShares,
  sourcesActions,
  initSourcesStore,
  cleanupSourcesStore,
  DISCOVERY_TIMEOUT_MS,
  BROWSE_TIMEOUT_MS,
  SHARE_OPERATION_TIMEOUT_MS,
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

    it('sets lastBrowseHostAttempt to host', () => {
      sourcesActions.browseShares('192.168.1.5');
      expect(get(lastBrowseHostAttempt)).toBe('192.168.1.5');
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

    it('resets lastBrowseHostAttempt to null', () => {
      lastBrowseHostAttempt.set('192.168.1.5');
      cleanupSourcesStore();
      expect(get(lastBrowseHostAttempt)).toBeNull();
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

  // -----------------------------------------------------------------------
  // 17. Per-action timeouts (discovery + browse)
  // -----------------------------------------------------------------------
  describe('per-action timeouts', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('discoverDevices: surfaces timeout error after DISCOVERY_TIMEOUT_MS when no pushNasDevices arrives', () => {
      initSourcesStore();
      sourcesActions.discoverDevices();

      // Advance just before the deadline — still loading, no error yet.
      vi.advanceTimersByTime(DISCOVERY_TIMEOUT_MS - 1);
      expect(get(discoveryLoading)).toBe(true);
      expect(get(discoveryError)).toBeNull();

      // Cross the deadline — timeout fires.
      vi.advanceTimersByTime(1);
      expect(get(discoveryError)).toBe('Discovery timed out — try again');
      expect(get(discoveryLoading)).toBe(false);
    });

    it('discoverDevices: timer is cancelled when pushNasDevices arrives before deadline', () => {
      initSourcesStore();
      sourcesActions.discoverDevices();

      // Listener arrives at t=1000ms with a successful payload.
      vi.advanceTimersByTime(1000);
      const handler = getHandler<DiscoverResult>('pushNasDevices');
      handler!({ devices: [{ name: 'NAS-1', ip: '192.168.1.10' }] });

      expect(get(discoveryLoading)).toBe(false);
      expect(get(discoveryError)).toBeNull();

      // Push past the original deadline; the cancelled timer must NOT flip state.
      vi.advanceTimersByTime(DISCOVERY_TIMEOUT_MS);
      expect(get(discoveryError)).toBeNull();
      expect(get(discoveredDevices)).toEqual([{ name: 'NAS-1', ip: '192.168.1.10' }]);
    });

    it('browseShares: surfaces timeout error after BROWSE_TIMEOUT_MS when no pushBrowseNasShares arrives', () => {
      initSourcesStore();
      sourcesActions.browseShares('192.168.1.5');

      vi.advanceTimersByTime(BROWSE_TIMEOUT_MS - 1);
      expect(get(browseLoading)).toBe(true);
      expect(get(browseError)).toBeNull();

      vi.advanceTimersByTime(1);
      expect(get(browseError)).toBe('Browse timed out — try again');
      expect(get(browseLoading)).toBe(false);
    });

    it('browseShares: timer is cancelled when pushBrowseNasShares arrives before deadline', () => {
      initSourcesStore();
      sourcesActions.browseShares('192.168.1.5');

      vi.advanceTimersByTime(1000);
      const handler = getHandler<BrowseSharesResult>('pushBrowseNasShares');
      handler!({ shares: [{ name: 'music', type: 'disk', writable: true }] });

      expect(get(browseLoading)).toBe(false);
      expect(get(browseError)).toBeNull();

      vi.advanceTimersByTime(BROWSE_TIMEOUT_MS);
      expect(get(browseError)).toBeNull();
      expect(get(browsedShares)).toEqual([{ name: 'music', type: 'disk', writable: true }]);
    });

    it('discoverDevices: subsequent call clears any pending stale timer', () => {
      initSourcesStore();
      sourcesActions.discoverDevices();

      // Fire a second discoverDevices() near (but before) the first deadline.
      vi.advanceTimersByTime(DISCOVERY_TIMEOUT_MS - 100);
      sourcesActions.discoverDevices();

      // Original timer would have fired by now if not cancelled — but the
      // second call resets the deadline, so we should still be loading.
      vi.advanceTimersByTime(200);
      expect(get(discoveryError)).toBeNull();
      expect(get(discoveryLoading)).toBe(true);

      // The second call's deadline lands at t = (DISCOVERY_TIMEOUT_MS - 100) + DISCOVERY_TIMEOUT_MS.
      // We've already advanced 200ms past the second call, so push the rest.
      vi.advanceTimersByTime(DISCOVERY_TIMEOUT_MS - 200);
      expect(get(discoveryError)).toBe('Discovery timed out — try again');
    });
  });

  // -----------------------------------------------------------------------
  // 18. Per-share mount/unmount in-flight tracking
  // -----------------------------------------------------------------------
  describe('mountInFlight tracking', () => {
    it('mountShare(id) sets mountInFlight[id] = "mounting"', () => {
      sourcesActions.mountShare('abc');
      expect(get(mountInFlight)).toEqual({ abc: 'mounting' });
    });

    it('unmountShare(id) sets mountInFlight[id] = "unmounting"', () => {
      sourcesActions.unmountShare('abc');
      expect(get(mountInFlight)).toEqual({ abc: 'unmounting' });
    });

    it('multiple in-flight shares are tracked independently', () => {
      sourcesActions.mountShare('abc');
      sourcesActions.unmountShare('def');
      expect(get(mountInFlight)).toEqual({ abc: 'mounting', def: 'unmounting' });
    });

    it('pushListNasShares clears all in-flight entries', () => {
      initSourcesStore();
      sourcesActions.mountShare('abc');
      sourcesActions.unmountShare('def');
      expect(get(mountInFlight)).not.toEqual({});

      const handler = getHandler<NasShare[]>('pushListNasShares');
      handler!([sampleShare]);

      expect(get(mountInFlight)).toEqual({});
    });

    it('pushListNasShares clears in-flight even when the share list is empty', () => {
      initSourcesStore();
      sourcesActions.unmountShare('abc');

      const handler = getHandler<NasShare[]>('pushListNasShares');
      handler!([]);

      expect(get(mountInFlight)).toEqual({});
    });

    it('pushNasShareResult with success: false clears all in-flight entries', () => {
      initSourcesStore();
      sourcesActions.mountShare('abc');
      expect(get(mountInFlight)).toEqual({ abc: 'mounting' });

      const handler = getHandler<SourceResult>('pushNasShareResult');
      handler!({ success: false, error: 'nope' });

      expect(get(mountInFlight)).toEqual({});
    });

    it('pushNasShareResult with success: true does NOT clear in-flight (waits for pushListNasShares)', () => {
      initSourcesStore();
      sourcesActions.mountShare('abc');

      const handler = getHandler<SourceResult>('pushNasShareResult');
      handler!({ success: true, message: 'mounted' });

      // Still in-flight until the authoritative share list arrives.
      expect(get(mountInFlight)).toEqual({ abc: 'mounting' });
    });

    it('cleanupSourcesStore() resets mountInFlight to empty', () => {
      sourcesActions.mountShare('abc');
      cleanupSourcesStore();
      expect(get(mountInFlight)).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // 19. Per-action timeouts on mutation actions (addShare/mountShare/
  //     unmountShare/deleteShare) — fallback when backend never responds.
  // -----------------------------------------------------------------------
  describe('per-action timeouts on mutation actions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('exposes SHARE_OPERATION_TIMEOUT_MS = 8000', () => {
      expect(SHARE_OPERATION_TIMEOUT_MS).toBe(8000);
    });

    const mutations: Array<{ name: string; fire: () => void }> = [
      {
        name: 'addShare',
        fire: () =>
          sourcesActions.addShare({
            name: 'X',
            ip: '10.0.0.1',
            path: '/x',
            fstype: 'cifs'
          })
      },
      { name: 'mountShare', fire: () => sourcesActions.mountShare('abc') },
      { name: 'unmountShare', fire: () => sourcesActions.unmountShare('abc') },
      { name: 'deleteShare', fire: () => sourcesActions.deleteShare('abc') }
    ];

    for (const mutation of mutations) {
      it(`${mutation.name}: surfaces sticky failure result after SHARE_OPERATION_TIMEOUT_MS when no response arrives`, () => {
        initSourcesStore();
        mutation.fire();

        // Just before the deadline — no synthetic failure yet.
        vi.advanceTimersByTime(SHARE_OPERATION_TIMEOUT_MS - 1);
        expect(get(lastShareResult)).toBeNull();

        // Cross the deadline — sticky failure result is set.
        vi.advanceTimersByTime(1);
        expect(get(lastShareResult)).toEqual({
          success: false,
          error: 'Operation timed out — try again'
        });
        // mountInFlight is cleared on the failure path (mirrors the
        // pushNasShareResult listener's failure behavior).
        expect(get(mountInFlight)).toEqual({});
      });
    }

    it('pushNasShareResult arrival cancels the pending mutation timeout', () => {
      initSourcesStore();
      sourcesActions.addShare({
        name: 'X',
        ip: '10.0.0.1',
        path: '/x',
        fstype: 'cifs'
      });

      // Backend pushes a real success result halfway through the window.
      vi.advanceTimersByTime(4000);
      const handler = getHandler<SourceResult>('pushNasShareResult');
      handler!({ success: true, message: 'Share added' });

      // Push well past the original deadline.
      vi.advanceTimersByTime(SHARE_OPERATION_TIMEOUT_MS);

      // The real success result must be preserved — no synthetic failure
      // overwrites it after the deadline.
      expect(get(lastShareResult)).toEqual({
        success: true,
        message: 'Share added'
      });
    });

    it('pushListNasShares arrival cancels the pending mutation timeout', () => {
      initSourcesStore();
      sourcesActions.mountShare('abc');

      // Backend pushes the authoritative share list halfway through the window.
      vi.advanceTimersByTime(4000);
      const handler = getHandler<NasShare[]>('pushListNasShares');
      handler!([sampleShare]);

      // Push past the original deadline; lastShareResult must stay null.
      vi.advanceTimersByTime(SHARE_OPERATION_TIMEOUT_MS);

      expect(get(lastShareResult)).toBeNull();
    });

    it('a second mutation cancels the first mutation\'s pending timeout', () => {
      initSourcesStore();
      sourcesActions.addShare({
        name: 'X',
        ip: '10.0.0.1',
        path: '/x',
        fstype: 'cifs'
      });

      // Halfway through the first window, fire a different mutation.
      vi.advanceTimersByTime(4000);
      sourcesActions.mountShare('abc');

      // Advance just past the first mutation's original deadline (4000 + 4001
      // = 8001ms total). The first timer must have been cancelled, so no
      // synthetic failure result yet.
      vi.advanceTimersByTime(4001);
      expect(get(lastShareResult)).toBeNull();
    });

    it('cleanupSourcesStore() clears the pending mutation timeout', () => {
      initSourcesStore();
      sourcesActions.mountShare('abc');

      // Advance halfway, then clean up.
      vi.advanceTimersByTime(4000);
      cleanupSourcesStore();

      // Push well past the original deadline — no fallback should fire,
      // because cleanup cleared the timer (and reset all stores).
      vi.advanceTimersByTime(SHARE_OPERATION_TIMEOUT_MS);
      expect(get(lastShareResult)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 20. shareOperationInProgress — in-progress feedback during the 3-7s
  //     normal-case wait. Set synchronously on each mutation, cleared by
  //     any path that finishes the operation (success/failure/timeout).
  // -----------------------------------------------------------------------
  describe('shareOperationInProgress tracking', () => {
    it('initial value is null', () => {
      cleanupSourcesStore();
      expect(get(shareOperationInProgress)).toBeNull();
    });

    it('addShare sets shareOperationInProgress.action = "add" synchronously', () => {
      const before = Date.now();
      sourcesActions.addShare({
        name: 'X',
        ip: '10.0.0.1',
        path: '/x',
        fstype: 'cifs'
      });
      const after = Date.now();
      const inProgress = get(shareOperationInProgress);
      expect(inProgress).not.toBeNull();
      expect(inProgress!.action).toBe('add');
      expect(inProgress!.startedAt).toBeGreaterThanOrEqual(before);
      expect(inProgress!.startedAt).toBeLessThanOrEqual(after);
    });

    it('mountShare sets shareOperationInProgress.action = "mount" synchronously', () => {
      sourcesActions.mountShare('abc');
      const inProgress = get(shareOperationInProgress);
      expect(inProgress).not.toBeNull();
      expect(inProgress!.action).toBe('mount');
      expect(typeof inProgress!.startedAt).toBe('number');
    });

    it('unmountShare sets shareOperationInProgress.action = "unmount" synchronously', () => {
      sourcesActions.unmountShare('abc');
      const inProgress = get(shareOperationInProgress);
      expect(inProgress).not.toBeNull();
      expect(inProgress!.action).toBe('unmount');
    });

    it('deleteShare sets shareOperationInProgress.action = "delete" synchronously', () => {
      sourcesActions.deleteShare('abc');
      const inProgress = get(shareOperationInProgress);
      expect(inProgress).not.toBeNull();
      expect(inProgress!.action).toBe('delete');
    });

    it('a second mutation updates the action label (addShare → mountShare)', () => {
      sourcesActions.addShare({
        name: 'X',
        ip: '10.0.0.1',
        path: '/x',
        fstype: 'cifs'
      });
      expect(get(shareOperationInProgress)!.action).toBe('add');

      sourcesActions.mountShare('abc');
      expect(get(shareOperationInProgress)!.action).toBe('mount');
    });

    it('pushNasShareResult clears shareOperationInProgress', () => {
      initSourcesStore();
      sourcesActions.addShare({
        name: 'X',
        ip: '10.0.0.1',
        path: '/x',
        fstype: 'cifs'
      });
      expect(get(shareOperationInProgress)).not.toBeNull();

      const handler = getHandler<SourceResult>('pushNasShareResult');
      handler!({ success: true, message: 'Share added' });

      expect(get(shareOperationInProgress)).toBeNull();
    });

    it('pushNasShareResult clears shareOperationInProgress on failure too', () => {
      initSourcesStore();
      sourcesActions.mountShare('abc');
      expect(get(shareOperationInProgress)).not.toBeNull();

      const handler = getHandler<SourceResult>('pushNasShareResult');
      handler!({ success: false, error: 'Mount failed' });

      expect(get(shareOperationInProgress)).toBeNull();
    });

    it('pushListNasShares clears shareOperationInProgress', () => {
      initSourcesStore();
      sourcesActions.mountShare('abc');
      expect(get(shareOperationInProgress)).not.toBeNull();

      const handler = getHandler<NasShare[]>('pushListNasShares');
      handler!([sampleShare]);

      expect(get(shareOperationInProgress)).toBeNull();
    });

    it('timeout fire clears shareOperationInProgress (along with synthetic failure)', () => {
      vi.useFakeTimers();
      try {
        initSourcesStore();
        sourcesActions.mountShare('abc');
        expect(get(shareOperationInProgress)).not.toBeNull();

        vi.advanceTimersByTime(SHARE_OPERATION_TIMEOUT_MS);

        expect(get(shareOperationInProgress)).toBeNull();
        expect(get(lastShareResult)).toEqual({
          success: false,
          error: 'Operation timed out — try again'
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('cleanupSourcesStore resets shareOperationInProgress to null', () => {
      sourcesActions.mountShare('abc');
      expect(get(shareOperationInProgress)).not.toBeNull();

      cleanupSourcesStore();

      expect(get(shareOperationInProgress)).toBeNull();
    });
  });
});
