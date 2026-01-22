<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BrowseItem } from '$lib/stores/browse';
  import Icon from './Icon.svelte';

  export let items: BrowseItem[] = [];

  const dispatch = createEventDispatcher<{
    itemClick: BrowseItem;
    itemContextMenu: { event: MouseEvent; item: BrowseItem };
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

  function handleClick(item: BrowseItem) {
    dispatch('itemClick', item);
  }

  function handleContextMenu(event: MouseEvent, item: BrowseItem) {
    event.preventDefault();
    dispatch('itemContextMenu', { event, item });
  }
</script>

<div class="browse-grid">
  {#each items as item}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="grid-item"
      on:click={() => handleClick(item)}
      on:contextmenu={(e) => handleContextMenu(e, item)}
      on:keydown={(e) => e.key === 'Enter' && handleClick(item)}
      role="button"
      tabindex="0"
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
          <button class="play-overlay-btn" on:click|stopPropagation={() => handleClick(item)}>
            <Icon name="play-filled" size={32} />
          </button>
        </div>
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
</style>
