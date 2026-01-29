import { test, expect } from '@playwright/test';

test.describe('Library Views (MPD-driven)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    // Wait for navigation functions to be exposed
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
  });

  test.describe('All Albums View', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to all albums view
      await page.evaluate(() => (window as any).__navigation.goToAllAlbums());
      await page.waitForSelector('[data-view="allAlbums"]', { timeout: 10000 });
    });

    test('should display all albums view', async ({ page }) => {
      await expect(page.locator('[data-view="allAlbums"]')).toBeVisible();
    });

    test('should display Music Library title', async ({ page }) => {
      await expect(page.locator('.title')).toContainText('Music Library');
    });

    test('should display back button', async ({ page }) => {
      await expect(page.locator('[data-testid="back-button"]')).toBeVisible();
    });

    test('should display sort dropdown', async ({ page }) => {
      await expect(page.locator('[data-testid="sort-select"]')).toBeVisible();
    });

    test('should navigate back to home when back button clicked', async ({ page }) => {
      await page.click('[data-testid="back-button"]');
      // Should return to home view (app-launcher)
      await expect(page.locator('.app-launcher')).toBeVisible({ timeout: 5000 });
    });

    test('should display albums grid when albums are available', async ({ page }) => {
      // Wait for loading to complete (either albums grid or empty state)
      await page.waitForSelector('.album-grid, .empty', { timeout: 30000 });
    });

    test('should change sort order when sort dropdown changed', async ({ page }) => {
      const sortSelect = page.locator('[data-testid="sort-select"]');
      await sortSelect.selectOption('by_artist');
      // Verify the selection changed
      await expect(sortSelect).toHaveValue('by_artist');
    });
  });

  test.describe('NAS Albums View', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to NAS albums view
      await page.evaluate(() => (window as any).__navigation.goToNASAlbums());
      await page.waitForSelector('[data-view="nasAlbums"]', { timeout: 10000 });
    });

    test('should display NAS albums view', async ({ page }) => {
      await expect(page.locator('[data-view="nasAlbums"]')).toBeVisible();
    });

    test('should display NAS Drives title', async ({ page }) => {
      await expect(page.locator('.title')).toContainText('NAS Drives');
    });

    test('should display back button', async ({ page }) => {
      await expect(page.locator('[data-testid="back-button"]')).toBeVisible();
    });

    test('should navigate back to home when back button clicked', async ({ page }) => {
      await page.click('[data-testid="back-button"]');
      await expect(page.locator('.app-launcher')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Artists View', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to artists view
      await page.evaluate(() => (window as any).__navigation.goToArtists());
      await page.waitForSelector('[data-view="artists"]', { timeout: 10000 });
    });

    test('should display artists view', async ({ page }) => {
      await expect(page.locator('[data-view="artists"]')).toBeVisible();
    });

    test('should display Artists title', async ({ page }) => {
      await expect(page.locator('.title')).toContainText('Artists');
    });

    test('should display back button', async ({ page }) => {
      await expect(page.locator('[data-testid="back-button"]')).toBeVisible();
    });

    test('should navigate back to home when back button clicked', async ({ page }) => {
      await page.click('[data-testid="back-button"]');
      await expect(page.locator('.app-launcher')).toBeVisible({ timeout: 5000 });
    });

    test('should display artists grid when artists are available', async ({ page }) => {
      // Wait for loading to complete (either artists grid or empty state)
      await page.waitForSelector('.artists-grid, .empty', { timeout: 30000 });
    });
  });

  test.describe('Radio View', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to radio view
      await page.evaluate(() => (window as any).__navigation.goToRadio());
      await page.waitForSelector('[data-view="radio"]', { timeout: 10000 });
    });

    test('should display radio view', async ({ page }) => {
      await expect(page.locator('[data-view="radio"]')).toBeVisible();
    });

    test('should display Web Radio title', async ({ page }) => {
      await expect(page.locator('.title')).toContainText('Web Radio');
    });

    test('should display back button', async ({ page }) => {
      await expect(page.locator('[data-testid="back-button"]')).toBeVisible();
    });

    test('should navigate back to home when back button clicked', async ({ page }) => {
      await page.click('[data-testid="back-button"]');
      await expect(page.locator('.app-launcher')).toBeVisible({ timeout: 5000 });
    });

    test('should display stations grid when stations are available', async ({ page }) => {
      // Wait for loading to complete (either stations grid or empty state)
      await page.waitForSelector('.stations-grid, .empty', { timeout: 30000 });
    });
  });

  test.describe('App Launcher Navigation', () => {
    test('should navigate to Music Library via tile', async ({ page }) => {
      // Find and click the Music Library tile
      const libraryTile = page.locator('[data-testid="tile-library"]');
      await expect(libraryTile).toBeVisible({ timeout: 10000 });
      await libraryTile.click();
      // Should navigate to all albums view
      await expect(page.locator('[data-view="allAlbums"]')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to NAS Drives via tile', async ({ page }) => {
      // Scroll to find NAS tile if needed
      const nasTile = page.locator('[data-testid="tile-nas"]');
      await nasTile.scrollIntoViewIfNeeded();
      await nasTile.click();
      // Should navigate to NAS albums view
      await expect(page.locator('[data-view="nasAlbums"]')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Artists via tile', async ({ page }) => {
      // Scroll to find Artists tile if needed
      const artistsTile = page.locator('[data-testid="tile-artists"]');
      await artistsTile.scrollIntoViewIfNeeded();
      await artistsTile.click();
      // Should navigate to artists view
      await expect(page.locator('[data-view="artists"]')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Web Radio via tile', async ({ page }) => {
      // Scroll to find Web Radio tile if needed
      const radioTile = page.locator('[data-testid="tile-webradio"]');
      await radioTile.scrollIntoViewIfNeeded();
      await radioTile.click();
      // Should navigate to radio view
      await expect(page.locator('[data-view="radio"]')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Albums via tile', async ({ page }) => {
      // Scroll to find Albums tile if needed
      const albumsTile = page.locator('[data-testid="tile-albums"]');
      await albumsTile.scrollIntoViewIfNeeded();
      await albumsTile.click();
      // Should navigate to all albums view
      await expect(page.locator('[data-view="allAlbums"]')).toBeVisible({ timeout: 10000 });
    });
  });
});
