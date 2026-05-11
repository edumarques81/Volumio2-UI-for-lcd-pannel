/**
 * Settings v2 — NAS C7-reopen edge cases.
 *
 * Validates the four C7-reopen frontend changes (per `~/.claude/plans/i-want-you-to-snug-summit.md`):
 *
 *   U1  — "Use this" prefills addIp from lastBrowseHostAttempt and moves focus
 *         to the first input.
 *   F1  — 8s timeout fallback on the four mutation actions (add / mount /
 *         unmount / delete) with per-action copy "X timed out — try again".
 *   F2  — in-progress strip with spinner + aria-live="polite" + aria-atomic="true"
 *         while a mutation is in flight (covers the normal 3-7s NFS handshake).
 *   F2r — race gate: while $shareOperationInProgress !== null, every mutation
 *         button (add, mount, unmount, delete) is disabled. Prevents the
 *         multi-outstanding-mutation timer race documented in the C7 review.
 *
 * Plus scenario (b) from the C7-reopen plan: browse to an unreachable host
 * surfaces a sticky error banner within ≤9s with a Retry button; browsing a
 * different (reachable) host clears the banner and renders the share list.
 *
 * Strategy: mockSocket harness, identical pattern to settings-nas.spec.ts. The
 * live-Pi smoke path is explicitly out of scope for this file — backend B1
 * (context-bounded mount/unmount) and M2 (UserUnmounted) have their own Go
 * tests, and a flaky live-network e2e adds no signal we don't already have.
 *
 * Event contract (verified against `src/lib/stores/sources.ts`):
 *   Client → server:
 *     - addNasShare(req)
 *     - discoverNasDevices()
 *     - browseNasShares({ host, username?, password? })
 *   Server → client:
 *     - pushListNasShares: NasShare[]
 *     - pushNasShareResult: { success, message?, error? }
 *     - pushNasDevices: { devices, error? }
 *     - pushBrowseNasShares: { shares, error? }
 *
 * Frontend timeout constants (also from sources.ts): all 8000ms. Tests that
 * exercise the fire path wait up to 9000ms.
 */

import { test, expect } from '../tests/e2e/fixtures/mockSocket';
import { SOCKET_EVENTS } from '../tests/e2e/fixtures/eventNames';

const NAV_SETTINGS = '[data-testid="nav-cell-settings"]';

// The frontend SHARE_OPERATION_TIMEOUT_MS / BROWSE_TIMEOUT_MS / DISCOVERY_TIMEOUT_MS
// are all 8s. The plan calls for asserting effects within ≤9s — leave 1s of
// scheduling slack on top of the store's setTimeout fire.
const POST_TIMEOUT_WAIT_MS = 9_000;

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

test.describe('Settings v2 — NAS C7-reopen', () => {
  test.beforeEach(async ({ page, mockSocket }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="player-layout"]', { timeout: 10_000 });
    await mockSocket.waitForClient();

    // Navigate to Settings — this triggers initSourcesStore() and the initial
    // getListNasShares() emit. Ack with an empty list so the UI is in a clean
    // "no shares" state. Tests that need a share present push their own list.
    await page.click(NAV_SETTINGS);
    await expect(page.getByTestId('settings-view')).toBeVisible();
    mockSocket.send(SOCKET_EVENTS.PUSH_LIST_NAS_SHARES, []);
  });

  test('scenario (b): browse unreachable host shows sticky banner within ≤9s, retry on different host clears it', async ({
    page,
    mockSocket,
  }) => {
    // Open Discover, run a scan, and stage two devices: one unreachable, one
    // reachable. We never hit a real Pi — the mock controls who answers.
    await page.getByRole('button', { name: 'Find devices on network' }).click();
    const discoverEmit = mockSocket.waitForEmit(SOCKET_EVENTS.DISCOVER_NAS_DEVICES);
    await page.getByTestId('nas-discover').click();
    await discoverEmit;

    mockSocket.send(SOCKET_EVENTS.PUSH_NAS_DEVICES, {
      devices: [
        { name: 'UnreachableNAS', ip: '192.168.86.99' },
        { name: 'WindowsNAS', ip: '192.168.86.26' },
      ],
    });

    const badRow = page.getByTestId('nas-device-192.168.86.99');
    const goodRow = page.getByTestId('nas-device-192.168.86.26');
    await expect(badRow).toBeVisible();
    await expect(goodRow).toBeVisible();

    // Click Browse on the unreachable host. We capture the emit and then do
    // NOT respond → the store's 8s BROWSE_TIMEOUT_MS fires and surfaces the
    // sticky error banner.
    const browseBadEmit = mockSocket.waitForEmit(SOCKET_EVENTS.BROWSE_NAS_SHARES);
    await badRow.getByRole('button', { name: /^Browse / }).click();
    const browseBadCaptured = await browseBadEmit;
    expect(browseBadCaptured.payload).toMatchObject({ host: '192.168.86.99' });

    const banner = page.getByTestId('nas-browse-error-banner');
    await expect(banner).toBeVisible({ timeout: POST_TIMEOUT_WAIT_MS });
    await expect(banner).toContainText('Browse timed out — try again');
    await expect(page.getByTestId('nas-browse-retry')).toBeVisible();
    await expect(page.getByTestId('nas-browse-retry')).toBeEnabled();

    // Now browse the reachable host. The store sets browseError = null
    // synchronously inside browseShares() (before the emit), so the banner
    // should disappear as soon as the click handler runs. We also push a
    // successful share list to confirm the success path renders.
    //
    // skip:1 — the mock buffers all matching emits, so without skipping we'd
    // re-resolve with the unreachable-host emit captured above.
    const browseGoodEmit = mockSocket.waitForEmit(SOCKET_EVENTS.BROWSE_NAS_SHARES, {
      skip: 1,
    });
    await goodRow.getByRole('button', { name: /^Browse / }).click();
    const browseGoodCaptured = await browseGoodEmit;
    expect(browseGoodCaptured.payload).toMatchObject({ host: '192.168.86.26' });

    mockSocket.send(SOCKET_EVENTS.PUSH_BROWSE_NAS_SHARES, {
      shares: [
        { name: 'MusicLibrary', type: 'disk', writable: true },
        { name: 'Photos', type: 'disk', writable: false },
      ],
    });

    await expect(banner).toBeHidden();
    await expect(page.getByRole('button', { name: 'Use this' }).first()).toBeVisible();
  });

  test('scenario (d): add NAS with bad creds shows in-progress strip then result strip with dismiss + a11y attrs', async ({
    page,
    mockSocket,
  }) => {
    // Open + fill the add form per plan scenario (d) — BadCreds / 192.168.86.26
    // / MusicLibrary / cifs / wrong / wrong.
    await page.getByRole('button', { name: '+ Add share' }).click();

    await page.getByTestId('nas-add-name').fill('BadCreds');
    await page.getByTestId('nas-add-ip').fill('192.168.86.26');
    await page.getByTestId('nas-add-path').fill('MusicLibrary');
    await page.getByTestId('nas-add-fstype').selectOption('cifs');
    await page.getByTestId('nas-add-username').fill('wrong');
    await page.getByTestId('nas-add-password').fill('wrong');

    // Submit. The store sets shareOperationInProgress = { action: 'add' }
    // synchronously before the emit, so the in-progress strip should appear
    // before the captured emit settles.
    const addEmit = mockSocket.waitForEmit(SOCKET_EVENTS.ADD_NAS_SHARE);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const addCaptured = await addEmit;
    expect(addCaptured.payload).toMatchObject({
      name: 'BadCreds',
      ip: '192.168.86.26',
      path: 'MusicLibrary',
      fstype: 'cifs',
      username: 'wrong',
      password: 'wrong',
    });

    // In-progress strip is visible with the canonical "add" copy, and the
    // aria-live + aria-atomic attributes that screen readers require.
    const inProgress = page.getByTestId('nas-operation-in-progress');
    await expect(inProgress).toBeVisible();
    await expect(inProgress).toContainText('Adding NAS share…');
    await expect(inProgress).toHaveAttribute('aria-live', 'polite');
    await expect(inProgress).toHaveAttribute('aria-atomic', 'true');
    await expect(inProgress).toHaveAttribute('role', 'status');

    // Ack: backend returns a permission-denied failure (NOT followed by a
    // pushListNasShares broadcast — that only fires on successful mutations).
    mockSocket.send(SOCKET_EVENTS.PUSH_NAS_SHARE_RESULT, {
      success: false,
      error: 'permission denied',
    });

    // In-progress strip swaps to result strip — the two share the bottom
    // slot via {#if/:else if} so this asserts both the disappearance of the
    // working state AND the appearance of the failure state.
    await expect(inProgress).toBeHidden();

    const result = page.getByTestId('nas-result-strip');
    await expect(result).toBeVisible();
    await expect(result).toContainText('permission denied');
    await expect(result).toHaveClass(/failure/);
    await expect(result).toHaveAttribute('aria-live', 'polite');
    await expect(result).toHaveAttribute('aria-atomic', 'true');
    await expect(result).toHaveAttribute('role', 'status');

    // Failure variant renders the × dismiss button (success variant does not).
    const dismiss = page.getByTestId('nas-result-dismiss');
    await expect(dismiss).toBeVisible();
    await dismiss.click();
    await expect(result).toBeHidden();
  });

  test('F2r race gate: every mutation button is disabled while a mutation is in flight', async ({
    page,
    mockSocket,
  }) => {
    // Seed one mounted share so we have a real row with mount/unmount/delete
    // buttons to gate. (The default beforeEach ack of [] hides those buttons
    // entirely — there's nothing to gate without a share present.)
    const share: NasShare = {
      id: 'share-gate-001',
      name: 'GateTestNAS',
      ip: '192.168.86.26',
      path: '/MusicLibrary',
      fstype: 'cifs',
      mounted: true,
      mountPoint: '/mnt/NAS/share-gate-001',
    };
    mockSocket.send(SOCKET_EVENTS.PUSH_LIST_NAS_SHARES, [share]);
    await expect(page.getByTestId(`nas-share-${share.id}`)).toBeVisible();

    const addToggle = page.getByRole('button', { name: '+ Add share' });
    const unmountBtn = page.getByTestId(`nas-share-unmount-${share.id}`);
    const deleteBtn = page.getByTestId(`nas-share-delete-${share.id}`);

    // All three are enabled in the steady state.
    await expect(addToggle).toBeEnabled();
    await expect(unmountBtn).toBeEnabled();
    await expect(deleteBtn).toBeEnabled();

    // Open the add form (it doesn't trigger a mutation by itself, just unhides
    // the form) and click Add through with empty fields. The store fires the
    // emit anyway — what we care about is that shareOperationInProgress flips
    // and the race gate engages.
    await addToggle.click();
    const addEmit = mockSocket.waitForEmit(SOCKET_EVENTS.ADD_NAS_SHARE);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await addEmit;

    // While the operation is in flight, every mutation entry point is
    // disabled. The unmount and delete buttons on the existing share row use
    // the same `gated` flag wired off $shareOperationInProgress.
    await expect(page.getByTestId('nas-operation-in-progress')).toBeVisible();
    await expect(addToggle).toBeDisabled();
    await expect(unmountBtn).toBeDisabled();
    await expect(deleteBtn).toBeDisabled();

    // Releasing the gate (any path that clears shareOperationInProgress) puts
    // the buttons back. We ack failure here — pushListNasShares (success path)
    // would re-render the row and racy us; pushNasShareResult is simpler.
    mockSocket.send(SOCKET_EVENTS.PUSH_NAS_SHARE_RESULT, {
      success: false,
      error: 'invalid request',
    });

    await expect(page.getByTestId('nas-operation-in-progress')).toBeHidden();
    await expect(addToggle).toBeEnabled();
    await expect(unmountBtn).toBeEnabled();
    await expect(deleteBtn).toBeEnabled();
  });

  test('U1: "Use this" prefills addPath + addIp from lastBrowseHostAttempt and focuses the first input', async ({
    page,
    mockSocket,
  }) => {
    // Walk Discover → Browse → pushBrowseNasShares so lastBrowseHostAttempt is
    // populated when Use this is clicked.
    await page.getByRole('button', { name: 'Find devices on network' }).click();
    const discoverEmit = mockSocket.waitForEmit(SOCKET_EVENTS.DISCOVER_NAS_DEVICES);
    await page.getByTestId('nas-discover').click();
    await discoverEmit;

    mockSocket.send(SOCKET_EVENTS.PUSH_NAS_DEVICES, {
      devices: [{ name: 'TestNAS', ip: '10.0.0.50' }],
    });

    const deviceRow = page.getByTestId('nas-device-10.0.0.50');
    await expect(deviceRow).toBeVisible();

    const browseEmit = mockSocket.waitForEmit(SOCKET_EVENTS.BROWSE_NAS_SHARES);
    await deviceRow.getByRole('button', { name: /^Browse / }).click();
    await browseEmit;

    mockSocket.send(SOCKET_EVENTS.PUSH_BROWSE_NAS_SHARES, {
      shares: [{ name: 'media', type: 'disk', writable: true }],
    });

    // Use this on the share — handleUseShare prefills both fields and, after
    // a tick, moves focus to the first <input> inside the add-form card.
    await page.getByRole('button', { name: 'Use this' }).first().click();

    const nameField = page.getByTestId('nas-add-name');
    const ipField = page.getByTestId('nas-add-ip');
    const pathField = page.getByTestId('nas-add-path');

    await expect(pathField).toHaveValue('media');
    await expect(ipField).toHaveValue('10.0.0.50');
    // First input in DOM order inside the add-form card is the name field.
    await expect(nameField).toBeFocused();
  });

  test('F1: addNasShare with no backend response triggers the 8s timeout fallback ("Add timed out — try again")', async ({
    page,
    mockSocket,
  }) => {
    // Fill the add form with anything — the values don't matter for the
    // timeout path, only that addNasShare is emitted and no response follows.
    await page.getByRole('button', { name: '+ Add share' }).click();
    await page.getByTestId('nas-add-name').fill('HangingNAS');
    await page.getByTestId('nas-add-ip').fill('192.168.86.99');
    await page.getByTestId('nas-add-path').fill('/music');

    const addEmit = mockSocket.waitForEmit(SOCKET_EVENTS.ADD_NAS_SHARE);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await addEmit;

    // While we're waiting on the timer to fire, the in-progress strip is up.
    await expect(page.getByTestId('nas-operation-in-progress')).toBeVisible();

    // No pushNasShareResult, no pushListNasShares — the 8s setTimeout in
    // beginShareOperation() fires, synthesizes a failure result with the
    // per-action copy, clears shareOperationInProgress, and the result strip
    // takes over.
    const result = page.getByTestId('nas-result-strip');
    await expect(result).toBeVisible({ timeout: POST_TIMEOUT_WAIT_MS });
    await expect(result).toContainText('Add timed out — try again');
    await expect(result).toHaveClass(/failure/);
    await expect(page.getByTestId('nas-operation-in-progress')).toBeHidden();
  });
});
