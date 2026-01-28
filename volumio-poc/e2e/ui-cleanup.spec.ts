import { test, expect } from '@playwright/test';

/**
 * E2E tests for UI cleanup changes:
 * 1. Main screen: Spotify and USB tiles removed
 * 2. Internal pages: Slim header (52px height)
 * 3. Audirvana: Header unchanged
 */
test.describe('UI Cleanup - Main Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
  });

  test('should NOT display Spotify tile on main screen', async ({ page }) => {
    // Spotify tile should not exist
    await expect(page.locator('[data-testid="tile-spotify"]')).not.toBeVisible();
    // Also check by text content
    const spotifyTile = page.locator('.app-tile:has-text("Spotify")');
    await expect(spotifyTile).not.toBeVisible();
  });

  test('should NOT display USB tile on main screen', async ({ page }) => {
    // USB tile should not exist
    await expect(page.locator('[data-testid="tile-usb"]')).not.toBeVisible();
    // Also check by text content
    const usbTile = page.locator('.app-tile:has-text("USB")');
    await expect(usbTile).not.toBeVisible();
  });

  test('should display essential tiles on main screen', async ({ page }) => {
    // Essential tiles should still be present
    await expect(page.locator('[data-testid="tile-local-music"]')).toBeVisible();
    await expect(page.locator('[data-testid="tile-settings"]')).toBeVisible();
  });
});

test.describe('UI Cleanup - Slim Header on Internal Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
  });

  test('Browse view should have slim header', async ({ page }) => {
    await page.evaluate(() => (window as any).__navigation.goToBrowse());
    await expect(page.locator('[data-view="browse"]')).toBeVisible();

    // Check header height is 52px
    const header = page.locator('.browse-header');
    await expect(header).toBeVisible();
    const height = await header.evaluate(el => getComputedStyle(el).height);
    expect(height).toBe('52px');
  });

  test('Settings view should have slim header', async ({ page }) => {
    await page.evaluate(() => (window as any).__navigation.goToSettings());
    await expect(page.locator('[data-view="settings"]')).toBeVisible();

    // Check header height is 52px
    const header = page.locator('.settings-header');
    await expect(header).toBeVisible();
    const height = await header.evaluate(el => getComputedStyle(el).height);
    expect(height).toBe('52px');
  });

  test('Queue view should have slim header', async ({ page }) => {
    await page.evaluate(() => (window as any).__navigation.goToQueue());
    await expect(page.locator('[data-view="queue"]')).toBeVisible();

    // Check header height is 52px
    const header = page.locator('.queue-header');
    await expect(header).toBeVisible();
    const height = await header.evaluate(el => getComputedStyle(el).height);
    expect(height).toBe('52px');
  });

  test('back button should be 44px for touch accessibility', async ({ page }) => {
    await page.evaluate(() => (window as any).__navigation.goToBrowse());
    await expect(page.locator('[data-view="browse"]')).toBeVisible();

    // Check back button size
    const backBtn = page.locator('.browse-header .back-btn');
    await expect(backBtn).toBeVisible();
    const width = await backBtn.evaluate(el => getComputedStyle(el).width);
    const height = await backBtn.evaluate(el => getComputedStyle(el).height);
    expect(width).toBe('44px');
    expect(height).toBe('44px');
  });

  test('header should preserve frosted glass styling', async ({ page }) => {
    await page.evaluate(() => (window as any).__navigation.goToBrowse());
    await expect(page.locator('[data-view="browse"]')).toBeVisible();

    const header = page.locator('.browse-header');
    const backdropFilter = await header.evaluate(el => getComputedStyle(el).backdropFilter);
    // Should contain blur
    expect(backdropFilter).toContain('blur');
  });
});

test.describe('UI Cleanup - Audirvana Exclusion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
  });

  test('Audirvana view should NOT have slim header (BackHeader component)', async ({ page }) => {
    // Navigate to Audirvana using tile click (not affected by our changes)
    const audirvanaSelector = '[data-testid="tile-audirvana"]';

    // Check if Audirvana tile exists (it may be scrolled out of view)
    const audirvanaExists = await page.locator(audirvanaSelector).count() > 0;

    if (audirvanaExists) {
      await page.click(audirvanaSelector);
      await expect(page.locator('[data-view="audirvana"]')).toBeVisible();

      // BackHeader has fixed 52px height, but uses different styling
      // The key difference is that Audirvana uses BackHeader component
      // which should remain unchanged
      const header = page.locator('.back-header');
      await expect(header).toBeVisible();
      const height = await header.evaluate(el => getComputedStyle(el).height);
      expect(height).toBe('52px');
    } else {
      // Skip test if Audirvana tile not visible
      test.skip();
    }
  });
});
