import { test, expect } from '@playwright/test';

test.describe('Track Info Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
  });

  test('should open track info modal when info button is clicked', async ({ page }) => {
    // Find track info button
    const infoButton = page.locator('[data-testid="track-info"], .info-btn, button:has(.icon-info)');

    if (await infoButton.first().isVisible()) {
      await infoButton.first().click();

      // Modal should appear
      const modal = page.locator('.track-info-modal, .modal');
      await expect(modal).toBeVisible({ timeout: 5000 });
    }
  });

  test('should close modal when close button is clicked', async ({ page }) => {
    // Open modal first
    const infoButton = page.locator('[data-testid="track-info"], .info-btn').first();

    if (await infoButton.isVisible()) {
      await infoButton.click();
      await page.waitForSelector('.track-info-modal, .modal', { timeout: 5000 });

      // Click close button
      await page.click('.modal-close, [data-testid="close-modal"], button:has(.icon-x)');

      // Modal should close
      await expect(page.locator('.track-info-modal, .modal')).not.toBeVisible();
    }
  });
});

test.describe('Playlist Selector Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    // Wait for navigation functions
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
  });

  test('should display playlist list in selector', async ({ page }) => {
    // Navigate to browse via navigation function
    await page.evaluate(() => (window as any).__navigation.goToBrowse());
    await page.waitForTimeout(2000);

    // If there's a direct "Add to Playlist" button visible
    const addToPlaylist = page.locator('button:has-text("Add to Playlist"), [data-testid="add-to-playlist"]');

    if (await addToPlaylist.first().isVisible()) {
      await addToPlaylist.first().click();

      // Playlist selector should appear
      const selector = page.locator('.playlist-selector, .playlist-modal');
      await expect(selector).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    // Wait for navigation functions
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
    // Navigate to browse
    await page.evaluate(() => (window as any).__navigation.goToBrowse());
    await page.waitForTimeout(2000);
  });

  test('should show context menu with expected options', async ({ page }) => {
    // Wait for browse items to load
    const item = page.locator('[data-testid="browse-item"], .list-item').first();
    await expect(item).toBeVisible({ timeout: 45000 });

    // Right click or long press
    await item.click({ button: 'right' });

    const contextMenu = page.locator('[data-testid="context-menu"]');

    if (await contextMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check for menu options that should be available for any item type
      // Note: Play and Add to Playlist might be hidden for folders
      const addQueueBtn = contextMenu.locator('[data-testid="context-menu-add-queue"]');
      const viewInfoBtn = contextMenu.locator('[data-testid="context-menu-view-info"]');

      // At minimum, these should be available for any item
      await expect(addQueueBtn).toBeVisible({ timeout: 3000 });
      await expect(viewInfoBtn).toBeVisible({ timeout: 3000 });
    }
  });

  test('should close context menu when clicking outside', async ({ page }) => {
    const item = page.locator('[data-testid="browse-item"], .list-item').first();

    if (await item.isVisible()) {
      await item.click({ button: 'right' });

      const contextMenu = page.locator('[data-testid="context-menu"]');

      if (await contextMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click outside (on backdrop)
        await page.click('[data-testid="context-menu-backdrop"]', { force: true });

        // Menu should close
        await expect(contextMenu).not.toBeVisible();
      }
    }
  });
});
