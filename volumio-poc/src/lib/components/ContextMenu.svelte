<script lang="ts">
  import { contextMenu, uiActions, type ContextMenuItem } from '$lib/stores/ui';
  import { browseActions, type BrowseItem } from '$lib/stores/browse';
  import { queueActions, type QueueItem } from '$lib/stores/queue';
  import { favoritesActions } from '$lib/stores/favorites';
  import Icon from './Icon.svelte';

  // Reactive state from store
  $: isOpen = $contextMenu.isOpen;
  $: item = $contextMenu.item;
  $: itemType = $contextMenu.itemType;
  $: itemIndex = $contextMenu.itemIndex;

  // Determine if item is playable (song or playable type)
  $: isPlayable = item && (
    item.type === 'song' ||
    item.type === 'webradio' ||
    (itemType === 'queue')
  );

  // Determine if item can be added to queue
  $: canAddToQueue = item && itemType === 'browse';

  // Determine if item can be added to playlist/favorites
  $: canAddToPlaylist = item && (item.type === 'song' || item.type === 'webradio');

  function handlePlayNow() {
    if (!item) return;

    if (itemType === 'browse') {
      browseActions.play(item as BrowseItem);
    } else if (itemType === 'queue' && itemIndex !== undefined) {
      queueActions.play(itemIndex);
    }
    uiActions.closeContextMenu();
  }

  function handleAddToQueue() {
    if (!item || itemType !== 'browse') return;
    browseActions.addToQueue(item as BrowseItem);
    uiActions.closeContextMenu();
  }

  function handleAddToPlaylist() {
    if (!item) return;
    uiActions.openPlaylistSelector(item, itemType || 'browse');
  }

  function handleAddToFavorites() {
    if (!item) return;
    favoritesActions.addToFavorites(item.service, item.uri, getItemTitle(item));
    uiActions.closeContextMenu();
  }

  function handleViewInfo() {
    if (!item) return;
    uiActions.openTrackInfoModal(item);
  }

  function handleRemoveFromQueue() {
    if (itemType !== 'queue' || itemIndex === undefined) return;
    queueActions.remove(itemIndex);
    uiActions.closeContextMenu();
  }

  function handleClose() {
    uiActions.closeContextMenu();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function getItemTitle(item: ContextMenuItem): string {
    return 'name' in item ? item.name : item.title;
  }
</script>

{#if isOpen && item}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="context-menu-backdrop" on:click={handleBackdropClick}>
    <div class="context-menu">
      <!-- Header with item info -->
      <div class="context-menu-header">
        {#if item.albumart}
          <img src={item.albumart} alt="" class="context-menu-art" />
        {:else}
          <div class="context-menu-art-placeholder">
            <Icon name="music" size={24} />
          </div>
        {/if}
        <div class="context-menu-info">
          <div class="context-menu-title">{getItemTitle(item)}</div>
          {#if item.artist}
            <div class="context-menu-artist">{item.artist}</div>
          {/if}
        </div>
        <button class="context-menu-close" on:click={handleClose}>
          <Icon name="x" size={20} />
        </button>
      </div>

      <!-- Menu options -->
      <div class="context-menu-options">
        {#if isPlayable}
          <button class="context-menu-option" on:click={handlePlayNow}>
            <Icon name="play" size={20} />
            <span>Play now</span>
          </button>
        {/if}

        {#if canAddToQueue}
          <button class="context-menu-option" on:click={handleAddToQueue}>
            <Icon name="list-plus" size={20} />
            <span>Add to queue</span>
          </button>
        {/if}

        {#if canAddToPlaylist}
          <button class="context-menu-option" on:click={handleAddToPlaylist}>
            <Icon name="playlist" size={20} />
            <span>Add to playlist</span>
          </button>

          <button class="context-menu-option" on:click={handleAddToFavorites}>
            <Icon name="heart" size={20} />
            <span>Add to favorites</span>
          </button>
        {/if}

        <button class="context-menu-option" on:click={handleViewInfo}>
          <Icon name="info" size={20} />
          <span>View info</span>
        </button>

        {#if itemType === 'queue'}
          <button class="context-menu-option context-menu-option--danger" on:click={handleRemoveFromQueue}>
            <Icon name="trash" size={20} />
            <span>Remove from queue</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .context-menu-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .context-menu {
    background: var(--surface-color, #1e1e1e);
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .context-menu-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .context-menu-art {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    object-fit: cover;
  }

  .context-menu-art-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    background: var(--surface-hover, #333);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, #888);
  }

  .context-menu-info {
    flex: 1;
    min-width: 0;
  }

  .context-menu-title {
    font-weight: 500;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary, #fff);
  }

  .context-menu-artist {
    font-size: 12px;
    color: var(--text-secondary, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .context-menu-close {
    background: transparent;
    border: none;
    color: var(--text-secondary, #888);
    padding: 8px;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .context-menu-close:hover {
    background: var(--surface-hover, #333);
    color: var(--text-primary, #fff);
  }

  .context-menu-options {
    padding: 8px 0;
  }

  .context-menu-option {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 14px 20px;
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
  }

  .context-menu-option:hover {
    background: var(--surface-hover, #333);
  }

  .context-menu-option:active {
    background: var(--surface-active, #444);
  }

  .context-menu-option--danger {
    color: var(--error-color, #ef4444);
  }

  /* Desktop styling */
  @media (min-width: 768px) {
    .context-menu-backdrop {
      align-items: center;
    }

    .context-menu {
      border-radius: 12px;
      max-width: 320px;
    }
  }
</style>
