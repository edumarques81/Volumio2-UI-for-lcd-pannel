<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BrowseItem } from '$lib/stores/browse';
  import Icon from './Icon.svelte';

  export let items: BrowseItem[] = [];

  const dispatch = createEventDispatcher<{
    itemClick: BrowseItem;
    itemPlay: BrowseItem;
    itemMore: { item: BrowseItem; position: { x: number; y: number } };
    itemContextMenu: { event: MouseEvent; item: BrowseItem };
  }>();

  function isAlbumType(item: BrowseItem): boolean {
    return item.type === 'album';
  }

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

  function handleClick(item: BrowseItem) {
    dispatch('itemClick', item);
  }

  function handlePlayClick(event: MouseEvent, item: BrowseItem) {
    event.stopPropagation();
    dispatch('itemPlay', item);
  }

  function handleMoreClick(event: MouseEvent, item: BrowseItem) {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dispatch('itemMore', {
      item,
      position: { x: rect.left, y: rect.bottom }
    });
  }

  function handleContextMenu(event: MouseEvent, item: BrowseItem) {
    event.preventDefault();
    dispatch('itemContextMenu', { event, item });
  }
</script>

<div class="browse-grid">
  {#each items as item}
    <div
      class="grid-item"
      class:is-album={isAlbumType(item)}
      data-testid="browse-item-{item.uri}"
    >
      <div class="grid-item-art">
        {#if item.albumart}
          <img src={item.albumart} alt={item.title} loading="lazy" />
        {:else}
          <div class="grid-item-icon">
            <Icon name={getItemIcon(item)} size={48} />
          </div>
        {/if}
        <div class="grid-item-overlay">
          <button class="play-overlay-btn" on:click={(e) => handlePlayClick(e, item)}>
            <Icon name="play-filled" size={32} />
          </button>
        </div>
        {#if isAlbumType(item)}
          <!-- More options button (top-right) - for albums -->
          <button
            class="more-btn"
            on:click={(e) => handleMoreClick(e, item)}
            aria-label="More options for {item.title}"
          >
            <Icon name="more-vertical" size={20} />
          </button>
          <!-- View songs button (bottom-right) - for albums -->
          <button
            class="view-btn"
            on:click={() => handleClick(item)}
            aria-label="View songs in {item.title}"
          >
            <Icon name="list" size={20} />
          </button>
        {/if}
      </div>
      <div class="grid-item-info">
        <span class="grid-item-title">{item.title}</span>
        {#if item.artist}
          <span class="grid-item-artist">{item.artist}</span>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .browse-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--spacing-lg);
    padding: var(--spacing-sm);
  }

  .grid-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    cursor: pointer;
    border-radius: var(--radius-md);
    padding: var(--spacing-sm);
    transition: all 0.2s;
    background: rgba(255, 255, 255, 0.144);
  }

  .grid-item:hover {
    background: rgba(255, 255, 255, 0.36);
  }

  .grid-item:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .grid-item-art {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-bg-secondary);
  }

  .grid-item-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .grid-item-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
  }

  .grid-item-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .grid-item:hover .grid-item-overlay {
    opacity: 1;
  }

  .play-overlay-btn {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--color-accent);
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .play-overlay-btn:hover {
    transform: scale(1.1);
  }

  .play-overlay-btn:active {
    transform: scale(0.95);
  }

  /* More and View buttons for albums */
  .more-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    border: none;
    border-radius: var(--radius-full);
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 1;
  }

  .more-btn:hover {
    background: rgba(0, 0, 0, 0.85);
    transform: scale(1.1);
  }

  .more-btn:active {
    transform: scale(0.95);
  }

  .view-btn {
    position: absolute;
    bottom: 6px;
    right: 6px;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    border: none;
    border-radius: var(--radius-full);
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 1;
  }

  .view-btn:hover {
    background: var(--color-primary);
    transform: scale(1.1);
  }

  .view-btn:active {
    transform: scale(0.95);
  }

  .grid-item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 var(--spacing-xs);
  }

  .grid-item-title {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .grid-item-artist {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Larger grid items for bigger screens */
  @media (min-width: 1200px) {
    .browse-grid {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
  }

  /* Smaller grid items for LCD panel */
  @media (max-height: 500px) {
    .browse-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: var(--spacing-md);
    }

    .grid-item-title {
      font-size: var(--font-size-sm);
    }

    .grid-item-artist {
      font-size: var(--font-size-xs);
    }
  }

  /* Tablet - 3-4 columns */
  @media (min-width: 768px) and (max-width: 1024px) and (min-height: 501px) {
    .browse-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: var(--spacing-md);
    }

    .play-overlay-btn {
      width: 48px;
      height: 48px;
    }
  }

  /* Phone - 2 columns */
  @media (max-width: 767px) and (min-height: 501px) {
    .browse-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-sm);
      padding: var(--spacing-sm);
    }

    .grid-item {
      padding: var(--spacing-xs);
    }

    .grid-item-title {
      font-size: var(--font-size-sm);
    }

    .grid-item-artist {
      font-size: var(--font-size-xs);
    }

    .play-overlay-btn {
      width: 44px;
      height: 44px;
    }
  }
</style>
