/**
 * Audio output device picker — list, select, success-ack, error-ack rollback.
 *
 * Replaces the legacy `audio-output.spec.ts` (which mixed v1 and v2 selectors
 * and gated behavior on `__testAudioDevices` rather than a real socket mock).
 *
 * Event contract (verified against src/lib/stores/audioDevices.ts):
 *   - Server pushes `pushPlaybackOptions` with the v3-style options envelope
 *     (`{ options: [{ id, attributes: [{ name: 'output_device', value, options }] }] }`).
 *   - Client emits `setPlaybackSettings` with `{ output_device }` and a callback;
 *     the store updates `selectedAudioOutput` only when `response.success !== false`.
 *
 * Cycle 5 closed the silent-failure gap: SelectField is now controlled
 * (its DOM `<select>.value` mirrors the store), and `audioDevices.setOutput`
 * surfaces a toast on the error branch instead of just `console.error`. The
 * error-path test below asserts both behaviors directly.
 */

import { test, expect } from '../tests/e2e/fixtures/mockSocket';
import { SOCKET_EVENTS } from '../tests/e2e/fixtures/eventNames';

const NAV_SETTINGS = '[data-testid="nav-cell-settings"]';

const DEVICE_A = { value: 'vc4hdmi0', name: 'HDMI 0 Out' };
const DEVICE_B = { value: 'U20SU6', name: 'USB Audio 2.0 (SU-6)' };

function playbackOptionsEnvelope(selectedValue: string) {
  return {
    options: [
      {
        id: 'output',
        name: 'Audio Output',
        attributes: [
          {
            name: 'output_device',
            type: 'select',
            value: selectedValue,
            options: [DEVICE_A, DEVICE_B],
          },
        ],
      },
    ],
  };
}

test.describe('Audio output v2', () => {
  test.beforeEach(async ({ page, mockSocket }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="player-layout"]', { timeout: 10000 });
    await mockSocket.waitForClient();
  });

  test('renders both devices in the SelectField', async ({ page, mockSocket }) => {
    await page.click(NAV_SETTINGS);
    await expect(page.getByTestId('settings-view')).toBeVisible();

    // Push the options envelope; SettingsView lazily inits audioDevicesStore on
    // mount and emits getPlaybackOptions, but the store also processes anything
    // pushed unsolicited.
    mockSocket.send(SOCKET_EVENTS.PUSH_PLAYBACK_OPTIONS, playbackOptionsEnvelope(DEVICE_A.value));

    const selectWrapper = page.getByTestId('audio-output-select');
    const select = selectWrapper.locator('select');
    await expect(select).toBeVisible();

    // Wait for the store to populate the device list.
    await expect.poll(async () => select.locator('option').count()).toBeGreaterThanOrEqual(2);

    const optionValues = await select.locator('option').evaluateAll((opts) =>
      (opts as HTMLOptionElement[]).map((o) => o.value),
    );
    expect(optionValues).toContain(DEVICE_A.value);
    expect(optionValues).toContain(DEVICE_B.value);
    await expect(select).toHaveValue(DEVICE_A.value);
  });

  test('picking second device emits setPlaybackSettings; success ack updates UI', async ({
    page,
    mockSocket,
  }) => {
    await page.click(NAV_SETTINGS);
    mockSocket.send(SOCKET_EVENTS.PUSH_PLAYBACK_OPTIONS, playbackOptionsEnvelope(DEVICE_A.value));

    const select = page.getByTestId('audio-output-select').locator('select');
    await expect(select).toHaveValue(DEVICE_A.value);

    // Pick device B and capture the resulting emit + ack callback.
    const emitWaiter = mockSocket.waitForEmit(SOCKET_EVENTS.SET_PLAYBACK_SETTINGS);
    await select.selectOption(DEVICE_B.value);
    const emit = await emitWaiter;

    expect(emit.payload).toMatchObject({ output_device: DEVICE_B.value });
    expect(emit.ack).not.toBeNull();
    emit.ack?.({ success: true });

    // Store updates → bound `value` re-renders the select with B selected.
    await expect(select).toHaveValue(DEVICE_B.value);
  });

  test('failed setPlaybackSettings rolls back the picker and surfaces a toast', async ({
    page,
    mockSocket,
  }) => {
    // Cycle-5 contract:
    //   - The store does NOT advance `selectedAudioOutput` to the rejected
    //     device, so the controlled <select> snaps back to the prior pick.
    //   - The user sees an error toast carrying the backend's message.
    //   - A subsequent successful pick of the rejected device round-trips
    //     end-to-end (recovery path stays clean after a failure).
    await page.click(NAV_SETTINGS);
    mockSocket.send(SOCKET_EVENTS.PUSH_PLAYBACK_OPTIONS, playbackOptionsEnvelope(DEVICE_A.value));

    const select = page.getByTestId('audio-output-select').locator('select');
    await expect(select).toHaveValue(DEVICE_A.value);

    const emitWaiter = mockSocket.waitForEmit(SOCKET_EVENTS.SET_PLAYBACK_SETTINGS);
    await select.selectOption(DEVICE_B.value);
    const emit = await emitWaiter;

    expect(emit.payload).toMatchObject({ output_device: DEVICE_B.value });
    emit.ack?.({ success: false, error: 'Device busy' });

    // 1. Picker rolls back: the controlled <select> mirrors the store, which
    //    did not move off DEVICE_A.
    await expect(select).toHaveValue(DEVICE_A.value);

    // 2. Error toast appears with the title set by audioDevices.setOutput
    //    and the backend's error string as the body.
    const toast = page.getByTestId('toast').filter({ hasText: 'Audio output change failed' });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Device busy');

    // 3. Recovery: the user re-picks DEVICE_B and the backend accepts.
    //    Note: because the select is controlled and currently shows
    //    DEVICE_A, picking B is a real transition (not a no-op).
    const recoveryEmit = mockSocket.waitForEmit(SOCKET_EVENTS.SET_PLAYBACK_SETTINGS, { skip: 1 });
    await select.selectOption(DEVICE_B.value);
    const recovery = await recoveryEmit;
    expect(recovery.payload).toMatchObject({ output_device: DEVICE_B.value });
    recovery.ack?.({ success: true });
    await expect(select).toHaveValue(DEVICE_B.value);
  });
});
