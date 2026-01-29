<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Track } from '$lib/stores/library';
  import Icon from './Icon.svelte';

  export let track: Track;
  export let index: number;
  export let albumArtist: string = '';

  const dispatch = createEventDispatcher<{
    play: Track;
    more: { track: Track; position: { x: number; y: number } };
  }>();

  function formatDuration(seconds: number): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handlePlay() {
    dispatch('play', track);
  }

  function handleMoreClick(event: MouseEvent) {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dispatch('more', {
      track,
      position: { x: rect.left, y: rect.bottom }
    });
  }

  // Show artist if different from album artist
  $: showArtist = track.artist && track.artist !== albumArtist;
</script>

<div class="track-item" data-testid="track-item-{track.id}">
  <button
    class="track-main"
    on:click={handlePlay}
    aria-label="Play {track.title}"
  >
    <span class="track-number">{track.trackNumber || index + 1}</span>
    <div class="track-info">
      <span class="track-title">{track.title}</span>
      {#if showArtist}
        <span class="track-artist">{track.artist}</span>
      {/if}
    </div>
    <span class="track-duration">{formatDuration(track.duration)}</span>
  </button>
  <button
    class="track-more"
    on:click={handleMoreClick}
    aria-label="More options for {track.title}"
  >
    <Icon name="more-vertical" size={20} />
  </button>
</div>

<style>
  .track-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: rgba(45, 45, 50, 0.4);
  }

  .track-item:first-child {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .track-item:last-child {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  .track-item:only-child {
    border-radius: var(--radius-md);
  }

  .track-item:hover {
    background: rgba(55, 55, 60, 0.6);
  }

  .track-item:active {
    background: rgba(65, 65, 70, 0.7);
  }

  .track-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    padding-right: 0;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    min-height: 48px;
    color: inherit;
  }

  .track-number {
    width: 32px;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    text-align: center;
    flex-shrink: 0;
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

  .track-duration {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    min-width: 40px;
    text-align: right;
  }

  .track-more {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: var(--radius-full);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    margin-right: var(--spacing-sm);
  }

  .track-more:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  .track-more:active {
    transform: scale(0.95);
  }

  /* LCD panel optimization */
  @media (max-height: 500px) {
    .track-main {
      min-height: 44px;
      padding: var(--spacing-sm) var(--spacing-md);
      padding-right: 0;
    }

    .track-title {
      font-size: var(--font-size-sm);
    }

    .track-artist {
      font-size: var(--font-size-xs);
    }

    .track-more {
      width: 40px;
      height: 40px;
    }
  }
</style>
