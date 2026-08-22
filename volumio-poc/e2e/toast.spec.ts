import { test, expect } from '@playwright/test';

test.describe('Toast Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    // Wait for testToast helper to be available
    await page.waitForFunction(() => (window as any).testToast, { timeout: 5000 });
    // Wait for Toast component to mount and register socket listener
    // Toast needs time to mount and set up its socket.on handler
    await page.waitForTimeout(1500);
  });

  test('should have toast container', async ({ page }) => {
    // Toast container should exist (even if empty)
    const toastContainer = page.locator('[data-testid="toast-container"]');
    await expect(toastContainer).toBeAttached();
  });

  test('should display toast when triggered via test helper', async ({ page }) => {
    // Use the testToast helper exposed on window
    await page.evaluate(() => {
      if ((window as any).testToast) {
        (window as any).testToast.success('Test Toast', 'This is a test message');
      }
    });

    // Toast should appear
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast.first()).toBeVisible({ timeout: 5000 });
  });

  test('should auto-dismiss toast after duration', async ({ page }) => {
    // Trigger a toast
    await page.evaluate(() => {
      if ((window as any).testToast) {
        (window as any).testToast.info('Auto Dismiss', 'Should disappear');
      }
    });

    // Toast should appear
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast.first()).toBeVisible({ timeout: 5000 });

    // Wait for auto-dismiss (info toasts are 4 seconds)
    await page.waitForTimeout(5000);

    // Toast should be gone
    await expect(toast).not.toBeVisible();
  });

  test('should dismiss toast when close button clicked', async ({ page }) => {
    // Trigger a toast
    await page.evaluate(() => {
      if ((window as any).testToast) {
        (window as any).testToast.warning('Dismissable', 'Click to dismiss');
      }
    });

    // Toast should appear
    const toast = page.locator('[data-testid="toast"]');
    await expect(toast.first()).toBeVisible({ timeout: 5000 });

    // Click dismiss button
    const dismissBtn = page.locator('[data-testid="toast"] button').first();
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
      await expect(toast).not.toBeVisible();
    }
  });

  test('should show error toast with correct styling', async ({ page }) => {
    await page.evaluate(() => {
      if ((window as any).testToast) {
        (window as any).testToast.error('Error Title', 'Error message');
      }
    });

    const toast = page.locator('[data-testid="toast"].toast--error');
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('should dedupe identical toasts', async ({ page }) => {
    // Trigger same toast twice rapidly
    await page.evaluate(() => {
      if ((window as any).testToast) {
        (window as any).testToast.error('Duplicate', 'Same message');
        (window as any).testToast.error('Duplicate', 'Same message');
      }
    });

    // Should only show one toast
    await page.waitForTimeout(500);
    const toasts = page.locator('[data-testid="toast"]');
    const count = await toasts.count();
    expect(count).toBeLessThanOrEqual(1);
  });
});
