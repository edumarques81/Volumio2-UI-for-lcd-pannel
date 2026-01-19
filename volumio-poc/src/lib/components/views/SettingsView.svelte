<script lang="ts">
  import { onMount } from 'svelte';
  import { layoutMode } from '$lib/stores/navigation';
  import {
    systemInfo,
    networkStatus,
    settingsCategories,
    currentSettingsCategory,
    settingsActions,
    availableBackgrounds,
    selectedBackground,
    type SettingsCategory
  } from '$lib/stores/settings';
  import Icon from '../Icon.svelte';

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
  });
</script>

<div class="settings-view">
  <!-- Header -->
  <header class="settings-header">
    <div class="header-left">
      {#if $currentSettingsCategory}
        <button class="back-btn" on:click={handleBack} aria-label="Go back">
          <Icon name="back" size={28} />
        </button>
      {/if}
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

        <div class="backgrounds-scroll">
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
      <div class="settings-section">
        <h2 class="section-title">Audio Output</h2>
        <p class="section-hint">Configure your audio output device</p>
        <!-- Audio output settings would go here -->
        <div class="placeholder">
          <Icon name="volume-high" size={48} />
          <p>Audio output configuration coming soon</p>
        </div>
      </div>
    {:else if $currentSettingsCategory === 'network'}
      <!-- Network Settings -->
      <div class="settings-section">
        <h2 class="section-title">Network Status</h2>
        {#if $networkStatus}
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Status</span>
              <span class="info-value" class:online={$networkStatus.online}>
                {$networkStatus.online ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {#if $networkStatus.ip}
              <div class="info-item">
                <span class="info-label">IP Address</span>
                <span class="info-value">{$networkStatus.ip}</span>
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
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.15);
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
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: var(--radius-lg);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .category-card:hover {
    background: rgba(255, 255, 255, 0.1);
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
    background: rgba(255, 255, 255, 0.05);
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
    background: rgba(255, 255, 255, 0.05);
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
</style>
