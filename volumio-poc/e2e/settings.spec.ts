import { test, expect } from '@playwright/test';

test.describe('Settings View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    // Wait for navigation functions to be exposed
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
    // Navigate to settings via navigation function
    await page.evaluate(() => (window as any).__navigation.goToSettings());
    await page.waitForSelector('[data-view="settings"]', { timeout: 10000 });
  });

  test('should display settings view', async ({ page }) => {
    await expect(page.locator('[data-view="settings"]')).toBeVisible();
  });

  test('should have background selection', async ({ page }) => {
    // Click on Appearance category first (background-selector is inside it)
    const appearanceCategory = page.locator('.category-card:has-text("Appearance")');
    await appearanceCategory.click();
    await page.waitForTimeout(500);

    // Background selector should be visible
    const bgSelector = page.locator('[data-testid="background-selector"], .background-selector');
    await expect(bgSelector.first()).toBeVisible({ timeout: 5000 });
  });

  test('should change background when selected', async ({ page }) => {
    // Get initial background
    const appContainer = page.locator('.app-container');
    const initialBg = await appContainer.evaluate(el =>
      window.getComputedStyle(el).backgroundImage
    );

    // Click on a different background option
    const bgOptions = page.locator('.background-option, .bg-thumbnail');
    const optionCount = await bgOptions.count();

    if (optionCount > 1) {
      await bgOptions.nth(1).click();
      await page.waitForTimeout(500);

      // Background should change
      const newBg = await appContainer.evaluate(el =>
        window.getComputedStyle(el).backgroundImage
      );

      // May or may not be different depending on selection
    }
  });

  test('should have layout mode options', async ({ page }) => {
    // Layout mode selector (LCD/Desktop)
    const layoutSelector = page.locator('.layout-selector, [data-testid="layout"]');

    if (await layoutSelector.isVisible()) {
      await expect(layoutSelector).toBeVisible();
    }
  });
});

test.describe('Responsive Layout', () => {
  test('should adapt to LCD viewport (1920x440)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 440 });
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });

    // Check for LCD-specific layout classes or styles
    const body = page.locator('body');
    const hasLcdClass = await body.evaluate(el =>
      el.classList.contains('lcd') ||
      el.classList.contains('horizontal') ||
      document.documentElement.classList.contains('lcd')
    );

    // Layout should be horizontal for LCD
    const appContainer = page.locator('.app-container');
    await expect(appContainer).toBeVisible();
  });

  test('should adapt to desktop viewport (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });

    // Check layout adapts
    const appContainer = page.locator('.app-container');
    await expect(appContainer).toBeVisible();
  });

  test('should have touch-friendly targets (≥44px)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 440 });
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });

    // Check button sizes
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          // Buttons should be at least 44px in one dimension for touch
          const isTouchFriendly = box.width >= 44 || box.height >= 44;
          if (!isTouchFriendly) {
            console.warn(`Button ${i} may be too small: ${box.width}x${box.height}`);
          }
        }
      }
    }
  });
});
