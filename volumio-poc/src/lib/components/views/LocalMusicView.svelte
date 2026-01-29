<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationActions } from '$lib/stores/navigation';
  import { uiActions } from '$lib/stores/ui';
  import {
    localAlbums,
    lastPlayedTracks,
    localMusicLoading,
    localMusicError,
    albumSortOrder,
    trackSortOrder,
    selectedAlbum,
    albumTracks,
    albumTracksLoading,
    localMusicActions,
    initLocalMusicListeners,
    type LocalAlbum,
    type PlayHistoryEntry,
    type AlbumTrack,
    type AlbumSortOrder,
    type TrackSortOrder
  } from '$lib/stores/localMusic';
  import type { Album } from '$lib/stores/library';
  import Icon from '../Icon.svelte';
  import AlbumGrid from '../AlbumGrid.svelte';
  import LibraryContextMenu from '../LibraryContextMenu.svelte';
  import SkeletonList from '../SkeletonList.svelte';

  type TabType = 'albums' | 'lastPlayed';
  let activeTab: TabType = 'albums';

  // Album sort options
  const albumSortOptions: { value: AlbumSortOrder; label: string }[] = [
    { value: 'alphabetical', label: 'A-Z' },
    { value: 'by_artist', label: 'Artist' },
    { value: 'recently_added', label: 'Recent' }
  ];

  // Track sort options
  const trackSortOptions: { value: TrackSortOrder; label: string }[] = [
    { value: 'last_played', label: 'Recent' },
    { value: 'most_played', label: 'Most Played' },
    { value: 'alphabetical', label: 'A-Z' }
  ];

  function handleBack() {
    if ($selectedAlbum) {
      localMusicActions.deselectAlbum();
    } else {
      navigationActions.goHome();
    }
  }

  function handleTabClick(tab: TabType) {
    activeTab = tab;
  }

  // Convert LocalAlbum to Album for AlbumGrid compatibility
  function toAlbum(localAlbum: LocalAlbum): Album {
    return {
      id: localAlbum.id,
      title: localAlbum.title,
      artist: localAlbum.artist,
      uri: localAlbum.uri,
      albumArt: localAlbum.albumArt,
      trackCount: localAlbum.trackCount,
      source: localAlbum.source
    };
  }

  // Convert Album back to LocalAlbum (for event handlers)
  function toLocalAlbum(album: Album): LocalAlbum {
    const localAlbum = $localAlbums.find(a => a.id === album.id);
    return localAlbum || {
      id: album.id,
      title: album.title,
      artist: album.artist,
      uri: album.uri,
      albumArt: album.albumArt || '',
      trackCount: album.trackCount || 0,
      source: album.source as 'usb' | 'local'
    };
  }

  function handleAlbumClick(event: CustomEvent<Album>) {
    const localAlbum = toLocalAlbum(event.detail);
    localMusicActions.selectAlbum(localAlbum);
  }

  function handleAlbumPlay(event: CustomEvent<Album>) {
    const localAlbum = toLocalAlbum(event.detail);
    localMusicActions.playAlbum(localAlbum);
  }

  function handleAlbumMore(event: CustomEvent<{ album: Album; position: { x: number; y: number } }>) {
    uiActions.openContextMenu(event.detail.album, 'album', event.detail.position);
  }

  function handlePlayAlbum(album: LocalAlbum) {
    localMusicActions.playAlbum(album);
  }

  function handleAlbumTrackClick(track: AlbumTrack) {
    localMusicActions.playAlbumTrack(track);
  }

  function handleTrackClick(track: PlayHistoryEntry) {
    localMusicActions.playTrack(track);
  }

  function handleAlbumSortChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    localMusicActions.setAlbumSort(select.value as AlbumSortOrder);
  }

  function handleTrackSortChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    localMusicActions.setTrackSort(select.value as TrackSortOrder);
  }

  function formatPlayedAt(playedAt: string): string {
    const date = new Date(playedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getSourceIcon(source: string): string {
    switch (source) {
      case 'usb': return 'storage';
      case 'local': return 'folder';
      default: return 'music-note';
    }
  }

  onMount(() => {
    initLocalMusicListeners();
    localMusicActions.refresh();
  });
</script>

<div class="local-music-view" data-view="localMusic">
  <!-- Header -->
  <header class="view-header">
    <div class="header-left">
      <button class="back-btn" data-testid="back-button" on:click={handleBack} aria-label="Go back">
        <Icon name="chevron-left" size={28} />
      </button>
      <h1 class="title">{$selectedAlbum ? $selectedAlbum.title : 'Local Music'}</h1>
      {#if $selectedAlbum}
        <span class="subtitle">{$selectedAlbum.artist}</span>
      {/if}
    </div>

    <div class="header-right">
      {#if !$selectedAlbum}
        <!-- Tabs -->
        <div class="tabs">
          <button
            class="tab"
            class:active={activeTab === 'albums'}
            on:click={() => handleTabClick('albums')}
          >
            Albums
          </button>
          <button
            class="tab"
            class:active={activeTab === 'lastPlayed'}
            on:click={() => handleTabClick('lastPlayed')}
          >
            Last Played
          </button>
        </div>

        <!-- Sort dropdown -->
        {#if activeTab === 'albums'}
          <select
            class="sort-select"
            value={$albumSortOrder}
            on:change={handleAlbumSortChange}
          >
            {#each albumSortOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        {:else}
          <select
            class="sort-select"
            value={$trackSortOrder}
            on:change={handleTrackSortChange}
          >
            {#each trackSortOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        {/if}
      {:else}
        <!-- Play All button for album detail view -->
        <button class="play-all-btn" on:click={() => $selectedAlbum && handlePlayAlbum($selectedAlbum)}>
          <Icon name="play" size={20} />
          Play All
        </button>
      {/if}
    </div>
  </header>

  <!-- Content -->
  <div class="view-content">
    {#if $localMusicError}
      <div class="error-message">
        <Icon name="warning" size={48} />
        <p>{$localMusicError}</p>
        <button class="retry-btn" on:click={() => localMusicActions.refresh()}>
          Retry
        </button>
      </div>
    {:else if $selectedAlbum}
      <!-- Album Detail View -->
      {#if $albumTracksLoading}
        <SkeletonList count={6} variant="browse" />
      {:else if $albumTracks.length === 0}
        <div class="empty">
          <Icon name="music-note" size={64} />
          <p>No tracks found</p>
        </div>
      {:else}
        <div class="album-detail">
          <div class="album-header">
            <div class="album-cover">
              {#if $selectedAlbum.albumArt}
                <img src={$selectedAlbum.albumArt} alt={$selectedAlbum.title} />
              {:else}
                <div class="album-placeholder">
                  <Icon name="album" size={64} />
                </div>
              {/if}
            </div>
            <div class="album-meta">
              <span class="track-count">{$albumTracks.length} tracks</span>
            </div>
          </div>
          <div class="album-tracks-list">
            {#each $albumTracks as track, index}
              <button
                class="album-track-item"
                on:click={() => handleAlbumTrackClick(track)}
              >
                <span class="track-number">{track.trackNumber || index + 1}</span>
                <div class="track-info">
                  <span class="track-title">{track.title}</span>
                  {#if track.artist && track.artist !== $selectedAlbum?.artist}
                    <span class="track-artist">{track.artist}</span>
                  {/if}
                </div>
                <span class="track-duration">{formatDuration(track.duration)}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {:else if $localMusicLoading}
      <SkeletonList count={6} variant="browse" />
    {:else if activeTab === 'albums'}
      <!-- Albums Grid -->
      {#if $localAlbums.length === 0}
        <div class="empty">
          <Icon name="folder-open" size={64} />
          <p>No local albums found</p>
          <span class="hint">Add music to INTERNAL or USB storage</span>
        </div>
      {:else}
        <AlbumGrid
          albums={$localAlbums.map(toAlbum)}
          showSource={true}
          on:albumClick={handleAlbumClick}
          on:albumPlay={handleAlbumPlay}
          on:albumMore={handleAlbumMore}
        />
      {/if}
    {:else}
      <!-- Last Played List -->
      {#if $lastPlayedTracks.length === 0}
        <div class="empty">
          <Icon name="history" size={64} />
          <p>No play history yet</p>
          <span class="hint">Tracks you play manually will appear here</span>
        </div>
      {:else}
        <div class="tracks-list">
          {#each $lastPlayedTracks as track}
            <button
              class="track-item"
              on:click={() => handleTrackClick(track)}
            >
              <div class="track-art">
                {#if track.albumArt}
                  <img src={track.albumArt} alt={track.album} loading="lazy" />
                {:else}
                  <div class="track-placeholder">
                    <Icon name="music-note" size={24} />
                  </div>
                {/if}
              </div>
              <div class="track-info">
                <span class="track-title">{track.title}</span>
                <span class="track-artist">{track.artist}</span>
              </div>
              <div class="track-meta">
                <span class="played-at">{formatPlayedAt(track.playedAt)}</span>
                {#if track.playCount > 1}
                  <span class="play-count">{track.playCount}x</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Context Menu -->
  <LibraryContextMenu />
</div>

<style>
  .local-music-view {
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

  .tabs {
    display: flex;
    gap: var(--spacing-xs);
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-full);
    padding: 4px;
  }

  .tab {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: var(--font-size-base);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab.active {
    background: rgba(255, 255, 255, 0.2);
    color: var(--color-text-primary);
  }

  .tab:hover:not(.active) {
    background: rgba(255, 255, 255, 0.1);
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

  /* Tracks List */
  .tracks-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .track-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: rgba(45, 45, 50, 0.5);
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .track-item:hover {
    background: rgba(55, 55, 60, 0.6);
  }

  .track-item:active {
    transform: scale(0.99);
  }

  .track-art {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
  }

  .track-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .track-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
  }

  .track-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .track-title {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-artist {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  .played-at {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .play-count {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  /* Header subtitle */
  .subtitle {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    margin-left: var(--spacing-sm);
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
    align-items: flex-end;
    gap: var(--spacing-lg);
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

  .album-meta {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .album-meta .track-count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  /* Album Tracks List */
  .album-tracks-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .album-track-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    background: rgba(45, 45, 50, 0.4);
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .album-track-item:first-child {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .album-track-item:last-child {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  .album-track-item:only-child {
    border-radius: var(--radius-md);
  }

  .album-track-item:hover {
    background: rgba(55, 55, 60, 0.6);
  }

  .album-track-item:active {
    background: rgba(65, 65, 70, 0.7);
  }

  .track-number {
    width: 32px;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    text-align: center;
    flex-shrink: 0;
  }

  .album-track-item .track-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .album-track-item .track-title {
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .album-track-item .track-artist {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-duration {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }
</style>
