import { test, expect } from '@playwright/test';

/**
 * M2.C live-Pi e2e — currently skipped.
 *
 * BLOCKER: NordVPN Threat Protection Pro™ macOS Endpoint Security
 * extension (`com.nordvpn.macos.Shield`, team `W5W395V82Y`, v9.15.0)
 * intercepts outbound TCP from non-system binaries. Playwright Chromium
 * hits ERR_ADDRESS_UNREACHABLE on every probe to the Mac dev server /
 * Pi backend. macOS Application Firewall is NOT the cause.
 *
 * Unblock command:
 *   sudo systemextensionsctl uninstall W5W395V82Y com.nordvpn.macos.Shield
 *
 * Or reboot the Mac after disabling Threat Protection Pro in the GUI.
 *
 * Manual verification of this spec's scenarios was performed by the
 * implementer during Task 8 — see `Volumio2-UI/docs/superpowers/plans/
 * 2026-05-13-m2c-artists-page-plan.md` Task 8 Step "Manual LCD smoke"
 * for the commit hash of the manual run and the recorded results.
 */

test.describe.skip('M2.C Artists library page (live-Pi)', () => {
  async function gotoApp(page: import('@playwright/test').Page) {
    await page.goto('/');
    // Page-ready gate (M1.E pattern): wait until the Play button is enabled
    // OR the library-view mounts. Without this gate, scenarios below would
    // false-pass on env failure.
    await expect.poll(
      async () => {
        const playEnabled = await page
          .locator('[data-testid="transport-play-pause"]')
          .isEnabled()
          .catch(() => false);
        const libraryMounted = await page
          .locator('[data-testid="library-view"]')
          .count();
        return playEnabled || libraryMounted > 0;
      },
      { timeout: 8000, message: 'Frontend never became interactive' },
    ).toBeTruthy();
  }

  test('vertical-swipe up from Library mounts ArtistsPage header within 2s', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    if (!box) test.fail();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="artists-page-header"]')).toBeVisible({ timeout: 2000 });
  });

  test('at least one ArtistTile renders after the strip mounts', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-testid^="artist-tile-"]').first()).toBeVisible({ timeout: 4000 });
  });

  test('tap an artist tile → AlbumsPage with amber name + ✕ clear button', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    const firstTile = page.locator('[data-testid^="artist-tile-"]').first();
    await firstTile.click();
    await expect(page.locator('[data-testid="clear-artist-filter"]')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.artist-row.is-filter-active')).toBeVisible();
  });

  test('tapping ✕ clears the filter; artist-row loses the accent', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    await page.locator('[data-testid^="artist-tile-"]').first().click();
    await page.locator('[data-testid="clear-artist-filter"]').click();
    await expect(page.locator('[data-testid="clear-artist-filter"]')).toHaveCount(0);
    await expect(page.locator('.artist-row.is-filter-active')).toHaveCount(0);
  });

  test('vertical-swipe back to Artists with active filter clears it implicitly', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    await page.locator('[data-testid^="artist-tile-"]').first().click();
    // swipe up again (Albums → Artists)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    // now swipe down (Artists → Albums) — filter should be cleared
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="clear-artist-filter"]')).toHaveCount(0);
  });

  test('letter-avatar fallback renders on /artistart 404', async ({ page }) => {
    await page.route(/\/artistart\?name=Hollow%20Tides/i, (route) => route.fulfill({ status: 404 }));
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    const fallback = page
      .locator('[data-testid="artist-tile-hollow-tides"]')
      .locator('[data-testid="avatar-fallback"]');
    await expect(fallback).toBeVisible({ timeout: 4000 });
    await expect(fallback).toHaveText('H');
  });
});
