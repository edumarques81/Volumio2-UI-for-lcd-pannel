<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationActions } from '$lib/stores/navigation';
  import { uiActions } from '$lib/stores/ui';
  import {
    libraryAlbums,
    libraryAlbumsLoading,
    libraryAlbumsError,
    librarySort,
    selectedLibraryAlbum,
    libraryAlbumTracks,
    libraryAlbumTracksLoading,
    libraryAlbumTotalDuration,
    libraryActions,
    initLibraryStore,
    type Album,
    type Track,
    type SortOrder
  } from '$lib/stores/library';
  import Icon from '../Icon.svelte';
  import AlbumGrid from '../AlbumGrid.svelte';
  import TrackItem from '../TrackItem.svelte';
  import SkeletonList from '../SkeletonList.svelte';

  // Sort options
  const sortOptions: { value: SortOrder; label: string }[] = [
    { value: 'alphabetical', label: 'A-Z' },
    { value: 'by_artist', label: 'Artist' },
    { value: 'recently_added', label: 'Recent' },
    { value: 'year', label: 'Year' }
  ];

  function handleBack() {
    if ($selectedLibraryAlbum) {
      libraryActions.clearSelectedAlbum();
    } else {
      navigationActions.goHome();
    }
  }

  function handleAlbumClick(event: CustomEvent<Album>) {
    libraryActions.fetchAlbumTracks(event.detail);
  }

  function handleAlbumPlay(event: CustomEvent<Album>) {
    libraryActions.playAlbum(event.detail);
  }

  function handlePlayAll() {
    if ($selectedLibraryAlbum) {
      libraryActions.playAlbum($selectedLibraryAlbum);
    }
  }

  function handleTrackClick(track: Track) {
    libraryActions.playTrack(track);
  }

  function handleAlbumMore(event: CustomEvent<{ album: Album; position: { x: number; y: number } }>) {
    uiActions.openContextMenu(event.detail.album, 'album', event.detail.position);
  }

  function handleTrackMore(event: CustomEvent<{ track: Track; position: { x: number; y: number } }>) {
    uiActions.openContextMenu(event.detail.track, 'track', event.detail.position);
  }

  function handleSortChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const sort = select.value as SortOrder;
    libraryActions.setSort(sort);
    libraryActions.fetchAlbums({ scope: 'all', sort });
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatTotalDuration(seconds: number): string {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  }

  onMount(() => {
    initLibraryStore();
    libraryActions.fetchAlbums({ scope: 'all' });
  });
</script>

<div class="albums-view" data-view="allAlbums">
  <!-- Header -->
  <header class="view-header">
    <div class="header-left">
      <button class="back-btn" data-testid="back-button" on:click={handleBack} aria-label="Go back">
        <Icon name="chevron-left" size={28} />
      </button>
      <h1 class="title">Music Library</h1>
    </div>

    <div class="header-right">
      {#if !$selectedLibraryAlbum}
        <!-- Sort dropdown -->
        <select
          class="sort-select"
          value={$librarySort}
          on:change={handleSortChange}
          data-testid="sort-select"
        >
          {#each sortOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      {:else}
        <!-- Play All button for album detail view -->
        <button class="play-all-btn" on:click={handlePlayAll} data-testid="play-all-button">
          <Icon name="play" size={20} />
          Play All
        </button>
      {/if}
    </div>
  </header>

  <!-- Content -->
  <div class="view-content">
    {#if $libraryAlbumsError}
      <div class="error-message">
        <Icon name="warning" size={48} />
        <p>{$libraryAlbumsError}</p>
        <button class="retry-btn" on:click={() => libraryActions.fetchAlbums({ scope: 'all' })}>
          Retry
        </button>
      </div>
    {:else if $selectedLibraryAlbum}
      <!-- Album Detail View -->
      {#if $libraryAlbumTracksLoading}
        <SkeletonList count={6} variant="browse" />
      {:else if $libraryAlbumTracks.length === 0}
        <div class="empty">
          <Icon name="music-note" size={64} />
          <p>No tracks found</p>
        </div>
      {:else}
        <div class="album-detail">
          <div class="album-header">
            <div class="album-cover">
              {#if $selectedLibraryAlbum.albumArt}
                <img src={$selectedLibraryAlbum.albumArt} alt={$selectedLibraryAlbum.title} />
              {:else}
                <div class="album-placeholder">
                  <Icon name="album" size={64} />
                </div>
              {/if}
            </div>
            <div class="album-info">
              <h2 class="album-title">{$selectedLibraryAlbum.title}</h2>
              <span class="album-artist">{$selectedLibraryAlbum.artist}</span>
              <div class="album-meta">
                <span class="track-count">{$libraryAlbumTracks.length} tracks</span>
                <span class="separator">•</span>
                <span class="total-duration">{formatTotalDuration($libraryAlbumTotalDuration)}</span>
              </div>
            </div>
          </div>
          <div class="album-tracks-list">
            {#each $libraryAlbumTracks as track, index}
              <TrackItem
                {track}
                {index}
                albumArtist={$selectedLibraryAlbum?.artist || ''}
                on:play={() => handleTrackClick(track)}
                on:more={handleTrackMore}
              />
            {/each}
          </div>
        </div>
      {/if}
    {:else if $libraryAlbumsLoading}
      <SkeletonList count={6} variant="browse" />
    {:else if $libraryAlbums.length === 0}
      <div class="empty">
        <Icon name="folder-open" size={64} />
        <p>No albums found</p>
        <span class="hint">Add music to your library</span>
      </div>
    {:else}
      <AlbumGrid
        albums={$libraryAlbums}
        on:albumClick={handleAlbumClick}
        on:albumPlay={handleAlbumPlay}
        on:albumMore={handleAlbumMore}
      />
    {/if}
  </div>

</div>

<style>
  .albums-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .view-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--header-height-slim);
    padding: var(--spacing-sm) var(--spacing-xl);
    background: rgba(45, 45, 50, 0.7);
    backdrop-filter: blur(1.5px) saturate(135%);
    -webkit-backdrop-filter: blur(1.5px) saturate(135%);
    flex-shrink: 0;
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
    gap: var(--spacing-lg);
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

  .title {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .sort-select {
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    outline: none;
  }

  .sort-select:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .view-content {
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

  .empty .hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .error-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--spacing-md);
    color: var(--color-text-secondary);
  }

  .retry-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: white;
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .retry-btn:hover {
    opacity: 0.9;
  }

  /* Play All button */
  .play-all-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: white;
    font-size: var(--font-size-base);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .play-all-btn:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }

  .play-all-btn:active {
    transform: scale(0.98);
  }

  /* Album Detail View */
  .album-detail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .album-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-xl);
  }

  .album-cover {
    width: 160px;
    height: 160px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
  }

  .album-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .album-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
  }

  .album-info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    min-width: 0;
  }

  .album-info .album-title {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .album-info .album-artist {
    font-size: var(--font-size-lg);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .album-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }

  .album-meta .track-count,
  .album-meta .total-duration {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .album-meta .separator {
    color: var(--color-text-tertiary);
  }

  /* Album Tracks List */
  .album-tracks-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
