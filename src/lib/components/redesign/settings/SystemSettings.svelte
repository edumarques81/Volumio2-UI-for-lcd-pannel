<script lang="ts">
  import Toggle from '$lib/components/redesign/controls/Toggle.svelte';
  import ConfirmDialog from '$lib/components/redesign/settings/ConfirmDialog.svelte';
  import { systemInfo, networkStatus } from '$lib/stores/settings';
  import { settingsActions } from '$lib/stores/settings';
  import { isLcdOn, lcdActions, lcdLoading } from '$lib/stores/lcd';
  import { frontendVersion, backendVersion } from '$lib/stores/version';
  import { getVolumioHost } from '$lib/config';

  // Local dialog state
  let rebootOpen = $state(false);
  let shutdownOpen = $state(false);

  // Derived values
  const backendUrl = getVolumioHost();

  function handleLcdChange(next: boolean): void {
    if (next) {
      lcdActions.turnOn();
    } else {
      lcdActions.turnOff();
    }
  }

  function handleRebootConfirm(): void {
    settingsActions.restart();
    rebootOpen = false;
  }

  function handleRebootCancel(): void {
    rebootOpen = false;
  }

  function handleShutdownConfirm(): void {
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
