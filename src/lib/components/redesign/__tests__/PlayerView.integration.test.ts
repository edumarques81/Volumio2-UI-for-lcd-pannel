import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

// Use vi.hoisted (async) so we can dynamically import svelte/store at
// hoist time without falling back to CJS `require()`. The mocks are
// then usable both inside vi.mock factories (also hoisted) and the test
// bodies below.
const mocks = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  const playerActions = {
    play: vi.fn(),
    pause: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    seekTo: vi.fn(),
  };
  const currentTrack = writable({
    title: 'Blue in Green',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    albumart: '/art/kob.jpg',
  });
  const isPlaying = writable(false);
  const seek = writable(45);
  const duration = writable(220);
  const trackQuality = writable('96 kHz • 24 bit • flac');
  const queue = writable([{ uri: 'a' }, { uri: 'b' }]);
  const playerState = writable({
    status: 'pause',
    position: 0,
    title: 'Blue in Green',
    artist: 'Miles Davis',
    album: 'Kind of Blue',
    albumart: '/art/kob.jpg',
    uri: 'mpd://kob/3',
    trackType: 'flac',
    seek: 45000,
    duration: 220,
    samplerate: '96 kHz',
    bitdepth: '24 bit',
    random: false,
    repeat: false,
    repeatSingle: false,
    volume: 80,
    mute: false,
  });
  const currentView = writable('player');
  const viewActions = {
    goToPlayer: vi.fn(), goToLibrary: vi.fn(), tapVuMeter: vi.fn(),
    tapSettings: vi.fn(), tapRefresh: vi.fn(), tapPower: vi.fn(),
  };
  const lastPlayedAlbum = writable(null);
  const transitioning = writable(false);
  return { playerActions, currentTrack, isPlaying, seek, duration, trackQuality, queue, playerState, currentView, viewActions, lastPlayedAlbum, transitioning };
});

vi.mock('$lib/stores/player', () => ({
  currentTrack: mocks.currentTrack,
  isPlaying: mocks.isPlaying,
  seek: mocks.seek,
  duration: mocks.duration,
  trackQuality: mocks.trackQuality,
  playerState: mocks.playerState,
  playerActions: mocks.playerActions,
  lastPlayedAlbum: mocks.lastPlayedAlbum,
  transitioning: mocks.transitioning,
}));
vi.mock('$lib/stores/queue', () => ({ queue: mocks.queue }));
vi.mock('$lib/stores/navigation', () => ({
  currentView: mocks.currentView,
  viewActions: mocks.viewActions,
}));

import PlayerView from '../PlayerView.svelte';

const { playerActions } = mocks;

describe('PlayerView (integration)', () => {
  beforeEach(() => {
    Object.values(playerActions).forEach(fn => fn.mockClear?.());
  });

  it('renders the current track title, artist, album', () => {
    const { getByText } = render(PlayerView);
    expect(getByText('Blue in Green')).toBeTruthy();
    expect(getByText('Miles Davis')).toBeTruthy();
    expect(getByText('Kind of Blue')).toBeTruthy();
  });

  it('displays the album art with the track albumart URL', () => {
    const { container } = render(PlayerView);
    const img = container.querySelector('img.art-img') as HTMLImageElement;
    expect(img?.src).toContain('/art/kob.jpg');
  });

  it('renders the format strip with HI-RES badge for 24/96', () => {
    const { container } = render(PlayerView);
    expect(container.textContent).toContain('HI-RES');
    expect(container.textContent).toContain('96kHz');
  });

  it('renders a TransportColumn with a Play button when paused', () => {
    const { container } = render(PlayerView);
    expect(container.querySelector('[aria-label="Play"]')).toBeTruthy();
  });

  it('shows progress bar with formatted current/total times', () => {
    const { getByText } = render(PlayerView);
    expect(getByText('0:45')).toBeTruthy();
    expect(getByText('3:40')).toBeTruthy();
  });
});
