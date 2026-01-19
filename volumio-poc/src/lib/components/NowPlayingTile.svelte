<script lang="ts">
  import { currentTrack, isPlaying, playerActions } from '$lib/stores/player';
  import { navigationActions } from '$lib/stores/navigation';
  import Icon from './Icon.svelte';

  let imageError = false;

  function handlePlayPause(e: Event) {
    e.stopPropagation();
    if ($isPlaying) {
      playerActions.pause();
    } else {
      playerActions.play();
    }
  }

  function handlePrev(e: Event) {
    e.stopPropagation();
    playerActions.prev();
  }

  function handleNext(e: Event) {
    e.stopPropagation();
    playerActions.next();
  }

  function openPlayer() {
    navigationActions.goToPlayer();
  }

  function handleImageError() {
    imageError = true;
  }

  // Reset error state when albumart changes
  $: if ($currentTrack.albumart) {
    imageError = false;
  }

  $: hasTrack = $currentTrack.title && $currentTrack.title !== 'No track';
  $: showPlaceholder = !$currentTrack.albumart || imageError;
</script>

<div class="now-playing-tile" on:click={openPlayer} on:keypress={openPlayer} role="button" tabindex="0">
  <div class="tile-content">
    <div class="album-art">
      {#if !showPlaceholder}
        <img src={$currentTrack.albumart} alt={$currentTrack.title} on:error={handleImageError} />
      {:else}
        <div class="art-placeholder">
          <div class="vinyl-icon">
            <div class="vinyl-outer"></div>
            <div class="vinyl-grooves"></div>
            <div class="vinyl-label"></div>
            <div class="vinyl-center"></div>
          </div>
        </div>
      {/if}
    </div>

    <div class="track-info">
      <span class="track-title">{$currentTrack.title || 'Not Playing'}</span>
      <span class="track-artist">{$currentTrack.artist || 'Tap to play'}</span>
    </div>

    <div class="controls">
      <button class="control-btn" on:click={handlePrev} aria-label="Previous">
        <Icon name="skip-back" size={49} />
      </button>
      <button class="control-btn play-btn" on:click={handlePlayPause} aria-label={$isPlaying ? 'Pause' : 'Play'}>
        <Icon name={$isPlaying ? 'pause' : 'play'} size={57} />
      </button>
      <button class="control-btn" on:click={handleNext} aria-label="Next">
        <Icon name="skip-forward" size={49} />
      </button>
    </div>
  </div>
</div>

<style>
  .now-playing-tile {
    display: flex;
    align-items: center;
    min-width: 650px;
    max-width: 771px;
    height: auto;
    padding: 23px 33px;
    /* Frosted glass with blur */
    background: rgba(45, 45, 50, 0.65);
    backdrop-filter: blur(1px) saturate(105%);
    -webkit-backdrop-filter: blur(1px) saturate(105%);
    border-radius: 33px;
    cursor: pointer;
    transition: all 0.15s ease-out;
    -webkit-tap-highlight-color: transparent;
    /* Subtle 3D pop-out effect */
    box-shadow:
      0 1px 4px rgba(0, 0, 0, 0.2),
      0 2px 6px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .now-playing-tile:hover {
    background: rgba(55, 55, 60, 0.7);
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.25),
      0 3px 8px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .now-playing-tile:active {
    transform: scale(0.97);
    background: rgba(50, 50, 55, 0.75);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .tile-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    width: 100%;
  }

  .album-art {
    width: 146px;
    height: 146px;
    border-radius: var(--radius-xl);
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
    background: linear-gradient(145deg, #1a1a1c 0%, #2a2a2e 50%, #1c1c1e 100%);
  }

  .vinyl-icon {
    width: 113px;
    height: 113px;
    position: relative;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a1a1c 0%, #2d2d30 100%);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.4),
      inset 0 1px 1px rgba(255, 255, 255, 0.05);
  }

  .vinyl-outer {
    position: absolute;
    top: 2px;
    left: 2px;
    right: 2px;
    bottom: 2px;
    border-radius: 50%;
    background: linear-gradient(135deg, #252528 0%, #1a1a1c 100%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
  }

  .vinyl-grooves {
    position: absolute;
    top: 17px;
    left: 17px;
    right: 17px;
    bottom: 17px;
    border-radius: 50%;
    background: repeating-radial-gradient(
      circle at center,
      rgba(60, 60, 65, 0.4) 0px,
      rgba(40, 40, 45, 0.6) 1px,
      rgba(60, 60, 65, 0.4) 2px
    );
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.3);
  }

  .vinyl-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(145deg, #e86a8a 0%, #c94466 100%);
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.3),
      inset 0 1px 1px rgba(255, 255, 255, 0.2);
  }

  .vinyl-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #1a1a1c;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .track-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
  }

  .track-title {
    font-size: var(--font-size-lg);
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
    gap: var(--spacing-xs);
    flex-shrink: 0;
  }

  .control-btn {
    width: 90px;
    height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .control-btn:active {
    transform: scale(0.9);
  }

  .control-btn.play-btn {
    width: 98px;
    height: 98px;
    background: rgba(255, 255, 255, 0.15);
  }

  .control-btn.play-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }
</style>
