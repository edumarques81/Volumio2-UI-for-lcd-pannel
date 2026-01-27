<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Album } from '$lib/stores/library';
  import Icon from './Icon.svelte';

  export let albums: Album[] = [];
  export let showSource = false;

  const dispatch = createEventDispatcher<{
    albumClick: Album;
    albumPlay: Album;
  }>();

  function getSourceIcon(source: string): string {
    switch (source) {
      case 'usb': return 'storage';
      case 'nas': return 'storage';
      case 'local': return 'folder';
      case 'streaming': return 'cloud';
      default: return 'music-note';
    }
  }

  function handleAlbumClick(album: Album) {
    dispatch('albumClick', album);
  }

  function handlePlayClick(event: MouseEvent, album: Album) {
    event.stopPropagation();
    dispatch('albumPlay', album);
  }
</script>

<div class="album-grid">
  {#each albums as album}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="album-card"
      on:click={() => handleAlbumClick(album)}
      on:keydown={(e) => e.key === 'Enter' && handleAlbumClick(album)}
      role="button"
      tabindex="0"
      data-testid="album-card-{album.id}"
    >
      <div class="album-art">
        {#if album.albumArt}
          <img src={album.albumArt} alt={album.title} loading="lazy" />
        {:else}
          <div class="album-placeholder">
            <Icon name="album" size={48} />
          </div>
        {/if}
        <div class="album-overlay">
          <button
            class="play-btn"
            on:click={(e) => handlePlayClick(e, album)}
            aria-label="Play {album.title}"
          >
            <Icon name="play-filled" size={32} />
          </button>
        </div>
        {#if showSource}
          <div class="source-badge">
            <Icon name={getSourceIcon(album.source)} size={14} />
          </div>
        {/if}
      </div>
      <div class="album-info">
        <span class="album-title">{album.title}</span>
        <span class="album-artist">{album.artist}</span>
        {#if album.trackCount}
          <span class="album-tracks">{album.trackCount} tracks</span>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .album-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .album-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: rgba(45, 45, 50, 0.6);
    backdrop-filter: blur(1px);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    outline: none;
  }

  .album-card:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .album-card:hover {
    background: rgba(55, 55, 60, 0.7);
    transform: translateY(-2px);
  }

  .album-card:active {
    transform: scale(0.98);
  }

  .album-art {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
  }

  .album-art img {
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

  .album-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .album-card:hover .album-overlay {
    opacity: 1;
  }

  .play-btn {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--color-primary);
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .play-btn:hover {
    transform: scale(1.1);
  }

  .play-btn:active {
    transform: scale(0.95);
  }

  .source-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border-radius: var(--radius-full);
    color: var(--color-text-primary);
  }

  .album-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .album-title {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .album-artist {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .album-tracks {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  /* LCD panel optimization */
  @media (max-height: 500px) {
    .album-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: var(--spacing-md);
    }

    .album-title {
      font-size: var(--font-size-sm);
    }

    .album-artist {
      font-size: var(--font-size-xs);
    }

    .play-btn {
      width: 44px;
      height: 44px;
    }
  }
</style>
