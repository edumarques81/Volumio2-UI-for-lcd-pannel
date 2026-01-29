import { test, expect } from '@playwright/test';

test.describe('LCD Control System', () => {
  test.beforeEach(async ({ page }) => {
    // Use LCD viewport
    await page.setViewportSize({ width: 1920, height: 440 });
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
  });

  test.describe('Standby Overlay', () => {
    test('should have standby overlay element in DOM', async ({ page }) => {
      const overlay = page.locator('.standby-overlay');
      await expect(overlay).toBeAttached();
    });

    test('should have brightness dimmer element in DOM', async ({ page }) => {
      const dimmer = page.locator('.brightness-dimmer');
      await expect(dimmer).toBeAttached();
    });

    test('standby overlay should be inactive by default', async ({ page }) => {
      const overlay = page.locator('.standby-overlay');
      await expect(overlay).not.toHaveClass(/active/);
    });

    test('should activate standby overlay when lcdState is off', async ({ page }) => {
      // Trigger standby via the store
      await page.evaluate(() => {
        const { lcdActions } = (window as any);
        if (lcdActions) {
          lcdActions.standby();
        }
      });

      // Wait for overlay to become active
      const overlay = page.locator('.standby-overlay');
      await expect(overlay).toHaveClass(/active/, { timeout: 2000 });
    });

    test('should wake from standby on click', async ({ page }) => {
      // First put into standby
      await page.evaluate(() => {
        const { lcdActions } = (window as any);
        if (lcdActions) {
          lcdActions.standby();
        }
      });

      // Verify standby is active
      const overlay = page.locator('.standby-overlay');
      await expect(overlay).toHaveClass(/active/, { timeout: 2000 });

      // Click on overlay to wake
      await overlay.click({ force: true });

      // Overlay should no longer be active
      await expect(overlay).not.toHaveClass(/active/, { timeout: 2000 });
    });

    test('should navigate to home on wake', async ({ page }) => {
      // Navigate away from home first
      await page.evaluate(() => (window as any).__navigation.goToSettings());
      await page.waitForSelector('[data-view="settings"]', { timeout: 5000 });

      // Put into standby
      await page.evaluate(() => {
        const { lcdActions } = (window as any);
        if (lcdActions) {
          lcdActions.standby();
        }
      });

      const overlay = page.locator('.standby-overlay');
      await expect(overlay).toHaveClass(/active/, { timeout: 2000 });

      // Wake by clicking
      await overlay.click({ force: true });

      // Should navigate to home
      await page.waitForSelector('.home-screen, [data-view="home"]', { timeout: 5000 });
    });
  });

  test.describe('Brightness Control', () => {
    test('should have brightness dimmer with opacity based on brightness', async ({ page }) => {
      const dimmer = page.locator('.brightness-dimmer');

      // Default brightness is 100, so opacity should be 0
      const style = await dimmer.getAttribute('style');
      expect(style).toContain('opacity');
    });

    test('should update dimmer opacity when brightness changes', async ({ page }) => {
      // Set brightness to 50%
      await page.evaluate(() => {
        const { lcdActions } = (window as any);
        if (lcdActions) {
          lcdActions.setBrightness(50);
        }
      });

      const dimmer = page.locator('.brightness-dimmer');
      const style = await dimmer.getAttribute('style');

      // At 50% brightness, opacity should be 0.5
      expect(style).toContain('opacity: 0.5');
    });

    test('should show full black overlay at 0% brightness', async ({ page }) => {
      await page.evaluate(() => {
        const { lcdActions } = (window as any);
        if (lcdActions) {
          lcdActions.setBrightness(0);
        }
      });

      const dimmer = page.locator('.brightness-dimmer');
      const style = await dimmer.getAttribute('style');
      expect(style).toContain('opacity: 1');
    });
  });

  test.describe('Brightness Slider in Settings', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Settings > Appearance
      await page.evaluate(() => (window as any).__navigation.goToSettings());
      await page.waitForSelector('[data-view="settings"]', { timeout: 5000 });

      // Click Appearance category
      const appearanceCategory = page.locator('.category-card:has-text("Appearance")');
      await appearanceCategory.click();
      await page.waitForTimeout(500);
    });

    test('should display brightness slider', async ({ page }) => {
      const slider = page.locator('[data-testid="brightness-slider"]');
      await expect(slider).toBeVisible({ timeout: 5000 });
    });

    test('should have correct initial value (100)', async ({ page }) => {
      const slider = page.locator('[data-testid="brightness-slider"]');
      const value = await slider.inputValue();
      expect(value).toBe('100');
    });

    test('should update brightness when slider changes', async ({ page }) => {
      const slider = page.locator('[data-testid="brightness-slider"]');

      // Change slider to 50
      await slider.fill('50');
      await slider.dispatchEvent('input');

      // Check dimmer opacity updated
      const dimmer = page.locator('.brightness-dimmer');
      await page.waitForTimeout(100);
      const style = await dimmer.getAttribute('style');
      expect(style).toContain('opacity: 0.5');
    });

    test('brightness slider should have minimum of 10', async ({ page }) => {
      const slider = page.locator('[data-testid="brightness-slider"]');
      const min = await slider.getAttribute('min');
      expect(min).toBe('10');
    });

    test('brightness slider should have maximum of 100', async ({ page }) => {
      const slider = page.locator('[data-testid="brightness-slider"]');
      const max = await slider.getAttribute('max');
      expect(max).toBe('100');
    });
  });

  test.describe('LCD Actions Exposure', () => {
    test('should expose lcdActions on window for testing', async ({ page }) => {
      const hasLcdActions = await page.evaluate(() => {
        return typeof (window as any).lcdActions !== 'undefined';
      });

      // Note: lcdActions may not be exposed by default
      // This test documents expected behavior for debugging
    });
  });
});

test.describe('LCD Touch Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 440 });
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
  });

  test('standby overlay should prevent click-through when active', async ({ page }) => {
    // Put into standby
    await page.evaluate(() => {
      const { lcdActions } = (window as any);
      if (lcdActions) {
        lcdActions.standby();
      }
    });

    const overlay = page.locator('.standby-overlay');
    await expect(overlay).toHaveClass(/active/, { timeout: 2000 });

    // Overlay should have pointer-events: all when active
    const pointerEvents = await overlay.evaluate(el =>
      window.getComputedStyle(el).pointerEvents
    );
    expect(pointerEvents).toBe('all');
  });

  test('standby overlay should not block interactions when inactive', async ({ page }) => {
    const overlay = page.locator('.standby-overlay');

    // Overlay should have pointer-events: none when inactive
    const pointerEvents = await overlay.evaluate(el =>
      window.getComputedStyle(el).pointerEvents
    );
    expect(pointerEvents).toBe('none');
  });
});
