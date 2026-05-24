<script lang="ts">
  import type { NasDevice, ShareInfo } from '$lib/stores/sources';
  import NasErrorBanner from './NasErrorBanner.svelte';

  // ── Props ────────────────────────────────────────────────────────────────
  // Pure-render discover/browse panel. Parent owns the store wiring,
  // discoverAttempted flag, and all action implementations — this component
  // only renders + invokes callbacks. Mirrors the original markup 1:1; all
  // data-testid values are preserved.
  interface Props {
    // Discovery state
    discoveryLoading: boolean;
    discoveryError: string | null;
    discoveredDevices: NasDevice[];
    discoverAttempted: boolean;
    // Browse state
    browseLoading: boolean;
    browseError: string | null;
    browsedShares: ShareInfo[];
    lastBrowseHostAttempt: string | null;
    // Callbacks
    onDiscover: () => void;
    onBrowse: (ip: string) => void;
    onBrowseRetry: () => void;
    onUseShare: (shareName: string) => void;
  }

  let {
    discoveryLoading,
    discoveryError,
    discoveredDevices,
    discoverAttempted,
    browseLoading,
    browseError,
    browsedShares,
    lastBrowseHostAttempt,
    onDiscover,
    onBrowse,
    onBrowseRetry,
    onUseShare,
  }: Props = $props();
</script>

<div class="discover-card">
  <button
    type="button"
    class="btn-discover"
    data-testid="nas-discover"
    onclick={onDiscover}
  >
    {discoveryLoading ? 'Discovering…' : 'Discover'}
  </button>

  {#if discoveryError !== null}
    <NasErrorBanner
      message={discoveryError}
      onRetry={onDiscover}
      bannerTestId="nas-discovery-error-banner"
      retryTestId="nas-discovery-retry"
    />
  {/if}

  {#if !discoveryLoading && discoveryError === null && discoverAttempted && discoveredDevices.length === 0}
    <div class="state-msg empty-state" data-testid="nas-discovery-empty">
      No devices found on this network
    </div>
  {/if}

  {#if discoveredDevices.length > 0}
    <ul class="device-list" role="list">
      {#each discoveredDevices as device (device.ip)}
        <li class="device-row" data-testid="nas-device-{device.ip}">
          <span class="device-name">{device.name}</span>
          <span class="device-ip">{device.ip}</span>
          <button
            type="button"
            class="btn-browse"
            aria-label={`Browse ${device.name}`}
            onclick={() => onBrowse(device.ip)}
          >
            {browseLoading ? '…' : 'Browse'}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if browseError !== null}
    <NasErrorBanner
      message={browseError}
      onRetry={onBrowseRetry}
      bannerTestId="nas-browse-error-banner"
      retryTestId="nas-browse-retry"
      retryDisabled={lastBrowseHostAttempt === null}
    />
  {/if}

  {#if browsedShares.length > 0}
    <ul class="browsed-list" role="list">
      {#each browsedShares as share (share.name)}
        <li class="browsed-row">
          <span class="browsed-name">{share.name}</span>
          <button
            type="button"
            class="btn-use"
            onclick={() => onUseShare(share.name)}
          >
            Use this
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .discover-card {
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-card);
    padding: 16px;
    margin: 12px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .btn-discover {
    min-height: var(--hit-target-min);
    padding: 0 20px;
    background: transparent;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-card);
    color: var(--color-accent);
    font-size: 14px;
    cursor: pointer;
    align-self: flex-start;
  }

  .btn-discover:hover {
    background: rgba(201, 169, 97, 0.08);
  }

  .device-list,
  .browsed-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .device-row,
  .browsed-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: var(--radius-card);
    background: rgba(255, 255, 255, 0.03);
  }

  .device-name,
  .browsed-name {
    flex: 1;
    color: var(--color-text-primary);
    font-size: 14px;
  }

  .device-ip {
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .btn-browse,
  .btn-use {
    min-height: var(--hit-target-min);
    padding: 0 16px;
    background: transparent;
    border: 1px solid var(--color-text-secondary);
    border-radius: var(--radius-card);
    color: var(--color-text-primary);
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-browse:hover,
  .btn-use:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .state-msg {
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .empty-state {
    padding: 8px 12px;
  }
</style>
