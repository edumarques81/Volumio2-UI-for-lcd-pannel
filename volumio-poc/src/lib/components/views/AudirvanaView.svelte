<script lang="ts">
  import BackHeader from '../BackHeader.svelte';
  import Icon from '../Icon.svelte';
  import {
    audirvanaInstalled,
    audirvanaService,
    audirvanaInstances,
    audirvanaLoading,
    audirvanaError,
    audirvanaActions
  } from '$lib/stores/audirvana';
  import {
    audioEngineState,
    activeEngine,
    engineSwitching,
    audioEngineActions
  } from '$lib/stores/audioEngine';

  // Refresh status when view loads
  $: {
    audirvanaActions.refresh();
  }

  function handleSwitchToAudirvana() {
    audioEngineActions.switchTo('audirvana');
  }

  function handleSwitchToMpd() {
    audioEngineActions.switchTo('mpd');
  }

  function handleStartService() {
    audirvanaActions.startService();
  }

  function handleStopService() {
    audirvanaActions.stopService();
  }

  function handleRefresh() {
    audirvanaActions.refresh();
  }
</script>

<div class="audirvana-view">
  <BackHeader title="Audirvana Studio" />

  <div class="content">
    {#if $audirvanaLoading}
      <div class="loading">
        <Icon name="refresh" size={48} />
        <p>Detecting Audirvana...</p>
      </div>
    {:else if $audirvanaError}
      <div class="error">
        <Icon name="warning" size={48} />
        <p>{$audirvanaError}</p>
        <button class="retry-btn" on:click={handleRefresh}>Retry</button>
      </div>
    {:else}
      <!-- Status Section -->
      <section class="status-section">
        <h2>Status</h2>

        <div class="status-cards">
          <!-- Installation Status -->
          <div class="status-card">
            <div class="status-icon" class:active={$audirvanaInstalled}>
              <Icon name={$audirvanaInstalled ? 'check' : 'close'} size={32} />
            </div>
            <div class="status-info">
              <span class="status-label">Installed</span>
              <span class="status-value">{$audirvanaInstalled ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <!-- Service Status -->
          <div class="status-card">
            <div class="status-icon" class:active={$audirvanaService.running}>
              <Icon name={$audirvanaService.running ? 'play' : 'stop'} size={32} />
            </div>
            <div class="status-info">
              <span class="status-label">Service</span>
              <span class="status-value">
                {#if $audirvanaService.running}
                  Running (PID: {$audirvanaService.pid})
                {:else if $audirvanaService.active}
                  Active
                {:else if $audirvanaService.loaded}
                  Stopped
                {:else}
                  Not Configured
                {/if}
              </span>
            </div>
          </div>

          <!-- Active Engine -->
          <div class="status-card">
            <div class="status-icon" class:active={$activeEngine === 'audirvana'}>
              <Icon name="headphones" size={32} />
            </div>
            <div class="status-info">
              <span class="status-label">Audio Engine</span>
              <span class="status-value">{$activeEngine === 'audirvana' ? 'Audirvana' : 'MPD'}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Engine Switch Section -->
      <section class="engine-section">
        <h2>Audio Engine</h2>
        <p class="section-desc">
          Only one audio engine can use the DAC at a time for bit-perfect playback.
        </p>

        <div class="engine-buttons">
          <button
            class="engine-btn"
            class:active={$activeEngine === 'mpd'}
            disabled={$engineSwitching || $activeEngine === 'mpd'}
            on:click={handleSwitchToMpd}
          >
            <Icon name="music-note" size={24} />
            <span>MPD</span>
            {#if $activeEngine === 'mpd'}
              <span class="badge">Active</span>
            {/if}
          </button>

          <button
            class="engine-btn"
            class:active={$activeEngine === 'audirvana'}
            disabled={$engineSwitching || $activeEngine === 'audirvana' || !$audirvanaInstalled}
            on:click={handleSwitchToAudirvana}
          >
            <Icon name="headphones" size={24} />
            <span>Audirvana</span>
            {#if $activeEngine === 'audirvana'}
              <span class="badge">Active</span>
            {:else if !$audirvanaInstalled}
              <span class="badge error">Not Installed</span>
            {/if}
          </button>
        </div>

        {#if $engineSwitching}
          <p class="switching-msg">Switching audio engine...</p>
        {/if}

        {#if $audioEngineState.error}
          <p class="error-msg">{$audioEngineState.error}</p>
        {/if}
      </section>

      <!-- Service Control Section -->
      {#if $audirvanaInstalled}
        <section class="service-section">
          <h2>Service Control</h2>

          <div class="service-buttons">
            {#if $audirvanaService.running}
              <button class="service-btn stop" on:click={handleStopService}>
                <Icon name="stop" size={20} />
                Stop Service
              </button>
            {:else}
              <button class="service-btn start" on:click={handleStartService}>
                <Icon name="play" size={20} />
                Start Service
              </button>
            {/if}

            <button class="service-btn refresh" on:click={handleRefresh}>
              <Icon name="refresh" size={20} />
              Refresh Status
            </button>
          </div>
        </section>
      {/if}

      <!-- Discovered Instances Section -->
      <section class="instances-section">
        <h2>Discovered Instances ({$audirvanaInstances.length})</h2>
        <p class="section-desc">
          Audirvana instances found on your network via mDNS discovery.
        </p>

        {#if $audirvanaInstances.length === 0}
          <div class="no-instances">
            <Icon name="search" size={48} />
            <p>No Audirvana instances found on the network</p>
          </div>
        {:else}
          <div class="instances-list">
            {#each $audirvanaInstances as instance}
              <div class="instance-card">
                <div class="instance-icon">
                  <Icon name="headphones" size={36} />
                </div>
                <div class="instance-info">
                  <span class="instance-name">{instance.name}</span>
                  <span class="instance-address">{instance.address}:{instance.port}</span>
                  <div class="instance-meta">
                    <span class="meta-tag">{instance.os}</span>
                    <span class="meta-tag">v{instance.protocol_version}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Info Section -->
      <section class="info-section">
        <h2>About</h2>
        <p>
          Audirvana Studio is a high-end music player for audiophiles.
          It uses a proprietary binary protocol, so only detection and discovery
          is supported. To control playback, use the Audirvana mobile app.
        </p>
      </section>
    {/if}
  </div>
</div>

<style>
  .audirvana-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-background);
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    padding-bottom: calc(var(--spacing-lg) + 80px);
  }

  .loading,
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--spacing-xl);
    color: var(--color-text-secondary);
  }

  .loading :global(svg) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .retry-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-primary);
    border: none;
    border-radius: var(--radius-md);
    color: white;
    cursor: pointer;
  }

  section {
    margin-bottom: var(--spacing-xl);
  }

  h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: var(--spacing-md);
  }

  .section-desc {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-md);
  }

  /* Status Cards */
  .status-cards {
    display: flex;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .status-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    min-width: 180px;
  }

  .status-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary);
  }

  .status-icon.active {
    background: rgba(46, 204, 113, 0.2);
    color: #2ecc71;
  }

  .status-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .status-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    text-transform: uppercase;
  }

  .status-value {
    font-size: 14px;
    color: var(--color-text-primary);
  }

  /* Engine Buttons */
  .engine-buttons {
    display: flex;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .engine-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--color-surface);
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    color: var(--color-text-primary);
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .engine-btn:hover:not(:disabled) {
    background: var(--color-surface-hover);
  }

  .engine-btn.active {
    border-color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.1);
  }

  .engine-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: var(--color-primary);
    color: white;
  }

  .badge.error {
    background: var(--color-error);
  }

  .switching-msg {
    margin-top: var(--spacing-md);
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .error-msg {
    margin-top: var(--spacing-md);
    color: var(--color-error);
  }

  /* Service Buttons */
  .service-buttons {
    display: flex;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .service-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .service-btn.start {
    background: #2ecc71;
    color: white;
  }

  .service-btn.stop {
    background: #e74c3c;
    color: white;
  }

  .service-btn.refresh {
    background: var(--color-surface);
    color: var(--color-text-primary);
  }

  .service-btn:hover {
    opacity: 0.9;
  }

  /* Instances List */
  .no-instances {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-xl);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    color: var(--color-text-secondary);
  }

  .instances-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .instance-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
  }

  .instance-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: linear-gradient(180deg, #7b5ea7 0%, #4a3875 100%);
    color: white;
  }

  .instance-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .instance-name {
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .instance-address {
    font-size: 14px;
    color: var(--color-text-secondary);
    font-family: monospace;
  }

  .instance-meta {
    display: flex;
    gap: var(--spacing-sm);
  }

  .meta-tag {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary);
  }

  /* Info Section */
  .info-section p {
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }
</style>
