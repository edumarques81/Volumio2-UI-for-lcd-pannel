<script lang="ts">
  import { onMount } from 'svelte';
  import { connectionState } from '$lib/services/socket';
  import { currentTrack, isPlaying } from '$lib/stores/player';
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

  onMount(() => {
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  });

  // Check if something is actually playing (has a real track)
  $: hasTrack = $currentTrack.title && $currentTrack.title !== 'No track' && $currentTrack.title !== '';
</script>

<div class="status-bar">
  <div class="left">
    {#if hasTrack}
      <div class="on-air-indicator">
        <span class="on-air-text">ON AIR</span>
      </div>
    {/if}
  </div>

  <div class="right">
    <div class="indicator" class:connected={$connectionState === 'connected'}>
      <Icon name="wifi" size={18} />
    </div>
    <span class="time">{currentTime}</span>
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

  .on-air-indicator {
    display: flex;
    align-items: center;
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
    animation: glow-pulse 2s ease-in-out infinite;
  }

  @keyframes glow-pulse {
    0%, 100% {
      opacity: 1;
      text-shadow:
        0 0 4px rgba(245, 192, 102, 0.6),
        0 0 8px rgba(245, 192, 102, 0.4),
        0 0 16px rgba(245, 166, 35, 0.3),
        0 1px 2px rgba(0, 0, 0, 0.5);
    }
    50% {
      opacity: 0.7;
      text-shadow:
        0 0 8px rgba(245, 192, 102, 0.8),
        0 0 16px rgba(245, 192, 102, 0.6),
        0 0 24px rgba(245, 166, 35, 0.5),
        0 0 32px rgba(245, 166, 35, 0.3),
        0 1px 2px rgba(0, 0, 0, 0.5);
    }
  }
</style>
