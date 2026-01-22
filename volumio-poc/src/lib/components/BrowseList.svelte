<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BrowseItem } from '$lib/stores/browse';
  import Icon from './Icon.svelte';

  export let items: BrowseItem[] = [];

  // Track which items have failed to load album art
  let failedImages: Set<string> = new Set();

  const dispatch = createEventDispatcher<{
    itemClick: BrowseItem;
    itemContextMenu: { event: MouseEvent; item: BrowseItem };
    moreClick: { event: MouseEvent; item: BrowseItem };
  }>();

  function getItemIcon(item: BrowseItem): string {
    switch (item.type) {
      case 'folder':
        return 'folder';
      case 'playlist':
        return 'playlist';
      case 'song':
      case 'track':
        return 'music-note';
      case 'album':
        return 'album';
      case 'artist':
        return 'artist';
      case 'radio':
      case 'webradio':
        return 'radio';
      default:
        return 'music-note';
    }
  }

  function handleImageError(uri: string) {
    failedImages.add(uri);
    failedImages = failedImages; // Trigger reactivity
  }

  function shouldShowImage(item: BrowseItem): boolean {
    return !!item.albumart && !failedImages.has(item.uri);
  }

  function formatDuration(seconds: number | undefined): string {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function handleClick(item: BrowseItem) {
    dispatch('itemClick', item);
  }

  function handleContextMenu(event: MouseEvent, item: BrowseItem) {
    event.preventDefault();
    dispatch('itemContextMenu', { event, item });
  }

  function handleMoreClick(event: MouseEvent, item: BrowseItem) {
    event.stopPropagation();
    dispatch('moreClick', { event, item });
  }
</script>

<div class="browse-list" data-testid="browse-list">
  {#each items as item}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="list-item browse-item"
      data-testid="browse-item"
      on:click={() => handleClick(item)}
      on:contextmenu={(e) => handleContextMenu(e, item)}
      on:keydown={(e) => e.key === 'Enter' && handleClick(item)}
      role="button"
      tabindex="0"
    >
      <div class="list-item-art">
        {#if shouldShowImage(item)}
          <img
            src={item.albumart}
            alt={item.title}
            loading="lazy"
            on:error={() => handleImageError(item.uri)}
          />
        {:else}
          <div class="list-item-icon">
            <Icon name={getItemIcon(item)} size={32} />
          </div>
        {/if}
      </div>
      <div class="list-item-info">
        <span class="list-item-title">{item.title}</span>
        {#if item.artist}
          <span class="list-item-artist">{item.artist}</span>
        {/if}
        {#if item.duration}
          <span class="list-item-duration">{formatDuration(item.duration)}</span>
        {/if}
      </div>
      <Icon name="chevron-right" size={24} />
      <button
        class="more-btn"
        on:click={(e) => handleMoreClick(e, item)}
        aria-label="More options"
      >
        <Icon name="more-vertical" size={20} />
      </button>
    </div>
  {/each}
</div>

<style>
  .browse-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s;
  }

  .list-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .list-item:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .list-item:active {
    transform: scale(0.99);
  }

  .list-item-art {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-shrink: 0;
    background: var(--color-bg-secondary);
  }

  .list-item-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .list-item-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
  }

  .list-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .list-item-title {
    font-size: var(--font-size-lg);
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .list-item-artist {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .list-item-duration {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .more-btn {
    width: 40px;
    height: 40px;
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
    opacity: 0.6;
  }

  .list-item:hover .more-btn {
    opacity: 1;
  }

  .more-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }
</style>
