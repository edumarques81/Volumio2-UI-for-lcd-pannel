<script lang="ts">
  import { onMount } from 'svelte';
  import {
    systemInfo,
    networkStatus,
    audioOutputs,
    lcdStandbyMode,
    settingsActions,
    type LcdStandbyMode
  } from '$lib/stores/settings';
  import {
    libraryCacheStatus,
    libraryCacheBuilding,
    libraryActions
  } from '$lib/stores/library';
  import {
    activeEngine,
    engineSwitching,
    audioEngineState,
    audioEngineActions
  } from '$lib/stores/audioEngine';
  import { audirvanaInstalled, audirvanaService } from '$lib/stores/audirvana';
  import { IconAudirvana, IconMusicNote } from '$lib/components/icons';
  import NasManager from './NasManager.svelte';
  import { socketService } from '$lib/services/socket';
  import { lcdActions } from '$lib/stores/lcd';

  let brightness = 100;
  let showScrollIndicator = true;
  let settingsContainer: HTMLDivElement;

  // Max external client connections
  // TODO: Wire to backend when setMaxClients/pushMaxClients events are implemented
  let maxClients = 2;

  function handleSettingsScroll() {
    if (!settingsContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = settingsContainer;
    // Hide gradient when within 10px of bottom
    showScrollIndicator = scrollHeight - scrollTop - clientHeight > 10;
  }

  function handleSwitchEngine(engine: 'mpd' | 'audirvana') {
    audioEngineActions.switchTo(engine);
  }

  function handleBrightnessChange() {
    // Apply brightness via CSS filter on the root element
    if (typeof document !== 'undefined') {
      document.documentElement.style.filter = brightness < 100 ? `brightness(${brightness / 100})` : '';
    }
  }

  function handleStandbyChange(mode: LcdStandbyMode) {
    settingsActions.setLcdStandbyMode(mode);
  }

  function handleAudioOutput(outputId: string) {
    settingsActions.setAudioOutput(outputId);
  }

  function handleMaxClientsChange() {
    // TODO: Emit socket event when backend supports it
    // socketService.emit('setMaxClients', { value: maxClients });
    console.log('[Settings] Max clients set to:', maxClients);
  }

  // Power controls with inline confirm
  type PowerAction = 'lcdOff' | 'restart' | 'shutdown';
  let confirmingAction: PowerAction | null = null;
  let confirmTimeout: ReturnType<typeof setTimeout> | null = null;
  let shutdownNotice = '';

  function requestPowerAction(action: PowerAction) {
    if (confirmingAction === action) {
      // Second tap — execute
      clearConfirmTimeout();
      confirmingAction = null;
      switch (action) {
        case 'lcdOff':
          lcdActions.turnOff();
          break;
        case 'restart':
          settingsActions.restart();
          break;
        case 'shutdown':
          settingsActions.shutdown();
          break;
      }
    } else {
      // First tap — arm confirm
      clearConfirmTimeout();
      confirmingAction = action;
      confirmTimeout = setTimeout(() => {
        confirmingAction = null;
      }, 3000);
    }
  }

  function clearConfirmTimeout() {
    if (confirmTimeout) {
      clearTimeout(confirmTimeout);
      confirmTimeout = null;
    }
  }

  function handleRebuildCache() {
    libraryActions.rebuildCache();
  }

  function handleRescan() {
    settingsActions.rescanLibrary();
  }

  onMount(() => {
    settingsActions.getSystemInfo();
    settingsActions.getNetworkStatus();
    libraryActions.getCacheStatus();

    // Listen for shutdown/reboot notices
    socketService.on<{ action: string; message: string }>('pushShutdownNotice', (data) => {
      shutdownNotice = data.message;
    });

    return () => {
      clearConfirmTimeout();
    };
  });
</script>

<div class="settings-wrapper">
<div class="settings-tab" bind:this={settingsContainer} on:scroll={handleSettingsScroll}>
  <!-- Audio Engine Section -->
  <div class="settings-section">
    <div class="section-header">Audio Engine</div>

    <div class="setting-row engine-status">
      <span class="setting-label">Active</span>
      <span class="setting-value engine-value">
        {#if $activeEngine === 'audirvana'}
          <IconAudirvana size={14} />
          Audirvana
        {:else}
          <IconMusicNote size={14} />
          MPD
        {/if}
      </span>
    </div>

    <div class="setting-row">
      <div class="engine-toggle-group">
        <button
          class="engine-toggle-btn"
          class:active={$activeEngine === 'mpd'}
          disabled={$engineSwitching || $activeEngine === 'mpd'}
          on:click={() => handleSwitchEngine('mpd')}
        >
          <IconMusicNote size={14} />
          MPD
        </button>
        <button
          class="engine-toggle-btn"
          class:active={$activeEngine === 'audirvana'}
          disabled={$engineSwitching || $activeEngine === 'audirvana' || !$audirvanaInstalled}
          on:click={() => handleSwitchEngine('audirvana')}
        >
          <IconAudirvana size={14} />
          Audirvana
        </button>
      </div>
    </div>

    {#if $engineSwitching}
      <div class="setting-row">
        <span class="setting-label muted switching-indicator">Switching…</span>
      </div>
    {/if}

    {#if $audioEngineState.error}
      <div class="setting-row">
        <span class="setting-label engine-error">{$audioEngineState.error}</span>
      </div>
    {/if}

    {#if $audirvanaInstalled}
      <div class="setting-row">
        <span class="setting-label muted">Service</span>
        <span class="setting-value" class:online={$audirvanaService.running}>
          {$audirvanaService.running ? 'Running' : 'Stopped'}
        </span>
      </div>
    {:else}
      <div class="setting-row">
        <span class="setting-label muted">Audirvana not installed</span>
      </div>
    {/if}
  </div>

  <!-- Display Section -->
  <div class="settings-section">
    <div class="section-header">Display</div>

    <div class="setting-row">
      <label class="setting-label" for="brightness">LCD Brightness</label>
      <div class="slider-wrap">
        <input
          id="brightness"
          type="range"
          min="10"
          max="100"
          bind:value={brightness}
          on:input={handleBrightnessChange}
          class="slider"
          aria-label="LCD Brightness"
        />
        <span class="slider-value">{brightness}%</span>
      </div>
    </div>

    <div class="setting-row">
      <span class="setting-label">Standby Mode</span>
      <div class="toggle-group">
        <button
          class="toggle-btn"
          class:active={$lcdStandbyMode === 'css'}
          on:click={() => handleStandbyChange('css')}
        >Dimmed</button>
        <button
          class="toggle-btn"
          class:active={$lcdStandbyMode === 'hardware'}
          on:click={() => handleStandbyChange('hardware')}
        >Off</button>
      </div>
    </div>
  </div>

  <!-- Audio Section -->
  <div class="settings-section">
    <div class="section-header">Audio Output</div>
    {#if $audioOutputs.length > 0}
      {#each $audioOutputs as output (output.id)}
        <button
          class="setting-row selectable"
          class:selected={output.enabled}
          on:click={() => handleAudioOutput(output.id)}
        >
          <span class="setting-label">{output.name}</span>
          {#if output.enabled}
            <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
        </button>
      {/each}
    {:else}
      <div class="setting-row selected">
        <span class="setting-label">System Default (MPD)</span>
        <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    {/if}
  </div>

  <!-- Library Section -->
  <div class="settings-section">
    <div class="section-header">Library</div>

    {#if $libraryCacheStatus}
      <div class="setting-row">
        <span class="setting-label muted">
          {$libraryCacheStatus.albumCount} albums · {$libraryCacheStatus.artistCount} artists · {$libraryCacheStatus.trackCount} tracks
        </span>
      </div>
    {/if}

    <div class="setting-row actions">
      <button class="action-btn" on:click={handleRebuildCache} disabled={$libraryCacheBuilding}>
        {#if $libraryCacheBuilding}
          Rebuilding...
        {:else}
          Rebuild Cache
        {/if}
      </button>
      <button class="action-btn" on:click={handleRescan}>
        Rescan Library
      </button>
    </div>
  </div>

  <!-- Sources (NAS) Section -->
  <div class="settings-section">
    <div class="section-header">Sources</div>
    <NasManager />
  </div>

  <!-- Connections Section -->
  <div class="settings-section">
    <div class="section-header">Connections</div>
    <div class="setting-row">
      <div class="max-clients-field">
        <label class="setting-label" for="settings-max-clients">Max External Clients</label>
        <span class="setting-description">Maximum number of devices that can connect simultaneously</span>
      </div>
      <div class="slider-wrap">
        <input
          id="settings-max-clients"
          type="range"
          min="1"
          max="10"
          bind:value={maxClients}
          on:change={handleMaxClientsChange}
          class="slider"
          aria-label="Max External Clients"
        />
        <span class="slider-value">{maxClients}</span>
      </div>
    </div>
  </div>

  <!-- Network Section -->
  <div class="settings-section">
    <div class="section-header">Network</div>
    <div class="setting-row">
      <span class="setting-label">Status</span>
      <span class="setting-value" class:online={$networkStatus?.online}>
        {$networkStatus?.online ? 'Connected' : 'Offline'}
      </span>
    </div>
    {#if $networkStatus?.ip || $systemInfo?.host}
      <div class="setting-row">
        <span class="setting-label">Host</span>
        <span class="setting-value mono">{$networkStatus?.ip || $systemInfo?.host || ''}</span>
      </div>
    {/if}
  </div>

  <!-- System Section -->
  {#if $systemInfo}
    <div class="settings-section">
      <div class="section-header">System</div>
      <div class="setting-row">
        <span class="setting-label">Device</span>
        <span class="setting-value">{$systemInfo.name}</span>
      </div>
      <div class="setting-row">
        <span class="setting-label">Version</span>
        <span class="setting-value mono">{$systemInfo.systemversion}</span>
      </div>
      <div class="setting-row">
        <span class="setting-label">Hardware</span>
        <span class="setting-value">{$systemInfo.hardware}</span>
      </div>
    </div>
  {/if}

  <!-- Power Section -->
  <div class="settings-section">
    <div class="section-header">⚡ Power</div>

    {#if shutdownNotice}
      <div class="setting-row shutdown-notice">
        <span class="setting-label">{shutdownNotice}</span>
      </div>
    {/if}

    <div class="setting-row power-row">
      <button
        class="power-btn"
        class:confirming={confirmingAction === 'lcdOff'}
        on:click={() => requestPowerAction('lcdOff')}
      >
        {confirmingAction === 'lcdOff' ? '🌙 Confirm?' : '🌙 LCD Off'}
      </button>
      <button
        class="power-btn"
        class:confirming={confirmingAction === 'restart'}
        on:click={() => requestPowerAction('restart')}
      >
        {confirmingAction === 'restart' ? '🔄 Confirm?' : '🔄 Restart'}
      </button>
      <button
        class="power-btn danger"
        class:confirming={confirmingAction === 'shutdown'}
        on:click={() => requestPowerAction('shutdown')}
      >
        {confirmingAction === 'shutdown' ? '⏻ Are you sure?' : '⏻ Shutdown'}
      </button>
    </div>
    <div class="setting-row">
      <span class="setting-label muted">LCD off → use mobile app to wake. Shutdown → needs physical power cycle.</span>
    </div>
  </div>
</div>
{#if showScrollIndicator}
  <div class="scroll-indicator"></div>
{/if}
</div>

<style>
  .settings-wrapper {
    position: relative;
    height: 100%;
    overflow: hidden;
  }

  .scroll-indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40px;
    background: linear-gradient(transparent, var(--md-surface, #1A1114));
    pointer-events: none;
    z-index: 1;
  }

  .settings-tab {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--md-outline-variant) transparent;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-header {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--md-outline);
    padding: 0 2px 6px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: var(--md-shape-xs, 4px);
    min-height: 44px;
    gap: 12px;
  }
  .setting-row.selectable {
    cursor: pointer;
    border: none;
    background: none;
    color: var(--md-on-surface);
    font-family: inherit;
    width: 100%;
    text-align: left;
    transition: background 200ms ease-out;
  }
  .setting-row.selectable:hover {
    background: rgba(255, 177, 200, 0.06);
  }
  .setting-row.selected {
    background: rgba(123, 41, 73, 0.2);
  }
  .setting-row.actions {
    gap: 8px;
    justify-content: flex-start;
  }

  .setting-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--md-on-surface);
    white-space: nowrap;
  }
  .setting-label.muted {
    color: var(--md-outline);
    font-size: 11px;
  }

  .setting-value {
    font-size: 14px;
    color: var(--md-on-surface-variant);
  }
  .setting-value.mono {
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
  }
  .setting-value.online {
    color: var(--stellar-status-online, #81C784);
  }

  .check-icon {
    color: var(--md-primary);
    flex-shrink: 0;
  }

  .slider-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    max-width: 200px;
  }
  .slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--md-outline-variant);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--md-secondary, #E3BDC6);
    cursor: pointer;
  }
  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--md-secondary, #E3BDC6);
    cursor: pointer;
    border: none;
  }
  .slider-value {
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    color: var(--md-outline);
    min-width: 32px;
    text-align: right;
  }

  .toggle-group {
    display: flex;
    gap: 2px;
    background: rgba(26, 17, 20, 0.6);
    border-radius: var(--md-shape-full, 9999px);
    padding: 2px;
  }
  .toggle-btn {
    padding: 5px 12px;
    border-radius: var(--md-shape-full, 9999px);
    border: none;
    background: transparent;
    color: var(--md-outline);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease-out;
    min-height: 32px;
  }
  .toggle-btn.active {
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
  }
  .toggle-btn:hover:not(.active) {
    color: var(--md-on-surface-variant);
  }

  /* ── Engine Switcher ── */
  .engine-status .engine-value {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--md-primary, #FFB1C8);
    font-weight: 600;
  }

  .engine-toggle-group {
    display: flex;
    gap: 2px;
    background: rgba(26, 17, 20, 0.6);
    border-radius: var(--md-shape-full, 9999px);
    padding: 2px;
    width: 100%;
  }

  .engine-toggle-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: var(--md-shape-full, 9999px);
    border: none;
    background: transparent;
    color: var(--md-outline);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease-out;
    min-height: 44px;
  }

  .engine-toggle-btn.active {
    background: var(--md-primary-container, #7B2949);
    color: var(--md-on-primary-container, #FFD9E3);
  }

  .engine-toggle-btn:hover:not(.active):not(:disabled) {
    color: var(--md-on-surface-variant);
    background: rgba(255, 177, 200, 0.06);
  }

  .engine-toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .switching-indicator {
    font-style: italic;
    animation: pulse-switch 1.2s ease-in-out infinite;
  }

  @keyframes pulse-switch {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .engine-error {
    color: var(--md-error, #FFB4AB);
    font-size: 11px;
    word-break: break-word;
  }

  .action-btn {
    padding: 8px 16px;
    border-radius: var(--md-shape-full, 9999px);
    border: 1px solid var(--md-outline-variant);
    background: transparent;
    color: var(--md-on-surface-variant);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease-out;
    min-height: 36px;
  }
  .action-btn:hover:not(:disabled) {
    background: rgba(255, 177, 200, 0.06);
    color: var(--md-primary);
    border-color: var(--md-primary);
  }
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .max-clients-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-description {
    font-size: 10px;
    color: var(--md-outline);
    line-height: 1.3;
  }

  /* Power section */
  .power-row {
    display: flex;
    gap: 8px;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  .power-btn {
    padding: 8px 16px;
    border-radius: var(--md-shape-full, 9999px);
    border: 1px solid var(--md-outline-variant);
    background: transparent;
    color: var(--md-on-surface-variant);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease-out;
    min-height: 36px;
    white-space: nowrap;
  }
  .power-btn:hover {
    background: rgba(255, 177, 200, 0.06);
    border-color: var(--md-primary);
    color: var(--md-primary);
  }
  .power-btn.confirming {
    background: rgba(255, 177, 200, 0.15);
    border-color: var(--md-primary);
    color: var(--md-primary);
    animation: pulse-confirm 1s ease-in-out infinite;
  }
  .power-btn.danger.confirming {
    background: rgba(255, 80, 80, 0.2);
    border-color: var(--md-error, #FFB4AB);
    color: var(--md-error, #FFB4AB);
  }
  @keyframes pulse-confirm {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .shutdown-notice {
    background: rgba(255, 177, 200, 0.1);
    border-radius: var(--md-shape-xs, 4px);
    animation: pulse-confirm 1.5s ease-in-out infinite;
  }
</style>
