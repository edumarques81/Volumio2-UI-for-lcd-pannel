import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Album } from '$lib/stores/library';

const albums: Album[] = [
  { id: '1', uri: 'a1', title: 'A', artist: 'X', albumArt: '/a', trackCount: 0, source: 'local' },
  { id: '2', uri: 'a2', title: 'B', artist: 'Y', albumArt: '/b', trackCount: 0, source: 'local' },
  { id: '3', uri: 'a3', title: 'C', artist: 'Z', albumArt: '/c', trackCount: 0, source: 'local' },
];

// Stub ArtistsPage so we don't drag its full dependency tree into this suite.
// The plan dynamic-imports ArtistsPage when libraryPageKind === 'artists'; the
// mock keeps the dynamic-import path resolvable while emitting nothing into
// the DOM (so the bundle-guard regex assertion in the second describe block
// is the only "is ArtistsPage statically imported?" signal).
vi.mock('../ArtistsPage.svelte', () => ({ default: vi.fn(() => null) }));

const {
  libraryAlbums,
  libraryArtists,
  artistAlbums,
  selectedArtist,
  libraryPageKind,
  libraryAlbumTracks,
  libraryAlbumTotalDuration,
  currentLibraryIndex,
  selectedLibraryAlbum,
  libraryActions,
  bioActions,
  viewActions,
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
  const libraryArtistsStore = writable<any[]>([]);
  const artistAlbumsStore = writable<any[]>([]);
  const selectedArtistStore = writable<string | null>(null);
  const libraryPageKindStore = writable<'albums' | 'artists'>('albums');
  const libraryAlbumTracksStore = writable<any[]>([]);
  const libraryAlbumTotalDurationStore = writable(0);
  const currentLibraryIndexStore = writable(0);
  const selectedLibraryAlbumStore = writable<any>(null);

  return {
    libraryAlbums: libraryAlbumsStore,
    libraryArtists: libraryArtistsStore,
    artistAlbums: artistAlbumsStore,
    selectedArtist: selectedArtistStore,
    libraryPageKind: libraryPageKindStore,
    libraryAlbumTracks: libraryAlbumTracksStore,
    libraryAlbumTotalDuration: libraryAlbumTotalDurationStore,
    currentLibraryIndex: currentLibraryIndexStore,
    selectedLibraryAlbum: selectedLibraryAlbumStore,
    libraryActions: {
      fetchAlbumTracks: vi.fn((album: any) => {
        selectedLibraryAlbumStore.set(album);
        libraryAlbumTracksStore.set([{ uri: 't1', title: 'Track', duration: 60 }]);
      }),
      playAlbum: vi.fn(),
      // cyclePageKind is asserted on directly by the M2.C tests; the mock body
      // mirrors the wrap-modulo semantics of the real action so subsequent
      // reactive `$libraryPageKind` reads stay consistent even though most
      // tests only check the spy's call args.
      cyclePageKind: vi.fn((delta: 1 | -1) => {
        const kinds = ['albums', 'artists'] as const;
        libraryPageKindStore.update((k) => {
          const idx = kinds.indexOf(k);
          return kinds[((idx + delta) % kinds.length + kinds.length) % kinds.length];
        });
      }),
    },
    bioActions: { requestBio: vi.fn(), refreshBio: vi.fn() },
    viewActions: { goToPlayer: vi.fn() },
    currentAlbumBio: writable({ summary: '', sourceUrl: '', kind: '' }),
    bioLoading: writable(false),
  };
});

vi.mock('$lib/stores/library', () => ({
  libraryAlbums,
  libraryArtists,
  artistAlbums,
  selectedArtist,
  libraryPageKind,
  libraryAlbumTracks,
  libraryAlbumTotalDuration,
  currentLibraryIndex,
  selectedLibraryAlbum,
  libraryActions,
}));
vi.mock('$lib/stores/bios', () => ({ currentAlbumBio, bioLoading, bioActions }));
vi.mock('$lib/stores/navigation', () => ({ viewActions }));
vi.mock('$lib/stores/player', () => ({
  formatTime: (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
}));

import LibraryView from '../LibraryView.svelte';

describe('LibraryView', () => {
  beforeEach(() => {
    currentLibraryIndex.set(0);
    libraryAlbumTracks.set([]);
    libraryAlbums.set(albums);
    libraryArtists.set([]);
    artistAlbums.set([]);
    selectedArtist.set(null);
    libraryPageKind.set('albums');
    libraryActions.fetchAlbumTracks.mockClear();
    libraryActions.playAlbum.mockClear();
    libraryActions.cyclePageKind.mockClear();
    viewActions.goToPlayer.mockClear();
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

  it('tap album cover invokes libraryActions.playAlbum and navigates to Player', async () => {
    const { container } = render(LibraryView);
    const cover = container.querySelector('button.album-cover')! as HTMLButtonElement;
    cover.click();
    expect(libraryActions.playAlbum).toHaveBeenCalledWith(albums[0]);
    expect(viewActions.goToPlayer).toHaveBeenCalledTimes(1);
  });

  it('Play Album button invokes libraryActions.playAlbum and navigates to Player', async () => {
    const { getByTestId } = render(LibraryView);
    const btn = getByTestId('play-album-button') as HTMLButtonElement;
    await fireEvent.click(btn);
    expect(libraryActions.playAlbum).toHaveBeenCalledWith(albums[0]);
    expect(viewActions.goToPlayer).toHaveBeenCalledTimes(1);
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

  // --- Wave 3A: interactive edge chevrons --------------------------------
  it('renders left + right edge chevrons when at least one album is in the library', () => {
    const { getByTestId } = render(LibraryView);
    expect(getByTestId('library-chevron-left')).toBeTruthy();
    expect(getByTestId('library-chevron-right')).toBeTruthy();
  });

  it('renders both chevrons even when the library is empty (always-visible policy)', () => {
    libraryAlbums.set([]);
    const { getByTestId } = render(LibraryView);
    expect(getByTestId('library-chevron-left')).toBeTruthy();
    expect(getByTestId('library-chevron-right')).toBeTruthy();
    libraryAlbums.set(albums);
  });

  it('tapping the right chevron increments currentLibraryIndex (mod length)', async () => {
    const { getByTestId } = render(LibraryView);
    await fireEvent.click(getByTestId('library-chevron-right'));
    expect(get(currentLibraryIndex)).toBe(1);
  });

  it('tapping the left chevron decrements currentLibraryIndex (mod length)', async () => {
    currentLibraryIndex.set(1);
    const { getByTestId } = render(LibraryView);
    await fireEvent.click(getByTestId('library-chevron-left'));
    expect(get(currentLibraryIndex)).toBe(0);
  });

  it('tapping the left chevron at index 0 wraps to the last album', async () => {
    currentLibraryIndex.set(0);
    const { getByTestId } = render(LibraryView);
    await fireEvent.click(getByTestId('library-chevron-left'));
    expect(get(currentLibraryIndex)).toBe(albums.length - 1);
  });

  it('tapping the right chevron at last index wraps to 0', async () => {
    currentLibraryIndex.set(albums.length - 1);
    const { getByTestId } = render(LibraryView);
    await fireEvent.click(getByTestId('library-chevron-right'));
    expect(get(currentLibraryIndex)).toBe(0);
  });

  it('tapping a chevron does not also trigger the swipe handler (no double-advance)', async () => {
    const { getByTestId } = render(LibraryView);
    const chevron = getByTestId('library-chevron-right');
    // Synthesize a tap: pointerdown + pointerup at the same location on the
    // chevron. If the swipe handler also reacts, |dx| === 0 < threshold so it
    // is a no-op anyway, BUT a click bubbling through still must advance only
    // once (not twice).
    await fireEvent.pointerDown(chevron, { clientX: 100, clientY: 200, pointerId: 1 });
    await fireEvent.pointerUp(chevron, { clientX: 100, clientY: 200, pointerId: 1 });
    await fireEvent.click(chevron);
    expect(get(currentLibraryIndex)).toBe(1);
  });
});

// --- M2.C Wave 3: vertical-swipe page-kind switch + filtered list -----------

// Note on titles: plan uses literal 'A' / 'B'. The real AlbumPage renders
// the literal eyebrow "ALBUM" and button text "Play Album", both of which
// contain the letter 'A'. To preserve the plan's textContent.not.toContain
// assertion intent ("the OTHER album's title is NOT in the DOM") we use
// distinctive multi-letter titles that don't collide with AlbumPage chrome.
const albumA = { id: '1', title: 'TitleAlpha', artist: 'ArtistAlpha', uri: 'nas:a', albumArt: '/a', trackCount: 0, source: 'nas' as const };
const albumB = { id: '2', title: 'TitleBravo', artist: 'ArtistBravo', uri: 'nas:b', albumArt: '/b', trackCount: 0, source: 'nas' as const };

describe('LibraryView page-kind renderer + vertical swipe + filtered list', () => {
  beforeEach(() => {
    libraryAlbums.set([albumA, albumB]);
    libraryArtists.set([]);
    artistAlbums.set([]);
    selectedArtist.set(null);
    libraryPageKind.set('albums');
    currentLibraryIndex.set(0);
    libraryActions.cyclePageKind.mockClear();
  });

  it('renders AlbumPage when libraryPageKind === "albums"', () => {
    const { container } = render(LibraryView);
    expect(container.querySelector('[data-testid="album-slide-wrapper"]')).toBeTruthy();
  });

  it('renders ArtistsPage stub when libraryPageKind === "artists"', () => {
    libraryPageKind.set('artists');
    const { container } = render(LibraryView);
    expect(container.querySelector('[data-testid="album-slide-wrapper"]')).toBeNull();
  });

  it('pointer-up with vertical dy >= 50px up calls cyclePageKind(+1)', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 500, clientY: 200 });
    expect(libraryActions.cyclePageKind).toHaveBeenCalledWith(1);
  });

  it('pointer-up with vertical dy >= 50px down calls cyclePageKind(-1)', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 500, clientY: 400 });
    expect(libraryActions.cyclePageKind).toHaveBeenCalledWith(-1);
  });

  it('pointer-up with dominant horizontal swipe calls existing advance, not cyclePageKind', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 600, clientY: 280 });
    expect(libraryActions.cyclePageKind).not.toHaveBeenCalled();
  });

  it('diagonal where |dx| === |dy| takes the horizontal branch (tie-break)', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 600, clientY: 400 });
    expect(libraryActions.cyclePageKind).not.toHaveBeenCalled();
  });

  it('below the 50px threshold on both axes is a no-op', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 540, clientY: 320 });
    expect(libraryActions.cyclePageKind).not.toHaveBeenCalled();
    expect(get(currentLibraryIndex)).toBe(0);
  });

  it('selectedArtist set + kind albums: renders from artistAlbums, not libraryAlbums', () => {
    selectedArtist.set('ArtistBravo');
    artistAlbums.set([albumB]);
    const { container } = render(LibraryView);
    const wrapper = container.querySelector('[data-testid="album-slide-wrapper"]');
    expect(wrapper).toBeTruthy();
    expect(container.textContent).toContain('TitleBravo');
    expect(container.textContent).not.toContain('TitleAlpha');
  });

  it('selectedArtist null + kind albums: renders from libraryAlbums', () => {
    selectedArtist.set(null);
    const { container } = render(LibraryView);
    expect(container.textContent).toContain('TitleAlpha');
  });
});

describe('LibraryView bundle-size guard (ArtistsPage stays lazy)', () => {
  function staticImportRegexFor(filename: string): RegExp {
    return new RegExp(
      String.raw`^\s*import\b[^;\n]*\bfrom\s+['"][^'"]*${filename.replace(/\./g, '\\.')}['"]\s*;?`,
      'm',
    );
  }

  it.each([['ArtistsPage.svelte']])(
    'does not statically import %s (stays in a separate chunk)',
    (filename) => {
      const here = dirname(fileURLToPath(import.meta.url));
      const libraryViewPath = resolve(here, '..', 'LibraryView.svelte');
      const src = readFileSync(libraryViewPath, 'utf8');
      expect(staticImportRegexFor(filename).test(src)).toBe(false);
      expect(src.includes(`import('./${filename}')`)).toBe(true);
    },
  );
});
