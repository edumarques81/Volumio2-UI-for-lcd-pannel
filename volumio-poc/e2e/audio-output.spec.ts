import { test, expect } from '@playwright/test';

test.describe('Audio Output Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    // Wait for navigation to be exposed
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });
    // Navigate to settings via navigation function
    await page.evaluate(() => (window as any).__navigation.goToSettings());
    await page.waitForSelector('[data-view="settings"]', { timeout: 10000 });
    // Navigate to Playback settings
    const playbackCategory = page.locator('.category-card:has-text("Playback")');
    await playbackCategory.click();
    await page.waitForTimeout(500);
  });

  test('should display audio output section', async ({ page }) => {
    const audioSection = page.locator('[data-testid="audio-output-section"]');
    await expect(audioSection).toBeVisible({ timeout: 5000 });
  });

  test('should show loading or empty state initially', async ({ page }) => {
    // Either loading state or "No audio devices found" should be visible
    const loadingOrEmpty = page.locator('.spinner, .placeholder:has-text("Loading"), .placeholder:has-text("No audio devices")');
    const audioList = page.locator('[data-testid="audio-output-list"]');

    // Wait a moment for the section to render
    await page.waitForTimeout(500);

    // Should see either loading, empty state, or the list (if connected to real backend)
    const hasLoadingOrEmpty = await loadingOrEmpty.first().isVisible().catch(() => false);
    const hasList = await audioList.isVisible().catch(() => false);

    expect(hasLoadingOrEmpty || hasList).toBeTruthy();
  });
});

test.describe('Audio Output Settings with Mock Data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-container', { timeout: 10000 });
    // Wait for navigation and test helpers to be exposed
    await page.waitForFunction(() => (window as any).__navigation, { timeout: 5000 });

    // Try to load mock devices if helper is available
    const hasTestHelper = await page.evaluate(() => !!(window as any).__testAudioDevices);
    if (hasTestHelper) {
      await page.evaluate(() => (window as any).__testAudioDevices.loadMockDevices());
      await page.waitForTimeout(100);
    }

    // Navigate to settings via navigation function
    await page.evaluate(() => (window as any).__navigation.goToSettings());
    await page.waitForSelector('[data-view="settings"]', { timeout: 10000 });
    // Navigate to Playback settings
    const playbackCategory = page.locator('.category-card:has-text("Playback")');
    await playbackCategory.click();
    await page.waitForTimeout(500);
  });

  test('should list available audio outputs when data is loaded', async ({ page }) => {
    // Check if test helper was available
    const hasTestHelper = await page.evaluate(() => !!(window as any).__testAudioDevices);

    if (hasTestHelper) {
      // Reload mock data in case it wasn't loaded in beforeEach
      await page.evaluate(() => (window as any).__testAudioDevices.loadMockDevices());
      await page.waitForTimeout(200);

      const outputList = page.locator('[data-testid="audio-output-list"]');
      await expect(outputList).toBeVisible({ timeout: 5000 });

      // Should have at least one output option
      const outputOptions = page.locator('[data-testid="audio-output-option"]');
      const count = await outputOptions.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // Skip this test if helper not available
      test.skip();
    }
  });

  test('should show device name for connected outputs', async ({ page }) => {
    const hasTestHelper = await page.evaluate(() => !!(window as any).__testAudioDevices);

    if (hasTestHelper) {
      await page.evaluate(() => (window as any).__testAudioDevices.loadMockDevices());
      await page.waitForTimeout(200);

      const connectedOutputs = page.locator('[data-testid="audio-output-option"]:not([data-disabled="true"])');
      const count = await connectedOutputs.count();

      if (count > 0) {
        const firstConnected = connectedOutputs.first();
        const deviceName = await firstConnected.locator('[data-testid="device-name"]').textContent();
        expect(deviceName).toBeTruthy();
        expect(deviceName).not.toBe('');
      }
    } else {
      test.skip();
    }
  });

  test('should highlight currently selected output', async ({ page }) => {
    const hasTestHelper = await page.evaluate(() => !!(window as any).__testAudioDevices);

    if (hasTestHelper) {
      await page.evaluate(() => (window as any).__testAudioDevices.loadMockDevices());
      await page.waitForTimeout(200);

      // One output should be marked as selected
      const selectedOutput = page.locator('[data-testid="audio-output-option"][data-selected="true"]');
      await expect(selectedOutput).toBeVisible({ timeout: 3000 });
    } else {
      test.skip();
    }
  });

  test('should categorize outputs by type (USB, HDMI)', async ({ page }) => {
    const hasTestHelper = await page.evaluate(() => !!(window as any).__testAudioDevices);

    if (hasTestHelper) {
      await page.evaluate(() => (window as any).__testAudioDevices.loadMockDevices());
      await page.waitForTimeout(200);

      // Should have category headers
      const usbCategory = page.locator('[data-testid="output-category-usb"]');
      const hdmiCategory = page.locator('[data-testid="output-category-hdmi"]');

      // At least one category should be visible
      const hasUsb = await usbCategory.isVisible().catch(() => false);
      const hasHdmi = await hdmiCategory.isVisible().catch(() => false);

      expect(hasUsb || hasHdmi).toBeTruthy();
    } else {
      test.skip();
    }
  });
});
