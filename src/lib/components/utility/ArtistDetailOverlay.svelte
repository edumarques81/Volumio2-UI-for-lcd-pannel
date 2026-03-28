<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    artistAlbums,
    artistAlbumsLoading,
    artistAlbumsError,
    selectedArtist,
    libraryActions,
    type Album
  } from '$lib/stores/library';
  import Skeleton from '../Skeleton.svelte';
  import { IconBack, IconChevronRight } from '$lib/components/icons';

  export let artist: string;

  const dispatch = createEventDispatcher<{
    back: void;
    albumSelect: Album;
  }>();

  function handleBack() {
    libraryActions.clearSelectedArtist();
    dispatch('back');
  }

  function handleAlbumClick(album: Album) {
    dispatch('albumSelect', album);
  }

  // Fetch artist albums on mount
  libraryActions.fetchArtistAlbums(artist);
</script>

<div class="artist-detail">
  <div class="artist-detail-header">
    <button class="back-btn" on:click={handleBack} aria-label="Back to artists">
      <IconBack size={14} />
    </button>
    <div class="artist-name">{artist}</div>
    {#if !$artistAlbumsLoading}
      <span class="artist-count">{$artistAlbums.length} albums</span>
    {/if}
  </div>

  {#if $artistAlbumsError}
    <div class="error-state">
      <p class="error-text">{$artistAlbumsError}</p>
      <button class="retry-btn" on:click={() => libraryActions.fetchArtistAlbums(artist)}>Retry</button>
    </div>
  {:else if $artistAlbumsLoading}
    <div class="album-list">
      {#each Array(4) as _}
        <div class="album-row">
          <Skeleton variant="rectangle" width="64px" height="64px" />
          <div class="album-meta">
            <Skeleton width="60%" height="13px" />
            <Skeleton width="40%" height="11px" />
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="album-list">
      {#each $artistAlbums as album (album.id)}
        <button class="album-row" on:click={() => handleAlbumClick(album)}>
          <img
            class="album-art"
            src={album.albumArt}
            alt={album.title}
            loading="lazy"
          />
          <div class="album-meta">
            <div class="album-title">{album.title}</div>
            <div class="album-info">
              {#if album.year}{album.year} · {/if}{album.trackCount} tracks
            </div>
          </div>
          <span class="chevron"><IconChevronRight size={16} /></span>
        </button>
      {:else}
        <div class="empty-text">No albums found</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .artist-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(16, 10, 14, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .artist-detail-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--md-outline-variant);
    margin-bottom: 8px;
    flex-shrink: 0;
  }

  .back-btn {
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
  .back-btn:hover {
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
  }

  .artist-name {
    font-size: 16px;
    font-weight: 700;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .artist-count {
    font-size: 10px;
    color: var(--md-outline);
    flex-shrink: 0;
  }

  .album-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    scrollbar-width: thin;
    scrollbar-color: var(--md-outline-variant) transparent;
  }

  .album-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: var(--md-shape-sm, 8px);
    cursor: pointer;
    transition: background 200ms ease-out;
    min-height: 48px;
    border: none;
    background: none;
    color: var(--md-on-surface);
    text-align: left;
    font-family: inherit;
    width: 100%;
  }
  .album-row:hover {
    background: rgba(255, 177, 200, 0.06);
  }

  .album-art {
    width: 64px;
    height: 64px;
    border-radius: var(--md-shape-sm, 8px);
    flex-shrink: 0;
    object-fit: cover;
    background: var(--md-surface-container, #261A1E);
  }

  .album-meta {
    flex: 1;
    min-width: 0;
  }
  .album-title {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .album-info {
    font-size: 11px;
    color: var(--md-outline);
    margin-top: 2px;
  }

  .chevron {
    color: var(--md-outline-variant);
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
