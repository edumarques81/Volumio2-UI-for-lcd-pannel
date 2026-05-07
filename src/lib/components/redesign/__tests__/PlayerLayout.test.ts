import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

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
    libraryAlbumTracks: writable<any[]>([]),
    currentLibraryIndex: writable(0),
    selectedLibraryAlbum: writable<any>(null),
    libraryActions: {
      fetchAlbumTracks: vi.fn(),
      replaceQueueAndPlay: vi.fn(),
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
  libraryAlbumTracks: libraryMocks.libraryAlbumTracks,
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
});
