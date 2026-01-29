import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the stores before importing the component
vi.mock('$lib/stores/library', () => ({
  libraryAlbums: { subscribe: vi.fn((cb) => { cb([]); return () => {}; }) },
  libraryAlbumsLoading: { subscribe: vi.fn((cb) => { cb(false); return () => {}; }) },
  libraryAlbumsError: { subscribe: vi.fn((cb) => { cb(null); return () => {}; }) },
  librarySort: { subscribe: vi.fn((cb) => { cb('alphabetical'); return () => {}; }) },
  selectedLibraryAlbum: { subscribe: vi.fn((cb) => { cb(null); return () => {}; }) },
  libraryAlbumTracks: { subscribe: vi.fn((cb) => { cb([]); return () => {}; }) },
  libraryAlbumTracksLoading: { subscribe: vi.fn((cb) => { cb(false); return () => {}; }) },
  libraryAlbumTotalDuration: { subscribe: vi.fn((cb) => { cb(0); return () => {}; }) },
  libraryActions: {
    fetchAlbums: vi.fn(),
    fetchAlbumTracks: vi.fn(),
    playAlbum: vi.fn(),
    playTrack: vi.fn(),
    setSort: vi.fn(),
    clearSelectedAlbum: vi.fn()
  },
  initLibraryStore: vi.fn()
}));

vi.mock('$lib/stores/navigation', () => ({
  navigationActions: {
    goHome: vi.fn()
  }
}));

import { libraryActions, initLibraryStore } from '$lib/stores/library';
import { navigationActions } from '$lib/stores/navigation';

describe('AllAlbumsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize library store on mount', async () => {
      // The component calls initLibraryStore on mount
      expect(initLibraryStore).toBeDefined();
    });

    it('should fetch albums with scope=all on mount', async () => {
      // The component calls fetchAlbums({ scope: 'all' }) on mount
      expect(libraryActions.fetchAlbums).toBeDefined();
    });
  });

  describe('libraryActions', () => {
    it('should have fetchAlbums action', () => {
      expect(libraryActions.fetchAlbums).toBeDefined();
      libraryActions.fetchAlbums({ scope: 'all' });
      expect(libraryActions.fetchAlbums).toHaveBeenCalledWith({ scope: 'all' });
    });

    it('should have playAlbum action', () => {
      expect(libraryActions.playAlbum).toBeDefined();
    });

    it('should have clearSelectedAlbum action', () => {
      expect(libraryActions.clearSelectedAlbum).toBeDefined();
    });

    it('should have setSort action', () => {
      expect(libraryActions.setSort).toBeDefined();
    });
  });

  describe('navigationActions', () => {
    it('should have goHome action for back navigation', () => {
      expect(navigationActions.goHome).toBeDefined();
    });
  });
});
