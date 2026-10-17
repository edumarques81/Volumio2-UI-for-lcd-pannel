<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Toggle from '$lib/components/redesign/controls/Toggle.svelte';
  import ConfirmDialog from '$lib/components/redesign/settings/ConfirmDialog.svelte';
  import { systemInfo, networkStatus } from '$lib/stores/settings';
  import { settingsActions } from '$lib/stores/settings';
  import { isLcdOn, lcdActions, lcdLoading } from '$lib/stores/lcd';
  import { lcdSchedule, lcdScheduleActions } from '$lib/stores/lcdSchedule';
  import SelectField from '$lib/components/redesign/controls/SelectField.svelte';
  import {
    standbyBrightness,
    standbyIdleMinutes,
    standbyActions
  } from '$lib/stores/standby';
  import { frontendVersion, backendVersion } from '$lib/stores/version';
  import { getVolumioHost } from '$lib/config';
  import { socketService } from '$lib/services/socket';

  /** Backend shape for system:action:error broadcasts. */
  interface SystemActionError {
    action?: string;
    error?: string;
  }

  // Local dialog state
  let rebootOpen = $state(false);
  let shutdownOpen = $state(false);

  // A power command can fail after the confirm dialog closes: the backend
  // defers the exec by 3s, and a non-loopback caller is refused outright.
  // PowerModal has always surfaced that; this column did not, so a refused
  // or failed Reboot looked identical to a working one that simply had not
  // happened yet. Nothing on screen ever said otherwise.
  let powerError = $state('');
  let unsubPowerError: (() => void) | null = null;

  onMount(() => {
    unsubPowerError = socketService.on<SystemActionError>('system:action:error', (payload) => {
      powerError = `Power command failed: ${payload?.error ?? 'unknown error'}`;
    });
  });
  onDestroy(() => unsubPowerError?.());

  // Derived values
  const backendUrl = getVolumioHost();

  function handleLcdChange(next: boolean): void {
    if (next) {
      lcdActions.turnOn();
    } else {
      lcdActions.turnOff();
    }
  }

  // Standby and "LCD on" are deliberately separate controls, because on this
  // panel they are different hardware states. Standby paints a clock face and
  // keeps the touch digitizer alive; turning the LCD off stops the HDMI signal,
  // and the panel answers that by resetting its own touch controller -- so the
  // screen can then only be brought back from the phone or the backend.
  const IDLE_OPTIONS = [
    { value: '0', label: 'Never' },
    { value: '10', label: 'After 10 minutes' },
    { value: '20', label: 'After 20 minutes' },
    { value: '30', label: 'After 30 minutes' },
    { value: '45', label: 'After 45 minutes' },
    { value: '60', label: 'After 1 hour' },
    { value: '120', label: 'After 2 hours' }
  ] as const;

  const idleValue = $derived(String($standbyIdleMinutes));

  // The panel is touch-only and the kiosk has no keyboard, so a time is picked
  // from a list rather than typed. Half-hour steps across the whole day: the
  // schedule is the user's, not ours to narrow to an evening window.
  const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const value = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
    return { value, label: value };
  });

  const NIGHT_IDLE_OPTIONS = [
    { value: '30', label: 'Nothing played for 30 minutes' },
    { value: '60', label: 'Nothing played for 1 hour' },
    { value: '120', label: 'Nothing played for 2 hours' },
    { value: '240', label: 'Nothing played for 4 hours' }
  ] as const;

  // A backend value that is not on the list (set from another client, or an
  // older default) would select nothing at all; SelectField renders an unknown
  // value as a disabled option, so it stays visible instead of looking unset.
  const nightIdleValue = $derived(String($lcdSchedule.autoOffIdleMinutes));

  function handleIdleChange(next: string): void {
    standbyActions.setIdleMinutes(Number(next));
  }

  function handleBrightnessInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    standbyActions.setBrightness(Number(target.value));
  }

  function handleRebootConfirm(): void {
    powerError = '';
    settingsActions.restart();
    rebootOpen = false;
  }

  function handleRebootCancel(): void {
    rebootOpen = false;
  }

  function handleShutdownConfirm(): void {
    powerError = '';
    settingsActions.shutdown();
    shutdownOpen = false;
  }

  function handleShutdownCancel(): void {
    shutdownOpen = false;
  }
</script>

<section class="system-settings">
  <h2 class="column-title">System</h2>

  <!-- About block -->
  <div class="block">
    <p class="block-label">About</p>
    <dl class="info-list">
      <dt>Frontend name</dt>
      <dd class="mono">{$frontendVersion.name}</dd>

      <dt>Frontend version</dt>
      <dd class="mono" data-testid="system-version-frontend">{$frontendVersion.version}</dd>

      <dt>Backend version</dt>
      <dd class="mono" data-testid="system-version-backend">{$backendVersion?.version ?? 'unknown'}</dd>

      <dt>Backend URL</dt>
      <dd class="mono">{backendUrl}</dd>

      <dt>Hostname</dt>
      <dd class="mono">{$systemInfo?.host ?? '—'}</dd>

      <dt>Hardware</dt>
      <dd class="mono">{$systemInfo?.hardware ?? '—'}</dd>

      <dt>Build date</dt>
      <dd class="mono">{$systemInfo?.builddate ?? '—'}</dd>
    </dl>
  </div>

  <!-- Network block -->
  <div class="block">
    <p class="block-label">Network</p>
    <div class="network-row">
      <span
        class="network-badge"
        class:online={$networkStatus.online}
        class:offline={!$networkStatus.online}
      >
        {$networkStatus.online ? 'Online' : 'Offline'}
      </span>
      {#if $networkStatus.ip}
        <span class="network-ip mono">{$networkStatus.ip}</span>
      {/if}
    </div>
  </div>

  <!-- Display block -->
  <div class="block">
    <p class="block-label">Display</p>
    <Toggle
      pressed={$isLcdOn}
      onchange={handleLcdChange}
      ariaLabel="LCD power"
      id="settings-system-lcd-power"
      label="LCD on"
      loading={$lcdLoading}
    />
    <p class="block-hint">
      Turning the LCD off cuts the display signal. Touch stops working until it is
      turned back on from the phone app, or by the morning schedule below.
    </p>

    <div class="field">
      <Toggle
        pressed={$lcdSchedule.autoOffEnabled}
        onchange={(next) => lcdScheduleActions.update({ autoOffEnabled: next })}
        ariaLabel="Turn the LCD off overnight"
        id="settings-system-lcd-autooff"
        label="Turn off overnight"
      />
    </div>

    {#if $lcdSchedule.autoOffEnabled}
      <div class="field">
        <SelectField
          id="settings-system-lcd-autooff-at"
          label="Not before"
          options={TIME_OPTIONS}
          value={$lcdSchedule.autoOffAt}
          onchange={(next) => lcdScheduleActions.update({ autoOffAt: next })}
        />
      </div>

      <div class="field">
        <SelectField
          id="settings-system-lcd-autooff-idle"
          label="And only if"
          options={NIGHT_IDLE_OPTIONS}
          value={nightIdleValue}
          onchange={(next) => lcdScheduleActions.update({ autoOffIdleMinutes: Number(next) })}
        />
      </div>
    {/if}

    <div class="field">
      <Toggle
        pressed={$lcdSchedule.autoRestoreEnabled}
        onchange={(next) => lcdScheduleActions.update({ autoRestoreEnabled: next })}
        ariaLabel="Turn the LCD back on in the morning"
        id="settings-system-lcd-autorestore"
        label="Turn back on in the morning"
      />
    </div>

    {#if $lcdSchedule.autoRestoreEnabled}
      <div class="field">
        <SelectField
          id="settings-system-lcd-autorestore-at"
          label="At"
          options={TIME_OPTIONS}
          value={$lcdSchedule.autoRestoreAt}
          onchange={(next) => lcdScheduleActions.update({ autoRestoreAt: next })}
        />
      </div>
      <p class="block-hint">
        The panel comes back to the clock, not the full UI. Touch it to get the
        player back.
      </p>
    {/if}
  </div>

  <!-- Standby block -->
  <div class="block">
    <p class="block-label">Standby</p>
    <button
      type="button"
      class="power-btn"
      data-testid="system-standby-now"
      onclick={() => standbyActions.enter()}
    >
      Standby now
    </button>
    <p class="block-hint">Shows the clock. Touch the screen to wake it.</p>

    <div class="field">
      <label class="field-label" for="settings-system-standby-brightness">
        Clock brightness
        <span class="field-value mono">{$standbyBrightness}%</span>
      </label>
      <input
        id="settings-system-standby-brightness"
        data-testid="system-standby-brightness"
        type="range"
        min="8"
        max="100"
        step="1"
        value={$standbyBrightness}
        oninput={handleBrightnessInput}
      />
    </div>

    <div class="field">
      <SelectField
        id="settings-system-standby-idle"
        label="Go to standby when idle"
        options={IDLE_OPTIONS}
        value={idleValue}
        onchange={handleIdleChange}
      />
    </div>
  </div>

  <!-- Power block -->
  <div class="block">
    <p class="block-label">Power</p>
    <div class="power-buttons">
      <button
        type="button"
        class="power-btn"
        data-testid="system-reboot"
        onclick={() => { rebootOpen = true; }}
      >
        Reboot Stellar
      </button>
      <button
        type="button"
        class="power-btn destructive"
        data-testid="system-shutdown"
        onclick={() => { shutdownOpen = true; }}
      >
        Shutdown Stellar
      </button>
    </div>
    {#if powerError}
      <p class="power-error" role="alert" data-testid="system-power-error">{powerError}</p>
    {/if}
  </div>
</section>

<!-- Reboot dialog -->
<ConfirmDialog
  open={rebootOpen}
  title="Reboot Stellar?"
  message="The streamer will restart. Playback will stop."
  confirmLabel="Reboot"
  oncancel={handleRebootCancel}
  onconfirm={handleRebootConfirm}
/>

<!-- Shutdown dialog -->
<ConfirmDialog
  open={shutdownOpen}
  title="Shutdown Stellar?"
  message="The streamer will power off. You'll need physical access to turn it back on."
  confirmLabel="Shutdown"
  destructive
  oncancel={handleShutdownCancel}
  onconfirm={handleShutdownConfirm}
/>

<style>
  .system-settings {
    padding: 24px;
    overflow-y: auto;
    height: 100%;
  }

  .column-title {
    color: var(--color-text-primary);
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 24px;
  }

  .block {
    margin-bottom: 24px;
  }

  .block-label {
    color: var(--color-text-secondary);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 10px;
  }

  .info-list {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 16px;
  }

  dt {
    color: var(--color-text-secondary);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    align-self: baseline;
    padding-bottom: 8px;
  }

  dd {
    color: var(--color-text-primary);
    font-size: 14px;
    margin: 0 0 8px;
  }

  .mono {
    font-family: monospace;
  }

  .block-hint {
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1.4;
    margin: 8px 0 0;
  }

  .field {
    margin-top: 16px;
  }

  .field-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    color: var(--color-text-secondary);
    font-size: 13px;
    margin-bottom: 8px;
  }

  .field-value {
    color: var(--color-text-primary);
    font-size: 13px;
  }

  input[type='range'] {
    width: 100%;
    /* The kiosk is touch-only: the default 4px track is unhittable with a
       fingertip, so the input itself carries the hit target and the track is
       drawn inside it. */
    height: var(--hit-target-min);
    background: transparent;
    accent-color: var(--color-accent-bright);
    cursor: pointer;
  }

  input[type='range']:focus-visible {
    outline: 2px solid var(--color-accent-bright);
    outline-offset: 2px;
  }

  .power-error {
    color: var(--color-error);
    font-size: 14px;
    margin: 12px 0 0;
  }

  .network-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .network-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  }

  .network-badge.online {
    background: rgba(34, 166, 109, 0.18);
    color: #4ade80;
  }

  .network-badge.offline {
    background: rgba(208, 69, 69, 0.18);
    color: #ff8080;
  }

  .network-ip {
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .power-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .power-btn {
    width: 100%;
    min-height: var(--hit-target-min);
    border: 1px solid var(--color-text-secondary);
    background: transparent;
    color: var(--color-text-primary);
    border-radius: var(--radius-card);
    padding: 0 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
  }

  .power-btn:focus-visible {
    outline: 2px solid var(--color-accent-bright);
    outline-offset: 2px;
  }

  .power-btn.destructive {
    border-color: #f06060;
    color: #ff8080;
  }

  .power-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .power-btn.destructive:hover {
    background: rgba(208, 69, 69, 0.1);
  }
</style>
