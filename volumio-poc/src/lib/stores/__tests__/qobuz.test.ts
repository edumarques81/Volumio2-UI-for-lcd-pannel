import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock the socket service
vi.mock('$lib/services/socket', () => {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    socketService: {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      }),
      off: vi.fn((event: string) => {
        delete handlers[event];
      }),
      emit: vi.fn(),
      // Helper for tests to trigger events
      _handlers: handlers,
      _trigger: (event: string, ...args: unknown[]) => {
        handlers[event]?.forEach(handler => handler(...args));
      }
    }
  };
});

// Import after mocking
import {
  qobuzStatus,
  qobuzLoading,
  qobuzError,
  isQobuzLoggedIn,
  qobuzActions,
  initQobuzListeners,
  cleanupQobuzListeners,
  type QobuzStatus,
  type QobuzLoginResult
} from '../qobuz';
import { socketService } from '$lib/services/socket';

describe('Qobuz Store', () => {
  beforeEach(() => {
    // Reset stores to initial state
    qobuzStatus.set({ loggedIn: false });
    qobuzLoading.set(false);
    qobuzError.set(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupQobuzListeners();
  });

  describe('Initial State', () => {
    it('should have loggedIn as false initially', () => {
      expect(get(qobuzStatus).loggedIn).toBe(false);
    });

    it('should have loading as false initially', () => {
      expect(get(qobuzLoading)).toBe(false);
    });

    it('should have no error initially', () => {
      expect(get(qobuzError)).toBeNull();
    });

    it('should derive isQobuzLoggedIn from status', () => {
      expect(get(isQobuzLoggedIn)).toBe(false);

      qobuzStatus.set({ loggedIn: true, email: 'test@example.com' });
      expect(get(isQobuzLoggedIn)).toBe(true);
    });
  });

  describe('initQobuzListeners', () => {
    it('should register socket event listeners', () => {
      initQobuzListeners();

      expect(socketService.on).toHaveBeenCalledWith('pushQobuzStatus', expect.any(Function));
      expect(socketService.on).toHaveBeenCalledWith('pushQobuzLoginResult', expect.any(Function));
      expect(socketService.on).toHaveBeenCalledWith('pushQobuzLogoutResult', expect.any(Function));
    });

    it('should request initial status', () => {
      initQobuzListeners();

      expect(socketService.emit).toHaveBeenCalledWith('getQobuzStatus');
    });

    it('should only initialize once', () => {
      initQobuzListeners();
      initQobuzListeners();
      initQobuzListeners();

      // Should only call on() 3 times (one for each event)
      expect(socketService.on).toHaveBeenCalledTimes(3);
    });
  });

  describe('cleanupQobuzListeners', () => {
    it('should remove socket event listeners', () => {
      initQobuzListeners();
      cleanupQobuzListeners();

      expect(socketService.off).toHaveBeenCalledWith('pushQobuzStatus');
      expect(socketService.off).toHaveBeenCalledWith('pushQobuzLoginResult');
      expect(socketService.off).toHaveBeenCalledWith('pushQobuzLogoutResult');
    });
  });

  describe('pushQobuzStatus event', () => {
    it('should update status when received', () => {
      initQobuzListeners();

      const status: QobuzStatus = {
        loggedIn: true,
        email: 'user@qobuz.com',
        subscription: 'studio',
        country: 'US'
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushQobuzStatus', status);

      expect(get(qobuzStatus)).toEqual(status);
      expect(get(isQobuzLoggedIn)).toBe(true);
    });

    it('should set error from status if present', () => {
      initQobuzListeners();

      const status: QobuzStatus = {
        loggedIn: false,
        error: 'Invalid credentials'
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushQobuzStatus', status);

      expect(get(qobuzError)).toBe('Invalid credentials');
    });
  });

  describe('pushQobuzLoginResult event', () => {
    it('should handle successful login', () => {
      initQobuzListeners();
      qobuzLoading.set(true);

      const result: QobuzLoginResult = {
        success: true,
        message: 'Login successful',
        status: {
          loggedIn: true,
          email: 'user@qobuz.com',
          subscription: 'studio'
        }
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushQobuzLoginResult', result);

      expect(get(qobuzLoading)).toBe(false);
      expect(get(qobuzError)).toBeNull();
      expect(get(qobuzStatus).loggedIn).toBe(true);
      expect(get(qobuzStatus).email).toBe('user@qobuz.com');
    });

    it('should handle failed login', () => {
      initQobuzListeners();
      qobuzLoading.set(true);

      const result: QobuzLoginResult = {
        success: false,
        error: 'Invalid email or password'
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushQobuzLoginResult', result);

      expect(get(qobuzLoading)).toBe(false);
      expect(get(qobuzError)).toBe('Invalid email or password');
    });

    it('should use default error message if none provided', () => {
      initQobuzListeners();
      qobuzLoading.set(true);

      const result: QobuzLoginResult = {
        success: false
      };

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushQobuzLoginResult', result);

      expect(get(qobuzError)).toBe('Login failed');
    });
  });

  describe('pushQobuzLogoutResult event', () => {
    it('should handle successful logout', () => {
      initQobuzListeners();
      qobuzStatus.set({ loggedIn: true, email: 'user@qobuz.com' });
      qobuzLoading.set(true);

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushQobuzLogoutResult', { success: true });

      expect(get(qobuzLoading)).toBe(false);
      expect(get(qobuzError)).toBeNull();
      expect(get(qobuzStatus).loggedIn).toBe(false);
    });

    it('should handle failed logout', () => {
      initQobuzListeners();
      qobuzStatus.set({ loggedIn: true, email: 'user@qobuz.com' });
      qobuzLoading.set(true);

      (socketService as unknown as { _trigger: (event: string, ...args: unknown[]) => void })._trigger('pushQobuzLogoutResult', { success: false, error: 'Logout failed' });

      expect(get(qobuzLoading)).toBe(false);
      expect(get(qobuzError)).toBe('Logout failed');
    });
  });

  describe('qobuzActions', () => {
    describe('login', () => {
      it('should emit qobuzLogin event with credentials', () => {
        qobuzActions.login('user@qobuz.com', 'password123');

        expect(socketService.emit).toHaveBeenCalledWith('qobuzLogin', {
          email: 'user@qobuz.com',
          password: 'password123'
        });
      });

      it('should set loading state', () => {
        qobuzActions.login('user@qobuz.com', 'password123');

        expect(get(qobuzLoading)).toBe(true);
      });

      it('should clear previous errors', () => {
        qobuzError.set('Previous error');
        qobuzActions.login('user@qobuz.com', 'password123');

        expect(get(qobuzError)).toBeNull();
      });
    });

    describe('logout', () => {
      it('should emit qobuzLogout event', () => {
        qobuzActions.logout();

        expect(socketService.emit).toHaveBeenCalledWith('qobuzLogout');
      });

      it('should set loading state', () => {
        qobuzActions.logout();

        expect(get(qobuzLoading)).toBe(true);
      });

      it('should clear previous errors', () => {
        qobuzError.set('Previous error');
        qobuzActions.logout();

        expect(get(qobuzError)).toBeNull();
      });
    });

    describe('getStatus', () => {
      it('should emit getQobuzStatus event', () => {
        qobuzActions.getStatus();

        expect(socketService.emit).toHaveBeenCalledWith('getQobuzStatus');
      });
    });

    describe('clearError', () => {
      it('should clear error', () => {
        qobuzError.set('Some error');
        qobuzActions.clearError();

        expect(get(qobuzError)).toBeNull();
      });
    });
  });
});
