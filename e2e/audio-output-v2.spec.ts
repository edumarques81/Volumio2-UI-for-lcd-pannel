/**
 * Audio output device picker — list, select, success-ack, error-ack recovery.
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
 * Behavior gap (documented in E2E-TEST-ISSUES.md): `setOutput` does NOT
 * surface a toast on the error branch and does NOT roll the `<select>` back
 * to the prior value (`audioDevices.ts:172-182` only `console.error`s, and
 * `SelectField` renders an uncontrolled native `<select>`). The C4 plan
 * called for both. The error-path test below asserts the weaker testable
 * property (subsequent selections still work end-to-end) rather than the
 * unobservable rollback.
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

  test('failed setPlaybackSettings does not break subsequent selections', async ({
    page,
    mockSocket,
  }) => {
    // What this test covers:
    //   - the emit shape on a user pick (output_device payload),
    //   - the error ack reaching the client without crashing the page,
    //   - a fresh user-driven selection round-tripping end-to-end after the
    //     failed attempt.
    //
    // What this test does NOT cover (and intentionally so):
    //   - error-toast appearance,
    //   - selection rollback in the <select>.
    // Both are documented in E2E-TEST-ISSUES.md as a real product gap in
    // src/lib/stores/audioDevices.ts:172-182 — the success branch sets
    // `selectedAudioOutput` but the failure branch only console.error()s.
    // If/when SelectField becomes a controlled component and audioDevices
    // surfaces a toast on failure, this test should be revisited and
    // strengthened to assert both behaviors directly.
    await page.click(NAV_SETTINGS);
    mockSocket.send(SOCKET_EVENTS.PUSH_PLAYBACK_OPTIONS, playbackOptionsEnvelope(DEVICE_A.value));

    const select = page.getByTestId('audio-output-select').locator('select');
    await expect(select).toHaveValue(DEVICE_A.value);

    const emitWaiter = mockSocket.waitForEmit(SOCKET_EVENTS.SET_PLAYBACK_SETTINGS);
    await select.selectOption(DEVICE_B.value);
    const emit = await emitWaiter;

    expect(emit.payload).toMatchObject({ output_device: DEVICE_B.value });
    emit.ack?.({ success: false, error: 'Device busy' });

    // Re-broadcast the canonical (unchanged) state — what a real backend
    // would do after rejecting a setPlaybackSettings call. The option list
    // stays intact, proving the store recovered cleanly from the error ack.
    mockSocket.send(SOCKET_EVENTS.PUSH_PLAYBACK_OPTIONS, playbackOptionsEnvelope(DEVICE_A.value));

    const optionCount = await select.locator('option').count();
    expect(optionCount).toBe(2);

    // Recovery selection: re-pick DEVICE_A. This currently fires a change
    // event because SelectField uses an attribute-only `selected={...}` (i.e.
    // an uncontrolled native <select>), so the user's previous (failed) pick
    // of DEVICE_B is still the DOM's `value`, and selecting A is a real
    // transition. If SelectField is ever made controlled (the documented gap
    // implies it should be), this `selectOption(A)` becomes a no-op and the
    // `waitForEmit({ skip: 1 })` below will time out — at which point this
    // test should be rewritten alongside the SelectField fix.
    const recoveryEmit = mockSocket.waitForEmit(SOCKET_EVENTS.SET_PLAYBACK_SETTINGS, { skip: 1 });
    await select.selectOption(DEVICE_A.value);
    const recovery = await recoveryEmit;
    expect(recovery.payload).toMatchObject({ output_device: DEVICE_A.value });
    recovery.ack?.({ success: true });
    await expect(select).toHaveValue(DEVICE_A.value);
  });
});
