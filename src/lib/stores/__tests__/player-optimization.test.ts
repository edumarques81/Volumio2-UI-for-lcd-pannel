import { describe, it, expect, vi, beforeAll } from 'vitest';
import { get } from 'svelte/store';

// Mock socket service - capture pushState handler
let pushStateHandler: ((state: any) => void) | null = null;

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (event === 'pushState') {
        pushStateHandler = handler as any;
      }
      return () => {};
    })
  }
}));

// Mock config
vi.mock('$lib/config', () => ({
  fixVolumioAssetUrl: vi.fn((url: string) => url)
}));

import {
  playerState,
  volume,
  mute,
  shuffle,
  repeat,
  seek,
  duration,
  initPlayerStore
} from '../player';
import { socketService } from '$lib/services/socket';

// Initialize once - the module-level `initialized` flag prevents re-init
beforeAll(() => {
  initPlayerStore();
});

describe('Player store optimizations', () => {
  describe('change-gated store updates', () => {
    it('should only update volume store when value changes', () => {
      if (!pushStateHandler) throw new Error('pushState handler not registered');

      // Reset stores
      volume.set(80);

      const volumeSetSpy = vi.fn();
      const unsub = volume.subscribe(volumeSetSpy);
      volumeSetSpy.mockClear(); // Clear initial subscription call

      // First pushState sets volume to 50
      pushStateHandler({ status: 'play', volume: 50, seek: 0, duration: 300 });
      expect(get(volume)).toBe(50);
      const callsAfterFirst = volumeSetSpy.mock.calls.length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // Second pushState with same volume should NOT trigger subscriber
      pushStateHandler({ status: 'play', volume: 50, seek: 1000, duration: 300 });
      expect(volumeSetSpy.mock.calls.length).toBe(callsAfterFirst);

      // Third pushState with different volume SHOULD trigger subscriber
      pushStateHandler({ status: 'play', volume: 75, seek: 2000, duration: 300 });
      expect(get(volume)).toBe(75);
      expect(volumeSetSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);

      unsub();
    });

    it('should only update duration store when value changes', () => {
      if (!pushStateHandler) throw new Error('pushState handler not registered');

      // Reset stores
      duration.set(0);

      const durationSetSpy = vi.fn();
      const unsub = duration.subscribe(durationSetSpy);
      durationSetSpy.mockClear();

      pushStateHandler({ status: 'play', duration: 300, seek: 0 });
      expect(get(duration)).toBe(300);
      const callsAfterFirst = durationSetSpy.mock.calls.length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // Same duration - no subscriber notification
      pushStateHandler({ status: 'play', duration: 300, seek: 1000 });
      expect(durationSetSpy.mock.calls.length).toBe(callsAfterFirst);

      unsub();
    });

    it('should only update shuffle store when value changes', () => {
      if (!pushStateHandler) throw new Error('pushState handler not registered');

      // Reset stores
      shuffle.set(false);

      pushStateHandler({ status: 'play', random: true, seek: 0, duration: 300 });
      expect(get(shuffle)).toBe(true);

      const shuffleSetSpy = vi.fn();
      const unsub = shuffle.subscribe(shuffleSetSpy);
      shuffleSetSpy.mockClear();

      // Same value - no notification
      pushStateHandler({ status: 'play', random: true, seek: 1000, duration: 300 });
      expect(shuffleSetSpy.mock.calls.length).toBe(0);

      unsub();
    });

    it('should only update repeat store when value changes', () => {
      if (!pushStateHandler) throw new Error('pushState handler not registered');

      // Reset stores
      repeat.set('off');

      pushStateHandler({ status: 'play', repeat: true, repeatSingle: false, seek: 0, duration: 300 });
      expect(get(repeat)).toBe('all');

      const repeatSetSpy = vi.fn();
      const unsub = repeat.subscribe(repeatSetSpy);
      repeatSetSpy.mockClear();

      // Same repeat value - no notification
      pushStateHandler({ status: 'play', repeat: true, repeatSingle: false, seek: 1000, duration: 300 });
      expect(repeatSetSpy.mock.calls.length).toBe(0);

      // Different repeat value
      pushStateHandler({ status: 'play', repeat: true, repeatSingle: true, seek: 2000, duration: 300 });
      expect(get(repeat)).toBe('one');
      expect(repeatSetSpy.mock.calls.length).toBeGreaterThan(0);

      unsub();
    });
  });

  describe('duplicate request removal', () => {
    it('should not emit getState from initPlayerStore', () => {
      // The setTimeout-based getState was removed.
      // Only socket.ts connect handler should request state.
      const emitCalls = (socketService.emit as any).mock.calls;
      const getStateCalls = emitCalls.filter((c: any[]) => c[0] === 'getState');
      expect(getStateCalls.length).toBe(0);
    });
  });
});
