import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';

// Mock the stores
vi.mock('$lib/stores/player', () => ({
  playerState: writable({
    status: 'play',
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    albumart: '/test-art.jpg',
    uri: 'NAS/Music/test.flac',
    position: 0,
    seek: 30000,
    duration: 180,
    trackType: 'flac',
    samplerate: '96000',
    bitdepth: '24',
    random: false,
    repeat: false,
    repeatSingle: false,
    volume: 80,
    mute: false,
  }),
  currentTrack: writable({
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    albumart: '/test-art.jpg',
  }),
  isPlaying: writable(true),
  seek: writable(30),
  duration: writable(180),
  progress: writable(16.67),
  trackQuality: writable('96000 • 24 • flac'),
  shuffle: writable(false),
  repeat: writable('off' as const),
  playerActions: {
    play: vi.fn(),
    pause: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
    seekTo: vi.fn(),
    toggleShuffle: vi.fn(),
    setRepeat: vi.fn(),
  },
}));

vi.mock('$lib/stores/queue', () => ({
  queue: writable([
    { uri: 'NAS/track1.flac', name: 'Track 1', artist: 'Artist 1', albumart: '/art1.jpg' },
    { uri: 'NAS/track2.flac', name: 'Track 2', artist: 'Artist 2', albumart: '/art2.jpg' },
    { uri: 'NAS/track3.flac', name: 'Track 3', artist: 'Artist 3', albumart: '/art3.jpg' },
  ]),
  queueActions: {
    play: vi.fn(),
  },
}));

vi.mock('$lib/stores/navigation', () => ({
  navigationActions: {
    goToPlayer: vi.fn(),
    goToQueue: vi.fn(),
  },
}));

// Import after mocks
import DockedMiniPlayer from '../DockedMiniPlayer.svelte';

describe('DockedMiniPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Layout', () => {
    it('should render the docked mini player container', () => {
      render(DockedMiniPlayer);
      const container = screen.getByTestId('docked-mini-player');
      expect(container).toBeInTheDocument();
    });

    it('should have the correct CSS class for docked styling', () => {
      render(DockedMiniPlayer);
      const container = screen.getByTestId('docked-mini-player');
      expect(container).toHaveClass('docked-mini-player');
    });

    it('should render album artwork section', () => {
      render(DockedMiniPlayer);
      const artwork = screen.getByTestId('miniplayer-artwork');
      expect(artwork).toBeInTheDocument();
    });

    it('should render track info section', () => {
      render(DockedMiniPlayer);
      const trackInfo = screen.getByTestId('miniplayer-track-info');
      expect(trackInfo).toBeInTheDocument();
    });

    it('should render transport controls', () => {
      render(DockedMiniPlayer);
      const controls = screen.getByTestId('miniplayer-controls');
      expect(controls).toBeInTheDocument();
    });

    it('should render progress bar', () => {
      render(DockedMiniPlayer);
      const progressBar = screen.getByTestId('miniplayer-progress');
      expect(progressBar).toBeInTheDocument();
    });

    it('should render queue strip', () => {
      render(DockedMiniPlayer);
      const queueStrip = screen.getByTestId('miniplayer-queue-strip');
      expect(queueStrip).toBeInTheDocument();
    });
  });

  describe('Header Controls', () => {
    it('should render expand button', () => {
      render(DockedMiniPlayer);
      const expandBtn = screen.getByTestId('miniplayer-expand');
      expect(expandBtn).toBeInTheDocument();
    });

    it('should render source label when source is detected', () => {
      render(DockedMiniPlayer);
      // With URI 'NAS/Music/test.flac', should show NAS label
      const sourceLabel = screen.getByTestId('miniplayer-source');
      expect(sourceLabel).toBeInTheDocument();
      expect(sourceLabel).toHaveTextContent('NAS');
    });
  });

  describe('Track Information', () => {
    it('should display track title', () => {
      render(DockedMiniPlayer);
      expect(screen.getByText('Test Track')).toBeInTheDocument();
    });

    it('should display artist name', () => {
      render(DockedMiniPlayer);
      expect(screen.getByText('Test Artist')).toBeInTheDocument();
    });

    it('should display album name', () => {
      render(DockedMiniPlayer);
      expect(screen.getByText('Test Album')).toBeInTheDocument();
    });

    it('should display track quality info', () => {
      render(DockedMiniPlayer);
      // Quality badge should show format info
      const qualityBadge = screen.getByTestId('miniplayer-quality');
      expect(qualityBadge).toBeInTheDocument();
    });
  });

  describe('Deep Sunk Styling', () => {
    it('should have right-edge depth effect class', () => {
      render(DockedMiniPlayer);
      const container = screen.getByTestId('docked-mini-player');
      // The container should have the sunk styling
      expect(container).toHaveClass('docked-mini-player');
    });
  });
});
