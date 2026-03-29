<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    libraryAlbumTracks,
    libraryAlbumTracksLoading,
    libraryAlbumTracksError,
    libraryAlbumTotalDuration,
    libraryActions,
    type Album,
    type Track
  } from '$lib/stores/library';
  import Skeleton from '../Skeleton.svelte';
  import { IconBack, IconPlay, IconAddToQueue, IconFavorite } from '$lib/components/icons';

  export let album: Album;

  const dispatch = createEventDispatcher<{ back: void }>();

  function formatDuration(seconds: number): string {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function formatTotalDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  }

  function handleBack() {
    libraryActions.clearSelectedAlbum();
    dispatch('back');
  }

  function handlePlayAll() {
    libraryActions.playAlbum(album);
  }

  function handleAddToQueue() {
    libraryActions.addAlbumToQueue(album);
  }

  function handlePlayTrack(track: Track) {
    libraryActions.playTrack(track);
  }

  function handleAddTrackToQueue(track: Track) {
    libraryActions.addTrackToQueue(track);
  }

  function handleRetry() {
    libraryActions.fetchAlbumTracks(album);
  }

  // Fetch tracks on mount
  libraryActions.fetchAlbumTracks(album);
</script>

<div class="lib-detail">
  <div class="lib-detail-header">
    <button class="lib-detail-back" on:click={handleBack} aria-label="Back to albums">
      <IconBack size={14} />
    </button>
    <div class="lib-detail-art-wrap">
      <img
        class="lib-detail-art"
        src={album.albumArt}
        alt={album.title}
        on:error={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div class="lib-detail-art-fallback"></div>
    </div>
    <div class="lib-detail-meta">
      <div class="lib-detail-title">{album.title}</div>
      <div class="lib-detail-artist">{album.artist}</div>
      {#if !$libraryAlbumTracksLoading}
        <div class="lib-detail-info">
          {$libraryAlbumTracks.length} tracks · {formatTotalDuration($libraryAlbumTotalDuration)}
        </div>
      {/if}
    </div>
  </div>

  <div class="lib-detail-actions">
    <button class="action-btn primary" on:click={handlePlayAll}>
      <IconPlay size={12} />
      Play All
    </button>
    <button class="action-btn" on:click={handleAddToQueue}>
      <IconAddToQueue size={14} />
      Add to Queue
    </button>
  </div>

  {#if $libraryAlbumTracksError}
    <div class="error-state">
      <p class="error-text">{$libraryAlbumTracksError}</p>
      <button class="retry-btn" on:click={handleRetry}>Retry</button>
    </div>
  {:else if $libraryAlbumTracksLoading}
    <div class="lib-detail-tracks">
      {#each Array(6) as _}
        <div class="ld-track">
          <Skeleton width="18px" height="12px" />
          <Skeleton width="60%" height="12px" />
          <Skeleton width="30px" height="10px" />
        </div>
      {/each}
    </div>
  {:else}
    <div class="lib-detail-tracks">
      {#each $libraryAlbumTracks as track (track.id)}
        <div class="ld-track-row">
          <button class="ld-track" on:click={() => handlePlayTrack(track)}>
            <span class="ld-track-num">{track.trackNumber}</span>
            <span class="ld-track-title">{track.title}</span>
            <span class="ld-track-dur">{formatDuration(track.duration)}</span>
          </button>
          <button
            class="ld-track-add"
            on:click={() => handleAddTrackToQueue(track)}
            aria-label="Add to queue"
          >
            <IconAddToQueue size={14} />
          </button>
        </div>
      {:else}
        <div class="empty-text">No tracks found</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .lib-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(16, 10, 14, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .lib-detail-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--md-outline-variant);
    margin-bottom: 8px;
    flex-shrink: 0;
  }

  .lib-detail-back {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: var(--md-surface-container-high, #312228);
    color: var(--md-on-surface);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms ease-out;
    flex-shrink: 0;
  }
  .lib-detail-back:hover {
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
  }

  .lib-detail-art-wrap {
    width: 54px;
    height: 54px;
    border-radius: var(--md-shape-sm, 8px);
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }

  .lib-detail-art {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lib-detail-art-fallback {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #0a0a2e 0%, #1a0533 30%, #2d1b69 50%, #0a0a2e 70%, #000 100%);
  }

  .lib-detail-meta {
    min-width: 0;
    flex: 1;
  }
  .lib-detail-title {
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lib-detail-artist {
    font-size: 11px;
    color: var(--md-on-surface-variant);
  }
  .lib-detail-info {
    font-size: 10px;
    color: var(--md-outline);
    margin-top: 2px;
  }

  .lib-detail-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    flex-shrink: 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--md-shape-full, 9999px);
    border: 1px solid var(--md-outline-variant);
    background: transparent;
    color: var(--md-on-surface-variant);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease-out;
    min-height: 36px;
    font-family: inherit;
  }
  .action-btn:hover {
    background: rgba(255, 177, 200, 0.06);
  }
  .action-btn.primary {
    background: var(--md-primary);
    color: var(--md-on-primary);
    border-color: var(--md-primary);
  }
  .action-btn.primary:hover {
    background: var(--md-on-primary-container);
    color: var(--md-primary);
  }

  .lib-detail-tracks {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--md-outline-variant) transparent;
    display: flex;
    flex-direction: column;
  }

  .ld-track-row {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .ld-track-add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--md-outline-variant);
    cursor: pointer;
    opacity: 0;
    transition: all 200ms ease-out;
    flex-shrink: 0;
  }
  .ld-track-row:hover .ld-track-add {
    opacity: 1;
  }
  .ld-track-add:hover {
    color: var(--md-primary);
    background: rgba(255, 177, 200, 0.1);
  }

  .ld-track {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border-radius: var(--md-shape-xs, 4px);
    cursor: pointer;
    transition: background 200ms ease-out;
    min-height: 38px;
    border: none;
    background: none;
    color: var(--md-on-surface);
    text-align: left;
    font-family: inherit;
    flex: 1;
    min-width: 0;
  }
  .ld-track:hover {
    background: rgba(255, 177, 200, 0.06);
  }

  .ld-track-num {
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    color: var(--md-outline);
    min-width: 18px;
    text-align: right;
    flex-shrink: 0;
  }
  .ld-track-title {
    font-size: 12px;
    font-weight: 500;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ld-track-dur {
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    color: var(--md-outline);
    flex-shrink: 0;
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
  }

  .empty-text {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--md-outline);
  }
</style>
