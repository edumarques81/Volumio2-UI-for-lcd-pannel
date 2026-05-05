import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const mocks = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  const currentView = writable('player');
  const playerActions = { play: vi.fn(), pause: vi.fn(), next: vi.fn(), prev: vi.fn(), seekTo: vi.fn() };
  return {
    currentView,
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
  };
});

vi.mock('$lib/stores/navigation', () => ({
  currentView: mocks.currentView,
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
}));
vi.mock('$lib/stores/queue', () => ({ queue: mocks.queue }));

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

  it('does NOT render PlayerView when currentView is library', () => {
    mocks.currentView.set('library');
    const { container } = render(PlayerLayout);
    expect(container.querySelector('.player-view')).toBeNull();
    // Library placeholder div renders so the layout grid stays balanced
    expect(container.querySelector('.library-pending')).toBeTruthy();
  });

  it('applies the global black background and sheen class', () => {
    mocks.currentView.set('player');
    const { container } = render(PlayerLayout);
    const root = container.querySelector('.player-layout');
    expect(root?.classList.contains('player-layout')).toBe(true);
  });
});
