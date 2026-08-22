<script lang="ts">
  import { onMount } from 'svelte';
  import { playlistSelector, uiActions, type ContextMenuItem } from '$lib/stores/ui';
  import { playlists, playlistActions, initPlaylistStore } from '$lib/stores/playlist';
  import Icon from './Icon.svelte';

  // Reactive state from store
  $: isOpen = $playlistSelector.isOpen;
  $: item = $playlistSelector.item;
  $: itemType = $playlistSelector.itemType;

  // Local state for new playlist creation
  let showCreateNew = false;
  let newPlaylistName = '';
  let inputElement: HTMLInputElement;

  // Initialize playlist store and fetch playlists
  onMount(() => {
    initPlaylistStore();
  });

  // Fetch playlists when opened
  $: if (isOpen) {
    playlistActions.listPlaylists();
    showCreateNew = false;
    newPlaylistName = '';
  }

  function handleSelectPlaylist(playlistName: string) {
    if (!item) return;

    const title = getItemTitle(item);
    playlistActions.addToPlaylist(playlistName, item.service, item.uri, title);
    uiActions.closePlaylistSelector();
  }

  function handleCreateNew() {
    showCreateNew = true;
    // Focus input after render
    setTimeout(() => inputElement?.focus(), 0);
  }

  function handleCreateAndAdd() {
    const name = newPlaylistName.trim();
    if (!name || !item) return;

    // Create playlist first, then add item
    playlistActions.createPlaylist(name);

    // Add to the new playlist (backend handles creation first)
    const title = getItemTitle(item);
    setTimeout(() => {
      playlistActions.addToPlaylist(name, item!.service, item!.uri, title);
    }, 100);

    uiActions.closePlaylistSelector();
  }

  function handleClose() {
    uiActions.closePlaylistSelector();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleCreateAndAdd();
    } else if (event.key === 'Escape') {
      showCreateNew = false;
    }
  }

  function getItemTitle(item: ContextMenuItem): string {
    return 'name' in item ? item.name : item.title;
  }
</script>

{#if isOpen && item}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="playlist-selector-backdrop" on:click={handleBackdropClick}>
    <div class="playlist-selector">
      <!-- Header -->
      <div class="playlist-selector-header">
        <h3>Add to playlist</h3>
        <button class="playlist-selector-close" on:click={handleClose}>
          <Icon name="x" size={20} />
        </button>
      </div>

      <!-- Item being added -->
      <div class="playlist-selector-item">
        {#if item.albumart}
          <img src={item.albumart} alt="" class="playlist-selector-art" />
        {:else}
          <div class="playlist-selector-art-placeholder">
            <Icon name="music" size={20} />
          </div>
        {/if}
        <div class="playlist-selector-item-info">
          <div class="playlist-selector-item-title">{getItemTitle(item)}</div>
          {#if item.artist}
            <div class="playlist-selector-item-artist">{item.artist}</div>
          {/if}
        </div>
      </div>

      <!-- Playlist list -->
      <div class="playlist-selector-list">
        <!-- Create new playlist button/input -->
        {#if showCreateNew}
          <div class="playlist-selector-create-form">
            <input
              bind:this={inputElement}
              bind:value={newPlaylistName}
              type="text"
              placeholder="Playlist name"
              class="playlist-selector-input"
              on:keydown={handleKeydown}
            />
            <button
              class="playlist-selector-create-btn"
              on:click={handleCreateAndAdd}
              disabled={!newPlaylistName.trim()}
            >
              Add
            </button>
          </div>
        {:else}
          <button class="playlist-selector-option playlist-selector-option--create" on:click={handleCreateNew}>
            <Icon name="plus" size={20} />
            <span>Create new playlist</span>
          </button>
        {/if}

        <!-- Existing playlists -->
        {#if $playlists.length > 0}
          <div class="playlist-selector-divider">Your playlists</div>
          {#each $playlists as playlist}
            <button class="playlist-selector-option" on:click={() => handleSelectPlaylist(playlist)}>
              <Icon name="playlist" size={20} />
              <span>{playlist}</span>
            </button>
          {/each}
        {:else}
          <div class="playlist-selector-empty">
            No playlists yet. Create one above.
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .playlist-selector-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .playlist-selector {
    background: var(--surface-color, #1e1e1e);
    border-radius: 12px;
    width: 100%;
    max-width: 360px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
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

  .playlist-selector-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .playlist-selector-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .playlist-selector-close {
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

  .playlist-selector-close:hover {
    background: var(--surface-hover, #333);
    color: var(--text-primary, #fff);
  }

  .playlist-selector-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: var(--surface-hover, #252525);
  }

  .playlist-selector-art {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
  }

  .playlist-selector-art-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    background: var(--surface-color, #333);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, #888);
  }

  .playlist-selector-item-info {
    flex: 1;
    min-width: 0;
  }

  .playlist-selector-item-title {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary, #fff);
  }

  .playlist-selector-item-artist {
    font-size: 12px;
    color: var(--text-secondary, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playlist-selector-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .playlist-selector-option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 20px;
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    font-size: 14px;
    cursor: pointer;
    text-align: left;
  }

  .playlist-selector-option:hover {
    background: var(--surface-hover, #333);
  }

  .playlist-selector-option--create {
    color: var(--accent-color, #22c55e);
  }

  .playlist-selector-create-form {
    display: flex;
    gap: 8px;
    padding: 8px 20px;
  }

  .playlist-selector-input {
    flex: 1;
    padding: 10px 12px;
    background: var(--surface-hover, #333);
    border: 1px solid var(--border-color, #444);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 14px;
  }

  .playlist-selector-input:focus {
    outline: none;
    border-color: var(--accent-color, #22c55e);
  }

  .playlist-selector-input::placeholder {
    color: var(--text-secondary, #666);
  }

  .playlist-selector-create-btn {
    padding: 10px 16px;
    background: var(--accent-color, #22c55e);
    border: none;
    border-radius: 6px;
    color: #000;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .playlist-selector-create-btn:hover {
    opacity: 0.9;
  }

  .playlist-selector-create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .playlist-selector-divider {
    padding: 12px 20px 8px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary, #666);
  }

  .playlist-selector-empty {
    padding: 20px;
    text-align: center;
    color: var(--text-secondary, #666);
    font-size: 13px;
  }
</style>
