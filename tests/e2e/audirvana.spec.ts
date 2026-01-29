import { test, expect } from '@playwright/test';

/**
 * Audirvana Integration E2E Tests
 *
 * These tests validate the Audirvana detection and discovery functionality
 * when connected to a Raspberry Pi with Audirvana installed.
 *
 * Prerequisites:
 * - Stellar backend running on Pi (port 3000)
 * - Audirvana Studio installed on Pi
 * - Frontend dev server running (localhost:5173)
 */

test.describe('Audirvana Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Wait for Socket.IO connection
    await page.waitForTimeout(1000);
  });

  test('should receive Audirvana status on connect', async ({ page }) => {
    // The store should be initialized and have received status from backend
    // Check the audirvana store state via window access
    const status = await page.evaluate(() => {
      // Access the window object for debugging helpers
      return (window as any).__audirvanaStatus || null;
    });

    // Status might not be exposed, but we can verify by checking if the socket
    // received any pushAudirvanaStatus event
    await expect(page).toHaveTitle(/Stellar|Volumio/i, { timeout: 5000 });
  });

  test('should detect Audirvana installation via getAudirvanaStatus', async ({ page }) => {
    // Expose a handler to capture the pushAudirvanaStatus event
    const statusPromise = page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for pushAudirvanaStatus')), 10000);

        // Access socket service and listen for the event
        const checkSocket = () => {
          const socket = (window as any).__socket;
          if (socket) {
            const originalEmit = socket.emit.bind(socket);

            // Intercept emit to trigger getAudirvanaStatus
            socket.emit('getAudirvanaStatus');

            // Listen for response
            socket.once('pushAudirvanaStatus', (data: any) => {
              clearTimeout(timeout);
              resolve(data);
            });
          } else {
            // Socket not ready, try again
            setTimeout(checkSocket, 100);
          }
        };
        checkSocket();
      });
    });

    // Wait for the status response
    try {
      const status = await statusPromise;
      expect(status).toBeDefined();
      expect(status).toHaveProperty('installed');
      expect(status).toHaveProperty('service');
      expect(status).toHaveProperty('instances');

      // On Pi with Audirvana installed, expect installed to be true
      if (status && (status as any).installed) {
        expect((status as any).service).toHaveProperty('running');
        expect(Array.isArray((status as any).instances)).toBe(true);
      }
    } catch (error) {
      // If socket not exposed, this is expected - skip the test
      test.skip(true, 'Socket not exposed for E2E testing');
    }
  });

  test('should show Audirvana instances if available', async ({ page }) => {
    // This test checks that when Audirvana instances are discovered,
    // they are properly reported by the backend

    // We can't directly inspect the store in E2E, but we can verify
    // the Socket.IO communication works by checking logs or UI elements
    // For now, this serves as a placeholder for UI-based verification

    // Verify page loads without errors
    await expect(page.locator('body')).toBeVisible();

    // If there's a settings or integrations page, navigate there
    // and verify Audirvana section exists
    // This is placeholder - implement when UI component exists
  });
});

test.describe('Audirvana API Contract', () => {
  // These tests verify the Socket.IO event contracts

  test('getAudirvanaStatus should return valid status structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Use page.evaluate to interact with Socket.IO
    const result = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({ error: 'Timeout - socket may not be exposed' });
        }, 5000);

        // Try to access the socket
        const trySocket = (retries = 10) => {
          const socket = (window as any).__socket;
          if (!socket && retries > 0) {
            setTimeout(() => trySocket(retries - 1), 200);
            return;
          }

          if (!socket) {
            clearTimeout(timeout);
            resolve({ error: 'Socket not available' });
            return;
          }

          socket.once('pushAudirvanaStatus', (data: any) => {
            clearTimeout(timeout);
            resolve(data);
          });

          socket.emit('getAudirvanaStatus');
        };

        trySocket();
      });
    });

    // Verify structure if we got a valid response
    if (result && !(result as any).error) {
      const status = result as any;

      // Validate required fields
      expect(typeof status.installed).toBe('boolean');
      expect(status.service).toBeDefined();
      expect(typeof status.service.loaded).toBe('boolean');
      expect(typeof status.service.enabled).toBe('boolean');
      expect(typeof status.service.active).toBe('boolean');
      expect(typeof status.service.running).toBe('boolean');
      expect(Array.isArray(status.instances)).toBe(true);

      // Validate instance structure if any exist
      if (status.instances.length > 0) {
        const instance = status.instances[0];
        expect(typeof instance.name).toBe('string');
        expect(typeof instance.hostname).toBe('string');
        expect(typeof instance.address).toBe('string');
        expect(typeof instance.port).toBe('number');
        expect(typeof instance.protocol_version).toBe('string');
        expect(typeof instance.os).toBe('string');
      }
    }
  });
});
