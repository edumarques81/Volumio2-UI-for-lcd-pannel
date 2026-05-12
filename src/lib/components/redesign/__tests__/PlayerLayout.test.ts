import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const mocks = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  const currentView = writable('player');
  const refreshInProgress = writable(false);
  const playerActions = { play: vi.fn(), pause: vi.fn(), next: vi.fn(), prev: vi.fn(), seekTo: vi.fn() };
  return {
    currentView,
    refreshInProgress,
    viewActions: {
      goToPlayer: vi.fn(), goToLibrary: vi.fn(), tapVuMeter: vi.fn(),
      tapSettings: vi.fn(), tapRefresh: vi.fn(), tapPower: vi.fn(),
    },
    currentTrack: writable({ title: '', artist: '', album: '', albumart: '' }),
    isPlaying: writable(false),
    seek: writable(0),
    duration: writable(0),
    trackQuality: writable(''),
    playerState: writable({
      status: 'stop', position: 0, title: '', artist: '', album: '',
      albumart: '', uri: '', trackType: '', seek: 0, duration: 0,
      random: false, repeat: false, repeatSingle: false, volume: 0, mute: false,
    }),
    playerActions,
    queue: writable([]),
    lastPlayedAlbum: writable(null),
  };
});

const libraryMocks = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return {
    libraryAlbums: writable<any[]>([]),
    // M2.C: LibraryView now imports artistAlbums/selectedArtist/libraryPageKind
    // for the filtered-list + page-kind renderer switch. Mock them as writables
    // so this test (which renders LibraryView via PlayerLayout's library branch)
    // doesn't blow up on subscribe-to-undefined.
    libraryArtists: writable<any[]>([]),
    artistAlbums: writable<any[]>([]),
    selectedArtist: writable<string | null>(null),
    libraryPageKind: writable<'albums' | 'artists'>('albums'),
    libraryAlbumTracks: writable<any[]>([]),
    libraryAlbumTotalDuration: writable(0),
    currentLibraryIndex: writable(0),
    selectedLibraryAlbum: writable<any>(null),
    libraryActions: {
      fetchAlbumTracks: vi.fn(),
      replaceQueueAndPlay: vi.fn(),
      playAlbum: vi.fn(),
      cyclePageKind: vi.fn(),
    },
    currentAlbumBio: writable({ summary: '', sourceUrl: '', kind: '' }),
    bioLoading: writable(false),
    bioActions: { requestBio: vi.fn(), refreshBio: vi.fn() },
  };
});

vi.mock('$lib/stores/navigation', () => ({
  currentView: mocks.currentView,
  refreshInProgress: mocks.refreshInProgress,
  viewActions: mocks.viewActions,
}));
vi.mock('$lib/stores/player', () => ({
  currentTrack: mocks.currentTrack,
  isPlaying: mocks.isPlaying,
  seek: mocks.seek,
  duration: mocks.duration,
  trackQuality: mocks.trackQuality,
  playerState: mocks.playerState,
  playerActions: mocks.playerActions,
  lastPlayedAlbum: mocks.lastPlayedAlbum,
  formatTime: (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
}));
vi.mock('$lib/stores/queue', () => ({ queue: mocks.queue }));
vi.mock('$lib/stores/library', () => ({
  libraryAlbums: libraryMocks.libraryAlbums,
  libraryArtists: libraryMocks.libraryArtists,
  artistAlbums: libraryMocks.artistAlbums,
  selectedArtist: libraryMocks.selectedArtist,
  libraryPageKind: libraryMocks.libraryPageKind,
  libraryAlbumTracks: libraryMocks.libraryAlbumTracks,
  libraryAlbumTotalDuration: libraryMocks.libraryAlbumTotalDuration,
  currentLibraryIndex: libraryMocks.currentLibraryIndex,
  selectedLibraryAlbum: libraryMocks.selectedLibraryAlbum,
  libraryActions: libraryMocks.libraryActions,
}));
vi.mock('$lib/stores/bios', () => ({
  currentAlbumBio: libraryMocks.currentAlbumBio,
  bioLoading: libraryMocks.bioLoading,
  bioActions: libraryMocks.bioActions,
}));

import PlayerLayout from '../PlayerLayout.svelte';

describe('PlayerLayout', () => {
  it('renders PlayerView when currentView is player', () => {
    mocks.currentView.set('player');
    const { container } = render(PlayerLayout);
    expect(container.querySelector('.player-view')).toBeTruthy();
  });

  it('renders nav column always', () => {
    const { container } = render(PlayerLayout);
    expect(container.querySelector('.nav-column')).toBeTruthy();
  });

  it('renders LibraryView when currentView is library', () => {
    mocks.currentView.set('library');
    const { container } = render(PlayerLayout);
    expect(container.querySelector('.library-view')).toBeTruthy();
    expect(container.querySelector('.player-view')).toBeNull();
  });

  it('applies the global black background and sheen class', () => {
    mocks.currentView.set('player');
    const { container } = render(PlayerLayout);
    const root = container.querySelector('.player-layout');
    expect(root?.classList.contains('player-layout')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Bundle-size guard (plan §C6.1 + M1.E)
  //
  // Rare-path views must not be transitively loaded at module-load time when
  // the user is idle on the player view — they ship in their own Vite chunks.
  // We assert this at the source level: PlayerLayout must NOT contain a
  // static `import` statement for these views; they must be pulled in via
  // dynamic `import()` so Rollup can split them out. (A mock-based assertion
  // is unreliable here — Vitest's `vi.mock` does not consistently intercept
  // dynamic `import()` of .svelte files when the real Vite-Svelte plugin is
  // in the resolver chain — so we guard the chunking intent at the source
  // level instead.)
  //
  // Regex shape (M1.E widening — C6 reviewers flagged the original \w+ form
  // as too narrow): matches `import X from`, `import { X } from`,
  // `import * as X from`, `import type X from`, and combinations with
  // destructured siblings. Source must NOT contain such a static import for
  // the lazy views; source MUST contain the dynamic-import call site.
  // ---------------------------------------------------------------------------
  function staticImportRegexFor(filename: string): RegExp {
    // [^;\n]* between `import` and `from` covers every import shape Vite/Rollup
    // would treat as a static import; the trailing path arm ensures we only
    // catch imports of THIS file.
    return new RegExp(
      String.raw`^\s*import\b[^;\n]*\bfrom\s+['"][^'"]*${filename.replace(/\./g, '\\.')}['"]\s*;?`,
      'm',
    );
  }

  it.each([
    ['SettingsView.svelte'],
    ['VuMeterView.svelte'],
  ])('does not statically import %s (so it stays in a separate chunk)', (filename) => {
    const here = dirname(fileURLToPath(import.meta.url));
    const playerLayoutPath = resolve(here, '..', 'PlayerLayout.svelte');
    const src = readFileSync(playerLayoutPath, 'utf8');
    expect(staticImportRegexFor(filename).test(src)).toBe(false);
    // And confirm the lazy hookup is in place (dynamic-import call site).
    expect(src.includes(`import('./${filename}')`)).toBe(true);
  });
});
