import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

// Simple writable implementation for mocking
function createWritable<T>(initialValue: T) {
  let value = initialValue;
  const subscribers = new Set<(value: T) => void>();

  return {
    subscribe(fn: (value: T) => void) {
      fn(value);
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    set(newValue: T) {
      value = newValue;
      subscribers.forEach(fn => fn(value));
    },
    update(fn: (value: T) => T) {
      value = fn(value);
      subscribers.forEach(sub => sub(value));
    },
  };
}

// Use vi.hoisted to create stores that are available during mock factory execution
const { mockQueueStore, mockPlayerStateStore, mockQueueActions, mockNavigationActions } = vi.hoisted(() => {
  // Simple writable implementation inline
  function createStore<T>(initialValue: T) {
    let value = initialValue;
    const subscribers = new Set<(value: T) => void>();
    return {
      subscribe(fn: (value: T) => void) {
        fn(value);
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
      set(newValue: T) {
        value = newValue;
        subscribers.forEach(fn => fn(value));
      },
    };
  }

  return {
    mockQueueStore: createStore([
      { uri: 'NAS/track0.flac', name: 'Current Track', artist: 'Artist 0', albumart: '/art0.jpg', duration: 180 },
      { uri: 'NAS/track1.flac', name: 'Next Track 1', artist: 'Artist 1', albumart: '/art1.jpg', duration: 200 },
      { uri: 'NAS/track2.flac', name: 'Next Track 2', artist: 'Artist 2', albumart: '/art2.jpg', duration: 220 },
      { uri: 'NAS/track3.flac', name: 'Next Track 3', artist: 'Artist 3', albumart: '/art3.jpg', duration: 190 },
      { uri: 'NAS/track4.flac', name: 'Next Track 4', artist: 'Artist 4', albumart: '/art4.jpg', duration: 210 },
    ]),
    mockPlayerStateStore: createStore({
      position: 0,
    }),
    mockQueueActions: {
      play: vi.fn(),
    },
    mockNavigationActions: {
      goToQueue: vi.fn(),
    },
  };
});

// Mock modules using the hoisted stores
vi.mock('$lib/stores/queue', () => ({
  queue: mockQueueStore,
  queueActions: mockQueueActions,
}));

vi.mock('$lib/stores/player', () => ({
  playerState: mockPlayerStateStore,
}));

vi.mock('$lib/stores/navigation', () => ({
  navigationActions: mockNavigationActions,
}));

// Import after mocks
import MiniPlayerQueueStrip from '../MiniPlayerQueueStrip.svelte';

describe('MiniPlayerQueueStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores to default values
    mockQueueStore.set([
      { uri: 'NAS/track0.flac', name: 'Current Track', artist: 'Artist 0', albumart: '/art0.jpg', duration: 180 },
      { uri: 'NAS/track1.flac', name: 'Next Track 1', artist: 'Artist 1', albumart: '/art1.jpg', duration: 200 },
      { uri: 'NAS/track2.flac', name: 'Next Track 2', artist: 'Artist 2', albumart: '/art2.jpg', duration: 220 },
      { uri: 'NAS/track3.flac', name: 'Next Track 3', artist: 'Artist 3', albumart: '/art3.jpg', duration: 190 },
      { uri: 'NAS/track4.flac', name: 'Next Track 4', artist: 'Artist 4', albumart: '/art4.jpg', duration: 210 },
    ]);
    mockPlayerStateStore.set({ position: 0 });
  });

  describe('Rendering', () => {
    it('should render the queue strip container', () => {
      render(MiniPlayerQueueStrip);
      const container = screen.getByTestId('miniplayer-queue-strip');
      expect(container).toBeInTheDocument();
    });

    it('should render Up Next label', () => {
      render(MiniPlayerQueueStrip);
      expect(screen.getByText('Up Next')).toBeInTheDocument();
    });

    it('should render queue tiles for upcoming tracks', () => {
      render(MiniPlayerQueueStrip);
      // Should show tracks after current position (index 0)
      expect(screen.getByText('Next Track 1')).toBeInTheDocument();
      expect(screen.getByText('Next Track 2')).toBeInTheDocument();
    });

    it('should not render the current track in up next', () => {
      render(MiniPlayerQueueStrip);
      // Current track should not be in up next section
      expect(screen.queryByText('Current Track')).not.toBeInTheDocument();
    });

    it('should have horizontal scroll container', () => {
      render(MiniPlayerQueueStrip);
      const scrollContainer = screen.getByTestId('queue-strip-scroll');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('queue-strip-scroll');
    });
  });

  describe('Queue Tile Content', () => {
    it('should display track title in each tile', () => {
      render(MiniPlayerQueueStrip);
      expect(screen.getByText('Next Track 1')).toBeInTheDocument();
      expect(screen.getByText('Next Track 2')).toBeInTheDocument();
    });

    it('should display artist name in each tile', () => {
      render(MiniPlayerQueueStrip);
      expect(screen.getByText('Artist 1')).toBeInTheDocument();
      expect(screen.getByText('Artist 2')).toBeInTheDocument();
    });

    it('should display album art in each tile', () => {
      render(MiniPlayerQueueStrip);
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);
    });
  });

  describe('Interactions', () => {
    it('should call queueActions.play when tile is clicked', async () => {
      render(MiniPlayerQueueStrip);
      const tile = screen.getByText('Next Track 1').closest('[data-testid^="queue-tile-"]');
      if (tile) {
        await fireEvent.click(tile);
        expect(mockQueueActions.play).toHaveBeenCalledWith(1); // Index of Next Track 1
      }
    });
  });

  describe('Empty Queue', () => {
    it('should show placeholder when queue is empty', () => {
      mockQueueStore.set([]);
      render(MiniPlayerQueueStrip);
      expect(screen.getByText(/no upcoming tracks/i)).toBeInTheDocument();
    });

    it('should show placeholder when only current track in queue', () => {
      mockQueueStore.set([
        { uri: 'NAS/track0.flac', name: 'Current Track', artist: 'Artist 0', albumart: '/art0.jpg', duration: 180 },
      ]);
      render(MiniPlayerQueueStrip);
      expect(screen.getByText(/no upcoming tracks/i)).toBeInTheDocument();
    });
  });
});
