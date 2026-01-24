<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { layoutMode, navigationActions } from '$lib/stores/navigation';
  import {
    systemInfo,
    settingsCategories,
    currentSettingsCategory,
    settingsActions,
    availableBackgrounds,
    selectedBackground,
    type SettingsCategory
  } from '$lib/stores/settings';
  import { networkStatus, isConnected } from '$lib/stores/network';
  import {
    audioDevices,
    audioDevicesLoading,
    selectedAudioOutput,
    audioDevicesByCategory,
    audioDevicesActions
  } from '$lib/stores/audioDevices';
  import {
    frontendVersion,
    backendVersion,
    backendVersionLoading,
    initVersionStore,
    cleanupVersionStore
  } from '$lib/stores/version';
  import {
    bitPerfectConfig,
    isBitPerfectConfigOk,
    audioActions,
    initAudioStore,
    cleanupAudioStore,
    dsdMode,
    dsdModeLoading
  } from '$lib/stores/audio';
  import Icon from '../Icon.svelte';

  let bitPerfectLoading = false;

  let audioDevicesCleanup: (() => void) | null = null;

  function handleCategoryClick(category: SettingsCategory) {
    settingsActions.openCategory(category.id);
  }

  function handleBack() {
    settingsActions.backToRoot();
  }

  function handleLayoutToggle() {
    settingsActions.toggleLayoutMode();
  }

  function handleRestart() {
    if (confirm('Restart Volumio?')) {
      settingsActions.restart();
    }
  }

  function handleShutdown() {
    if (confirm('Shutdown Volumio?')) {
      settingsActions.shutdown();
    }
  }

  function handleRescan() {
    settingsActions.rescanLibrary();
  }

  function handleBackgroundSelect(path: string) {
    settingsActions.setBackground(path);
  }

  function handleClearBackground() {
    settingsActions.clearBackground();
  }

  onMount(() => {
    settingsActions.getSystemInfo();
    settingsActions.getNetworkStatus();
    audioDevicesCleanup = audioDevicesActions.init();
    initVersionStore();
    initAudioStore();
  });

  onDestroy(() => {
    audioDevicesCleanup?.();
    cleanupVersionStore();
    cleanupAudioStore();
  });

  function handleAudioOutputSelect(deviceId: string) {
    audioDevicesActions.setOutput(deviceId);
  }

  function handleRefreshBitPerfect() {
    bitPerfectLoading = true;
    audioActions.getBitPerfectConfig();
    // Reset loading state after a timeout (the store will be updated by pushBitPerfect)
    setTimeout(() => {
      bitPerfectLoading = false;
    }, 2000);
  }
</script>

<div class="settings-view" data-view="settings">
  <!-- Header -->
  <header class="settings-header">
    <div class="header-left">
      <button class="back-btn" on:click={$currentSettingsCategory ? handleBack : navigationActions.goHome} aria-label={$currentSettingsCategory ? 'Go back to categories' : 'Back to home'} data-testid={$currentSettingsCategory ? 'settings-back' : 'home-back'}>
        <Icon name="chevron-left" size={32} />
      </button>
      <h1 class="title">
        {$currentSettingsCategory
          ? settingsCategories.find(c => c.id === $currentSettingsCategory)?.title || 'Settings'
          : 'Settings'}
      </h1>
    </div>
  </header>

  <!-- Content -->
  <div class="settings-content">
    {#if !$currentSettingsCategory}
      <!-- Settings Categories -->
      <div class="categories-grid">
        {#each settingsCategories as category}
          <button class="category-card" on:click={() => handleCategoryClick(category)}>
            <div class="category-icon">
              <Icon name={category.icon} size={32} />
            </div>
            <div class="category-info">
              <span class="category-title">{category.title}</span>
              <span class="category-desc">{category.description}</span>
            </div>
            <Icon name="chevron-right" size={24} />
          </button>
        {/each}
      </div>
    {:else if $currentSettingsCategory === 'appearance'}
      <!-- Appearance Settings -->
      <div class="settings-section">
        <h2 class="section-title">Background</h2>
        <p class="section-hint">Choose a background image or use album art</p>

        <div class="backgrounds-scroll" data-testid="background-selector">
          <!-- Album Art Option -->
          <button
            class="bg-option"
            class:selected={!$selectedBackground}
            on:click={handleClearBackground}
          >
            <div class="bg-preview album-art-preview">
              <Icon name="album" size={32} />
            </div>
            <span class="bg-label">Album Art</span>
          </button>

          <!-- Background Images -->
          {#each $availableBackgrounds as bg}
            <button
              class="bg-option"
              class:selected={$selectedBackground === bg.path}
              on:click={() => handleBackgroundSelect(bg.path)}
            >
              <img
                class="bg-preview"
                src={bg.thumbnail}
                alt={bg.name}
                loading="lazy"
              />
              <span class="bg-label">{bg.name}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">Display</h2>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Layout Mode</span>
            <span class="setting-desc">Choose how views are displayed</span>
          </div>
          <div class="layout-toggle">
            <button
              class="toggle-option"
              class:active={$layoutMode === 'full'}
              on:click={() => settingsActions.setLayoutMode('full')}
            >
              <Icon name="fullscreen" size={20} />
              Full Screen
            </button>
            <button
              class="toggle-option"
              class:active={$layoutMode === 'compact'}
              on:click={() => settingsActions.setLayoutMode('compact')}
            >
              <Icon name="compact" size={20} />
              Compact
            </button>
          </div>
        </div>
      </div>
    {:else if $currentSettingsCategory === 'playback'}
      <!-- Playback Settings -->
      <div class="settings-section" data-testid="audio-output-section">
        <h2 class="section-title">Audio Output</h2>
        <p class="section-hint">Select your audio output device</p>

        {#if $audioDevicesLoading}
          <div class="placeholder">
            <div class="spinner"></div>
            <p>Loading audio devices...</p>
          </div>
        {:else}
          <div class="audio-output-list" data-testid="audio-output-list">
            <!-- USB Devices -->
            {#if $audioDevicesByCategory.usb.length > 0}
              <div class="output-category" data-testid="output-category-usb">
                <h3 class="category-label">
                  <Icon name="usb" size={18} />
                  USB Audio
                </h3>
                {#each $audioDevicesByCategory.usb as device}
                  <button
                    class="audio-output-option"
                    class:selected={$selectedAudioOutput === device.id}
                    class:disabled={!device.connected}
                    data-testid="audio-output-option"
                    data-selected={$selectedAudioOutput === device.id}
                    data-disabled={!device.connected}
                    on:click={() => device.connected && handleAudioOutputSelect(device.id)}
                    disabled={!device.connected}
                  >
                    <div class="output-info">
                      <span class="output-name" data-testid="device-name">{device.name}</span>
                      {#if !device.connected}
                        <span class="output-status">Not connected</span>
                      {/if}
                    </div>
                    {#if $selectedAudioOutput === device.id}
                      <Icon name="check" size={20} />
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}

            <!-- HDMI Devices -->
            {#if $audioDevicesByCategory.hdmi.length > 0}
              <div class="output-category" data-testid="output-category-hdmi">
                <h3 class="category-label">
                  <Icon name="monitor" size={18} />
                  HDMI Audio
                </h3>
                {#each $audioDevicesByCategory.hdmi as device}
                  <button
                    class="audio-output-option"
                    class:selected={$selectedAudioOutput === device.id}
                    class:disabled={!device.connected}
                    data-testid="audio-output-option"
                    data-selected={$selectedAudioOutput === device.id}
                    data-disabled={!device.connected}
                    on:click={() => device.connected && handleAudioOutputSelect(device.id)}
                    disabled={!device.connected}
                  >
                    <div class="output-info">
                      <span class="output-name" data-testid="device-name">{device.name}</span>
                      {#if !device.connected}
                        <span class="output-status">Not connected</span>
                      {/if}
                    </div>
                    {#if $selectedAudioOutput === device.id}
                      <Icon name="check" size={20} />
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}

            <!-- I2S/DAC Devices -->
            {#if $audioDevicesByCategory.i2s.length > 0}
              <div class="output-category" data-testid="output-category-i2s">
                <h3 class="category-label">
                  <Icon name="cpu" size={18} />
                  I2S / DAC
                </h3>
                {#each $audioDevicesByCategory.i2s as device}
                  <button
                    class="audio-output-option"
                    class:selected={$selectedAudioOutput === device.id}
                    class:disabled={!device.connected}
                    data-testid="audio-output-option"
                    data-selected={$selectedAudioOutput === device.id}
                    data-disabled={!device.connected}
                    on:click={() => device.connected && handleAudioOutputSelect(device.id)}
                    disabled={!device.connected}
                  >
                    <div class="output-info">
                      <span class="output-name" data-testid="device-name">{device.name}</span>
                      {#if !device.connected}
                        <span class="output-status">Not connected</span>
                      {/if}
                    </div>
                    {#if $selectedAudioOutput === device.id}
                      <Icon name="check" size={20} />
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}

            <!-- Other Devices -->
            {#if $audioDevicesByCategory.other.length > 0}
              <div class="output-category" data-testid="output-category-other">
                <h3 class="category-label">
                  <Icon name="speaker" size={18} />
                  Other
                </h3>
                {#each $audioDevicesByCategory.other as device}
                  <button
                    class="audio-output-option"
                    class:selected={$selectedAudioOutput === device.id}
                    class:disabled={!device.connected}
                    data-testid="audio-output-option"
                    data-selected={$selectedAudioOutput === device.id}
                    data-disabled={!device.connected}
                    on:click={() => device.connected && handleAudioOutputSelect(device.id)}
                    disabled={!device.connected}
                  >
                    <div class="output-info">
                      <span class="output-name" data-testid="device-name">{device.name}</span>
                      {#if !device.connected}
                        <span class="output-status">Not connected</span>
                      {/if}
                    </div>
                    {#if $selectedAudioOutput === device.id}
                      <Icon name="check" size={20} />
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}

            <!-- No devices -->
            {#if $audioDevices.length === 0}
              <div class="placeholder">
                <Icon name="volume-x" size={48} />
                <p>No audio devices found</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Bit-Perfect Audio Section -->
      <div class="settings-section" data-testid="bit-perfect-section">
        <div class="section-header">
          <h2 class="section-title">Bit-Perfect Audio</h2>
          <button
            class="refresh-btn"
            on:click={handleRefreshBitPerfect}
            disabled={bitPerfectLoading}
            aria-label="Refresh bit-perfect status"
          >
            <Icon name="refresh" size={18} />
          </button>
        </div>
        <p class="section-hint">Verify your audio path is configured for lossless playback</p>

        {#if bitPerfectLoading}
          <div class="placeholder">
            <div class="spinner"></div>
            <p>Checking configuration...</p>
          </div>
        {:else if $bitPerfectConfig}
          <!-- Status Badge -->
          <div class="bit-perfect-status" class:ok={$bitPerfectConfig.status === 'ok'} class:warning={$bitPerfectConfig.status === 'warning'} class:error={$bitPerfectConfig.status === 'error'}>
            <div class="status-icon">
              {#if $bitPerfectConfig.status === 'ok'}
                <Icon name="check-circle" size={24} />
              {:else if $bitPerfectConfig.status === 'warning'}
                <Icon name="alert-triangle" size={24} />
              {:else}
                <Icon name="x-circle" size={24} />
              {/if}
            </div>
            <div class="status-text">
              {#if $bitPerfectConfig.status === 'ok'}
                <span class="status-title">Bit-Perfect Enabled</span>
                <span class="status-desc">Audio is passing through without modification</span>
              {:else if $bitPerfectConfig.status === 'warning'}
                <span class="status-title">Potential Issues</span>
                <span class="status-desc">Some settings may affect audio quality</span>
              {:else}
                <span class="status-title">Not Bit-Perfect</span>
                <span class="status-desc">Audio may be resampled or modified</span>
              {/if}
            </div>
          </div>

          <!-- Issues -->
          {#if $bitPerfectConfig.issues.length > 0}
            <div class="issues-list">
              <h3 class="list-title">Issues</h3>
              {#each $bitPerfectConfig.issues as issue}
                <div class="issue-item error">
                  <Icon name="x-circle" size={16} />
                  <span>{issue}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Warnings -->
          {#if $bitPerfectConfig.warnings.length > 0}
            <div class="issues-list">
              <h3 class="list-title">Warnings</h3>
              {#each $bitPerfectConfig.warnings as warning}
                <div class="issue-item warning">
                  <Icon name="alert-triangle" size={16} />
                  <span>{warning}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Configuration Details -->
          {#if $bitPerfectConfig.config.length > 0}
            <div class="config-list">
              <h3 class="list-title">Current Configuration</h3>
              {#each $bitPerfectConfig.config as configItem}
                <div class="config-item">
                  <code>{configItem}</code>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="placeholder">
            <Icon name="settings" size={48} />
            <p>Tap refresh to check bit-perfect configuration</p>
            <button class="action-btn" on:click={handleRefreshBitPerfect}>
              <Icon name="refresh" size={20} />
              <span>Check Configuration</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- DSD Playback Mode Section -->
      <div class="settings-section" data-testid="dsd-mode-section">
        <h2 class="section-title">DSD Playback Mode</h2>
        <p class="section-hint">Choose how DSD files are sent to your DAC</p>

        <div class="dsd-mode-options">
          <button
            class="dsd-mode-option"
            class:selected={$dsdMode === 'native'}
            class:loading={$dsdModeLoading}
            disabled={$dsdModeLoading}
            on:click={() => audioActions.setDsdMode('native')}
          >
            <div class="option-radio" class:checked={$dsdMode === 'native'}></div>
            <div class="option-content">
              <span class="option-title">Native DSD</span>
              <span class="option-desc">Pure bit-perfect DSD stream. Requires DAC with native DSD support.</span>
            </div>
          </button>

          <button
            class="dsd-mode-option"
            class:selected={$dsdMode === 'dop'}
            class:loading={$dsdModeLoading}
            disabled={$dsdModeLoading}
            on:click={() => audioActions.setDsdMode('dop')}
          >
            <div class="option-radio" class:checked={$dsdMode === 'dop'}></div>
            <div class="option-content">
              <span class="option-title">DSD over PCM (DoP)</span>
              <span class="option-desc">DSD wrapped in PCM frames. Compatible with more DACs but not true bit-perfect.</span>
            </div>
          </button>
        </div>

        {#if $dsdModeLoading}
          <div class="mode-loading">
            <div class="spinner small"></div>
            <span>Applying changes...</span>
          </div>
        {/if}
      </div>
    {:else if $currentSettingsCategory === 'network'}
      <!-- Network Settings -->
      <div class="settings-section">
        <h2 class="section-title">Connection Status</h2>
        {#if $networkStatus}
          <div class="info-grid">
            <!-- Connection Status -->
            <div class="info-item">
              <span class="info-label">Status</span>
              <span class="info-value" class:online={$isConnected} class:offline={!$isConnected}>
                {$isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <!-- Connection Type -->
            <div class="info-item">
              <span class="info-label">Connection Type</span>
              <span class="info-value connection-type">
                {#if $networkStatus.type === 'wifi'}
                  <Icon name="wifi" size={18} />
                  <span>WiFi</span>
                {:else if $networkStatus.type === 'ethernet'}
                  <Icon name="ethernet" size={18} />
                  <span>Ethernet</span>
                {:else}
                  <Icon name="wifi-off" size={18} />
                  <span>None</span>
                {/if}
              </span>
            </div>

            <!-- WiFi-specific info -->
            {#if $networkStatus.type === 'wifi'}
              {#if $networkStatus.ssid}
                <div class="info-item">
                  <span class="info-label">Network Name</span>
                  <span class="info-value">{$networkStatus.ssid}</span>
                </div>
              {/if}
              <div class="info-item">
                <span class="info-label">Signal Strength</span>
                <span class="info-value signal-strength">
                  <span class="signal-bars">
                    <span class="bar" class:active={$networkStatus.strength >= 1}></span>
                    <span class="bar" class:active={$networkStatus.strength >= 2}></span>
                    <span class="bar" class:active={$networkStatus.strength >= 3}></span>
                  </span>
                  <span>{$networkStatus.signal}%</span>
                </span>
              </div>
            {/if}

            <!-- IP Address -->
            {#if $networkStatus.ip}
              <div class="info-item">
                <span class="info-label">IP Address</span>
                <span class="info-value mono">{$networkStatus.ip}</span>
              </div>
            {/if}
          </div>
        {:else}
          <div class="placeholder">
            <Icon name="wifi" size={48} />
            <p>Loading network status...</p>
          </div>
        {/if}
      </div>

      <!-- Device Access -->
      <div class="settings-section">
        <h2 class="section-title">Device Access</h2>
        <div class="info-grid">
          {#if $systemInfo?.host}
            <div class="info-item">
              <span class="info-label">Hostname</span>
              <span class="info-value mono">{$systemInfo.host}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Local Address</span>
              <span class="info-value mono">http://{$systemInfo.host}.local</span>
            </div>
          {/if}
          {#if $networkStatus?.ip}
            <div class="info-item">
              <span class="info-label">Direct Address</span>
              <span class="info-value mono">http://{$networkStatus.ip}</span>
            </div>
          {/if}
        </div>
      </div>
    {:else if $currentSettingsCategory === 'sources'}
      <!-- Music Sources -->
      <div class="settings-section">
        <h2 class="section-title">Music Sources</h2>
        <button class="action-btn" on:click={handleRescan}>
          <Icon name="refresh" size={24} />
          <span>Rescan Music Library</span>
        </button>
        <div class="placeholder">
          <Icon name="storage" size={48} />
          <p>NAS and streaming service configuration coming soon</p>
        </div>
      </div>
    {:else if $currentSettingsCategory === 'system'}
      <!-- System Settings -->
      <div class="settings-section">
        <h2 class="section-title">System Information</h2>
        {#if $systemInfo}
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Device Name</span>
              <span class="info-value">{$systemInfo.name}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Version</span>
              <span class="info-value">{$systemInfo.systemversion}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Hardware</span>
              <span class="info-value">{$systemInfo.hardware}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Build Date</span>
              <span class="info-value">{$systemInfo.builddate}</span>
            </div>
          </div>
        {:else}
          <div class="placeholder">
            <Icon name="info" size={48} />
            <p>Loading system info...</p>
          </div>
        {/if}
      </div>

      <div class="settings-section" data-testid="version-section">
        <h2 class="section-title">Version Info</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Frontend</span>
            <span class="info-value">{$frontendVersion.name} v{$frontendVersion.version}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Backend</span>
            {#if $backendVersionLoading}
              <span class="info-value loading">Loading...</span>
            {:else if $backendVersion}
              <span class="info-value">{$backendVersion.name} v{$backendVersion.version}</span>
            {:else}
              <span class="info-value error">Not connected</span>
            {/if}
          </div>
          {#if $backendVersion?.gitCommit}
            <div class="info-item">
              <span class="info-label">Backend Commit</span>
              <span class="info-value mono">{$backendVersion.gitCommit.slice(0, 7)}</span>
            </div>
          {/if}
          {#if $backendVersion?.buildTime}
            <div class="info-item">
              <span class="info-label">Backend Build</span>
              <span class="info-value">{$backendVersion.buildTime}</span>
            </div>
          {/if}
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">Power</h2>
        <div class="power-actions">
          <button class="power-btn" on:click={handleRestart}>
            <Icon name="refresh" size={24} />
            <span>Restart</span>
          </button>
          <button class="power-btn danger" on:click={handleShutdown}>
            <Icon name="power" size={24} />
            <span>Shutdown</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .settings-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg) var(--spacing-xl);
    /* Frosted glass - 30% more blur/saturation than tiles */
    background: rgba(45, 45, 50, 0.7);
    backdrop-filter: blur(1.5px) saturate(135%);
    -webkit-backdrop-filter: blur(1.5px) saturate(135%);
    flex-shrink: 0;
    /* Subtle 3D effect */
    box-shadow:
      0 1px 4px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .back-btn {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .back-btn :global(svg) {
    stroke-width: 3;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .back-btn:active {
    transform: scale(0.95);
  }

  .title {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
  }

  .categories-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .category-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    background: rgba(255, 255, 255, 0.27);
    border: none;
    border-radius: var(--radius-lg);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .category-card:hover {
    background: rgba(255, 255, 255, 0.54);
  }

  .category-card:active {
    transform: scale(0.99);
  }

  .category-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 122, 255, 0.2);
    border-radius: var(--radius-md);
    color: var(--color-accent);
    flex-shrink: 0;
  }

  .category-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .category-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .category-desc {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
  }

  .settings-section {
    margin-bottom: var(--spacing-xl);
  }

  .section-title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 var(--spacing-md) 0;
  }

  .section-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin: 0 0 var(--spacing-lg) 0;
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    background: rgba(255, 255, 255, 0.27);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-sm);
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting-label {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .setting-desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .layout-toggle {
    display: flex;
    gap: var(--spacing-sm);
  }

  .toggle-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-option:hover {
    border-color: var(--color-accent);
    color: var(--color-text-primary);
  }

  .toggle-option.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--spacing-md);
    background: rgba(255, 255, 255, 0.27);
    border-radius: var(--radius-md);
  }

  .info-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .info-value {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .info-value.online {
    color: #30d158;
  }

  .info-value.offline {
    color: #ff453a;
  }

  .info-value.connection-type {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .info-value.signal-strength {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .signal-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 16px;
  }

  .signal-bars .bar {
    width: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 1px;
    transition: background 0.2s;
  }

  .signal-bars .bar:nth-child(1) { height: 6px; }
  .signal-bars .bar:nth-child(2) { height: 10px; }
  .signal-bars .bar:nth-child(3) { height: 14px; }

  .signal-bars .bar.active {
    background: #30d158;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl);
    gap: var(--spacing-md);
    color: var(--color-text-tertiary);
    text-align: center;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: var(--spacing-lg);
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .power-actions {
    display: flex;
    gap: var(--spacing-md);
  }

  .power-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-xl);
    border: none;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    min-height: var(--touch-target-min);
  }

  .power-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .power-btn.danger:hover {
    background: rgba(255, 59, 48, 0.2);
    color: #ff3b30;
  }

  /* Background picker styles */
  .backgrounds-scroll {
    display: flex;
    gap: var(--spacing-md);
    overflow-x: auto;
    overflow-y: hidden;
    padding: var(--spacing-sm) 0;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }

  .backgrounds-scroll::-webkit-scrollbar {
    display: none;
  }

  .bg-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: transparent;
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.15s ease-out;
    scroll-snap-align: start;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .bg-option:active {
    transform: scale(0.95);
  }

  .bg-option.selected {
    border-color: var(--color-accent);
    background: rgba(0, 122, 255, 0.1);
  }

  .bg-preview {
    width: 100px;
    height: 60px;
    border-radius: var(--radius-md);
    object-fit: cover;
    background: rgba(255, 255, 255, 0.1);
  }

  .bg-preview.album-art-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    background: linear-gradient(135deg, #2c2c2e 0%, #3a3a3c 100%);
  }

  .bg-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    text-transform: capitalize;
    white-space: nowrap;
  }

  .bg-option.selected .bg-label {
    color: var(--color-accent);
    font-weight: 500;
  }

  /* Audio output styles */
  .audio-output-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .output-category {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .category-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--spacing-xs) 0;
    padding: 0 var(--spacing-sm);
  }

  .audio-output-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    background: rgba(255, 255, 255, 0.27);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
    min-height: var(--touch-target-min);
    text-align: left;
    width: 100%;
  }

  .audio-output-option:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.54);
    border-color: rgba(255, 255, 255, 0.54);
  }

  .audio-output-option:active:not(.disabled) {
    transform: scale(0.98);
  }

  .audio-output-option.selected {
    background: rgba(0, 122, 255, 0.15);
    border-color: var(--color-accent);
  }

  .audio-output-option.selected:hover {
    background: rgba(0, 122, 255, 0.2);
  }

  .audio-output-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .output-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .output-name {
    font-size: var(--font-size-base);
    font-weight: 500;
  }

  .output-status {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .audio-output-option.selected .output-name {
    color: var(--color-accent);
  }

  /* Spinner */
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Version info styles */
  .info-value.loading {
    color: var(--color-text-tertiary);
    font-style: italic;
  }

  .info-value.error {
    color: #ff453a;
  }

  .info-value.mono {
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
    font-size: var(--font-size-sm);
    letter-spacing: 0.02em;
  }

  /* Bit-Perfect Section Styles */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  .section-header .section-title {
    margin: 0;
  }

  .refresh-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    color: var(--color-text-primary);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .bit-perfect-status {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-lg);
  }

  .bit-perfect-status.ok {
    background: rgba(48, 209, 88, 0.15);
    border: 1px solid rgba(48, 209, 88, 0.3);
  }

  .bit-perfect-status.ok .status-icon {
    color: #30d158;
  }

  .bit-perfect-status.warning {
    background: rgba(255, 159, 10, 0.15);
    border: 1px solid rgba(255, 159, 10, 0.3);
  }

  .bit-perfect-status.warning .status-icon {
    color: #ff9f0a;
  }

  .bit-perfect-status.error {
    background: rgba(255, 69, 58, 0.15);
    border: 1px solid rgba(255, 69, 58, 0.3);
  }

  .bit-perfect-status.error .status-icon {
    color: #ff453a;
  }

  .status-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .status-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .status-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .status-desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .issues-list,
  .config-list {
    margin-bottom: var(--spacing-lg);
  }

  .list-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--spacing-sm) 0;
  }

  .issue-item {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-xs);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .issue-item.error {
    color: #ff453a;
  }

  .issue-item.warning {
    color: #ff9f0a;
  }

  .issue-item :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .config-item {
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-xs);
  }

  .config-item code {
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  /* DSD Mode Toggle Styles */
  .dsd-mode-options {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .dsd-mode-option {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background: rgba(255, 255, 255, 0.27);
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .dsd-mode-option:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.35);
  }

  .dsd-mode-option:active:not(:disabled) {
    transform: scale(0.99);
  }

  .dsd-mode-option.selected {
    background: rgba(0, 122, 255, 0.15);
    border-color: var(--color-accent);
  }

  .dsd-mode-option.selected:hover:not(:disabled) {
    background: rgba(0, 122, 255, 0.2);
  }

  .dsd-mode-option:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .dsd-mode-option.loading {
    pointer-events: none;
  }

  .option-radio {
    width: 22px;
    height: 22px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 2px;
    position: relative;
    transition: all 0.2s;
  }

  .option-radio.checked {
    border-color: var(--color-accent);
    background: var(--color-accent);
  }

  .option-radio.checked::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
  }

  .option-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .option-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .option-desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .dsd-mode-option.selected .option-title {
    color: var(--color-accent);
  }

  .mode-loading {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .spinner.small {
    width: 18px;
    height: 18px;
    border-width: 2px;
  }
</style>
