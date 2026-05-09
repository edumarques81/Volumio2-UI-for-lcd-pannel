/**
 * Settings v2 — column render, library scope round-trip, and reboot Confirm/Cancel.
 *
 * Replaces the legacy `settings.spec.ts` (which targeted v1 selectors that no
 * longer exist after the redesign).
 *
 * Event-name note: the SystemSettings reboot/shutdown buttons emit `reboot` and
 * `shutdown` directly via socketService (settings.ts:288, 296) — the C4 plan
 * mentioned `system:action:reboot`, but the actual code uses `reboot`. We
 * assert against the real event names. See E2E-TEST-ISSUES.md for the spec
 * reconciliation note.
 */

import { test, expect } from '../tests/e2e/fixtures/mockSocket';
import { SOCKET_EVENTS } from '../tests/e2e/fixtures/eventNames';

const NAV_SETTINGS = '[data-testid="nav-cell-settings"]';
const NAV_PLAYER = '[data-testid="nav-cell-player"]';

test.describe('Settings v2', () => {
  test.beforeEach(async ({ page, mockSocket }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="player-layout"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="nav-column"]', { timeout: 10000 });
    await mockSocket.waitForClient();
  });

  test('NavColumn → Settings shows three columns', async ({ page }) => {
    await page.click(NAV_SETTINGS);

    await expect(page.getByTestId('settings-view')).toBeVisible();
    await expect(page.getByTestId('settings-column-library')).toBeVisible();
    await expect(page.getByTestId('settings-column-audio')).toBeVisible();
    await expect(page.getByTestId('settings-column-system')).toBeVisible();
  });

  test('Library scope round-trip (NAS) persists across reload', async ({ page, mockSocket }) => {
    await page.click(NAV_SETTINGS);
    await expect(page.getByTestId('settings-view')).toBeVisible();

    // Drill into the SegmentedControl wrapper for scope and pick "NAS".
    const scope = page.getByTestId('library-scope');
    await scope.getByRole('radio', { name: 'NAS' }).click();

    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('libraryScope')))
      .toBe('nas');

    // Reload and assert the choice survives. Re-route /config.json on the new
    // page-load (route handlers persist on the page, but the frontend re-fetches
    // /config.json after navigation, so the route still matches).
    await page.reload();
    await page.waitForSelector('[data-testid="nav-column"]', { timeout: 10000 });
    await mockSocket.waitForClient();

    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('libraryScope')))
      .toBe('nas');

    // And the UI should reflect that on next visit to Settings.
    await page.click(NAV_SETTINGS);
    await expect(page.getByTestId('settings-view')).toBeVisible();
    const nasRadio = page.getByTestId('library-scope').getByRole('radio', { name: 'NAS' });
    await expect(nasRadio).toHaveAttribute('aria-checked', 'true');
  });

  test('Reboot → ConfirmDialog → Cancel: dialog dismissed, no reboot emit', async ({
    page,
    mockSocket,
  }) => {
    await page.click(NAV_SETTINGS);
    await page.click('[data-testid="system-reboot"]');

    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toBeVisible();

    await page.click('[data-testid="confirm-dialog-cancel"]');
    await expect(dialog).toBeHidden();

    // Give any (incorrect) emit a moment to surface, then assert nothing.
    await page.waitForTimeout(250);
    expect(mockSocket.getEmits(SOCKET_EVENTS.REBOOT)).toHaveLength(0);
  });

  test('Reboot → ConfirmDialog → Confirm: emits reboot', async ({ page, mockSocket }) => {
    await page.click(NAV_SETTINGS);
    await page.click('[data-testid="system-reboot"]');

    const dialog = page.getByTestId('confirm-dialog');
    await expect(dialog).toBeVisible();

    const reboot = mockSocket.waitForEmit(SOCKET_EVENTS.REBOOT, { timeout: 5000 });
    await page.click('[data-testid="confirm-dialog-confirm"]');
    const captured = await reboot;

    expect(captured.event).toBe(SOCKET_EVENTS.REBOOT);
    await expect(dialog).toBeHidden();
  });

  test('NavColumn back to Player closes Settings view', async ({ page }) => {
    await page.click(NAV_SETTINGS);
    await expect(page.getByTestId('settings-view')).toBeVisible();

    await page.click(NAV_PLAYER);
    await expect(page.getByTestId('settings-view')).toBeHidden();
  });
});
