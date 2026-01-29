<script lang="ts">
  import { currentTrack, isPlaying, seek, duration, playerActions } from '$lib/stores/player';
  import { navigationActions } from '$lib/stores/navigation';
  import Icon from './Icon.svelte';

  let imageError = false;

  $: progress = $duration > 0 ? ($seek / $duration) * 100 : 0;

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

  function handleImageError() {
    imageError = true;
  }

  // Reset error state when albumart changes
  $: if ($currentTrack.albumart) {
    imageError = false;
  }

  $: showPlaceholder = !$currentTrack.albumart || imageError;
</script>

<div class="mobile-mini-player">
  <!-- Progress bar at top -->
  <div class="progress-bar">
    <div class="progress-fill" style="width: {progress}%"></div>
  </div>

  <div class="mini-content">
    <!-- Track section (clickable to open player) -->
    <button class="track-section" on:click={openPlayer}>
      <div class="mini-art">
        {#if !showPlaceholder}
          <img src={$currentTrack.albumart} alt={$currentTrack.title} on:error={handleImageError} />
        {:else}
          <div class="art-placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
        {/if}
      </div>
      <div class="track-info">
        <span class="track-title">{$currentTrack.title}</span>
        <span class="track-artist">{$currentTrack.artist}</span>
      </div>
    </button>

    <!-- Controls - fixed width, never shrink -->
    <div class="controls">
      <button
        class="control-btn"
        on:click|stopPropagation={playerActions.prev}
        aria-label="Previous"
      >
        <Icon name="skip-back" size={22} />
      </button>
      <button
        class="control-btn play-btn"
        on:click|stopPropagation={handlePlayPause}
        aria-label={$isPlaying ? 'Pause' : 'Play'}
      >
        <Icon name={$isPlaying ? 'pause' : 'play'} size={24} />
      </button>
      <button
        class="control-btn"
        on:click|stopPropagation={playerActions.next}
        aria-label="Next"
      >
        <Icon name="skip-forward" size={22} />
      </button>
    </div>
  </div>
</div>

<style>
  .mobile-mini-player {
    display: flex;
    flex-direction: column;
    background: rgba(28, 28, 32, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .progress-bar {
    width: 100%;
    height: 2px;
    background: rgba(255, 255, 255, 0.1);
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent, #e86a8a);
    transition: width 0.3s linear;
  }

  .mini-content {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 12px;
    height: 56px;
    box-sizing: border-box;
  }

  .track-section {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0; /* Allow shrinking */
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    padding: 4px;
    margin: -4px;
    border-radius: 8px;
    transition: background 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .track-section:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .track-section:active {
    background: rgba(255, 255, 255, 0.08);
  }

  .mini-art {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    background: rgba(40, 40, 45, 0.8);
  }

  .mini-art img {
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
    background: linear-gradient(135deg, #2a2a2e 0%, #1c1c1e 100%);
    color: rgba(255, 255, 255, 0.3);
  }

  .art-placeholder svg {
    width: 20px;
    height: 20px;
  }

  .track-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0; /* Allow text truncation */
    flex: 1;
  }

  .track-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary, white);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-artist {
    font-size: 12px;
    color: var(--color-text-secondary, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Controls container - NEVER shrink */
  .controls {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .control-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-primary, white);
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .control-btn:active {
    transform: scale(0.92);
    background: rgba(255, 255, 255, 0.15);
  }

  .control-btn.play-btn {
    width: 44px;
    height: 44px;
    background: var(--color-accent, #e86a8a);
    color: white;
  }

  .control-btn.play-btn:hover {
    background: var(--color-accent-dark, #d05a7a);
  }

  /* Landscape adjustments - more compact */
  @media (orientation: landscape) and (max-height: 500px) {
    .mini-content {
      height: 48px;
      padding: 6px 16px;
    }

    .mini-art {
      width: 36px;
      height: 36px;
    }

    .track-title {
      font-size: 13px;
    }

    .track-artist {
      font-size: 11px;
    }

    .control-btn {
      width: 36px;
      height: 36px;
    }

    .control-btn.play-btn {
      width: 40px;
      height: 40px;
    }
  }

  /* Very narrow screens - hide prev/next */
  @media (max-width: 320px) {
    .control-btn:not(.play-btn) {
      display: none;
    }

    .mini-content {
      gap: 8px;
    }
  }
</style>
