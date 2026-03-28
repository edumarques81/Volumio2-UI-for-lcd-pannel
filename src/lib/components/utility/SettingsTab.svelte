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

  let brightness = 100;
  let showScrollIndicator = true;
  let settingsContainer: HTMLDivElement;

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
      <div class="setting-row">
        <span class="setting-label muted">No outputs detected</span>
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

  <!-- Network Section -->
  <div class="settings-section">
    <div class="section-header">Network</div>
    <div class="setting-row">
      <span class="setting-label">Status</span>
      <span class="setting-value" class:online={$networkStatus?.online}>
        {$networkStatus?.online ? 'Online' : 'Offline'}
      </span>
    </div>
    {#if $networkStatus?.ip}
      <div class="setting-row">
        <span class="setting-label">IP</span>
        <span class="setting-value mono">{$networkStatus.ip}</span>
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
</style>
