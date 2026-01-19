<script lang="ts">
  import { onMount } from 'svelte';
  import { queue, queueLength, queueDuration, queueLoading, queueActions, formatQueueDuration, type QueueItem } from '$lib/stores/queue';
  import { currentTrack } from '$lib/stores/player';
  import Icon from '../Icon.svelte';

  function handlePlay(index: number) {
    queueActions.play(index);
  }

  function handleRemove(index: number) {
    queueActions.remove(index);
  }

  function handleClearQueue() {
    if (confirm('Clear entire queue?')) {
      queueActions.clear();
    }
  }

  function formatDuration(seconds: number | undefined): string {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function isCurrentTrack(item: QueueItem): boolean {
    return item.uri === $currentTrack.uri;
  }

  onMount(() => {
    queueActions.getQueue();
  });
</script>

<div class="queue-view">
  <!-- Header -->
  <header class="queue-header">
    <div class="header-left">
      <h1 class="title">Queue</h1>
      <span class="queue-info">
        {$queueLength} tracks • {formatQueueDuration($queueDuration)}
      </span>
    </div>

    <div class="header-actions">
      <button class="action-btn" on:click={() => queueActions.getQueue()} aria-label="Refresh">
        <Icon name="refresh" size={24} />
      </button>
      <button class="action-btn danger" on:click={handleClearQueue} aria-label="Clear queue">
        <Icon name="delete" size={24} />
        <span>Clear</span>
      </button>
    </div>
  </header>

  <!-- Content -->
  <div class="queue-content">
    {#if $queueLoading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading queue...</p>
      </div>
    {:else if $queue.length === 0}
      <div class="empty">
        <Icon name="queue" size={64} />
        <p>Queue is empty</p>
        <p class="hint">Browse your library to add music</p>
      </div>
    {:else}
      <div class="queue-list">
        {#each $queue as item, index}
          <div class="queue-item" class:playing={isCurrentTrack(item)}>
            <button class="play-btn" on:click={() => handlePlay(index)} aria-label="Play">
              {#if isCurrentTrack(item)}
                <div class="now-playing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              {:else}
                <span class="track-number">{index + 1}</span>
              {/if}
            </button>

            <div class="item-art">
              {#if item.albumart}
                <img src={item.albumart} alt={item.name} />
              {:else}
                <div class="item-icon">
                  <Icon name="music-note" size={24} />
                </div>
              {/if}
            </div>

            <div class="item-info">
              <span class="item-title">{item.name}</span>
              {#if item.artist}
                <span class="item-artist">{item.artist}</span>
              {/if}
            </div>

            <span class="item-duration">{formatDuration(item.duration)}</span>

            <button class="remove-btn" on:click={() => handleRemove(index)} aria-label="Remove">
              <Icon name="x" size={20} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .queue-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .queue-header {
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
    align-items: baseline;
    gap: var(--spacing-lg);
  }

  .title {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .queue-info {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    min-height: var(--touch-target-min);
    border: none;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .action-btn.danger:hover {
    background: rgba(255, 59, 48, 0.2);
    color: #ff3b30;
  }

  .queue-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md);
  }

  .loading, .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--spacing-md);
    color: var(--color-text-secondary);
  }

  .empty .hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .queue-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .queue-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }

  .queue-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .queue-item.playing {
    background: rgba(0, 122, 255, 0.15);
  }

  .play-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .track-number {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-tertiary);
  }

  .now-playing-indicator {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 16px;
  }

  .now-playing-indicator span {
    width: 3px;
    background: var(--color-accent);
    border-radius: 1px;
    animation: equalizer 0.8s ease-in-out infinite;
  }

  .now-playing-indicator span:nth-child(1) {
    height: 8px;
    animation-delay: 0s;
  }

  .now-playing-indicator span:nth-child(2) {
    height: 16px;
    animation-delay: 0.2s;
  }

  .now-playing-indicator span:nth-child(3) {
    height: 12px;
    animation-delay: 0.4s;
  }

  @keyframes equalizer {
    0%, 100% { transform: scaleY(0.5); }
    50% { transform: scaleY(1); }
  }

  .item-art {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-shrink: 0;
    background: var(--color-bg-secondary);
  }

  .item-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .item-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
  }

  .item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-title {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .queue-item.playing .item-title {
    color: var(--color-accent);
  }

  .item-artist {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-duration {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    min-width: 50px;
    text-align: right;
  }

  .remove-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    opacity: 0;
  }

  .queue-item:hover .remove-btn {
    opacity: 1;
  }

  .remove-btn:hover {
    background: rgba(255, 59, 48, 0.2);
    color: #ff3b30;
  }
</style>
