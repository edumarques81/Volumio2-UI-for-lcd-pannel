<script lang="ts">
  import Toggle from '$lib/components/redesign/controls/Toggle.svelte';
  import SelectField from '$lib/components/redesign/controls/SelectField.svelte';
  import { isLcdOn, lcdActions, lcdLoading } from '$lib/stores/lcd';
  import { lcdSchedule, lcdScheduleActions } from '$lib/stores/lcdSchedule';
  import {
    standbyBrightness,
    standbyIdleMinutes,
    standbyActions
  } from '$lib/stores/standby';

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
</script>

<section class="display-settings">
  <h2 class="column-title">Display</h2>

  <!-- Panel block -->
  <div class="block">
    <p class="block-label">Panel</p>
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
</section>

<style>
  .display-settings {
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

  .mono {
    font-family: monospace;
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

  .power-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }
</style>
