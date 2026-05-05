import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const onHandlers = new Map<string, (payload: any) => void>();

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn((event: string, fn: (p: any) => void) => {
      onHandlers.set(event, fn);
      return () => onHandlers.delete(event);
    }),
  },
}));

import {
  currentAlbumBio,
  bioLoading,
  bioActions,
  initBiosStore,
  cleanupBiosStore,
} from '../bios';
import { socketService } from '$lib/services/socket';

describe('bios store', () => {
  beforeEach(() => {
    onHandlers.clear();
    currentAlbumBio.set({ summary: '', sourceUrl: '', kind: '' });
    bioLoading.set(false);
    (socketService.emit as any).mockClear();
    initBiosStore();
  });

  it('emits library:bio:get with artist/album when bioActions.requestBio runs', () => {
    bioActions.requestBio('Miles Davis', 'Kind of Blue');
    expect(socketService.emit).toHaveBeenCalledWith('library:bio:get', {
      artist: 'Miles Davis', album: 'Kind of Blue',
    });
    expect(get(bioLoading)).toBe(true);
  });

  it('updates currentAlbumBio when pushLibraryBio fires for the requested album', () => {
    bioActions.requestBio('Miles Davis', 'Kind of Blue');
    onHandlers.get('pushLibraryBio')!({
      artist: 'Miles Davis', album: 'Kind of Blue',
      summary: 'A 1959 jazz album.', source_url: 'https://w/ko', kind: 'album',
    });
    expect(get(currentAlbumBio).summary).toBe('A 1959 jazz album.');
    expect(get(bioLoading)).toBe(false);
  });

  it('ignores pushLibraryBio for a stale (non-matching) album', () => {
    bioActions.requestBio('A', 'B');
    onHandlers.get('pushLibraryBio')!({
      artist: 'C', album: 'D', summary: 'wrong', source_url: '', kind: 'album',
    });
    expect(get(currentAlbumBio).summary).toBe('');
  });

  it('emits library:bio:rebuild with artist/album when bioActions.refreshBio runs', () => {
    bioActions.refreshBio('Miles Davis', 'Kind of Blue');
    expect(socketService.emit).toHaveBeenCalledWith('library:bio:rebuild', {
      artist: 'Miles Davis', album: 'Kind of Blue',
    });
  });

  it('cleanupBiosStore unsubscribes pushLibraryBio handler', () => {
    cleanupBiosStore();
    expect(onHandlers.has('pushLibraryBio')).toBe(false);
  });
});
