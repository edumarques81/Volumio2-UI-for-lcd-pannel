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
  frontendVersion,
  backendVersion,
  backendVersionLoading,
  versionActions,
  initVersionStore,
  cleanupVersionStore,
  type VersionInfo
} from '../version';
import { socketService } from '$lib/services/socket';

describe('Version store', () => {
  const mockBackendVersion: VersionInfo = {
    name: 'Stellar',
    version: '0.1.0',
    buildTime: '2024-01-15T10:00:00Z',
    gitCommit: 'abc1234'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanupVersionStore();
  });

  afterEach(() => {
    cleanupVersionStore();
  });

  describe('frontendVersion', () => {
    it('should have name', () => {
      const version = get(frontendVersion);
      expect(version.name).toBe('Volumio POC');
    });

    it('should have version string', () => {
      const version = get(frontendVersion);
      expect(version.version).toBeDefined();
      expect(version.version.length).toBeGreaterThan(0);
    });
  });

  describe('backendVersion', () => {
    it('should be null initially', () => {
      expect(get(backendVersion)).toBeNull();
    });

    it('should be loading initially', () => {
      expect(get(backendVersionLoading)).toBe(true);
    });
  });

  describe('versionActions', () => {
    it('should emit getVersion', () => {
      versionActions.fetchBackendVersion();
      expect(socketService.emit).toHaveBeenCalledWith('getVersion');
    });
  });

  describe('initVersionStore', () => {
    it('should register pushVersion event handler', () => {
      initVersionStore();
      expect(socketService.on).toHaveBeenCalledWith('pushVersion', expect.any(Function));
    });

    it('should not register multiple handlers on repeated init calls', () => {
      initVersionStore();
      initVersionStore();
      initVersionStore();

      // Should only register once due to initialized flag
      expect(socketService.on).toHaveBeenCalledTimes(1);
    });
  });

  describe('pushVersion handler', () => {
    it('should update backendVersion when received', () => {
      initVersionStore();

      // Get the handler that was registered
      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushVersion')?.[1] as ((version: VersionInfo) => void) | undefined;
      expect(handler).toBeDefined();

      handler!(mockBackendVersion);

      expect(get(backendVersion)).toEqual(mockBackendVersion);
    });

    it('should set loading to false when version received', () => {
      initVersionStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushVersion')?.[1] as ((version: VersionInfo) => void) | undefined;

      handler!(mockBackendVersion);

      expect(get(backendVersionLoading)).toBe(false);
    });
  });

  describe('cleanupVersionStore', () => {
    it('should reset backendVersion to null', () => {
      initVersionStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushVersion')?.[1] as ((version: VersionInfo) => void) | undefined;
      handler!(mockBackendVersion);

      cleanupVersionStore();

      expect(get(backendVersion)).toBeNull();
    });

    it('should reset loading to true', () => {
      initVersionStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushVersion')?.[1] as ((version: VersionInfo) => void) | undefined;
      handler!(mockBackendVersion);

      cleanupVersionStore();

      expect(get(backendVersionLoading)).toBe(true);
    });

    it('should allow re-initialization after cleanup', () => {
      initVersionStore();
      expect(socketService.on).toHaveBeenCalledTimes(1);

      cleanupVersionStore();

      vi.clearAllMocks();
      initVersionStore();

      // Should register again after cleanup
      expect(socketService.on).toHaveBeenCalledTimes(1);
    });
  });
});
