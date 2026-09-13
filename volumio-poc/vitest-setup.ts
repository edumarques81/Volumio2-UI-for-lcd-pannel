import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: true
  };

  return {
    default: vi.fn(() => mockSocket),
    io: vi.fn(() => mockSocket)
  };
});

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock fetch for LCD store tests
global.fetch = vi.fn();
