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
    /* Frosted glass - 30% more blur/saturation than tiles */
    background: rgba(45, 45, 50, 0.7);
    backdrop-filter: blur(1.5px) saturate(135%);
    -webkit-backdrop-filter: blur(1.5px) saturate(135%);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    /* Subtle 3D effect */
    box-shadow:
      0 -1px 4px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .progress-bar {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent);
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
    border-radius: var(--radius-md);
    transition: background 0.2s;
  }

  .track-section:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .mini-art {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-shrink: 0;
    background: var(--color-bg-secondary);
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
    background: linear-gradient(145deg, #1a1a1c 0%, #2a2a2e 50%, #1c1c1e 100%);
  }

  .vinyl-icon {
    width: 36px;
    height: 36px;
    position: relative;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a1a1c 0%, #2d2d30 100%);
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.4),
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
    top: 5px;
    left: 5px;
    right: 5px;
    bottom: 5px;
    border-radius: 50%;
    background: repeating-radial-gradient(
      circle at center,
      rgba(60, 60, 65, 0.4) 0px,
      rgba(40, 40, 45, 0.6) 1px,
      rgba(60, 60, 65, 0.4) 2px
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
    background: linear-gradient(145deg, #e86a8a 0%, #c94466 100%);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.3),
      inset 0 1px 1px rgba(255, 255, 255, 0.2);
  }

  .vinyl-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #1a1a1c;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.5);
  }

  .mini-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .mini-title {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-artist {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
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
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .control-btn.primary {
    width: 52px;
    height: 52px;
    background: var(--color-accent);
    color: white;
  }

  .control-btn.primary:hover {
    background: var(--color-accent-dark);
  }
</style>
