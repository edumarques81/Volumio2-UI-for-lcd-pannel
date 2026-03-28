<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import {
    libraryAlbums,
    libraryAlbumsLoading,
    libraryAlbumsError,
    libraryActions,
    libraryScope,
    type Album,
    type Scope
  } from '$lib/stores/library';
  import {
    playlists,
    playlistsLoading,
    playlistActions
  } from '$lib/stores/playlist';
  import {
    radioStations,
    radioLoading,
    libraryActions as radioActions
  } from '$lib/stores/library';
  import {
    favoritesList,
    favoritesLoading,
    favoritesActions
  } from '$lib/stores/favorites';
  import Skeleton from '../Skeleton.svelte';
  import SourceTabs from './SourceTabs.svelte';
  import { IconSearch, IconClose, IconPlay, IconPlaylist, IconRadio, IconFavoriteFilled } from '$lib/components/icons';
  import PlaylistDetailOverlay from './PlaylistDetailOverlay.svelte';

  const dispatch = createEventDispatcher<{
    albumSelect: Album;
  }>();

  let searchQuery = '';
  let activeSource = 'nas';
  let selectedPlaylist: string | null = null;

  const scopeMap: Record<string, Scope> = {
    nas: 'nas',
    local: 'local',
    usb: 'usb'
  };

  function handleTabChange(e: CustomEvent<string>) {
    activeSource = e.detail;
    searchQuery = '';
    loadContent();
  }

  function loadContent() {
    if (activeSource === 'playlists') {
      playlistActions.listPlaylists();
    } else if (activeSource === 'radio') {
      libraryActions.fetchRadioStations({ query: searchQuery });
    } else if (activeSource === 'favorites') {
      favoritesActions.fetchFavorites();
    } else {
      const scope = scopeMap[activeSource] || 'all';
      libraryActions.fetchAlbums({ scope, query: searchQuery });
    }
  }

  function handleSearch() {
    loadContent();
  }

  function handleAlbumClick(album: Album) {
    dispatch('albumSelect', album);
  }

  function handlePlaylistClick(name: string) {
    selectedPlaylist = name;
  }

  function handlePlaylistBack() {
    selectedPlaylist = null;
  }

  function clearSearch() {
    searchQuery = '';
    loadContent();
  }

  function handleRadioClick(station: { id: string; name: string; uri: string }) {
    libraryActions.playRadioStation(station);
  }

  function handleFavoriteClick(item: { service?: string; type?: string; title?: string; uri: string }) {
    favoritesActions.playItem(item as any);
  }

  function handleRetry() {
    loadContent();
  }

  onMount(() => {
    loadContent();
  });

  function handleArtError(e: Event) {
    const img = e.target as HTMLImageElement;
    // Replace broken image with empty string to trigger the CSS background fallback
    img.style.display = 'none';
  }

  $: isAlbumView = !['playlists', 'radio', 'favorites'].includes(activeSource);
  $: loading = isAlbumView ? $libraryAlbumsLoading : activeSource === 'playlists' ? $playlistsLoading : activeSource === 'radio' ? $radioLoading : $favoritesLoading;
  $: error = isAlbumView ? $libraryAlbumsError : null;
  $: hasSearchQuery = searchQuery.trim().length > 0;
</script>

<div class="library-tab">
  <SourceTabs activeTab={activeSource} on:tabChange={handleTabChange} />

  <div class="search-bar">
    <span class="search-icon"><IconSearch size={14} /></span>
    <input
      id="library-search"
      type="text"
      class="search-input"
      placeholder="Search..."
      bind:value={searchQuery}
      on:input={handleSearch}
    />
    {#if hasSearchQuery}
      <button class="search-clear" on:click={clearSearch} aria-label="Clear search">
        <IconClose size={12} />
      </button>
    {/if}
  </div>

  {#if error}
    <div class="error-state">
      <p class="error-text">{error}</p>
      <button class="retry-btn" on:click={handleRetry}>Retry</button>
    </div>
  {:else if loading}
    <div class="lib-album-grid">
      {#each Array(8) as _}
        <div class="lib-album skeleton-card">
          <Skeleton width="100%" height="0" variant="rectangle" />
          <div class="lib-album-info">
            <Skeleton width="80%" height="10px" />
            <Skeleton width="50%" height="9px" />
          </div>
        </div>
      {/each}
    </div>
  {:else if isAlbumView}
    <div class="lib-album-grid">
      {#each $libraryAlbums as album (album.id)}
        <button class="lib-album" on:click={() => handleAlbumClick(album)}>
          <div class="lib-album-art-wrap">
            <img
              class="lib-album-art"
              src={album.albumArt}
              alt={album.title}
              loading="lazy"
              on:error={handleArtError}
            />
            <div class="lib-album-art-fallback"></div>
          </div>
          <div class="lib-album-hover">
            <IconPlay size={24} />
          </div>
          <div class="lib-album-info">
            <div class="lib-album-title">{album.title}</div>
            <div class="lib-album-artist">{album.artist}</div>
          </div>
        </button>
      {:else}
        <div class="empty-state">
          {#if hasSearchQuery}
            No albums matching '{searchQuery}'
          {:else}
            No albums found
          {/if}
        </div>
      {/each}
    </div>
  {:else if activeSource === 'playlists'}
    {#if selectedPlaylist}
      <PlaylistDetailOverlay playlistName={selectedPlaylist} on:back={handlePlaylistBack} />
    {:else}
      <div class="list-view">
        {#each $playlists as name (name)}
          <button class="list-item" on:click={() => handlePlaylistClick(name)}>
            <span class="list-icon"><IconPlaylist size={16} /></span>
            <span class="list-title">{name}</span>
          </button>
        {:else}
          <div class="empty-state">No playlists</div>
        {/each}
      </div>
    {/if}
  {:else if activeSource === 'radio'}
    <div class="list-view">
      {#each $radioStations as station (station.id)}
        <button class="list-item" on:click={() => handleRadioClick(station)}>
          <span class="list-icon"><IconRadio size={16} /></span>
          <span class="list-title">{station.name}</span>
        </button>
      {:else}
        <div class="empty-state">No radio stations</div>
      {/each}
    </div>
  {:else if activeSource === 'favorites'}
    <div class="list-view">
      {#each $favoritesList as item (item.uri)}
        <button class="list-item" on:click={() => handleFavoriteClick(item)}>
          <span class="list-icon"><IconFavoriteFilled size={16} /></span>
          <span class="list-title">{item.title || item.name || 'Unknown'}</span>
          {#if item.artist}
            <span class="list-artist">{item.artist}</span>
          {/if}
        </button>
      {:else}
        <div class="empty-state">No favorites</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .library-tab {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(26, 17, 20, 0.6);
    border: 1px solid var(--md-outline-variant);
    border-radius: var(--md-shape-full, 9999px);
    flex-shrink: 0;
  }
  .search-icon {
    color: var(--md-outline);
    flex-shrink: 0;
  }
  .search-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--md-on-surface);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    min-width: 0;
  }
  .search-input::placeholder {
    color: var(--md-outline);
  }

  .search-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: -6px -10px -6px 0;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--md-outline);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 200ms ease-out;
  }
  .search-clear:hover {
    color: var(--md-on-surface);
  }

  .lib-album-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(95px, 1fr));
    gap: 8px;
    overflow-y: auto;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: var(--md-outline-variant) transparent;
  }

  .lib-album {
    border-radius: var(--md-shape-sm, 8px);
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease-out;
    border: none;
    padding: 0;
    background: none;
    text-align: left;
    color: var(--md-on-surface);
    position: relative;
  }
  .lib-album:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }
  .lib-album:active {
    transform: scale(0.97);
  }

  .lib-album-art-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
  }

  .lib-album-art {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    background: var(--md-surface-container, #261A1E);
  }

  .lib-album-art-fallback {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #0a0a2e 0%, #1a0533 30%, #2d1b69 50%, #0a0a2e 70%, #000 100%);
  }

  .lib-album-hover {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    color: var(--md-primary);
    opacity: 0;
    transition: opacity 200ms ease-out;
  }
  .lib-album:hover .lib-album-hover {
    opacity: 1;
  }

  .lib-album-info {
    padding: 4px 6px;
    background: rgba(26, 17, 20, 0.8);
  }
  .lib-album-title {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lib-album-artist {
    font-size: 11px;
    color: var(--md-outline);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .skeleton-card {
    pointer-events: none;
  }
  .skeleton-card .lib-album-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
  }

  .list-view {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: var(--md-outline-variant) transparent;
  }
  .list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    border-radius: var(--md-shape-sm, 8px);
    cursor: pointer;
    transition: background 200ms ease-out;
    min-height: 44px;
    border: none;
    background: none;
    color: var(--md-on-surface);
    text-align: left;
    font-family: inherit;
    width: 100%;
  }
  .list-item:hover {
    background: rgba(255, 177, 200, 0.06);
  }
  .list-icon {
    color: var(--md-outline);
    flex-shrink: 0;
  }
  .list-title {
    font-size: 13px;
    font-weight: 500;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .list-artist {
    font-size: 11px;
    color: var(--md-outline);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }

  .empty-state {
    padding: 24px;
    text-align: center;
    font-size: 12px;
    color: var(--md-outline);
    grid-column: 1 / -1;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
  }
  .error-text {
    font-size: 12px;
    color: var(--md-error, #FFB4AB);
  }
  .retry-btn {
    padding: 8px 16px;
    border-radius: var(--md-shape-full, 9999px);
    border: 1px solid var(--md-outline-variant);
    background: transparent;
    color: var(--md-primary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    transition: background 200ms ease-out;
  }
  .retry-btn:hover {
    background: rgba(255, 177, 200, 0.06);
  }
</style>
