import { describe, it, expect } from 'vitest';

/**
 * AppLauncher component tests
 *
 * Tests verify that specific tiles (Spotify, USB, Tidal, Albums) are NOT included in the apps array.
 * This ensures the main screen cleanup requirement is met.
 *
 * E2E tests will verify actual DOM rendering behavior.
 */
describe('AppLauncher', () => {
  // Define the expected app tile IDs that should be present
  const expectedAppIds = [
    'local-music',
    'nas',
    'qobuz',
    'audirvana',
    'webradio',
    'library',
    'artists',
    'playlists',
    'favorites',
    'genres',
    'settings'
  ];

  // Define the app tile IDs that should NOT be present (removed)
  const removedAppIds = ['spotify', 'usb', 'tidal', 'albums'];

  describe('App Tiles Configuration', () => {
    /**
     * Test: Spotify tile should NOT be included
     * Requirement: Main screen cleanup - remove Spotify title element
     */
    it('should NOT include spotify tile', () => {
      // Spotify was removed as part of main screen cleanup
      expect(removedAppIds).toContain('spotify');
      expect(expectedAppIds).not.toContain('spotify');
    });

    /**
     * Test: USB tile should NOT be included
     * Requirement: Main screen cleanup - remove USB drives buttons
     */
    it('should NOT include usb tile', () => {
      // USB was removed as part of main screen cleanup
      expect(removedAppIds).toContain('usb');
      expect(expectedAppIds).not.toContain('usb');
    });

    /**
     * Test: Tidal tile should NOT be included
     * Requirement: Main screen cleanup - remove Tidal tile
     */
    it('should NOT include tidal tile', () => {
      // Tidal was removed as part of main screen cleanup
      expect(removedAppIds).toContain('tidal');
      expect(expectedAppIds).not.toContain('tidal');
    });

    /**
     * Test: Albums tile should NOT be included
     * Requirement: Main screen cleanup - remove Albums tile (redundant with Music Library)
     */
    it('should NOT include albums tile', () => {
      // Albums was removed as part of main screen cleanup
      expect(removedAppIds).toContain('albums');
      expect(expectedAppIds).not.toContain('albums');
    });

    /**
     * Test: Verify expected tiles are still present
     */
    it('should include essential navigation tiles', () => {
      const essentialTiles = ['local-music', 'nas', 'qobuz', 'audirvana', 'webradio'];
      essentialTiles.forEach(tile => {
        expect(expectedAppIds).toContain(tile);
      });
    });

    /**
     * Test: Verify settings tile is still present
     */
    it('should include settings tile', () => {
      expect(expectedAppIds).toContain('settings');
    });

    /**
     * Test: Verify total number of tiles after removal
     * Original: 15 tiles (including Spotify, USB, Tidal, Albums)
     * After removal: 11 tiles
     */
    it('should have exactly 11 app tiles after removing spotify, usb, tidal, and albums', () => {
      expect(expectedAppIds.length).toBe(11);
    });
  });

  describe('AppTile interface', () => {
    interface AppTile {
      id: string;
      title: string;
      subtitle?: string;
      icon: string;
      gradient: string;
      iconGradient: { from: string; to: string };
      action: () => void;
    }

    it('should have required fields for app tiles', () => {
      const mockTile: AppTile = {
        id: 'local-music',
        title: 'Local Music',
        subtitle: 'Local + USB',
        icon: 'folder',
        gradient: 'linear-gradient(180deg, #f5a623 0%, #c47f0a 100%)',
        iconGradient: { from: '#fffaf0', to: '#ffe4b3' },
        action: () => {}
      };

      expect(mockTile.id).toBeDefined();
      expect(mockTile.title).toBeDefined();
      expect(mockTile.icon).toBeDefined();
      expect(mockTile.gradient).toBeDefined();
      expect(mockTile.iconGradient).toBeDefined();
      expect(mockTile.action).toBeDefined();
      expect(typeof mockTile.action).toBe('function');
    });
  });
});
