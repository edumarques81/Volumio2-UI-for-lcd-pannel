<script lang="ts">
  import { onMount } from 'svelte';
  import { queue, queueLoading, queueLength, queueDuration, queueActions, formatQueueDuration, type QueueItem } from '$lib/stores/queue';
  import { playerState } from '$lib/stores/player';
  import { IconClose, IconQueue, IconDragHandle, IconPlay, IconDelete } from '$lib/components/icons';

  let draggedIndex: number | null = null;
  let dropTargetIndex: number | null = null;

  function handlePlay(index: number) {
    queueActions.play(index);
  }

  function handleRemove(index: number) {
    queueActions.remove(index);
  }

  function formatDuration(seconds: number | undefined): string {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function isCurrentTrack(item: QueueItem): boolean {
    return !!$playerState && item.uri === $playerState.uri;
  }

  function handleDragStart(index: number) {
    draggedIndex = index;
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dropTargetIndex = index;
  }

  function handleDragEnd() {
    if (draggedIndex !== null && dropTargetIndex !== null && draggedIndex !== dropTargetIndex) {
      queueActions.move(draggedIndex, dropTargetIndex);
    }
    draggedIndex = null;
    dropTargetIndex = null;
  }

  function handleClear() {
    queueActions.clear();
  }

  onMount(() => {
    queueActions.getQueue();
  });
</script>

<div class="queue-tab">
  {#if $queueLength > 0}
    <div class="queue-header">
      <span class="queue-count">{$queueLength} tracks · {formatQueueDuration($queueDuration)}</span>
      <button class="clear-btn" on:click={handleClear}>
        <IconDelete size={12} />
        Clear
      </button>
    </div>
  {/if}

  {#if $queueLoading}
    <div class="queue-list">
      {#each Array(5) as _}
        <div class="q-item skeleton-item">
          <span class="q-num">&nbsp;</span>
          <span class="q-title skeleton-bar" style="width:60%">&nbsp;</span>
          <span class="q-dur">&nbsp;</span>
        </div>
      {/each}
    </div>
  {:else if $queueLength === 0}
    <div class="empty-state">
      <IconQueue size={32} />
      <p>Queue empty</p>
    </div>
  {:else}
    <div class="queue-list">
      {#each $queue as item, index (item.uri + index)}
        <!-- Using <div role="button"> to avoid button-inside-button nesting -->
        <div
          class="q-item"
          class:playing={isCurrentTrack(item)}
          class:drop-target={dropTargetIndex === index}
          draggable="true"
          role="button"
          tabindex="0"
          on:click={() => handlePlay(index)}
          on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePlay(index); }}
          on:dragstart={() => handleDragStart(index)}
          on:dragover={(e) => handleDragOver(e, index)}
          on:dragend={handleDragEnd}
        >
          <span class="q-drag">
            <IconDragHandle size={10} />
          </span>
          <span class="q-num">
            {#if isCurrentTrack(item)}
              <IconPlay size={10} />
            {:else}
              {index + 1}
            {/if}
          </span>
          <span class="q-title">{item.name || item.title || 'Untitled'}</span>
          {#if item.artist}
            <span class="q-artist">{item.artist}</span>
          {/if}
          <span class="q-dur">{formatDuration(item.duration)}</span>
          <button
            class="q-remove"
            on:click|stopPropagation={() => handleRemove(index)}
            aria-label="Remove from queue"
          >
            <IconClose size={12} />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .queue-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .queue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid rgba(81, 67, 71, 0.3);
    flex-shrink: 0;
  }
  .queue-count {
    font-size: 10px;
    font-weight: 600;
    color: var(--md-outline);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .clear-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--md-shape-full, 9999px);
    border: 1px solid var(--md-outline-variant);
    background: transparent;
    color: var(--md-outline);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease-out;
    min-height: 32px;
  }
  .clear-btn:hover {
    color: var(--md-error, #FFB4AB);
    border-color: var(--md-error, #FFB4AB);
  }

  .queue-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: var(--md-outline-variant) transparent;
  }

  .q-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    border-radius: var(--md-shape-sm, 8px);
    cursor: pointer;
    transition: background 200ms ease-out;
    min-height: 48px;
    flex-shrink: 0;
    border: none;
    background: none;
    color: var(--md-on-surface);
    text-align: left;
    font-family: inherit;
    width: 100%;
  }
  .q-item:hover {
    background: rgba(255, 177, 200, 0.06);
  }
  .q-item.playing {
    background: rgba(123, 41, 73, 0.3);
  }
  .q-item.playing .q-title {
    color: var(--md-on-primary-container);
  }
  .q-item.drop-target {
    border-top: 2px solid var(--md-primary);
  }

  .q-drag {
    color: var(--md-outline-variant);
    cursor: grab;
    opacity: 0;
    transition: opacity 150ms;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  .q-item:hover .q-drag {
    opacity: 1;
  }

  .q-num {
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
    color: var(--md-outline);
    min-width: 16px;
    text-align: right;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  .q-item.playing .q-num {
    color: var(--md-primary);
  }

  .q-title {
    font-size: 15px;
    font-weight: 500;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .q-artist {
    font-size: 13px;
    color: var(--md-outline);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    flex-shrink: 0;
  }

  .q-dur {
    font-family: 'Roboto Mono', monospace;
    font-size: 12px;
    color: var(--md-outline);
    flex-shrink: 0;
  }

  .q-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--md-outline-variant);
    cursor: pointer;
    opacity: 0;
    transition: all 200ms ease-out;
    flex-shrink: 0;
  }
  .q-item:hover .q-remove {
    opacity: 1;
  }
  .q-remove:hover {
    color: var(--md-error, #FFB4AB);
    background: rgba(255, 180, 171, 0.1);
  }

  .skeleton-item {
    pointer-events: none;
  }
  .skeleton-bar {
    background: linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
    height: 12px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px;
    color: var(--md-outline);
    flex: 1;
  }
  .empty-state p {
    font-size: 12px;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
