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

// Polyfill Web Animations API — jsdom does not implement element.animate(),
// which Svelte 5 transition internals call. Return a minimal Animation stub.
if (typeof Element.prototype.animate !== 'function') {
  Element.prototype.animate = vi.fn().mockReturnValue({
    pause: vi.fn(),
    play: vi.fn(),
    cancel: vi.fn(),
    finish: vi.fn(),
    reverse: vi.fn(),
    onfinish: null,
    oncancel: null,
    finished: Promise.resolve(),
    ready: Promise.resolve(),
    currentTime: 0,
    playbackRate: 1,
    playState: 'finished',
    effect: null,
    timeline: null,
  });
}

// Polyfill scrollIntoView — jsdom doesn't implement it, but our components
// call it (e.g. NasShareList.handleUseShare). A noop is enough for tests
// to assert behavior; component tests that care use vi.spyOn over this.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = vi.fn();
}
