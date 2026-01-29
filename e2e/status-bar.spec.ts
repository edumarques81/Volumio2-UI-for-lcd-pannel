import { test, expect } from '@playwright/test';

test.describe('Status Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.status-bar', { timeout: 10000 });
  });

  test('should display status badge', async ({ page }) => {
    const statusBadge = page.locator('.status-badge');
    await expect(statusBadge).toBeVisible();
  });

  test('should display status dot with color', async ({ page }) => {
    const statusDot = page.locator('.status-dot');
    await expect(statusDot).toBeVisible();
    // Should have a background color
    const bgColor = await statusDot.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('should display LCD toggle button', async ({ page }) => {
    const lcdButton = page.locator('.lcd-toggle-btn');
    await expect(lcdButton).toBeVisible();
    // Should show either "LCD On" or "LCD Off"
    const text = await lcdButton.textContent();
    expect(text).toMatch(/LCD (On|Off)/);
  });

  test('should toggle LCD state when clicked', async ({ page }) => {
    const lcdButton = page.locator('.lcd-toggle-btn');
    const initialText = await lcdButton.textContent();

    // Click to toggle
    await lcdButton.click();

    // Wait for loading to complete
    await page.waitForFunction(() => {
      const btn = document.querySelector('.lcd-toggle-btn');
      return btn && !btn.hasAttribute('disabled');
    }, { timeout: 15000 });

    // Text should change
    const newText = await lcdButton.textContent();
    if (initialText?.includes('Off')) {
      expect(newText).toContain('On');
    } else {
      expect(newText).toContain('Off');
    }
  });

  test('should open status drawer when status badge is clicked', async ({ page }) => {
    const statusBadge = page.locator('.status-badge');
    await statusBadge.click();

    // Status drawer should appear
    const drawer = page.locator('[data-testid="status-drawer"], .status-drawer');
    await expect(drawer).toBeVisible();
  });

  test('should close status drawer when clicking outside', async ({ page }) => {
    // Open drawer
    await page.click('.status-badge');
    await expect(page.locator('[data-testid="status-drawer"], .status-drawer')).toBeVisible();

    // Click outside (on backdrop or outside area)
    await page.click('.drawer-backdrop, .app-container', { force: true });

    // Drawer should close
    await expect(page.locator('[data-testid="status-drawer"], .status-drawer')).not.toBeVisible();
  });

  test('should display connection indicator', async ({ page }) => {
    const indicator = page.locator('.indicator');
    await expect(indicator).toBeVisible();
  });
});
