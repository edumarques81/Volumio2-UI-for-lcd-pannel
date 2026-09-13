import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Volumio POC E2E tests
 * Tests run against the deployed Pi at 192.168.86.34
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially for consistent state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for E2E tests
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  use: {
    // Base URL for the deployed POC on Pi (port 8080 serves the Svelte POC)
    baseURL: process.env.VOLUMIO_URL || 'http://192.168.86.34:8080',

    // Collect trace on failure for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',

    // Viewport matching LCD panel
    viewport: { width: 1920, height: 440 },

    // Increase timeout for slower Pi responses
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // Global timeout for each test
  timeout: 60000,

  // Projects for different test scenarios
  projects: [
    {
      name: 'lcd-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 440 },
      },
    },
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],

  // Web server - not needed since we're testing against deployed Pi
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  // },
});
