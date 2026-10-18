import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// Same shape as PlayerView.airplay.integration: hoisted stores so the
// `vi.mock` factories and the test bodies share one instance. The new piece
// is the `$lib/stores/cast` mock — flipping a cast session on must swap the
// view the same way AirPlay does, but route transport to castActions and
// keep the progress bar (Cast has a real seek, unlike DACP).
const mocks = await vi.hoisted(async () => {
  const { writable, derived } = await import('svelte/store');

  const playerActions = {
    play: vi.fn(), pause: vi.fn(), next: vi.fn(), prev: vi.fn(),
    seekTo: vi.fn(), playLastPlayed: vi.fn(),
  };
  const currentTrack = writable({
    title: 'MPD Track Title',
    artist: 'MPD Artist',
    album: 'MPD Album',
    albumart: '/art/mpd.jpg',
  });
  const isPlaying = writable(false);
  const seek = writable(10);
  const duration = writable(180);
  const trackQuality = writable('');
  const queue = writable([{ uri: 'a' }, { uri: 'b' }]);
  const playerState = writable({
    status: 'pause' as const,
    position: 0,
    title: 'MPD Track Title',
    artist: 'MPD Artist',
    album: 'MPD Album',
    albumart: '/art/mpd.jpg',
    uri: 'mpd://mpd/1',
    trackType: 'flac',
    seek: 10000,
    duration: 180,
    samplerate: '44100',
    bitdepth: '16',
    random: false,
    repeat: false,
    repeatSingle: false,
    volume: 80,
    mute: false,
  });
  const lastPlayedAlbum = writable(null);
  const transitioning = writable(false);
  const currentView = writable('player');
  const viewActions = {
    goToPlayer: vi.fn(), goToLibrary: vi.fn(), tapVuMeter: vi.fn(),
    tapSettings: vi.fn(), tapRefresh: vi.fn(), tapPower: vi.fn(),
  };
  const modalActions = { openOutput: vi.fn(), closeOutput: vi.fn(), openPower: vi.fn(), closePower: vi.fn() };

  // AirPlay stays mocked and inactive: the point of several tests below is
  // that Cast does not disturb the AirPlay branch.
  const airplayState = writable({
    isActive: false, title: '', artist: '', album: '', sender: '',
    coverDataURL: '', seekSeconds: 0, durationSeconds: 0,
    canControl: false, sessionID: '', sampleRate: 0, bitDepth: 0,
  });
  const airplayActive = derived(airplayState, ($s) => $s.isActive);
  const airplayActions = { play: vi.fn(), pause: vi.fn(), toggle: vi.fn(), next: vi.fn(), prev: vi.fn() };

  const castState = writable({
    active: false, deviceId: '', deviceName: '', status: 'stop' as 'play' | 'pause' | 'stop',
    title: '', artist: '', album: '', albumart: '', uri: '',
    seek: 0, duration: 0, volume: 0, mute: false, queueIndex: 0, queueLength: 0,
  });
  const castActive = derived(castState, ($s) => $s.active);
  const castActions = {
    play: vi.fn(), pause: vi.fn(), toggle: vi.fn(), next: vi.fn(), prev: vi.fn(),
    seekTo: vi.fn(), setVolume: vi.fn(), setMuted: vi.fn(),
  };

  return {
    playerActions, currentTrack, isPlaying, seek, duration, trackQuality,
    queue, playerState, currentView, viewActions, modalActions, lastPlayedAlbum,
    transitioning, airplayState, airplayActive, airplayActions,
    castState, castActive, castActions,
  };
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
  modalActions: mocks.modalActions,
}));
vi.mock('$lib/stores/airplay', () => ({
  airplayState: mocks.airplayState,
  airplayActive: mocks.airplayActive,
  airplayActions: mocks.airplayActions,
}));
vi.mock('$lib/stores/cast', () => ({
  castState: mocks.castState,
  castActive: mocks.castActive,
  castActions: mocks.castActions,
}));

import PlayerView from '../PlayerView.svelte';

const IDLE_CAST = {
  active: false, deviceId: '', deviceName: '', status: 'stop' as const,
  title: '', artist: '', album: '', albumart: '', uri: '',
  seek: 0, duration: 0, volume: 0, mute: false, queueIndex: 0, queueLength: 0,
};

const CAST_SESSION = {
  active: true,
  deviceId: 'hub',
  deviceName: 'Living Room Display',
  status: 'play' as const,
  title: 'Keep Yourself Warm',
  artist: 'Frightened Rabbit',
  album: 'The Midnight Organ Fight',
  albumart: '/albumart?path=USB/Frightened%20Rabbit',
  uri: 'http://192.168.86.25:3000/stream/abc',
  seek: 42_000,
  duration: 320,
  volume: 24,
  mute: false,
  queueIndex: 3,
  queueLength: 14,
};

describe('PlayerView — Cast mode swap', () => {
  beforeEach(() => {
    Object.values(mocks.playerActions).forEach((fn: any) => fn.mockClear?.());
    Object.values(mocks.castActions).forEach((fn: any) => fn.mockClear?.());
    Object.values(mocks.airplayActions).forEach((fn: any) => fn.mockClear?.());
    mocks.castState.set({ ...IDLE_CAST });
    mocks.airplayState.set({
      isActive: false, title: '', artist: '', album: '', sender: '',
      coverDataURL: '', seekSeconds: 0, durationSeconds: 0,
      canControl: false, sessionID: '', sampleRate: 0, bitDepth: 0,
    });
    mocks.isPlaying.set(false);
  });

  it('shows MPD metadata when nothing is casting', () => {
    const { container } = render(PlayerView);
    expect(container.textContent).toContain('MPD Track Title');
    expect(container.querySelector('[data-testid="cast-source-badge"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="player-view"]')!.getAttribute('data-cast')).toBe('false');
  });

  it('offers the output button even with nothing playing', () => {
    mocks.currentTrack.set({ title: '', artist: '', album: '', albumart: '' });
    const { container } = render(PlayerView);
    expect(container.querySelector('[data-testid="output-button"]')).toBeTruthy();
    // Restore for the rest of the suite.
    mocks.currentTrack.set({
      title: 'MPD Track Title', artist: 'MPD Artist', album: 'MPD Album', albumart: '/art/mpd.jpg',
    });
  });

  it('a connected-but-idle device does NOT take the view over', async () => {
    const { container } = render(PlayerView);
    mocks.castState.set({ ...IDLE_CAST, active: true, deviceId: 'hub', deviceName: 'Living Room Display' });
    await Promise.resolve();

    // The MPD track still owns the screen — only the output button changes.
    expect(container.textContent).toContain('MPD Track Title');
    expect(container.querySelector('[data-testid="cast-source-badge"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="output-button"]')!.textContent).toContain('Living Room Display');
  });

  it('swaps to cast metadata once a track is loaded', async () => {
    const { container } = render(PlayerView);
    mocks.castState.set(CAST_SESSION);
    await Promise.resolve();

    expect(container.textContent).toContain('Keep Yourself Warm');
    expect(container.textContent).toContain('Frightened Rabbit');
    expect(container.textContent).toContain('The Midnight Organ Fight');
    expect(container.textContent).not.toContain('MPD Track Title');
    expect(container.querySelector('[data-testid="player-view"]')!.getAttribute('data-cast')).toBe('true');
  });

  it('renders the CAST · <device> badge', async () => {
    const { container } = render(PlayerView);
    mocks.castState.set(CAST_SESSION);
    await Promise.resolve();

    const badge = container.querySelector('[data-testid="cast-source-badge"]')!;
    expect(badge.textContent).toContain('CAST');
    expect(badge.textContent).toContain('Living Room Display');
  });

  it('keeps the progress bar and converts cast ms to seconds', async () => {
    const { container } = render(PlayerView);
    mocks.castState.set(CAST_SESSION);
    await Promise.resolve();

    // Unlike AirPlay, Cast exposes a real position — the bar must stay.
    expect(container.querySelector('[data-testid="progress-track"]')).toBeTruthy();
    // 42000ms -> 0:42 elapsed, 320s -> 5:20 total.
    expect(container.textContent).toContain('0:42');
    expect(container.textContent).toContain('5:20');
  });

  it('hides the format strip in cast mode rather than echoing local tags', async () => {
    const { container } = render(PlayerView);
    expect(container.querySelector('[data-testid="format-strip"]')).toBeTruthy();

    mocks.castState.set(CAST_SESSION);
    await Promise.resolve();
    expect(container.querySelector('[data-testid="format-strip"]')).toBeFalsy();
  });

  it('routes play/pause to castActions.toggle, never to MPD', async () => {
    const { container } = render(PlayerView);
    mocks.castState.set(CAST_SESSION);
    await Promise.resolve();

    await fireEvent.click(container.querySelector('[data-testid="transport-play-pause"]')!);
    expect(mocks.castActions.toggle).toHaveBeenCalledTimes(1);
    expect(mocks.playerActions.play).not.toHaveBeenCalled();
    expect(mocks.playerActions.pause).not.toHaveBeenCalled();
  });

  it('routes next and prev to castActions', async () => {
    const { container } = render(PlayerView);
    mocks.castState.set(CAST_SESSION);
    await Promise.resolve();

    await fireEvent.click(container.querySelector('[data-testid="transport-next"]')!);
    await fireEvent.click(container.querySelector('[data-testid="transport-prev"]')!);
    expect(mocks.castActions.next).toHaveBeenCalledTimes(1);
    expect(mocks.castActions.prev).toHaveBeenCalledTimes(1);
    expect(mocks.playerActions.next).not.toHaveBeenCalled();
    expect(mocks.playerActions.prev).not.toHaveBeenCalled();
  });

  it('takes the play/pause icon from the device, not from MPD', async () => {
    const { container } = render(PlayerView);
    // MPD says stopped; the device says playing. The device wins.
    mocks.isPlaying.set(false);
    mocks.castState.set(CAST_SESSION);
    await Promise.resolve();
    const btn = container.querySelector('[data-testid="transport-play-pause"]')!;
    expect(btn.getAttribute('aria-label')).toBe('Pause');

    mocks.castState.set({ ...CAST_SESSION, status: 'pause' });
    await Promise.resolve();
    expect(btn.getAttribute('aria-label')).toBe('Play');
  });

  it('disables Next on the last track of the cast queue', async () => {
    const { container } = render(PlayerView);
    mocks.castState.set({ ...CAST_SESSION, queueIndex: 13, queueLength: 14 });
    await Promise.resolve();
    expect((container.querySelector('[data-testid="transport-next"]') as HTMLButtonElement).disabled).toBe(true);

    mocks.castState.set({ ...CAST_SESSION, queueIndex: 12, queueLength: 14 });
    await Promise.resolve();
    expect((container.querySelector('[data-testid="transport-next"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('AirPlay still wins over a live cast session', async () => {
    const { container } = render(PlayerView);
    mocks.castState.set(CAST_SESSION);
    mocks.airplayState.set({
      isActive: true, title: 'Vampire', artist: 'Olivia Rodrigo', album: 'GUTS',
      sender: "Eduardo's iPhone", coverDataURL: 'data:image/jpeg;base64,abc',
      seekSeconds: 1, durationSeconds: 2, canControl: true, sessionID: 's1',
      sampleRate: 44100, bitDepth: 16,
    });
    await Promise.resolve();

    expect(container.textContent).toContain('Vampire');
    expect(container.textContent).not.toContain('Keep Yourself Warm');
    await fireEvent.click(container.querySelector('[data-testid="transport-play-pause"]')!);
    expect(mocks.airplayActions.toggle).toHaveBeenCalledTimes(1);
    expect(mocks.castActions.toggle).not.toHaveBeenCalled();
  });

  it('reverts to MPD metadata when the cast session ends', async () => {
    const { container } = render(PlayerView);
    mocks.castState.set(CAST_SESSION);
    await Promise.resolve();
    expect(container.textContent).toContain('Keep Yourself Warm');

    mocks.castState.set({ ...IDLE_CAST });
    await Promise.resolve();
    expect(container.textContent).toContain('MPD Track Title');
    expect(container.querySelector('[data-testid="cast-source-badge"]')).toBeFalsy();
  });
});
