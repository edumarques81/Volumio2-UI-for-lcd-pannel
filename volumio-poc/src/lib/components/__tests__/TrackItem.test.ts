import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import TrackItem from '../TrackItem.svelte';
import type { Track } from '$lib/stores/library';

// Mock track data
const mockTrack: Track = {
  id: 'track1',
  title: 'So What',
  artist: 'Miles Davis',
  album: 'Kind of Blue',
  uri: 'NAS/Jazz/Kind of Blue/01 - So What.flac',
  trackNumber: 1,
  duration: 564,
  albumArt: '/albumart?path=...',
  source: 'nas'
};

describe('TrackItem component', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('should render track number', () => {
      render(TrackItem, {
        props: {
          track: mockTrack,
          index: 0
        }
      });

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should render track title', () => {
      render(TrackItem, {
        props: {
          track: mockTrack,
          index: 0
        }
      });

      expect(screen.getByText('So What')).toBeInTheDocument();
    });

    it('should render formatted duration', () => {
      render(TrackItem, {
        props: {
          track: mockTrack,
          index: 0
        }
      });

      // 564 seconds = 9:24
      expect(screen.getByText('9:24')).toBeInTheDocument();
    });

    it('should use index+1 as fallback when trackNumber is 0', () => {
      const trackWithoutNumber: Track = {
        ...mockTrack,
        trackNumber: 0
      };

      render(TrackItem, {
        props: {
          track: trackWithoutNumber,
          index: 4
        }
      });

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render artist when different from album artist', () => {
      const trackWithDifferentArtist: Track = {
        ...mockTrack,
        artist: 'John Coltrane'
      };

      render(TrackItem, {
        props: {
          track: trackWithDifferentArtist,
          index: 0,
          albumArtist: 'Miles Davis'
        }
      });

      expect(screen.getByText('John Coltrane')).toBeInTheDocument();
    });

    it('should not render artist when same as album artist', () => {
      render(TrackItem, {
        props: {
          track: mockTrack,
          index: 0,
          albumArtist: 'Miles Davis'
        }
      });

      // The artist should not appear as a separate element
      const artistElements = screen.queryAllByText('Miles Davis');
      expect(artistElements.length).toBe(0);
    });

    it('should have data-testid attribute', () => {
      render(TrackItem, {
        props: {
          track: mockTrack,
          index: 0
        }
      });

      expect(screen.getByTestId('track-item-track1')).toBeInTheDocument();
    });

    it('should render more button', () => {
      render(TrackItem, {
        props: {
          track: mockTrack,
          index: 0
        }
      });

      const moreButton = screen.getByLabelText(/more options/i);
      expect(moreButton).toBeInTheDocument();
    });
  });

  describe('events', () => {
    it('should have clickable play button', async () => {
      render(TrackItem, {
        props: {
          track: mockTrack,
          index: 0
        }
      });

      const mainButton = screen.getByRole('button', { name: /play so what/i });
      expect(mainButton).toBeInTheDocument();

      // Button should be clickable (no error thrown)
      await fireEvent.click(mainButton);
    });

    it('should have clickable more button', async () => {
      render(TrackItem, {
        props: {
          track: mockTrack,
          index: 0
        }
      });

      const moreButton = screen.getByLabelText(/more options/i);
      expect(moreButton).toBeInTheDocument();

      // Button should be clickable (no error thrown)
      await fireEvent.click(moreButton);
    });

    it('should have correct aria labels for accessibility', () => {
      render(TrackItem, {
        props: {
          track: mockTrack,
          index: 0
        }
      });

      const playButton = screen.getByRole('button', { name: /play so what/i });
      const moreButton = screen.getByRole('button', { name: /more options for so what/i });

      expect(playButton).toBeInTheDocument();
      expect(moreButton).toBeInTheDocument();
    });
  });

  describe('duration formatting', () => {
    it('should format duration with leading zero for seconds', () => {
      const trackShortSeconds: Track = {
        ...mockTrack,
        duration: 65 // 1:05
      };

      render(TrackItem, {
        props: {
          track: trackShortSeconds,
          index: 0
        }
      });

      expect(screen.getByText('1:05')).toBeInTheDocument();
    });

    it('should handle 0 duration', () => {
      const trackNoDuration: Track = {
        ...mockTrack,
        duration: 0
      };

      render(TrackItem, {
        props: {
          track: trackNoDuration,
          index: 0
        }
      });

      // Empty duration should render empty string or not render
      expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    });
  });
});
