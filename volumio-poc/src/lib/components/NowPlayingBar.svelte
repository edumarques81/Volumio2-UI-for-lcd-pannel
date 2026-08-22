<script lang="ts">
  import { currentTrack, isPlaying, playerActions } from '$lib/stores/player';
  import { navigationActions } from '$lib/stores/navigation';
  import Icon from './Icon.svelte';

  function handlePlayPause() {
    if ($isPlaying) {
      playerActions.pause();
    } else {
      playerActions.play();
    }
  }

  function openPlayer() {
    navigationActions.goToPlayer();
  }

  $: hasTrack = $currentTrack.title && $currentTrack.title !== 'No track';
</script>

<div class="now-playing-bar" class:has-track={hasTrack}>
  <button class="track-info" on:click={openPlayer}>
    <div class="album-art">
      {#if $currentTrack.albumart}
        <img src={$currentTrack.albumart} alt={$currentTrack.title} />
      {:else}
        <div class="art-placeholder">
          <Icon name="music-note" size={28} />
        </div>
      {/if}
    </div>
    <div class="track-details">
      <span class="track-title">{$currentTrack.title || 'Not Playing'}</span>
      <span class="track-artist">{$currentTrack.artist || 'Select music to play'}</span>
    </div>
  </button>

  <div class="controls">
    <button class="control-btn" on:click={playerActions.prev} aria-label="Previous">
      <Icon name="skip-back" size={32} />
    </button>
    <button class="control-btn play-btn" on:click={handlePlayPause} aria-label={$isPlaying ? 'Pause' : 'Play'}>
      <Icon name={$isPlaying ? 'pause' : 'play'} size={36} />
    </button>
    <button class="control-btn" on:click={playerActions.next} aria-label="Next">
      <Icon name="skip-forward" size={32} />
    </button>
  </div>
</div>

<style>
  .now-playing-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-xl);
    margin: 0 var(--spacing-xl) var(--spacing-lg);
    background: rgba(30, 30, 30, 0.85);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border-radius: var(--radius-xl);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .track-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    padding: var(--spacing-xs);
    border-radius: var(--radius-md);
    transition: background 0.2s;
  }

  .track-info:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .album-art {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-md);
    overflow: hidden;
    flex-shrink: 0;
    background: var(--color-bg-secondary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .album-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .art-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
    background: linear-gradient(135deg, #2c2c2e 0%, #3a3a3c 100%);
  }

  .track-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .track-title {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-artist {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex-shrink: 0;
  }

  .control-btn {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(1.05);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .control-btn.play-btn {
    width: 64px;
    height: 64px;
    background: rgba(255, 255, 255, 0.15);
  }

  .control-btn.play-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }
</style>
