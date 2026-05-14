import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Hoisted mocks so the import order in libraryRefresh.ts picks them up.
const { socketEmit, socketOn, onHandlers, refreshBio, fetchAlbums } =
  await vi.hoisted(async () => {
    const handlers = new Map<string, Set<(p: any) => void>>();
    const onMock = vi.fn((event: string, fn: (p: any) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
      return () => handlers.get(event)?.delete(fn);
    });
    return {
      socketEmit: vi.fn(),
      socketOn: onMock,
      onHandlers: handlers,
      refreshBio: vi.fn(),
      fetchAlbums: vi.fn(),
    };
  });

vi.mock('$lib/services/socket', () => ({
  socketService: { emit: socketEmit, on: socketOn },
}));
vi.mock('$lib/stores/library', async () => {
  const { writable } = await import('svelte/store');
  return {
    libraryActions: { fetchAlbums },
    // Use any here — the real store is typed Album|null, but for these
    // tests we only care about artist/title being read by the helper.
    selectedLibraryAlbum: writable<any>(null),
  };
});
vi.mock('$lib/stores/bios', () => ({
  bioActions: { refreshBio },
}));

import { refreshInProgress } from '../navigation';
import {
  triggerLibraryRefresh,
  cancelLibraryRefresh,
  _hasActiveCacheUpdatedListener,
} from '../libraryRefresh';
import { selectedLibraryAlbum } from '../library';

function listenerCount(event: string): number {
  return onHandlers.get(event)?.size ?? 0;
}

describe('triggerLibraryRefresh', () => {
  beforeEach(() => {
    socketEmit.mockClear();
    socketOn.mockClear();
    refreshBio.mockClear();
    fetchAlbums.mockClear();
    onHandlers.clear();
    refreshInProgress.set(false);
    selectedLibraryAlbum.set(null);
    cancelLibraryRefresh();
  });

  it('emits library:cache:rebuild and registers exactly one library:cache:updated listener', () => {
    triggerLibraryRefresh();

    expect(socketEmit).toHaveBeenCalledWith('library:cache:rebuild');
    expect(listenerCount('library:cache:updated')).toBe(1);
    expect(get(refreshInProgress)).toBe(true);
  });

  it('rapid taps register at most one library:cache:updated listener (reentrancy guard)', () => {
    // Five rapid taps before the backend responds.
    triggerLibraryRefresh();
    triggerLibraryRefresh();
    triggerLibraryRefresh();
    triggerLibraryRefresh();
    triggerLibraryRefresh();

    // Only the first tap should have actually started a refresh.
    expect(socketEmit).toHaveBeenCalledTimes(1);
    expect(socketOn).toHaveBeenCalledTimes(1);
    expect(listenerCount('library:cache:updated')).toBe(1);
  });

  it('the listener self-unsubscribes on first library:cache:updated', () => {
    triggerLibraryRefresh();
    expect(listenerCount('library:cache:updated')).toBe(1);

    // Simulate the backend broadcast.
    onHandlers.get('library:cache:updated')!.forEach(h => h(undefined));

    expect(fetchAlbums).toHaveBeenCalledTimes(1);
    expect(get(refreshInProgress)).toBe(false);
    expect(listenerCount('library:cache:updated')).toBe(0);
    expect(_hasActiveCacheUpdatedListener()).toBe(false);
  });

  it('a subsequent tap after completion starts a fresh refresh', () => {
    // First refresh cycle = 2 emits: library:cache:rebuild + clients:reload
    // (the page-reload broadcast added in 13b044f8 — runs from inside the
    // cache-updated handler).
    triggerLibraryRefresh();
    onHandlers.get('library:cache:updated')!.forEach(h => h(undefined));
    expect(socketEmit).toHaveBeenCalledTimes(2);
    expect(socketEmit).toHaveBeenCalledWith('library:cache:rebuild');
    expect(socketEmit).toHaveBeenCalledWith('clients:reload');

    // Second tap after the first finished — fires only library:cache:rebuild
    // (the new listener won't fire until we replay the cache-updated handler).
    triggerLibraryRefresh();
    expect(socketEmit).toHaveBeenCalledTimes(3);
    expect(listenerCount('library:cache:updated')).toBe(1);
  });

  it('refreshes the bio of the currently displayed album', () => {
    selectedLibraryAlbum.set({ artist: 'Pink Floyd', title: 'Animals' } as any);
    triggerLibraryRefresh();
    expect(refreshBio).toHaveBeenCalledWith('Pink Floyd', 'Animals');
  });

  it('skips bio refresh when no album is in view', () => {
    selectedLibraryAlbum.set(null);
    triggerLibraryRefresh();
    expect(refreshBio).not.toHaveBeenCalled();
  });
});

describe('cancelLibraryRefresh', () => {
  beforeEach(() => {
    socketEmit.mockClear();
    socketOn.mockClear();
    onHandlers.clear();
    refreshInProgress.set(false);
    cancelLibraryRefresh();
  });

  it('tears down an in-flight library:cache:updated listener and resets refreshInProgress', () => {
    triggerLibraryRefresh();
    expect(listenerCount('library:cache:updated')).toBe(1);
    expect(get(refreshInProgress)).toBe(true);

    cancelLibraryRefresh();

    expect(listenerCount('library:cache:updated')).toBe(0);
    expect(get(refreshInProgress)).toBe(false);
    expect(_hasActiveCacheUpdatedListener()).toBe(false);
  });

  it('is safe to call when no refresh is in flight', () => {
    expect(() => cancelLibraryRefresh()).not.toThrow();
    expect(_hasActiveCacheUpdatedListener()).toBe(false);
  });

  it('after cancel, a new tap starts a fresh refresh with one listener', () => {
    triggerLibraryRefresh();
    cancelLibraryRefresh();

    triggerLibraryRefresh();
    expect(socketEmit).toHaveBeenLastCalledWith('library:cache:rebuild');
    expect(listenerCount('library:cache:updated')).toBe(1);
  });
});
