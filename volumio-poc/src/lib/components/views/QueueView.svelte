<script lang="ts">
  import { onMount } from 'svelte';
  import { queue, queueLength, queueDuration, queueLoading, queueActions, formatQueueDuration, type QueueItem } from '$lib/stores/queue';
  import { currentTrack } from '$lib/stores/player';
  import { navigationActions } from '$lib/stores/navigation';
  import { uiActions } from '$lib/stores/ui';
  import Icon from '../Icon.svelte';
  import SkeletonList from '../SkeletonList.svelte';

  // Drag state
  let draggedIndex: number | null = null;
  let dropTargetIndex: number | null = null;

  // Save to playlist modal
  let showSaveModal = false;
  let savePlaylistName = '';

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

  function handleContextMenu(event: MouseEvent, item: QueueItem, index: number) {
    event.preventDefault();
    event.stopPropagation();
    uiActions.openContextMenu(item, 'queue', { x: event.clientX, y: event.clientY }, index);
  }

  function handleMoreClick(event: MouseEvent, item: QueueItem, index: number) {
    event.stopPropagation();
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    uiActions.openContextMenu(item, 'queue', { x: rect.right, y: rect.top }, index);
  }

  // Drag and drop handlers
  function handleDragStart(event: DragEvent, index: number) {
    draggedIndex = index;
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', index.toString());
    (event.target as HTMLElement).closest('.queue-item')?.classList.add('dragging');
  }

  function handleDragEnd(event: DragEvent) {
    (event.target as HTMLElement).closest('.queue-item')?.classList.remove('dragging');
    draggedIndex = null;
    dropTargetIndex = null;
  }

  function handleDragOver(event: DragEvent, index: number) {
    if (draggedIndex === null) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    if (index !== draggedIndex) {
      dropTargetIndex = index;
    }
  }

  function handleDragLeave() {
    dropTargetIndex = null;
  }

  function handleDrop(event: DragEvent, index: number) {
    if (draggedIndex === null) return;
    event.preventDefault();

    if (draggedIndex !== index) {
      queueActions.move(draggedIndex, index);
    }

    draggedIndex = null;
    dropTargetIndex = null;
  }

  // Save to playlist
  function handleSaveToPlaylist() {
    showSaveModal = true;
    savePlaylistName = '';
  }

  function handleConfirmSave() {
    const name = savePlaylistName.trim();
    if (name) {
      queueActions.saveAsPlaylist(name);
      showSaveModal = false;
      savePlaylistName = '';
    }
  }

  function handleCancelSave() {
    showSaveModal = false;
    savePlaylistName = '';
  }

  function handleSaveKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleConfirmSave();
    } else if (event.key === 'Escape') {
      handleCancelSave();
    }
  }

  onMount(() => {
    queueActions.getQueue();
  });
</script>

<div class="queue-view" data-view="queue">
  <!-- Header -->
  <header class="queue-header">
    <div class="header-left">
      <button class="back-btn" on:click={navigationActions.goHome} aria-label="Back to home">
        <Icon name="chevron-left" size={28} />
      </button>
      <div class="header-title">
        <h1 class="title">Queue</h1>
        <span class="queue-info">
          {$queueLength} tracks • {formatQueueDuration($queueDuration)}
        </span>
      </div>
    </div>

    <div class="header-actions">
      <button class="action-btn" data-testid="refresh-queue" on:click={() => queueActions.getQueue()} aria-label="Refresh">
        <Icon name="refresh" size={24} />
      </button>
      {#if $queueLength > 0}
        <button class="action-btn" data-testid="save-playlist" on:click={handleSaveToPlaylist} aria-label="Save to playlist">
          <Icon name="playlist" size={24} />
          <span>Save</span>
        </button>
      {/if}
      <button class="action-btn danger" data-testid="clear-queue" on:click={handleClearQueue} aria-label="Clear queue">
        <Icon name="delete" size={24} />
        <span>Clear</span>
      </button>
    </div>
  </header>

  <!-- Content -->
  <div class="queue-content">
    {#if $queueLoading}
      <SkeletonList count={6} variant="queue" />
    {:else if $queue.length === 0}
      <div class="empty">
        <Icon name="queue" size={64} />
        <p>Queue is empty</p>
        <p class="hint">Browse your library to add music</p>
      </div>
    {:else}
      <div class="queue-list">
        {#each $queue as item, index (item.uri + index)}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="queue-item"
            class:playing={isCurrentTrack(item)}
            class:drag-over={dropTargetIndex === index && draggedIndex !== index}
            on:contextmenu={(e) => handleContextMenu(e, item, index)}
            on:dragover={(e) => handleDragOver(e, index)}
            on:dragleave={handleDragLeave}
            on:drop={(e) => handleDrop(e, index)}
          >
            <!-- Drag handle -->
            <button
              class="drag-handle"
              draggable="true"
              on:dragstart={(e) => handleDragStart(e, index)}
              on:dragend={handleDragEnd}
              aria-label="Drag to reorder"
            >
              <Icon name="grip-vertical" size={16} />
            </button>

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

            <button
              class="more-btn"
              on:click={(e) => handleMoreClick(e, item, index)}
              aria-label="More options"
            >
              <Icon name="more-vertical" size={20} />
            </button>

            <button class="remove-btn" on:click={() => handleRemove(index)} aria-label="Remove">
              <Icon name="x" size={20} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Save to Playlist Modal -->
{#if showSaveModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="save-modal-backdrop" on:click={handleCancelSave}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="save-modal" on:click|stopPropagation>
      <h3>Save Queue as Playlist</h3>
      <input
        type="text"
        bind:value={savePlaylistName}
        placeholder="Playlist name"
        class="save-modal-input"
        on:keydown={handleSaveKeydown}
      />
      <div class="save-modal-actions">
        <button class="save-modal-btn cancel" on:click={handleCancelSave}>Cancel</button>
        <button
          class="save-modal-btn confirm"
          on:click={handleConfirmSave}
          disabled={!savePlaylistName.trim()}
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if}

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
    height: var(--header-height-slim);
    padding: var(--spacing-sm) var(--spacing-xl);
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

  .header-title {
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

  .back-btn {
    width: 44px;
    height: 44px;
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

  .queue-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md);
  }

  .empty {
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
    background: rgba(255, 255, 255, 0.216);
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }

  .queue-item:hover {
    background: rgba(255, 255, 255, 0.43);
  }

  .queue-item.playing {
    background: rgba(0, 122, 255, 0.5);
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

  .more-btn {
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

  .queue-item:hover .more-btn {
    opacity: 1;
  }

  .more-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  /* Drag handle */
  .drag-handle {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: grab;
    flex-shrink: 0;
    opacity: 0.3;
    transition: opacity 0.2s;
  }

  .queue-item:hover .drag-handle {
    opacity: 1;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  /* Drag states */
  .queue-item.drag-over {
    background: rgba(0, 122, 255, 0.1);
  }

  .queue-item.drag-over::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--color-accent);
    border-radius: 1px;
  }

  :global(.queue-item.dragging) {
    opacity: 0.5;
  }

  /* Save Modal */
  .save-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .save-modal {
    background: var(--color-bg-secondary, #1e1e1e);
    border-radius: 12px;
    padding: 24px;
    width: 100%;
    max-width: 360px;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .save-modal h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .save-modal-input {
    width: 100%;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-size: 14px;
    box-sizing: border-box;
  }

  .save-modal-input:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .save-modal-input::placeholder {
    color: var(--color-text-tertiary);
  }

  .save-modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }

  .save-modal-btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .save-modal-btn.cancel {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  .save-modal-btn.cancel:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .save-modal-btn.confirm {
    background: var(--color-accent);
    color: #fff;
  }

  .save-modal-btn.confirm:hover {
    opacity: 0.9;
  }

  .save-modal-btn.confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Mobile responsive adjustments */
  @media (max-width: 600px) {
    .queue-header {
      padding: var(--spacing-xs) var(--spacing-md);
    }

    .header-title {
      flex-direction: column;
      align-items: flex-start;
      gap: 0;
    }

    .title {
      font-size: var(--font-size-lg);
    }

    .queue-info {
      font-size: var(--font-size-xs);
    }

    .back-btn {
      width: 40px;
      height: 40px;
    }

    .action-btn {
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .action-btn span {
      display: none;
    }

    .queue-content {
      padding: var(--spacing-md);
    }

    .queue-item {
      padding: var(--spacing-sm);
      gap: var(--spacing-sm);
    }

    .item-art {
      width: 48px;
      height: 48px;
    }

    .item-title {
      font-size: var(--font-size-sm);
    }

    .item-artist {
      font-size: var(--font-size-xs);
    }
  }

  /* Landscape mobile */
  @media (orientation: landscape) and (max-height: 500px) {
    .queue-header {
      height: auto;
      min-height: 44px;
      padding: var(--spacing-xs) var(--spacing-lg);
    }
  }
</style>
