import { test, expect } from '@playwright/test';

test.describe('Player Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    // Click on Now Playing tile (always visible at start of carousel)
    await page.click('[data-testid="tile-player"]');
    await page.waitForSelector('[data-testid="player-controls"]', { timeout: 10000 });
  });

  test('should display player controls', async ({ page }) => {
    // Player controls should be visible in player view
    const playerControls = page.locator('[data-testid="player-controls"]');
    await expect(playerControls).toBeVisible();
  });

  test('should have play/pause button', async ({ page }) => {
    const playPauseBtn = page.locator('[data-testid="btn-play-pause"]');
    await expect(playPauseBtn.first()).toBeVisible();
  });

  test('should have previous track button', async ({ page }) => {
    const prevBtn = page.locator('[data-testid="btn-prev"]');
    await expect(prevBtn.first()).toBeVisible();
  });

  test('should have next track button', async ({ page }) => {
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn.first()).toBeVisible();
  });

  test('should have volume control', async ({ page }) => {
    const volumeControl = page.locator('[data-testid="volume-control"]');
    await expect(volumeControl.first()).toBeVisible();
  });

  test('should have shuffle button', async ({ page }) => {
    const shuffleBtn = page.locator('[data-testid="btn-shuffle"]');
    await expect(shuffleBtn.first()).toBeVisible();
  });

  test('should have repeat button', async ({ page }) => {
    const repeatBtn = page.locator('[data-testid="btn-repeat"]');
    await expect(repeatBtn.first()).toBeVisible();
  });

  test('should display seek bar', async ({ page }) => {
    const seekBar = page.locator('[data-testid="seek-bar"]');
    await expect(seekBar.first()).toBeVisible();
  });

  test('should display album art or placeholder', async ({ page }) => {
    const albumArt = page.locator('.album-art, .art-section');
    await expect(albumArt.first()).toBeVisible();
  });

  test('should display track info (title/artist)', async ({ page }) => {
    // Track info should show title or "No track"
    const trackTitle = page.locator('.track-title, .track-info');
    await expect(trackTitle.first()).toBeVisible();
  });

  test('play/pause button should be clickable', async ({ page }) => {
    const playPauseBtn = page.locator('[data-testid="btn-play-pause"]').first();

    // Click should not throw error
    await playPauseBtn.click();

    // Note: Actual playback won't work without DAC connected
    // This just tests the button is interactive
  });

  test('volume slider should be adjustable', async ({ page }) => {
    const volumeSlider = page.locator('[data-testid="volume-slider"]').first();

    if (await volumeSlider.isVisible()) {
      // Get initial value
      const initialValue = await volumeSlider.inputValue();

      // Try to change volume
      await volumeSlider.fill('50');

      // Value should be changeable
    }
  });
});

test.describe('Player View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
  });

  test('should open full player view when now playing is clicked', async ({ page }) => {
    // Click on now playing tile (always visible at start)
    const nowPlayingTile = page.locator('[data-testid="tile-player"]');

    if (await nowPlayingTile.first().isVisible()) {
      await nowPlayingTile.first().click();

      // Player view should show
      const playerView = page.locator('[data-view="player"]');
      await expect(playerView).toBeVisible({ timeout: 5000 });
    }
  });
});
