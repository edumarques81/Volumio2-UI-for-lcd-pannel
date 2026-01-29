import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import { get } from 'svelte/store';
import type { Album, Track } from '$lib/stores/library';

// Mock the stores before importing the component
vi.mock('$lib/stores/library', () => ({
  libraryActions: {
    playAlbum: vi.fn(),
    playAlbumNext: vi.fn(),
    addAlbumToQueue: vi.fn(),
    playTrack: vi.fn(),
    playTrackNext: vi.fn(),
    addTrackToQueue: vi.fn()
  }
}));

vi.mock('$lib/stores/browse', () => ({
  browseActions: {
    play: vi.fn(),
    addToQueue: vi.fn()
  }
}));

vi.mock('$lib/stores/queue', () => ({
  queueActions: {
    play: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('$lib/stores/favorites', () => ({
  favoritesActions: {
    addToFavorites: vi.fn()
  }
}));

vi.mock('$lib/stores/ui', async () => {
  const { writable, derived } = await import('svelte/store');

  const contextMenuStore = writable({
    isOpen: false,
    item: null,
    itemType: null,
    position: { x: 0, y: 0 },
    itemIndex: undefined
  });

  return {
    contextMenu: contextMenuStore,
    uiActions: {
      closeContextMenu: vi.fn(),
      openPlaylistSelector: vi.fn(),
      openTrackInfoModal: vi.fn()
    }
  };
});

// Import after mocks
import LibraryContextMenu from '../LibraryContextMenu.svelte';
import { contextMenu, uiActions } from '$lib/stores/ui';

// Mock album
const mockAlbum: Album = {
  id: 'album1',
  title: 'Kind of Blue',
  artist: 'Miles Davis',
  uri: 'NAS/Jazz/Kind of Blue',
  albumArt: '/albumart?path=...',
  trackCount: 5,
  source: 'nas'
};

// Mock track
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

describe('LibraryContextMenu component (unified)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset context menu state
    contextMenu.set({
      isOpen: false,
      item: null,
      itemType: null,
      position: { x: 0, y: 0 },
      itemIndex: undefined
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('when closed', () => {
    it('should not render when isOpen is false', () => {
      render(LibraryContextMenu);

      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
    });
  });

  describe('for albums', () => {
    beforeEach(() => {
      contextMenu.set({
        isOpen: true,
        item: mockAlbum,
        itemType: 'album',
        position: { x: 100, y: 100 },
        itemIndex: undefined
      });
    });

    it('should render when open with album', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument();
      });
    });

    it('should display album title', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Kind of Blue')).toBeInTheDocument();
      });
    });

    it('should display album artist', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Miles Davis')).toBeInTheDocument();
      });
    });

    it('should show Play Now option', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Play Now')).toBeInTheDocument();
      });
    });

    it('should show Play Next option', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Play Next')).toBeInTheDocument();
      });
    });

    it('should show Add to Queue option', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Add to Queue')).toBeInTheDocument();
      });
    });

    it('should show Add to Playlist option', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Add to Playlist')).toBeInTheDocument();
      });
    });

    it('should not show View Info option for albums', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.queryByText('View Info')).not.toBeInTheDocument();
      });
    });
  });

  describe('for tracks', () => {
    beforeEach(() => {
      contextMenu.set({
        isOpen: true,
        item: mockTrack,
        itemType: 'track',
        position: { x: 100, y: 100 },
        itemIndex: undefined
      });
    });

    it('should render when open with track', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument();
      });
    });

    it('should display track title', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('So What')).toBeInTheDocument();
      });
    });

    it('should display track artist', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Miles Davis')).toBeInTheDocument();
      });
    });

    it('should show View Info option for tracks', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('View Info')).toBeInTheDocument();
      });
    });

    it('should show all common options', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Play Now')).toBeInTheDocument();
        expect(screen.getByText('Play Next')).toBeInTheDocument();
        expect(screen.getByText('Add to Queue')).toBeInTheDocument();
        expect(screen.getByText('Add to Playlist')).toBeInTheDocument();
      });
    });
  });

  describe('for browse items', () => {
    beforeEach(() => {
      contextMenu.set({
        isOpen: true,
        item: { uri: 'test', service: 'mpd', type: 'song', title: 'Test Song', artist: 'Test Artist' } as any,
        itemType: 'browse',
        position: { x: 100, y: 100 },
        itemIndex: undefined
      });
    });

    it('should render for browse items', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument();
      });
    });

    it('should show Play Now option', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Play Now')).toBeInTheDocument();
      });
    });

    it('should show Add to Queue option', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Add to Queue')).toBeInTheDocument();
      });
    });
  });

  describe('for queue items', () => {
    beforeEach(() => {
      contextMenu.set({
        isOpen: true,
        item: { uri: 'test', service: 'mpd', name: 'Test Queue Item' } as any,
        itemType: 'queue',
        position: { x: 100, y: 100 },
        itemIndex: 0
      });
    });

    it('should render for queue items', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument();
      });
    });

    it('should show Remove from Queue option', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByText('Remove from Queue')).toBeInTheDocument();
      });
    });
  });

  describe('close behavior', () => {
    beforeEach(() => {
      contextMenu.set({
        isOpen: true,
        item: mockAlbum,
        itemType: 'album',
        position: { x: 100, y: 100 },
        itemIndex: undefined
      });
    });

    it('should have close button', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        const closeButton = screen.getByLabelText(/close/i);
        expect(closeButton).toBeInTheDocument();
      });
    });

    it('should call closeContextMenu when close button clicked', async () => {
      render(LibraryContextMenu);

      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText(/close/i);
      await fireEvent.click(closeButton);

      expect(uiActions.closeContextMenu).toHaveBeenCalled();
    });
  });
});
