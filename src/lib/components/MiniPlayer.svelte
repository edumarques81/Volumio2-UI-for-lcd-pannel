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

<div class="mini-player">
  <!-- Progress bar at top -->
  <div class="progress-bar">
    <div class="progress-fill" style="width: {progress}%"></div>
  </div>

  <div class="mini-content">
    <!-- Album art & info (clickable to open player) -->
    <button class="track-section" on:click={openPlayer}>
      <div class="mini-art">
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
      <div class="mini-info">
        <span class="mini-title">{$currentTrack.title}</span>
        <span class="mini-artist">{$currentTrack.artist}</span>
      </div>
    </button>

    <!-- Controls -->
    <div class="mini-controls">
      <button class="control-btn" on:click={playerActions.prev} aria-label="Previous">
        <Icon name="skip-back" size={24} />
      </button>
      <button class="control-btn primary" on:click={handlePlayPause} aria-label={$isPlaying ? 'Pause' : 'Play'}>
        <Icon name={$isPlaying ? 'pause' : 'play'} size={28} />
      </button>
      <button class="control-btn" on:click={playerActions.next} aria-label="Next">
        <Icon name="skip-forward" size={24} />
      </button>
    </div>
  </div>
</div>

<style>
  .mini-player {
    display: flex;
    flex-direction: column;
    background: var(--md-surface-container-high);
    border-top: 1px solid var(--md-outline-variant);
  }

  .progress-bar {
    width: 100%;
    height: 3px;
    background: var(--md-outline-variant);
  }

  .progress-fill {
    height: 100%;
    background: var(--md-primary);
    transition: width 0.3s linear;
  }

  .mini-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-lg);
    gap: var(--spacing-lg);
  }

  .track-section {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    padding: var(--spacing-xs);
    border-radius: var(--md-shape-medium);
    transition: background 0.2s;
  }

  .track-section:hover {
    background: rgba(239, 224, 225, 0.05);
  }

  .mini-art {
    width: 48px;
    height: 48px;
    border-radius: var(--md-shape-small);
    overflow: hidden;
    flex-shrink: 0;
    background: var(--md-surface-container);
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
    background: var(--md-surface-container-low);
  }

  .vinyl-icon {
    width: 36px;
    height: 36px;
    position: relative;
    border-radius: 50%;
    background: var(--md-surface-container);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .vinyl-outer {
    position: absolute;
    top: 2px;
    left: 2px;
    right: 2px;
    bottom: 2px;
    border-radius: 50%;
    background: var(--md-surface-container-low);
  }

  .vinyl-grooves {
    position: absolute;
    top: 5px;
    left: 5px;
    right: 5px;
    bottom: 5px;
    border-radius: 50%;
    background: repeating-radial-gradient(
      circle at center,
      var(--md-surface-container-high) 0px,
      var(--md-surface-container) 1px,
      var(--md-surface-container-high) 2px
    );
    box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.3);
  }

  .vinyl-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: linear-gradient(145deg, var(--md-primary) 0%, color-mix(in srgb, var(--md-primary) 70%, black 30%) 100%);
  }

  .vinyl-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--md-surface-container-lowest);
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.5);
  }

  .mini-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .mini-title {
    font-size: var(--md-body-large);
    font-weight: 500;
    color: var(--md-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-artist {
    font-size: var(--md-body-medium);
    color: var(--md-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-shrink: 0;
  }

  .control-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--md-shape-full);
    background: transparent;
    color: var(--md-on-surface);
    cursor: pointer;
    transition: background 0.2s;
  }

  .control-btn:hover {
    background: rgba(239, 224, 225, 0.1);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .control-btn.primary {
    width: 52px;
    height: 52px;
    background: var(--md-primary);
    color: var(--md-on-primary);
  }

  .control-btn.primary:hover {
    background: color-mix(in srgb, var(--md-primary) 85%, white 15%);
  }
</style>
