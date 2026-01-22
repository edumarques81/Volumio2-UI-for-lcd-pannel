<script lang="ts">
  import { onMount } from 'svelte';
  import { browseStack, currentBrowseLocation, navigationActions } from '$lib/stores/navigation';
  import { browseItems, browseSources, browseLists, browseLoading, browseActions, browseViewMode, type BrowseItem } from '$lib/stores/browse';
  import { uiActions } from '$lib/stores/ui';
  import Icon from '../Icon.svelte';
  import BrowseList from '../BrowseList.svelte';
  import BrowseGrid from '../BrowseGrid.svelte';
  import SkeletonList from '../SkeletonList.svelte';

  let searchQuery = '';

  // Check if we're at the root (empty URI means show sources)
  $: isAtRoot = !$currentBrowseLocation?.uri;

  // Get items to display - either sources (at root) or browse items (in folder)
  $: displayItems = isAtRoot ? $browseSources : $browseItems;

  // Browse to current location when stack changes (but not for empty URI - that uses sources)
  $: if ($currentBrowseLocation && $currentBrowseLocation.uri) {
    browseActions.browse($currentBrowseLocation.uri);
  }

  function handleItemClick(item: BrowseItem) {
    // Sources and folders should be navigated into
    // Note: Sources from getBrowseSources don't have a 'type' but have a 'uri'
    const isNavigable = !item.type ||
                       item.type === 'folder' ||
                       item.type === 'playlist' ||
                       item.type === 'streaming-category' ||
                       item.type === 'item-no-menu';

    if (isNavigable) {
      // Navigate into folder/playlist/source
      navigationActions.browseTo(item.uri, item.title || item.name || 'Browse');
    } else {
      // Play the item
      browseActions.play(item);
    }
  }

  function handleBack() {
    if ($browseStack.length > 1) {
      // Navigate back within browse hierarchy
      navigationActions.browseBack();
    } else {
      // At root, go back to home screen
      navigationActions.goHome();
    }
  }

  function handleSearch() {
    if (searchQuery.trim()) {
      browseActions.search(searchQuery);
    }
  }

  function handleContextMenu(event: MouseEvent, item: BrowseItem) {
    event.preventDefault();
    event.stopPropagation();
    uiActions.openContextMenu(item, 'browse', { x: event.clientX, y: event.clientY });
  }

  function handleMoreClick(event: MouseEvent, item: BrowseItem) {
    event.stopPropagation();
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    uiActions.openContextMenu(item, 'browse', { x: rect.right, y: rect.top });
  }

  function handleToggleViewMode() {
    browseActions.toggleViewMode();
  }

  onMount(() => {
    // Initial browse if needed
    if (!$currentBrowseLocation) {
      navigationActions.browseRoot();
    }
  });
</script>

<div class="browse-view" data-view="browse">
  <!-- Header -->
  <header class="browse-header">
    <div class="header-left">
      <button class="back-btn" data-testid="back-button" on:click={handleBack} aria-label="Go back">
        <Icon name="chevron-left" size={32} />
      </button>
      <h1 class="title">{$currentBrowseLocation?.title || 'Browse'}</h1>
    </div>

    <div class="header-right">
      <div class="search-box">
        <Icon name="search" size={20} />
        <input
          type="text"
          placeholder="Search..."
          bind:value={searchQuery}
          on:keydown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>
      <button
        class="view-toggle-btn"
        on:click={handleToggleViewMode}
        aria-label={$browseViewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
      >
        <Icon name={$browseViewMode === 'list' ? 'grid' : 'list'} size={24} />
      </button>
    </div>
  </header>

  <!-- Content -->
  <div class="browse-content">
    {#if $browseLoading && displayItems.length === 0}
      <SkeletonList count={8} variant="browse" />
    {:else if displayItems.length === 0}
      <div class="empty">
        <Icon name="folder-open" size={64} />
        <p>No items found</p>
      </div>
    {:else}
      {#if $browseViewMode === 'list'}
        <BrowseList
          items={displayItems}
          on:itemClick={(e) => handleItemClick(e.detail)}
          on:itemContextMenu={(e) => handleContextMenu(e.detail.event, e.detail.item)}
          on:moreClick={(e) => handleMoreClick(e.detail.event, e.detail.item)}
        />
      {:else}
        <BrowseGrid
          items={displayItems}
          on:itemClick={(e) => handleItemClick(e.detail)}
          on:itemContextMenu={(e) => handleContextMenu(e.detail.event, e.detail.item)}
        />
      {/if}
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

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .back-btn {
    width: 56px;
    height: 56px;
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

  .view-toggle-btn {
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

  .view-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .view-toggle-btn:active {
    transform: scale(0.95);
  }

  .browse-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
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
</style>
