import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to initialize
    await page.waitForSelector('.app-container', { timeout: 10000 });
    // Wait for navigation functions to be exposed
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
  });

  test('should load the home screen', async ({ page }) => {
    await expect(page.locator('.app-container')).toBeVisible();
  });

  test('should navigate to Browse view', async ({ page }) => {
    // Use navigation function (tiles require scrolling)
    await page.evaluate(() => (window as any).__navigation.goToBrowse());
    await expect(page.locator('[data-view="browse"]')).toBeVisible();
  });

  test('should navigate to Player view', async ({ page }) => {
    // Click on Now Playing tile (always visible at start)
    await page.click('[data-testid="tile-player"]');
    await expect(page.locator('[data-testid="player-controls"]')).toBeVisible();
  });

  test('should navigate to Settings view', async ({ page }) => {
    // Use navigation function (settings tile requires scrolling)
    await page.evaluate(() => (window as any).__navigation.goToSettings());
    await expect(page.locator('[data-view="settings"]')).toBeVisible();
  });

  test('should display status bar', async ({ page }) => {
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  test('should display current time in status bar', async ({ page }) => {
    // Time should be displayed in the status bar
    const timeElement = page.locator('.status-bar .time');
    await expect(timeElement).toBeVisible();
    // Time format should contain day/month
    await expect(timeElement).toContainText(/\w+ \d+ \w+/);
  });
});
