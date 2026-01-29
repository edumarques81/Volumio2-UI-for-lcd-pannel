<script lang="ts">
  import { contextMenu, uiActions, type ContextMenuItem } from '$lib/stores/ui';
  import { libraryActions, type Album, type Track } from '$lib/stores/library';
  import { browseActions, type BrowseItem } from '$lib/stores/browse';
  import { queueActions } from '$lib/stores/queue';
  import { favoritesActions } from '$lib/stores/favorites';
  import Icon from './Icon.svelte';

  // Reactive state from store
  $: isOpen = $contextMenu.isOpen;
  $: item = $contextMenu.item;
  $: itemType = $contextMenu.itemType;
  $: itemIndex = $contextMenu.itemIndex;

  // Type guards
  function isAlbum(item: unknown): item is Album {
    return itemType === 'album' && item !== null && typeof item === 'object' && 'title' in item;
  }

  function isTrack(item: unknown): item is Track {
    return itemType === 'track' && item !== null && typeof item === 'object' && 'trackNumber' in item;
  }

  function isBrowseItem(item: unknown): item is BrowseItem {
    return itemType === 'browse' && item !== null && typeof item === 'object';
  }

  function isQueueItem(): boolean {
    return itemType === 'queue';
  }

  // Get item properties safely
  function getTitle(): string {
    if (!item) return '';
    if ('title' in item) return item.title as string;
    if ('name' in item) return item.name as string;
    return '';
  }

  function getArtist(): string {
    if (!item) return '';
    if ('artist' in item) return item.artist as string;
    return '';
  }

  function getAlbumArt(): string {
    if (!item) return '';
    if ('albumArt' in item) return item.albumArt as string;
    if ('albumart' in item) return item.albumart as string;
    return '';
  }

  function getIcon(): string {
    if (itemType === 'album') return 'album';
    if (itemType === 'track') return 'music-note';
    if (itemType === 'queue') return 'queue';
    if (isBrowseItem(item) && item.type) {
      switch (item.type) {
        case 'folder': return 'folder';
        case 'playlist': return 'playlist';
        case 'album': return 'album';
        case 'artist': return 'artist';
        case 'radio':
        case 'webradio': return 'radio';
        default: return 'music-note';
      }
    }
    return 'music-note';
  }

  // Determine available actions based on item type
  $: canPlay = itemType === 'album' || itemType === 'track' || itemType === 'browse' || itemType === 'queue';
  $: canPlayNext = itemType === 'album' || itemType === 'track';
  $: canAddToQueue = itemType === 'album' || itemType === 'track' || itemType === 'browse';
  $: canAddToPlaylist = itemType === 'album' || itemType === 'track' ||
    (isBrowseItem(item) && (item.type === 'song' || item.type === 'webradio'));
  $: canAddToFavorites = itemType === 'album' || itemType === 'track' ||
    (isBrowseItem(item) && (item.type === 'song' || item.type === 'webradio'));
  $: canViewInfo = itemType === 'track' || itemType === 'browse';
  $: canRemoveFromQueue = itemType === 'queue';

  // Action handlers
  function handlePlayNow() {
    if (isAlbum(item)) {
      libraryActions.playAlbum(item);
    } else if (isTrack(item)) {
      libraryActions.playTrack(item);
    } else if (isBrowseItem(item)) {
      browseActions.play(item);
    } else if (isQueueItem() && itemIndex !== undefined) {
      queueActions.play(itemIndex);
    }
    uiActions.closeContextMenu();
  }

  function handlePlayNext() {
    if (isAlbum(item)) {
      libraryActions.playAlbumNext(item);
    } else if (isTrack(item)) {
      libraryActions.playTrackNext(item);
    }
    uiActions.closeContextMenu();
  }

  function handleAddToQueue() {
    if (isAlbum(item)) {
      libraryActions.addAlbumToQueue(item);
    } else if (isTrack(item)) {
      libraryActions.addTrackToQueue(item);
    } else if (isBrowseItem(item)) {
      browseActions.addToQueue(item);
    }
    uiActions.closeContextMenu();
  }

  function handleAddToPlaylist() {
    if (item && itemType) {
      uiActions.openPlaylistSelector(item, itemType);
    }
  }

  function handleAddToFavorites() {
    if (isAlbum(item)) {
      favoritesActions.addToFavorites('mpd', item.uri, getTitle());
    } else if (isTrack(item)) {
      favoritesActions.addToFavorites('mpd', item.uri, getTitle());
    } else if (isBrowseItem(item)) {
      favoritesActions.addToFavorites(item.service || '', item.uri, getTitle());
    }
    uiActions.closeContextMenu();
  }

  function handleViewInfo() {
    if (item) {
      uiActions.openTrackInfoModal(item);
    }
  }

  function handleRemoveFromQueue() {
    if (itemIndex !== undefined) {
      queueActions.remove(itemIndex);
    }
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
</script>

{#if isOpen && item}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="context-menu-backdrop" data-testid="context-menu-backdrop" on:click={handleBackdropClick}>
    <div class="context-menu" data-testid="context-menu">
      <!-- Header with item info -->
      <div class="context-menu-header">
        {#if getAlbumArt()}
          <img src={getAlbumArt()} alt="" class="context-menu-art" />
        {:else}
          <div class="context-menu-art-placeholder">
            <Icon name={getIcon()} size={24} />
          </div>
        {/if}
        <div class="context-menu-info">
          <div class="context-menu-title">{getTitle()}</div>
          {#if getArtist()}
            <div class="context-menu-artist">{getArtist()}</div>
          {/if}
        </div>
        <button class="context-menu-close" on:click={handleClose} aria-label="Close menu">
          <Icon name="x" size={20} />
        </button>
      </div>

      <!-- Menu options -->
      <div class="context-menu-options">
        {#if canPlay}
          <button class="context-menu-option" data-testid="context-menu-play" on:click={handlePlayNow}>
            <Icon name="play" size={20} />
            <span>Play Now</span>
          </button>
        {/if}

        {#if canPlayNext}
          <button class="context-menu-option" data-testid="context-menu-play-next" on:click={handlePlayNext}>
            <Icon name="skip-forward" size={20} />
            <span>Play Next</span>
          </button>
        {/if}

        {#if canAddToQueue}
          <button class="context-menu-option" data-testid="context-menu-add-queue" on:click={handleAddToQueue}>
            <Icon name="queue" size={20} />
            <span>Add to Queue</span>
          </button>
        {/if}

        {#if canAddToPlaylist}
          <button class="context-menu-option" data-testid="context-menu-add-playlist" on:click={handleAddToPlaylist}>
            <Icon name="playlist" size={20} />
            <span>Add to Playlist</span>
          </button>
        {/if}

        {#if canAddToFavorites}
          <button class="context-menu-option" data-testid="context-menu-add-favorites" on:click={handleAddToFavorites}>
            <Icon name="heart" size={20} />
            <span>Add to Favorites</span>
          </button>
        {/if}

        {#if canViewInfo}
          <button class="context-menu-option" data-testid="context-menu-view-info" on:click={handleViewInfo}>
            <Icon name="info" size={20} />
            <span>View Info</span>
          </button>
        {/if}

        {#if canRemoveFromQueue}
          <button class="context-menu-option context-menu-option--danger" data-testid="context-menu-remove" on:click={handleRemoveFromQueue}>
            <Icon name="trash" size={20} />
            <span>Remove from Queue</span>
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
    background: rgba(30, 30, 35, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .context-menu-art {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .context-menu-art-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }

  .context-menu-info {
    flex: 1;
    min-width: 0;
  }

  .context-menu-title {
    font-weight: 500;
    font-size: var(--font-size-base);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--color-text-primary);
  }

  .context-menu-artist {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .context-menu-close {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    padding: 8px;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .context-menu-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
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
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
    min-height: 48px;
  }

  .context-menu-option:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .context-menu-option:active {
    background: rgba(255, 255, 255, 0.15);
  }

  .context-menu-option--danger {
    color: var(--color-error, #ef4444);
  }

  /* Desktop styling */
  @media (min-width: 768px) {
    .context-menu-backdrop {
      align-items: center;
    }

    .context-menu {
      border-radius: 12px;
      max-width: 360px;
    }
  }

  /* LCD panel optimization */
  @media (max-height: 500px) {
    .context-menu {
      max-height: 90vh;
    }

    .context-menu-option {
      padding: 12px 16px;
      min-height: 44px;
    }
  }
</style>
