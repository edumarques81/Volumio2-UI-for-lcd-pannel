import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

// Which output the picker has selected decides where Play Album goes. These
// tests pin that routing: with a session live, nothing may reach MPD, and the
// tracks the backend refused must be surfaced rather than silently dropped.
vi.mock('../ArtistsPage.svelte', () => ({ default: vi.fn(() => null) }));

const mocks = await vi.hoisted(async () => {
  const { writable, derived } = await import('svelte/store');
  const albums = [
    {
      id: '1', uri: 'USB/Karajan', title: 'Beethoven: Symphonies', artist: 'Herbert von Karajan',
      albumArt: '/a', trackCount: 9, source: 'local', sampleRate: 352800,
    },
  ];
  const castState = writable({
    active: false, deviceId: '', deviceName: '', status: 'stop' as const,
    title: '', artist: '', album: '', albumart: '', uri: '',
    seek: 0, duration: 0, volume: 0, mute: false, queueIndex: 0, queueLength: 0,
  });
  return {
    libraryAlbums: writable(albums),
    libraryArtists: writable<any[]>([]),
    artistAlbums: writable<any[]>([]),
    selectedArtist: writable<string | null>(null),
    artistLooseTracks: writable<any[]>([]),
    libraryPageKind: writable<'albums' | 'artists'>('albums'),
    libraryAlbumTracks: writable<any[]>([]),
    libraryAlbumTotalDuration: writable(0),
    currentLibraryIndex: writable(0),
    selectedLibraryAlbum: writable<any>(null),
    libraryActions: {
      fetchAlbumTracks: vi.fn(),
      playAlbum: vi.fn(),
      playLooseTracks: vi.fn(),
      cyclePageKind: vi.fn(),
    },
    bioActions: { requestBio: vi.fn(), refreshBio: vi.fn() },
    currentAlbumBio: writable({ summary: '', sourceUrl: '', kind: '' }),
    bioLoading: writable(false),
    viewActions: { goToPlayer: vi.fn() },
    castState,
    castActive: derived(castState, ($s) => $s.active),
    castActions: {
      playAlbum: vi.fn(
        async (): Promise<{ ok: boolean; error?: string; skipped?: any[] }> => ({ ok: true, skipped: [] }),
      ),
    },
    toastActions: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
  };
});

vi.mock('$lib/stores/library', () => ({
  libraryAlbums: mocks.libraryAlbums,
  libraryArtists: mocks.libraryArtists,
  artistAlbums: mocks.artistAlbums,
  selectedArtist: mocks.selectedArtist,
  artistLooseTracks: mocks.artistLooseTracks,
  libraryPageKind: mocks.libraryPageKind,
  libraryAlbumTracks: mocks.libraryAlbumTracks,
  libraryAlbumTotalDuration: mocks.libraryAlbumTotalDuration,
  currentLibraryIndex: mocks.currentLibraryIndex,
  selectedLibraryAlbum: mocks.selectedLibraryAlbum,
  libraryActions: mocks.libraryActions,
}));
vi.mock('$lib/stores/bios', () => ({
  currentAlbumBio: mocks.currentAlbumBio,
  bioLoading: mocks.bioLoading,
  bioActions: mocks.bioActions,
}));
vi.mock('$lib/stores/navigation', () => ({ viewActions: mocks.viewActions }));
vi.mock('$lib/stores/player', () => ({
  formatTime: (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
}));
vi.mock('$lib/stores/cast', () => ({
  castActive: mocks.castActive,
  castActions: mocks.castActions,
}));
vi.mock('$lib/stores/toast', () => ({ toastActions: mocks.toastActions }));

import LibraryView from '../LibraryView.svelte';

async function settle() {
  await tick();
  await Promise.resolve();
  await tick();
}

async function tapPlayAlbum() {
  const { container } = render(LibraryView);
  await tick();
  await fireEvent.click(container.querySelector('[data-testid="play-album-button"]')!);
  await settle();
  return container;
}

describe('LibraryView — Play Album output routing', () => {
  beforeEach(() => {
    mocks.currentLibraryIndex.set(0);
    mocks.selectedArtist.set(null);
    mocks.artistLooseTracks.set([]);
    mocks.libraryPageKind.set('albums');
    mocks.castState.update((s) => ({ ...s, active: false }));
    mocks.libraryActions.playAlbum.mockClear();
    mocks.libraryActions.playLooseTracks.mockClear();
    mocks.viewActions.goToPlayer.mockClear();
    Object.values(mocks.toastActions).forEach((fn: any) => fn.mockClear());
    mocks.castActions.playAlbum.mockClear();
    mocks.castActions.playAlbum.mockImplementation(async () => ({ ok: true, skipped: [] }));
  });

  it('queues onto MPD when the DAC is the output', async () => {
    await tapPlayAlbum();
    expect(mocks.libraryActions.playAlbum).toHaveBeenCalledTimes(1);
    expect(mocks.castActions.playAlbum).not.toHaveBeenCalled();
  });

  it('casts the album when a session is live, and never touches MPD', async () => {
    mocks.castState.update((s) => ({ ...s, active: true, deviceId: 'hub' }));
    await tapPlayAlbum();

    expect(mocks.libraryActions.playAlbum).not.toHaveBeenCalled();
    expect(mocks.castActions.playAlbum).toHaveBeenCalledWith({
      album: 'Beethoven: Symphonies',
      albumArtist: 'Herbert von Karajan',
      uri: 'USB/Karajan',
      sampleRate: 352800,
    });
    expect(mocks.viewActions.goToPlayer).toHaveBeenCalled();
  });

  it('warns with the backend reason when some tracks are refused', async () => {
    mocks.castState.update((s) => ({ ...s, active: true }));
    mocks.castActions.playAlbum.mockImplementation(async () => ({
      ok: true,
      skipped: [
        { title: 'Allegro', uri: 'a', reason: '352.8 kHz is above the 192 kHz a Cast device accepts' },
        { title: 'Andante', uri: 'b', reason: '352.8 kHz is above the 192 kHz a Cast device accepts' },
      ],
    }));
    await tapPlayAlbum();

    expect(mocks.toastActions.warning).toHaveBeenCalledWith(
      'Skipped 2 tracks',
      '352.8 kHz is above the 192 kHz a Cast device accepts',
    );
    // A partly-castable album still plays, so the view still follows.
    expect(mocks.viewActions.goToPlayer).toHaveBeenCalled();
  });

  it('singularises a one-track skip', async () => {
    mocks.castState.update((s) => ({ ...s, active: true }));
    mocks.castActions.playAlbum.mockImplementation(async () => ({
      ok: true,
      skipped: [{ title: 'Allegro', uri: 'a', reason: 'DSD cannot be cast' }],
    }));
    await tapPlayAlbum();
    expect(mocks.toastActions.warning).toHaveBeenCalledWith('Skipped 1 track', 'DSD cannot be cast');
  });

  it('errors with the per-track reason when nothing is castable, and stays put', async () => {
    mocks.castState.update((s) => ({ ...s, active: true }));
    mocks.castActions.playAlbum.mockImplementation(async () => ({
      ok: false,
      error: 'cast: none of those tracks can be cast',
      skipped: [{ title: 'Allegro', uri: 'a', reason: 'DSD cannot be cast' }],
    }));
    await tapPlayAlbum();

    expect(mocks.toastActions.error).toHaveBeenCalledWith('Could not cast this album', 'DSD cannot be cast');
    expect(mocks.toastActions.warning).not.toHaveBeenCalled();
    expect(mocks.viewActions.goToPlayer).not.toHaveBeenCalled();
  });

  it('falls back to the raw error when the backend sends no per-track reason', async () => {
    mocks.castState.update((s) => ({ ...s, active: true }));
    mocks.castActions.playAlbum.mockImplementation(async () => ({ ok: false, error: 'no session is active' }));
    await tapPlayAlbum();
    expect(mocks.toastActions.error).toHaveBeenCalledWith('Could not cast this album', 'no session is active');
  });

  it('says so when loose tracks fall back to the DAC mid-cast', async () => {
    mocks.selectedArtist.set('Herbert von Karajan');
    mocks.artistAlbums.set([]);
    mocks.artistLooseTracks.set([{ uri: 't1', title: 'Stray', artist: 'X', album: '', duration: 60 }]);
    mocks.castState.update((s) => ({ ...s, active: true }));

    const { container } = render(LibraryView);
    await tick();
    await fireEvent.click(container.querySelector('[data-testid="loose-tracks-play-all"]')!);
    await settle();

    expect(mocks.libraryActions.playLooseTracks).toHaveBeenCalledTimes(1);
    expect(mocks.toastActions.info).toHaveBeenCalledWith(
      'Playing on the Stellar DAC',
      "Loose tracks can't be cast yet",
    );
  });
});
