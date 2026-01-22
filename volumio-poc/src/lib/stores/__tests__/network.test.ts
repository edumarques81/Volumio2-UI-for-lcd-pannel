import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Create mock functions at module level
const mockEmit = vi.fn();
const mockOn = vi.fn(() => () => {}); // Return cleanup function

// Mock socket service using importOriginal pattern to avoid hoisting issues
vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(() => () => {})
  }
}));

// Import store after mock is defined
import {
  networkStatus,
  networkIcon,
  isConnected,
  initNetworkStore,
  cleanupNetworkStore,
  type NetworkStatus
} from '../network';
import { socketService } from '$lib/services/socket';

describe('Network store (Socket.IO)', () => {
  const defaultStatus: NetworkStatus = {
    type: 'none',
    ssid: '',
    signal: 0,
    ip: '',
    strength: 0
  };

  beforeEach(() => {
    // Reset stores and mocks
    networkStatus.set(defaultStatus);
    vi.clearAllMocks();
    cleanupNetworkStore();
  });

  afterEach(() => {
    cleanupNetworkStore();
  });

  describe('initial state', () => {
    it('should have none type initially', () => {
      expect(get(networkStatus).type).toBe('none');
    });

    it('should have empty SSID initially', () => {
      expect(get(networkStatus).ssid).toBe('');
    });

    it('should have zero signal initially', () => {
      expect(get(networkStatus).signal).toBe(0);
    });

    it('should derive isConnected as false initially', () => {
      expect(get(isConnected)).toBe(false);
    });

    it('should derive networkIcon as wifi-off initially', () => {
      expect(get(networkIcon)).toBe('wifi-off');
    });
  });

  describe('networkIcon derived store', () => {
    it('should return ethernet for ethernet type', () => {
      networkStatus.set({ ...defaultStatus, type: 'ethernet' });
      expect(get(networkIcon)).toBe('ethernet');
    });

    it('should return wifi for wifi with full strength (3)', () => {
      networkStatus.set({ ...defaultStatus, type: 'wifi', strength: 3 });
      expect(get(networkIcon)).toBe('wifi');
    });

    it('should return wifi-3 for wifi with medium strength (2)', () => {
      networkStatus.set({ ...defaultStatus, type: 'wifi', strength: 2 });
      expect(get(networkIcon)).toBe('wifi-3');
    });

    it('should return wifi-2 for wifi with weak strength (1)', () => {
      networkStatus.set({ ...defaultStatus, type: 'wifi', strength: 1 });
      expect(get(networkIcon)).toBe('wifi-2');
    });

    it('should return wifi-1 for wifi with very weak strength (0)', () => {
      networkStatus.set({ ...defaultStatus, type: 'wifi', strength: 0 });
      expect(get(networkIcon)).toBe('wifi-1');
    });

    it('should return wifi-off for none type', () => {
      networkStatus.set({ ...defaultStatus, type: 'none' });
      expect(get(networkIcon)).toBe('wifi-off');
    });
  });

  describe('isConnected derived store', () => {
    it('should be true for wifi type', () => {
      networkStatus.set({ ...defaultStatus, type: 'wifi' });
      expect(get(isConnected)).toBe(true);
    });

    it('should be true for ethernet type', () => {
      networkStatus.set({ ...defaultStatus, type: 'ethernet' });
      expect(get(isConnected)).toBe(true);
    });

    it('should be false for none type', () => {
      networkStatus.set({ ...defaultStatus, type: 'none' });
      expect(get(isConnected)).toBe(false);
    });
  });

  describe('initNetworkStore', () => {
    it('should register pushNetworkStatus event handler', () => {
      initNetworkStore();
      expect(socketService.on).toHaveBeenCalledWith('pushNetworkStatus', expect.any(Function));
    });

    it('should not make redundant initial request (backend pushes on connection)', () => {
      initNetworkStore();

      // Should NOT emit getNetworkStatus - backend pushes initial state
      expect(socketService.emit).not.toHaveBeenCalledWith('getNetworkStatus');
    });

    it('should not register multiple handlers on repeated init calls', () => {
      initNetworkStore();
      initNetworkStore();
      initNetworkStore();

      // Should only register once due to initialized flag
      expect(socketService.on).toHaveBeenCalledTimes(1);
    });
  });

  describe('pushNetworkStatus handler', () => {
    it('should update networkStatus on wifi connection', () => {
      initNetworkStore();

      // Get the handler that was registered
      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushNetworkStatus')?.[1] as ((status: NetworkStatus) => void) | undefined;
      expect(handler).toBeDefined();

      // Simulate receiving pushNetworkStatus
      const wifiStatus: NetworkStatus = {
        type: 'wifi',
        ssid: 'HomeNetwork',
        signal: 75,
        ip: '192.168.1.100',
        strength: 3
      };
      handler!(wifiStatus);

      expect(get(networkStatus)).toEqual(wifiStatus);
    });

    it('should update networkStatus on ethernet connection', () => {
      initNetworkStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushNetworkStatus')?.[1] as ((status: NetworkStatus) => void) | undefined;

      const ethernetStatus: NetworkStatus = {
        type: 'ethernet',
        ssid: '',
        signal: 100,
        ip: '192.168.86.34',
        strength: 3
      };
      handler!(ethernetStatus);

      expect(get(networkStatus)).toEqual(ethernetStatus);
      expect(get(isConnected)).toBe(true);
      expect(get(networkIcon)).toBe('ethernet');
    });

    it('should handle disconnection', () => {
      // Start with wifi connected
      networkStatus.set({
        type: 'wifi',
        ssid: 'HomeNetwork',
        signal: 75,
        ip: '192.168.1.100',
        strength: 3
      });

      initNetworkStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushNetworkStatus')?.[1] as ((status: NetworkStatus) => void) | undefined;

      // Simulate disconnection
      handler!({
        type: 'none',
        ssid: '',
        signal: 0,
        ip: '',
        strength: 0
      });

      expect(get(isConnected)).toBe(false);
      expect(get(networkIcon)).toBe('wifi-off');
    });
  });

  describe('cleanupNetworkStore', () => {
    it('should allow re-initialization after cleanup', () => {
      initNetworkStore();
      expect(socketService.on).toHaveBeenCalledTimes(1);

      cleanupNetworkStore();

      vi.clearAllMocks();
      initNetworkStore();

      // Should register again after cleanup
      expect(socketService.on).toHaveBeenCalledTimes(1);
    });
  });
});
