<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { connectionState } from '$lib/services/socket';
  import { currentTrack, isPlaying } from '$lib/stores/player';
  import { highestSeverity, issueCounts, playbackIssues, type Issue } from '$lib/stores/issues';
  import { statusDrawerOpen } from '$lib/stores/ui';
  import { lcdState, lcdLoading, lcdActions, initLcdStore, cleanupLcdStore } from '$lib/stores/lcd';
  import { networkStatus, networkIcon, isConnected, initNetworkStore, cleanupNetworkStore } from '$lib/stores/network';
  import { isDeviceLocked, formatBadge, isBitPerfect, initAudioStore, cleanupAudioStore } from '$lib/stores/audio';
  import Icon from './Icon.svelte';

  let currentTime = '';

  function updateTime() {
    const now = new Date();

    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'short' });
    const dayOfMonth = now.getDate();
    const month = now.toLocaleDateString('en-US', { month: 'short' });
    const time = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();

    currentTime = `${dayOfWeek} ${dayOfMonth} ${month} ${time}`;
  }

  async function handleLcdToggle() {
    await lcdActions.toggle();
  }

  function handleStatusTap() {
    statusDrawerOpen.set(true);
  }

  onMount(() => {
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Initialize LCD state tracking
    initLcdStore();

    // Initialize network status tracking
    initNetworkStore();

    return () => {
      clearInterval(interval);
      cleanupLcdStore();
      cleanupNetworkStore();
    };
  });

  // LCD button label based on current state
  $: lcdButtonLabel = $lcdState === 'off' ? 'LCD On' : 'LCD Off';
  $: lcdButtonIcon = $lcdState === 'off' ? 'monitor' : 'power';

  // Check if music is actually playing (not just has a track)
  // ON AIR should only show when playback is active
  $: hasTrack = $isPlaying && $currentTrack.title && $currentTrack.title !== 'No track' && $currentTrack.title !== '';

  // Status dot color based on highest severity
  $: statusColor = {
    'ok': '#34c759',
    'info': '#007aff',
    'warning': '#ffcc00',
    'error': '#ff3b30'
  }[$highestSeverity];

  // Show dot always (green when OK, colored when issues)
  $: showStatusDot = true;

  // Top playback issue for inline banner
  $: topPlaybackIssue = $playbackIssues.length > 0 ? $playbackIssues[0] : null;

  function getIssueIcon(severity: Issue['severity']): string {
    switch (severity) {
      case 'error': return 'x-circle';
      case 'warning': return 'alert-triangle';
      default: return 'info';
    }
  }
</script>

<div class="status-bar">
  <div class="left">
    <!-- Status indicator + ON AIR (tappable) -->
    <button class="status-badge" on:click={handleStatusTap} aria-label="Open status drawer">
      <!-- Status dot (always visible) -->
      <span class="status-dot" style="background-color: {statusColor}"></span>

      {#if hasTrack}
        <span class="on-air-text">ON AIR</span>
      {:else}
        <span class="status-text">STATUS</span>
      {/if}

      <!-- Issue count badge (only when there are issues) -->
      {#if $issueCounts.total > 0}
        <span class="issue-count" class:error={$highestSeverity === 'error'} class:warning={$highestSeverity === 'warning'}>
          {$issueCounts.total}
        </span>
      {/if}
    </button>

    <!-- Audio status badges (when playing) -->
    {#if $isDeviceLocked}
      <div class="audio-status">
        <!-- Lock icon for exclusive access -->
        <span class="audio-lock" title="Exclusive audio device access">
          <Icon name="lock" size={14} />
        </span>
        <!-- Format badge -->
        {#if $formatBadge}
          <span class="audio-format" class:bit-perfect={$isBitPerfect} title={$isBitPerfect ? 'Bit-perfect output' : 'Audio output'}>
            {#if $isBitPerfect}
              <Icon name="check" size={12} />
            {/if}
            {$formatBadge}
          </span>
        {/if}
      </div>
    {/if}

    <!-- Playback issue banner (inline, next to ON AIR) -->
    {#if topPlaybackIssue}
      <button
        class="playback-issue-banner"
        class:error={topPlaybackIssue.severity === 'error'}
        class:warning={topPlaybackIssue.severity === 'warning'}
        on:click={handleStatusTap}
        aria-label="View issue details"
      >
        <Icon name={getIssueIcon(topPlaybackIssue.severity)} size={14} />
        <span class="issue-text">{topPlaybackIssue.title}</span>
      </button>
    {/if}
  </div>

  <div class="right">
    {#if $isConnected}
      <div
        class="indicator connected"
        title={$networkStatus.type === 'wifi' ? `${$networkStatus.ssid} (${$networkStatus.signal}%)` : `Ethernet (${$networkStatus.ip})`}
      >
        <Icon name={$networkIcon} size={18} />
      </div>
    {/if}
    <span class="time">{currentTime}</span>
    <button
      class="lcd-toggle-btn"
      class:lcd-on={$lcdState === 'off'}
      class:loading={$lcdLoading}
      on:click={handleLcdToggle}
      disabled={$lcdLoading}
    >
      {#if $lcdLoading}
        <span class="spinner-small"></span>
      {:else}
        <Icon name={lcdButtonIcon} size={18} />
      {/if}
      <span>{lcdButtonLabel}</span>
    </button>
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-xl);
    height: 40px;
    background: transparent;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 200;
  }

  .left, .right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border: none;
    border-radius: 20px;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 44px; /* Touch-friendly */
  }

  .status-badge:hover {
    background: rgba(0, 0, 0, 0.4);
  }

  .status-badge:active {
    transform: scale(0.97);
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 6px currentColor;
    animation: dot-pulse 2s ease-in-out infinite;
  }

  @keyframes dot-pulse {
    0%, 100% {
      opacity: 1;
      box-shadow: 0 0 4px currentColor;
    }
    50% {
      opacity: 0.7;
      box-shadow: 0 0 8px currentColor, 0 0 12px currentColor;
    }
  }

  .on-air-text {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: var(--font-size-sm);
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #f5c066;
    text-shadow:
      0 0 4px rgba(245, 192, 102, 0.6),
      0 0 8px rgba(245, 192, 102, 0.4),
      0 0 16px rgba(245, 166, 35, 0.3),
      0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .status-text {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .issue-count {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.2);
    color: var(--color-text-primary);
  }

  .issue-count.error {
    background: rgba(255, 59, 48, 0.8);
  }

  .issue-count.warning {
    background: rgba(255, 204, 0, 0.8);
    color: #1a1a1a;
  }

  .time {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .indicator {
    color: var(--color-text-secondary);
    opacity: 0.6;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  .indicator.connected {
    color: var(--color-text-primary);
    opacity: 1;
  }

  .lcd-toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 44px;
  }

  .lcd-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .lcd-toggle-btn:active {
    transform: scale(0.95);
  }

  .lcd-toggle-btn:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  /* When LCD is off, show green "turn on" style */
  .lcd-toggle-btn.lcd-on {
    background: rgba(52, 199, 89, 0.3);
    color: #34c759;
  }

  .lcd-toggle-btn.lcd-on:hover {
    background: rgba(52, 199, 89, 0.4);
  }

  /* Loading spinner */
  .spinner-small {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: var(--color-text-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Playback issue banner */
  .playback-issue-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(0, 122, 255, 0.25);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: none;
    border-radius: 16px;
    color: #5ac8fa;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 44px;
  }

  .playback-issue-banner:hover {
    background: rgba(0, 122, 255, 0.35);
  }

  .playback-issue-banner:active {
    transform: scale(0.97);
  }

  .playback-issue-banner.warning {
    background: rgba(255, 204, 0, 0.25);
    color: #ffcc00;
  }

  .playback-issue-banner.warning:hover {
    background: rgba(255, 204, 0, 0.35);
  }

  .playback-issue-banner.error {
    background: rgba(255, 59, 48, 0.25);
    color: #ff6961;
  }

  .playback-issue-banner.error:hover {
    background: rgba(255, 59, 48, 0.35);
  }

  .playback-issue-banner .issue-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  /* Audio status badges */
  .audio-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 16px;
  }

  .audio-lock {
    display: flex;
    align-items: center;
    color: #5ac8fa;
    filter: drop-shadow(0 0 4px rgba(90, 200, 250, 0.5));
  }

  .audio-format {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
    letter-spacing: 0.02em;
  }

  .audio-format.bit-perfect {
    color: #34c759;
    text-shadow: 0 0 4px rgba(52, 199, 89, 0.5);
  }
</style>
