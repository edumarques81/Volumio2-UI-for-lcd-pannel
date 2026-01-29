<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationActions } from '$lib/stores/navigation';
  import { uiActions } from '$lib/stores/ui';
  import {
    libraryArtists,
    libraryArtistsLoading,
    libraryArtistsError,
    selectedArtist,
    artistAlbums,
    artistAlbumsLoading,
    artistAlbumsError,
    selectedLibraryAlbum,
    libraryAlbumTracks,
    libraryAlbumTracksLoading,
    libraryAlbumTotalDuration,
    libraryActions,
    initLibraryStore,
    type Artist,
    type Album,
    type Track
  } from '$lib/stores/library';
  import Icon from '../Icon.svelte';
  import AlbumGrid from '../AlbumGrid.svelte';
  import TrackItem from '../TrackItem.svelte';
  import SkeletonList from '../SkeletonList.svelte';

  function handleBack() {
    if ($selectedLibraryAlbum) {
      libraryActions.clearSelectedAlbum();
    } else if ($selectedArtist) {
      libraryActions.clearSelectedArtist();
    } else {
      navigationActions.goHome();
    }
  }

  function handleArtistClick(artist: Artist) {
    libraryActions.fetchArtistAlbums(artist.name);
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

  function getTitle(): string {
    if ($selectedArtist) {
      return $selectedArtist;
    }
    return 'Artists';
  }

  onMount(() => {
    initLibraryStore();
    libraryActions.fetchArtists();
  });
</script>

<div class="artists-view" data-view="artists">
  <!-- Header -->
  <header class="view-header">
    <div class="header-left">
      <button class="back-btn" data-testid="back-button" on:click={handleBack} aria-label="Go back">
        <Icon name="chevron-left" size={28} />
      </button>
      <h1 class="title">{getTitle()}</h1>
      {#if $selectedArtist && !$selectedLibraryAlbum}
        <span class="subtitle">{$artistAlbums.length} albums</span>
      {/if}
    </div>

    <div class="header-right">
      {#if $selectedLibraryAlbum}
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
    {#if $libraryArtistsError}
      <div class="error-message">
        <Icon name="warning" size={48} />
        <p>{$libraryArtistsError}</p>
        <button class="retry-btn" on:click={() => libraryActions.fetchArtists()}>
          Retry
        </button>
      </div>
    {:else if $selectedLibraryAlbum}
      <!-- Album Detail View (tracks) -->
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
    {:else if $selectedArtist}
      <!-- Artist Albums View -->
      {#if $artistAlbumsLoading}
        <SkeletonList count={6} variant="browse" />
      {:else if $artistAlbumsError}
        <div class="error-message">
          <Icon name="warning" size={48} />
          <p>{$artistAlbumsError}</p>
          <button class="retry-btn" on:click={() => libraryActions.fetchArtistAlbums($selectedArtist || '')}>
            Retry
          </button>
        </div>
      {:else if $artistAlbums.length === 0}
        <div class="empty">
          <Icon name="album" size={64} />
          <p>No albums found</p>
        </div>
      {:else}
        <AlbumGrid
          albums={$artistAlbums}
          on:albumClick={handleAlbumClick}
          on:albumPlay={handleAlbumPlay}
          on:albumMore={handleAlbumMore}
        />
      {/if}
    {:else if $libraryArtistsLoading}
      <SkeletonList count={8} variant="browse" />
    {:else if $libraryArtists.length === 0}
      <div class="empty">
        <Icon name="artist" size={64} />
        <p>No artists found</p>
        <span class="hint">Add music to your library</span>
      </div>
    {:else}
      <!-- Artists List -->
      <div class="artists-grid">
        {#each $libraryArtists as artist}
          <button
            class="artist-card"
            on:click={() => handleArtistClick(artist)}
            data-testid="artist-card-{artist.name}"
          >
            <div class="artist-avatar">
              {#if artist.albumArt}
                <img
                  src={artist.albumArt}
                  alt={artist.name}
                  loading="lazy"
                  on:error={(e) => {
                    const img = e.currentTarget;
                    img.style.display = 'none';
                    const fallback = img.nextElementSibling;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div class="artist-placeholder artist-fallback" style="display: none;">
                  <Icon name="artist" size={48} />
                </div>
              {:else}
                <div class="artist-placeholder">
                  <Icon name="artist" size={48} />
                </div>
              {/if}
            </div>
            <div class="artist-info">
              <span class="artist-name">{artist.name}</span>
              <span class="artist-albums">{artist.albumCount} albums</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>

</div>

<style>
  .artists-view {
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

  .subtitle {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    margin-left: var(--spacing-sm);
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

  /* Artists Grid */
  .artists-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .artist-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background: rgba(45, 45, 50, 0.6);
    backdrop-filter: blur(1px);
    border-radius: var(--radius-lg);
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
    overflow: hidden; /* Prevent children from overflowing */
    min-width: 0; /* Allow grid item to shrink */
  }

  .artist-card:hover {
    background: rgba(55, 55, 60, 0.7);
    transform: translateY(-2px);
  }

  .artist-card:active {
    transform: scale(0.98);
  }

  .artist-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
    position: relative;
  }

  .artist-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .artist-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
  }

  .artist-fallback {
    position: absolute;
    top: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.2);
  }

  .artist-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    min-width: 0; /* Allow flex child to shrink below content size */
    overflow: hidden;
  }

  .artist-name {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .artist-albums {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
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

  /* LCD panel optimization */
  @media (max-height: 500px) {
    .artists-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: var(--spacing-md);
    }

    .artist-avatar {
      width: 80px;
      height: 80px;
    }

    .artist-name {
      font-size: var(--font-size-sm);
    }

    .artist-albums {
      font-size: var(--font-size-xs);
    }
  }
</style>
