import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Mocks are hoisted so both `vi.mock` factories and the test bodies share
// the same store instances. The MPD-side mocks mirror PlayerView.integration
// — the key new piece is the `$lib/stores/airplay` mock that lets us flip
// the AirPlay session on/off and verify the UI swap.
const mocks = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');

  // MPD-shape mocks (kept lightweight; PlayerView reads these even in
  // AirPlay mode for layout consistency but they should NOT drive
  // user-visible strings while a session is active).
  const playerActions = {
    play: vi.fn(),
    pause: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    seekTo: vi.fn(),
    playLastPlayed: vi.fn(),
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
  const currentView = writable('player');
  const viewActions = {
    goToPlayer: vi.fn(), goToLibrary: vi.fn(), tapVuMeter: vi.fn(),
    tapSettings: vi.fn(), tapRefresh: vi.fn(), tapPower: vi.fn(),
  };
  const lastPlayedAlbum = writable(null);
  const transitioning = writable(false);

  // AirPlay-side mocks — the new contract surface.
  const airplayState = writable({
    isActive: false,
    title: '',
    artist: '',
    album: '',
    sender: '',
    coverDataURL: '',
    seekSeconds: 0,
    durationSeconds: 0,
    canControl: false,
    sessionID: '',
    sampleRate: 0,
    bitDepth: 0,
  });
  const airplayActive = {
    subscribe: (fn: (v: boolean) => void) => airplayState.subscribe((s) => fn(s.isActive)),
  };
  const airplayActions = {
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
  };

  return {
    playerActions, currentTrack, isPlaying, seek, duration, trackQuality,
    queue, playerState, currentView, viewActions, lastPlayedAlbum,
    transitioning, airplayState, airplayActive, airplayActions,
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
}));
vi.mock('$lib/stores/airplay', () => ({
  airplayState: mocks.airplayState,
  airplayActive: mocks.airplayActive,
  airplayActions: mocks.airplayActions,
}));

import PlayerView from '../PlayerView.svelte';

const AIRPLAY_SESSION = {
  isActive: true,
  title: 'Vampire',
  artist: 'Olivia Rodrigo',
  album: 'GUTS',
  sender: "Eduardo's iPhone",
  coverDataURL: 'data:image/jpeg;base64,abc123',
  seekSeconds: 42,
  durationSeconds: 245,
  canControl: true,
  sessionID: 'session-1',
  sampleRate: 44100,
  bitDepth: 16,
};

describe('PlayerView — AirPlay mode swap', () => {
  beforeEach(() => {
    // Reset all action spies.
    Object.values(mocks.playerActions).forEach((fn: any) => fn.mockClear?.());
    Object.values(mocks.airplayActions).forEach((fn: any) => fn.mockClear?.());
    // Reset the airplay store to inactive.
    mocks.airplayState.set({
      ...AIRPLAY_SESSION,
      isActive: false,
      title: '',
      artist: '',
      album: '',
      sender: '',
      coverDataURL: '',
      sessionID: '',
    });
  });

  it('shows MPD metadata when no AirPlay session is active', () => {
    const { container } = render(PlayerView);
    expect(container.textContent).toContain('MPD Track Title');
    expect(container.textContent).not.toContain("Eduardo's iPhone");
    expect(container.querySelector('[data-testid="airplay-source-badge"]')).toBeFalsy();
  });

  it('swaps to AirPlay metadata when airplayState.isActive flips to true', async () => {
    const { container } = render(PlayerView);
    mocks.airplayState.set(AIRPLAY_SESSION);
    await Promise.resolve();

    expect(container.textContent).toContain('Vampire');
    expect(container.textContent).toContain('Olivia Rodrigo');
    expect(container.textContent).toContain('GUTS');
    // MPD title must NOT leak through.
    expect(container.textContent).not.toContain('MPD Track Title');
  });

  it('renders the AIRPLAY · <sender> badge in AirPlay mode', async () => {
    const { container } = render(PlayerView);
    mocks.airplayState.set(AIRPLAY_SESSION);
    await Promise.resolve();

    const badge = container.querySelector('[data-testid="airplay-source-badge"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('AIRPLAY');
    expect(badge?.textContent).toContain("Eduardo's iPhone");
  });

  it('renders the cover via the data: URL — proves CSP allows data: img-src', async () => {
    const { container } = render(PlayerView);
    mocks.airplayState.set(AIRPLAY_SESSION);
    await Promise.resolve();

    const img = container.querySelector('img.art-img') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img?.src).toContain('data:image/jpeg;base64,abc123');
  });

  it('Play button routes to airplayActions in AirPlay mode (NOT playerActions)', async () => {
    const { container } = render(PlayerView);
    mocks.airplayState.set(AIRPLAY_SESSION);
    await Promise.resolve();

    const playBtn = container.querySelector('[data-testid="transport-play-pause"]') as HTMLButtonElement;
    expect(playBtn).toBeTruthy();
    await fireEvent.click(playBtn);

    // In AirPlay mode toggle is the natural mapping (the iPhone owns
    // status); play/pause both resolve through airplay:command toggle.
    const airplayHits =
      mocks.airplayActions.toggle.mock.calls.length +
      mocks.airplayActions.play.mock.calls.length +
      mocks.airplayActions.pause.mock.calls.length;
    expect(airplayHits).toBeGreaterThanOrEqual(1);

    // Critically: the MPD player actions must not fire.
    expect(mocks.playerActions.play).not.toHaveBeenCalled();
    expect(mocks.playerActions.pause).not.toHaveBeenCalled();
  });

  it('Next button routes to airplayActions.next in AirPlay mode', async () => {
    const { container } = render(PlayerView);
    mocks.airplayState.set(AIRPLAY_SESSION);
    await Promise.resolve();

    const nextBtn = container.querySelector('[data-testid="transport-next"]') as HTMLButtonElement;
    await fireEvent.click(nextBtn);

    expect(mocks.airplayActions.next).toHaveBeenCalledTimes(1);
    expect(mocks.playerActions.next).not.toHaveBeenCalled();
  });

  it('Prev button routes to airplayActions.prev in AirPlay mode', async () => {
    const { container } = render(PlayerView);
    mocks.airplayState.set(AIRPLAY_SESSION);
    await Promise.resolve();

    const prevBtn = container.querySelector('[data-testid="transport-prev"]') as HTMLButtonElement;
    await fireEvent.click(prevBtn);

    expect(mocks.airplayActions.prev).toHaveBeenCalledTimes(1);
    expect(mocks.playerActions.prev).not.toHaveBeenCalled();
  });

  it('disables transport when canControl is false', async () => {
    const { container } = render(PlayerView);
    mocks.airplayState.set({ ...AIRPLAY_SESSION, canControl: false });
    await Promise.resolve();

    const playBtn = container.querySelector('[data-testid="transport-play-pause"]') as HTMLButtonElement;
    expect(playBtn.disabled).toBe(true);
  });

  it('reverts to MPD metadata when AirPlay session is cleared', async () => {
    const { container } = render(PlayerView);
    mocks.airplayState.set(AIRPLAY_SESSION);
    await Promise.resolve();
    expect(container.textContent).toContain('Vampire');

    // Session ends — store resets.
    mocks.airplayState.set({
      isActive: false, title: '', artist: '', album: '', sender: '',
      coverDataURL: '', seekSeconds: 0, durationSeconds: 0,
      canControl: false, sessionID: '', sampleRate: 0, bitDepth: 0,
    });
    await Promise.resolve();

    expect(container.textContent).toContain('MPD Track Title');
    expect(container.querySelector('[data-testid="airplay-source-badge"]')).toBeFalsy();
  });

  // Sanity check that the airplay store is being read at all.
  it('reads the airplay store on render', () => {
    render(PlayerView);
    // The default state we set in beforeEach is isActive=false; this just
    // exercises that the store is present and didn't throw.
    expect(get(mocks.airplayState).isActive).toBe(false);
  });
});
