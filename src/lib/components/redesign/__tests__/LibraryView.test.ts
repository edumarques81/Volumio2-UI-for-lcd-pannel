import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import type { Album } from '$lib/stores/library';

const albums: Album[] = [
  { id: '1', uri: 'a1', title: 'A', artist: 'X', albumArt: '/a', trackCount: 0, source: 'local' },
  { id: '2', uri: 'a2', title: 'B', artist: 'Y', albumArt: '/b', trackCount: 0, source: 'local' },
  { id: '3', uri: 'a3', title: 'C', artist: 'Z', albumArt: '/c', trackCount: 0, source: 'local' },
];

const {
  libraryAlbums,
  libraryAlbumTracks,
  currentLibraryIndex,
  selectedLibraryAlbum,
  libraryActions,
  bioActions,
  currentAlbumBio,
  bioLoading,
} = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  const initialAlbums = [
    { id: '1', uri: 'a1', title: 'A', artist: 'X', albumArt: '/a', trackCount: 0, source: 'local' },
    { id: '2', uri: 'a2', title: 'B', artist: 'Y', albumArt: '/b', trackCount: 0, source: 'local' },
    { id: '3', uri: 'a3', title: 'C', artist: 'Z', albumArt: '/c', trackCount: 0, source: 'local' },
  ];
  const libraryAlbumsStore = writable(initialAlbums);
  const libraryAlbumTracksStore = writable<any[]>([]);
  const currentLibraryIndexStore = writable(0);
  const selectedLibraryAlbumStore = writable<any>(null);

  return {
    libraryAlbums: libraryAlbumsStore,
    libraryAlbumTracks: libraryAlbumTracksStore,
    currentLibraryIndex: currentLibraryIndexStore,
    selectedLibraryAlbum: selectedLibraryAlbumStore,
    libraryActions: {
      fetchAlbumTracks: vi.fn((album: any) => {
        selectedLibraryAlbumStore.set(album);
        libraryAlbumTracksStore.set([{ uri: 't1', title: 'Track', duration: 60 }]);
      }),
      replaceQueueAndPlay: vi.fn(),
    },
    bioActions: { requestBio: vi.fn(), refreshBio: vi.fn() },
    currentAlbumBio: writable({ summary: '', sourceUrl: '', kind: '' }),
    bioLoading: writable(false),
  };
});

vi.mock('$lib/stores/library', () => ({
  libraryAlbums, libraryAlbumTracks, currentLibraryIndex,
  selectedLibraryAlbum, libraryActions,
}));
vi.mock('$lib/stores/bios', () => ({ currentAlbumBio, bioLoading, bioActions }));
vi.mock('$lib/stores/player', () => ({
  formatTime: (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`,
}));

import LibraryView from '../LibraryView.svelte';

describe('LibraryView', () => {
  beforeEach(() => {
    currentLibraryIndex.set(0);
    libraryAlbumTracks.set([]);
    libraryAlbums.set(albums);
    libraryActions.fetchAlbumTracks.mockClear();
    libraryActions.replaceQueueAndPlay.mockClear();
    bioActions.requestBio.mockClear();
  });

  it('renders the album at currentLibraryIndex', () => {
    const { getByText } = render(LibraryView);
    expect(getByText('A')).toBeTruthy();
  });

  it('fires bioActions.requestBio for the current album on mount', () => {
    render(LibraryView);
    expect(bioActions.requestBio).toHaveBeenCalledWith('X', 'A');
  });

  it('advances index on swipe right-to-left', async () => {
    const { container } = render(LibraryView);
    const host = container.querySelector('[data-testid="library-view"]') as HTMLElement;
    await fireEvent.pointerDown(host, { clientX: 800, clientY: 200, pointerId: 1 });
    await fireEvent.pointerUp(host, { clientX: 100, clientY: 200, pointerId: 1 });
    expect(get(currentLibraryIndex)).toBe(1);
  });

  it('decrements index on swipe left-to-right', async () => {
    currentLibraryIndex.set(1);
    const { container } = render(LibraryView);
    const host = container.querySelector('[data-testid="library-view"]') as HTMLElement;
    await fireEvent.pointerDown(host, { clientX: 100, clientY: 200, pointerId: 1 });
    await fireEvent.pointerUp(host, { clientX: 800, clientY: 200, pointerId: 1 });
    expect(get(currentLibraryIndex)).toBe(0);
  });

  it('wraps from last → first on right-to-left swipe (infinite loop)', async () => {
    currentLibraryIndex.set(albums.length - 1);
    const { container } = render(LibraryView);
    const host = container.querySelector('[data-testid="library-view"]') as HTMLElement;
    await fireEvent.pointerDown(host, { clientX: 800, clientY: 200, pointerId: 1 });
    await fireEvent.pointerUp(host, { clientX: 100, clientY: 200, pointerId: 1 });
    expect(get(currentLibraryIndex)).toBe(0);
  });

  it('wraps from first → last on left-to-right swipe', async () => {
    currentLibraryIndex.set(0);
    const { container } = render(LibraryView);
    const host = container.querySelector('[data-testid="library-view"]') as HTMLElement;
    await fireEvent.pointerDown(host, { clientX: 100, clientY: 200, pointerId: 1 });
    await fireEvent.pointerUp(host, { clientX: 800, clientY: 200, pointerId: 1 });
    expect(get(currentLibraryIndex)).toBe(albums.length - 1);
  });

  it('ignores small deltas (< 50px) — no index change', async () => {
    const { container } = render(LibraryView);
    const host = container.querySelector('[data-testid="library-view"]') as HTMLElement;
    await fireEvent.pointerDown(host, { clientX: 400, clientY: 200, pointerId: 1 });
    await fireEvent.pointerUp(host, { clientX: 380, clientY: 200, pointerId: 1 });
    expect(get(currentLibraryIndex)).toBe(0);
  });

  it('renders a placeholder when albums array is empty', () => {
    libraryAlbums.set([]);
    const { container } = render(LibraryView);
    expect(container.querySelector('[data-testid="library-empty"]')).toBeTruthy();
    libraryAlbums.set(albums);
  });

  it('tap album cover invokes libraryActions.replaceQueueAndPlay with current album', async () => {
    const { container } = render(LibraryView);
    const cover = container.querySelector('button.album-cover')! as HTMLButtonElement;
    cover.click();
    expect(libraryActions.replaceQueueAndPlay).toHaveBeenCalledWith(albums[0]);
  });

  it('does not refetch tracks/bio when libraryAlbums re-emits the same albums', () => {
    render(LibraryView);
    expect(libraryActions.fetchAlbumTracks).toHaveBeenCalledTimes(1);
    expect(bioActions.requestBio).toHaveBeenCalledTimes(1);
    // Re-emit the same array — simulates a pushLibraryAlbums after cache rebuild
    libraryAlbums.set([...albums]);
    expect(libraryActions.fetchAlbumTracks).toHaveBeenCalledTimes(1);
    expect(bioActions.requestBio).toHaveBeenCalledTimes(1);
  });

  it('exposes the swipe direction as a data attribute on the album wrapper', async () => {
    const { getByTestId, getAllByTestId } = render(LibraryView);
    const region = getByTestId('library-view');
    await fireEvent.pointerDown(region, { clientX: 1000 });
    await fireEvent.pointerUp(region, { clientX: 800 });   // dx = -200 → forward
    // During the fly transition, both the exiting and entering wrappers exist
    // simultaneously. getAllByTestId handles the multi-element case gracefully;
    // at least one wrapper must carry data-direction="forward".
    const wrappers = getAllByTestId('album-slide-wrapper');
    expect(wrappers.some((w) => w.getAttribute('data-direction') === 'forward')).toBe(true);
  });
});
