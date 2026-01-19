<script lang="ts">
  import { onMount } from 'svelte';
  import { browseStack, currentBrowseLocation, navigationActions } from '$lib/stores/navigation';
  import { browseItems, browseLists, browseLoading, browseActions, type BrowseItem } from '$lib/stores/browse';
  import Icon from '../Icon.svelte';

  let searchQuery = '';

  // Browse to current location when stack changes
  $: if ($currentBrowseLocation) {
    browseActions.browse($currentBrowseLocation.uri);
  }

  function handleItemClick(item: BrowseItem) {
    if (item.type === 'folder' || item.type === 'playlist' || item.type === 'streaming-category' || item.type === 'item-no-menu') {
      // Navigate into folder/playlist
      navigationActions.browseTo(item.uri, item.title);
    } else {
      // Play the item
      browseActions.play(item);
    }
  }

  function handleBack() {
    if ($browseStack.length > 1) {
      navigationActions.browseBack();
    }
  }

  function handleSearch() {
    if (searchQuery.trim()) {
      browseActions.search(searchQuery);
    }
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

  function formatDuration(seconds: number | undefined): string {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  onMount(() => {
    // Initial browse if needed
    if (!$currentBrowseLocation) {
      navigationActions.browseRoot();
    }
  });
</script>

<div class="browse-view">
  <!-- Header -->
  <header class="browse-header">
    <div class="header-left">
      {#if $browseStack.length > 1}
        <button class="back-btn" on:click={handleBack} aria-label="Go back">
          <Icon name="back" size={28} />
        </button>
      {/if}
      <h1 class="title">{$currentBrowseLocation?.title || 'Browse'}</h1>
    </div>

    <div class="search-box">
      <Icon name="search" size={20} />
      <input
        type="text"
        placeholder="Search..."
        bind:value={searchQuery}
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
      />
    </div>
  </header>

  <!-- Content -->
  <div class="browse-content">
    {#if $browseLoading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    {:else if $browseItems.length === 0}
      <div class="empty">
        <Icon name="folder-open" size={64} />
        <p>No items found</p>
      </div>
    {:else}
      <div class="items-grid">
        {#each $browseItems as item}
          <button class="browse-item" on:click={() => handleItemClick(item)}>
            <div class="item-art">
              {#if item.albumart}
                <img src={item.albumart} alt={item.title} />
              {:else}
                <div class="item-icon">
                  <Icon name={getItemIcon(item)} size={32} />
                </div>
              {/if}
            </div>
            <div class="item-info">
              <span class="item-title">{item.title}</span>
              {#if item.artist}
                <span class="item-artist">{item.artist}</span>
              {/if}
              {#if item.duration}
                <span class="item-duration">{formatDuration(item.duration)}</span>
              {/if}
            </div>
            <Icon name="chevron-right" size={24} />
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .browse-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .browse-header {
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
    align-items: center;
    gap: var(--spacing-md);
  }

  .back-btn {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .back-btn:active {
    transform: scale(0.95);
  }

  .title {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-full);
    color: var(--color-text-secondary);
    min-width: 300px;
  }

  .search-box input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    outline: none;
  }

  .search-box input::placeholder {
    color: var(--color-text-tertiary);
  }

  .browse-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
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

  .items-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .browse-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .browse-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .browse-item:active {
    transform: scale(0.99);
  }

  .item-art {
    width: 56px;
    height: 56px;
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
    font-size: var(--font-size-lg);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-artist {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-duration {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }
</style>
