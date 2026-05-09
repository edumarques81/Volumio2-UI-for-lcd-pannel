<script lang="ts">
  import SelectField from '$lib/components/redesign/controls/SelectField.svelte';
  import RadioGroup from '$lib/components/redesign/controls/RadioGroup.svelte';
  import Toggle from '$lib/components/redesign/controls/Toggle.svelte';
  import {
    dsdMode,
    dsdModeLoading,
    mixerEnabled,
    mixerLoading,
    bitPerfectConfig,
    applyBitPerfectLoading,
    audioActions,
  } from '$lib/stores/audio';
  import {
    audioDevices,
    audioDevicesLoading,
    selectedAudioOutput,
    audioDevicesActions,
    type AudioDevice,
  } from '$lib/stores/audioDevices';

  import type { SelectFieldOption } from '$lib/components/redesign/controls/SelectField.svelte';
  import type { RadioGroupOption } from '$lib/components/redesign/controls/RadioGroup.svelte';

  // ---------------------------------------------------------------------------
  // DSD options (static, defined once)
  // ---------------------------------------------------------------------------
  const DSD_OPTIONS: ReadonlyArray<RadioGroupOption<'native' | 'dop'>> = [
    {
      value: 'native',
      label: 'Native',
      description: 'Direct DSD output (requires native-DSD-capable DAC)',
    },
    {
      value: 'dop',
      label: 'DoP',
      description: 'DSD over PCM — universal compatibility',
    },
  ];

  // ---------------------------------------------------------------------------
  // Derived: device options for SelectField
  // ---------------------------------------------------------------------------
  const deviceOptions = $derived(
    $audioDevices.map(
      (d: AudioDevice): SelectFieldOption => ({
        value: d.id,
        label: d.connected ? d.name : `${d.name} (disconnected)`,
        disabled: !d.connected,
      })
    )
  );
</script>

<section class="audio-settings">
  <h2 class="column-title">Audio</h2>

  <!-- ── Output device ──────────────────────────────────────────────────── -->
  <div class="block">
    <p class="block-label">Output device</p>
    <div data-testid="audio-output-select">
      <SelectField
        id="settings-audio-output-device"
        ariaLabel="Audio output device"
        options={deviceOptions}
        value={$selectedAudioOutput}
        onchange={audioDevicesActions.setOutput}
        placeholder="Select device…"
      />
    </div>
    {#if $audioDevicesLoading}
      <p class="loading-text">Loading…</p>
    {/if}
  </div>

  <!-- ── Bit-perfect status ──────────────────────────────────────────────── -->
  {#if $bitPerfectConfig !== null}
    <div class="block">
      <p class="block-label">Bit-perfect status</p>

      <span
        class="status-badge"
        class:status-ok={$bitPerfectConfig.status === 'ok'}
        class:status-warning={$bitPerfectConfig.status === 'warning'}
        class:status-error={$bitPerfectConfig.status === 'error'}
      >
        {$bitPerfectConfig.status}
      </span>

      {#if $bitPerfectConfig.issues.length > 0}
        <ul class="issues-list">
          {#each $bitPerfectConfig.issues as issue}
            <li>{issue}</li>
          {/each}
        </ul>
      {/if}

      <button
        type="button"
        class="apply-btn"
        disabled={$applyBitPerfectLoading}
        onclick={audioActions.applyBitPerfect}
      >
        Apply optimal settings
      </button>
    </div>
  {/if}

  <!-- ── DSD mode ────────────────────────────────────────────────────────── -->
  <div class="block">
    <p class="block-label">DSD playback</p>
    <RadioGroup
      id="settings-audio-dsd"
      options={DSD_OPTIONS}
      value={$dsdMode}
      onchange={audioActions.setDsdMode}
      ariaLabel="DSD playback mode"
    />
    {#if $dsdModeLoading}
      <p class="loading-text">Switching…</p>
    {/if}
  </div>

  <!-- ── Mixer ───────────────────────────────────────────────────────────── -->
  <div class="block">
    <Toggle
      id="settings-audio-mixer"
      pressed={$mixerEnabled}
      onchange={audioActions.setMixerMode}
      ariaLabel="Software mixer"
      label="Enable software mixer"
      loading={$mixerLoading}
    />
  </div>
</section>

<style>
  .audio-settings {
    padding: 24px;
    overflow-y: auto;
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
    margin: 0 0 8px;
  }

  /* ── Status badge ── */
  .status-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-ok {
    background: rgba(34, 166, 109, 0.18);
    color: #4ade80;
  }

  .status-warning {
    background: rgba(245, 210, 80, 0.18);
    color: #fbbf24;
  }

  .status-error {
    background: rgba(208, 69, 69, 0.18);
    color: #ff8080;
  }

  /* ── Issues list ── */
  .issues-list {
    color: var(--color-text-primary);
    font-size: 13px;
    margin: 8px 0 12px;
    padding-left: 20px;
  }

  /* ── Apply button ── */
  .apply-btn {
    display: inline-flex;
    align-items: center;
    background: var(--color-accent);
    color: var(--color-bg-base);
    border: 1px solid var(--color-accent-bright);
    border-radius: var(--radius-card);
    min-height: var(--hit-target-min);
    padding: 0 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 12px;
  }

  .apply-btn:disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  /* ── Loading text ── */
  .loading-text {
    color: var(--color-text-secondary);
    font-size: 12px;
    font-style: italic;
    margin-top: 6px;
  }
</style>
