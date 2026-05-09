/**
 * Settings v2 — NAS share manual-add and discover/browse flows.
 *
 * Event contract (verified against src/lib/stores/sources.ts):
 *   Client emits:
 *     - addNasShare(req)
 *     - mountNasShare({ id })
 *     - getListNasShares() (auto-fired on Settings mount via initSourcesStore)
 *     - discoverNasDevices()
 *     - browseNasShares({ host, username, password })
 *   Server pushes:
 *     - pushListNasShares: NasShare[]
 *     - pushNasShareResult: { success, message?, error? }
 *     - pushNasDevices: { devices, error? }                  (NOT pushDiscoveredNasDevices as the C4 plan suggested)
 *     - pushBrowseNasShares: { shares, error? }              (NOT pushBrowsedNasShares as the C4 plan suggested)
 *
 * The `nas-result-strip` is rendered from `lastShareResult`, populated by
 * `pushNasShareResult` — so a successful add needs both pushNasShareResult AND
 * pushListNasShares.
 *
 * Per-share testids are keyed by share.id (NOT share.name) — verified in
 * NasShareList.svelte:112.
 */

import { test, expect } from '../tests/e2e/fixtures/mockSocket';
import { SOCKET_EVENTS } from '../tests/e2e/fixtures/eventNames';

const NAV_SETTINGS = '[data-testid="nav-cell-settings"]';

interface NasShare {
  id: string;
  name: string;
  ip: string;
  path: string;
  fstype: string;
  username?: string;
  options?: string;
  mounted: boolean;
  mountPoint: string;
}

const SHARE_FIXTURE: NasShare = {
  id: 'share-001',
  name: 'My NAS',
  ip: '192.168.1.10',
  path: '/music',
  fstype: 'cifs',
  mounted: false,
  mountPoint: '/mnt/nas/share-001',
};

test.describe('Settings v2 — NAS shares', () => {
  test.beforeEach(async ({ page, mockSocket }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="player-layout"]', { timeout: 10000 });
    await mockSocket.waitForClient();

    // Navigate to Settings — this triggers initSourcesStore() and the initial
    // getListNasShares() emit. Ack with an empty list so the UI is in a clean
    // "no shares" state for the manual-add flow.
    await page.click(NAV_SETTINGS);
    await expect(page.getByTestId('settings-view')).toBeVisible();
    mockSocket.send(SOCKET_EVENTS.PUSH_LIST_NAS_SHARES, []);
  });

  test('manual add emits addNasShare with all fields and renders the result strip', async ({
    page,
    mockSocket,
  }) => {
    // Reveal the form by clicking "+ Add share".
    await page.getByRole('button', { name: '+ Add share' }).click();

    // Fill every testid'd field.
    await page.getByTestId('nas-add-name').fill(SHARE_FIXTURE.name);
    await page.getByTestId('nas-add-ip').fill(SHARE_FIXTURE.ip);
    await page.getByTestId('nas-add-path').fill(SHARE_FIXTURE.path);
    await page.getByTestId('nas-add-fstype').selectOption('cifs');
    await page.getByTestId('nas-add-username').fill('alice');
    await page.getByTestId('nas-add-password').fill('s3cret');
    await page.getByTestId('nas-add-options').fill('vers=3.0');

    // Submit → expect addNasShare emit with the full payload.
    const addEmit = mockSocket.waitForEmit(SOCKET_EVENTS.ADD_NAS_SHARE);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const captured = await addEmit;

    expect(captured.payload).toMatchObject({
      name: SHARE_FIXTURE.name,
      ip: SHARE_FIXTURE.ip,
      path: SHARE_FIXTURE.path,
      fstype: 'cifs',
      username: 'alice',
      password: 's3cret',
      options: 'vers=3.0',
    });

    // Ack: backend pushes a success result + the updated share list.
    mockSocket.send(SOCKET_EVENTS.PUSH_NAS_SHARE_RESULT, {
      success: true,
      message: 'Share added',
    });
    mockSocket.send(SOCKET_EVENTS.PUSH_LIST_NAS_SHARES, [SHARE_FIXTURE]);

    // Result strip should appear (success branch styling).
    const strip = page.getByTestId('nas-result-strip');
    await expect(strip).toBeVisible();
    await expect(strip).toHaveClass(/success/);

    // The new share row should be rendered (testid keyed by share.id).
    await expect(page.getByTestId(`nas-share-${SHARE_FIXTURE.id}`)).toBeVisible();
    // Unmounted share renders the mount button (mutually exclusive with unmount).
    await expect(page.getByTestId(`nas-share-mount-${SHARE_FIXTURE.id}`)).toBeVisible();
  });

  test('discover → device → browse → use-this drives addNasShare + mountNasShare flow', async ({
    page,
    mockSocket,
  }) => {
    // Open Discover panel and trigger the scan.
    await page.getByRole('button', { name: 'Find devices on network' }).click();
    const discoverEmit = mockSocket.waitForEmit(SOCKET_EVENTS.DISCOVER_NAS_DEVICES);
    await page.getByTestId('nas-discover').click();
    await discoverEmit;

    // Mock backend returns two devices.
    mockSocket.send(SOCKET_EVENTS.PUSH_NAS_DEVICES, {
      devices: [
        { name: 'Synology', ip: '10.0.0.20' },
        { name: 'TrueNAS', ip: '10.0.0.21' },
      ],
    });

    // First device row appears (keyed by ip).
    const firstRow = page.getByTestId('nas-device-10.0.0.20');
    await expect(firstRow).toBeVisible();

    // Tap the device's Browse button → backend should see browseNasShares.
    const browseEmit = mockSocket.waitForEmit(SOCKET_EVENTS.BROWSE_NAS_SHARES);
    await firstRow.getByRole('button', { name: /^Browse / }).click();
    const browseCaptured = await browseEmit;
    expect(browseCaptured.payload).toMatchObject({ host: '10.0.0.20' });

    // Mock the share list for that host.
    mockSocket.send(SOCKET_EVENTS.PUSH_BROWSE_NAS_SHARES, {
      shares: [
        { name: 'music', type: 'disk', writable: true },
        { name: 'photos', type: 'disk', writable: false },
      ],
    });

    // "Use this" on the first share opens the add form prefilled with that
    // path. Verify the form shows up with the path populated.
    await page.getByRole('button', { name: 'Use this' }).first().click();
    await expect(page.getByTestId('nas-add-path')).toHaveValue('music');

    // Fill the remaining required fields and submit.
    await page.getByTestId('nas-add-name').fill('Synology Music');
    await page.getByTestId('nas-add-ip').fill('10.0.0.20');

    const addEmit = mockSocket.waitForEmit(SOCKET_EVENTS.ADD_NAS_SHARE);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const addCaptured = await addEmit;
    expect(addCaptured.payload).toMatchObject({
      name: 'Synology Music',
      ip: '10.0.0.20',
      path: 'music',
      fstype: 'cifs',
    });

    // Backend acks with the new share (unmounted) + a result message.
    const newShare: NasShare = {
      id: 'share-syn-music',
      name: 'Synology Music',
      ip: '10.0.0.20',
      path: 'music',
      fstype: 'cifs',
      mounted: false,
      mountPoint: '/mnt/nas/share-syn-music',
    };
    mockSocket.send(SOCKET_EVENTS.PUSH_NAS_SHARE_RESULT, { success: true, message: 'Share added' });
    mockSocket.send(SOCKET_EVENTS.PUSH_LIST_NAS_SHARES, [newShare]);

    // Mount button is shown for the new (unmounted) share. Tapping it should
    // emit mountNasShare with the share id.
    const mountBtn = page.getByTestId(`nas-share-mount-${newShare.id}`);
    await expect(mountBtn).toBeVisible();

    const mountEmit = mockSocket.waitForEmit(SOCKET_EVENTS.MOUNT_NAS_SHARE);
    await mountBtn.click();
    const mountCaptured = await mountEmit;
    expect(mountCaptured.payload).toMatchObject({ id: newShare.id });
  });
});
