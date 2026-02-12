<script lang="ts">
  import { playerState, currentTrack, isPlaying, seek, duration, progress, trackQuality, shuffle, repeat, playerActions } from '$lib/stores/player';
  import { queue, queueActions } from '$lib/stores/queue';
  import { navigationActions } from '$lib/stores/navigation';
  import { classifySource, getSourceLabel, shouldShowSource } from '$lib/utils/sourceClassifier';
  import Icon from '../Icon.svelte';
  import MiniPlayerQueueStrip from './MiniPlayerQueueStrip.svelte';

  // Derived source info from current track URI
  $: sourceType = classifySource($playerState?.uri, $playerState?.service);
  $: showSource = shouldShowSource(sourceType);
  $: sourceLabel = getSourceLabel(sourceType);

  // Image error handling
  let imageError = false;

  function handleImageError() {
    imageError = true;
  }

  // Reset error state when albumart changes
  $: if ($currentTrack.albumart) {
    imageError = false;
  }

  $: showPlaceholder = !$currentTrack.albumart || imageError;

  // Format time helper
  function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Playback controls
  function handlePlayPause() {
    if ($isPlaying) {
      playerActions.pause();
    } else {
      playerActions.play();
    }
  }

  function handlePrev() {
    playerActions.prev();
  }

  function handleNext() {
    playerActions.next();
  }

  function handleShuffle() {
    playerActions.toggleShuffle();
  }

  function handleRepeat() {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf($repeat);
    const nextIndex = (currentIndex + 1) % modes.length;
    playerActions.setRepeat(modes[nextIndex]);
  }

  // Seek handling
  let isSeeking = false;
  let seekValue = 0;

  $: if (!isSeeking) {
    seekValue = $seek;
  }

  function handleSeekStart() {
    isSeeking = true;
  }

  function handleSeekEnd() {
    isSeeking = false;
    playerActions.seekTo(seekValue);
  }

  function handleSeekInput(e: Event) {
    const target = e.target as HTMLInputElement;
    seekValue = parseInt(target.value);
  }

  // Navigation
  function goToFullPlayer() {
    navigationActions.goToPlayer();
  }

  // Format info for badge
  $: formatBadge = $playerState?.trackType?.toUpperCase() || '';
  $: sampleRateBadge = $playerState?.samplerate
    ? `${(parseInt($playerState.samplerate) / 1000).toFixed(1)}kHz`
    : '';
  $: bitDepthBadge = $playerState?.bitdepth ? `${$playerState.bitdepth}bit` : '';
</script>

<div class="docked-mini-player" data-testid="docked-mini-player">
  <!-- Top-right light effect overlay -->
  <div class="light-effect"></div>

  <!-- Deep sunk effect overlay on right edge -->
  <div class="sunk-edge"></div>

  <!-- Header row with source and expand on the right -->
  <div class="header-row">
    <div class="header-left">
      <!-- Empty for balance -->
    </div>
    <div class="header-right">
      {#if showSource}
        <span class="source-label" data-testid="miniplayer-source">{sourceLabel}</span>
      {/if}
      <button
        class="expand-btn"
        data-testid="miniplayer-expand"
        on:click={goToFullPlayer}
        aria-label="Expand player"
      >
        <Icon name="expand" size={24} />
      </button>
    </div>
  </div>

  <!-- Main content area -->
  <div class="main-content">
    <!-- Large album art - now bigger and positioned to align with UP NEXT -->
    <div class="artwork-section" data-testid="miniplayer-artwork">
      {#if !showPlaceholder}
        <img
          src={$currentTrack.albumart}
          alt={$currentTrack.title}
          class="album-art"
          on:error={handleImageError}
        />
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

    <!-- Track info + controls column -->
    <div class="info-controls-column">
      <!-- Track info -->
      <div class="track-info" data-testid="miniplayer-track-info">
        <span class="track-title">{$currentTrack.title || 'Not Playing'}</span>
        <span class="track-artist">{$currentTrack.artist || 'Unknown Artist'}</span>
        <span class="track-album">{$currentTrack.album || ''}</span>

        <!-- Format badges -->
        <div class="format-badges" data-testid="miniplayer-quality">
          {#if formatBadge}
            <span class="badge format-badge">{formatBadge}</span>
          {/if}
          {#if sampleRateBadge}
            <span class="badge sample-badge">{sampleRateBadge}</span>
          {/if}
          {#if bitDepthBadge}
            <span class="badge bit-badge">{bitDepthBadge}</span>
          {/if}
        </div>
      </div>

      <!-- Transport controls -->
      <div class="transport-controls" data-testid="miniplayer-controls">
        <button
          class="control-btn shuffle-btn"
          class:active={$shuffle}
          on:click={handleShuffle}
          aria-label="Shuffle"
        >
          <Icon name="shuffle" size={24} />
        </button>

        <button class="control-btn" on:click={handlePrev} aria-label="Previous">
          <Icon name="skip-back" size={32} />
        </button>

        <button
          class="control-btn play-btn"
          on:click={handlePlayPause}
          aria-label={$isPlaying ? 'Pause' : 'Play'}
        >
          <Icon name={$isPlaying ? 'pause' : 'play'} size={40} />
        </button>

        <button class="control-btn" on:click={handleNext} aria-label="Next">
          <Icon name="skip-forward" size={32} />
        </button>

        <button
          class="control-btn repeat-btn"
          class:active={$repeat !== 'off'}
          on:click={handleRepeat}
          aria-label="Repeat"
        >
          <Icon name={$repeat === 'one' ? 'repeat-1' : 'repeat'} size={24} />
        </button>
      </div>

      <!-- Progress bar - aligned with controls, squared and thicker -->
      <div class="progress-section" data-testid="miniplayer-progress">
        <span class="time current-time">{formatTime(isSeeking ? seekValue : $seek)}</span>
        <div class="seek-track">
          <div class="seek-progress" style="width: {$duration > 0 ? ((isSeeking ? seekValue : $seek) / $duration) * 100 : 0}%"></div>
          <input
            id="miniplayer-seek-slider"
            type="range"
            class="seek-slider"
            min="0"
            max={$duration || 100}
            value={isSeeking ? seekValue : $seek}
            on:mousedown={handleSeekStart}
            on:touchstart={handleSeekStart}
            on:mouseup={handleSeekEnd}
            on:touchend={handleSeekEnd}
            on:input={handleSeekInput}
          />
        </div>
        <span class="time duration-time">{formatTime($duration)}</span>
      </div>
    </div>
  </div>

  <!-- Queue strip -->
  <MiniPlayerQueueStrip />
</div>

<style>
  .docked-mini-player {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 12px 20px 12px;
    background: linear-gradient(165deg, rgba(38, 38, 44, 0.97) 0%, rgba(22, 22, 26, 0.99) 60%, rgba(18, 18, 22, 1) 100%);
    box-sizing: border-box;
    overflow: hidden;
  }

  /* Top-right light effect - like light coming from top-right */
  .light-effect {
    position: absolute;
    top: -50%;
    right: -30%;
    width: 80%;
    height: 120%;
    pointer-events: none;
    background: radial-gradient(
      ellipse at center,
      rgba(255, 255, 255, 0.08) 0%,
      rgba(255, 255, 255, 0.04) 25%,
      rgba(255, 255, 255, 0.01) 50%,
      transparent 70%
    );
    transform: rotate(-15deg);
    z-index: 0;
  }

  /* Deep sunk effect on right edge */
  .sunk-edge {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 50px;
    pointer-events: none;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(0, 0, 0, 0.1) 20%,
      rgba(0, 0, 0, 0.25) 60%,
      rgba(0, 0, 0, 0.45) 100%
    );
    /* Inner shadow for depth */
    box-shadow: inset -20px 0 35px -15px rgba(0, 0, 0, 0.5);
    z-index: 2;
  }

  /* Subtle inner glow on left side for contrast */
  .docked-mini-player::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.08) 0%,
      rgba(255, 255, 255, 0.03) 50%,
      rgba(255, 255, 255, 0.05) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  /* Header row */
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    position: relative;
    z-index: 1;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .source-label {
    height: 44px;
    display: flex;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 14px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
  }

  .expand-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .expand-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .expand-btn:active {
    transform: scale(0.95);
  }

  /* Main content layout */
  .main-content {
    display: flex;
    gap: 24px;
    flex: 1;
    min-height: 0;
    position: relative;
    z-index: 1;
  }

  /* Artwork section - larger, extending close to UP NEXT */
  .artwork-section {
    width: 280px;
    height: 280px;
    flex-shrink: 0;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(40, 40, 45, 0.5);
    box-shadow:
      0 6px 30px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    align-self: flex-end;
    margin-bottom: 8px;
  }

  .album-art {
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
    width: 180px;
    height: 180px;
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
    top: 25px;
    left: 25px;
    right: 25px;
    bottom: 25px;
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
    width: 60px;
    height: 60px;
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
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #1a1a1c;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  /* Info and controls column */
  .info-controls-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-width: 0;
    gap: 12px;
    padding-bottom: 8px;
  }

  /* Track info */
  .track-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .track-title {
    font-size: 26px;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .track-artist {
    font-size: 18px;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-album {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Format badges */
  .format-badges {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Transport controls */
  .transport-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-btn {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .control-btn:active {
    transform: scale(0.9);
  }

  .control-btn.play-btn {
    width: 64px;
    height: 64px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 8px;
  }

  .control-btn.play-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .control-btn.shuffle-btn,
  .control-btn.repeat-btn {
    width: 40px;
    height: 40px;
    color: rgba(255, 255, 255, 0.5);
  }

  .control-btn.shuffle-btn.active,
  .control-btn.repeat-btn.active {
    color: var(--color-accent, #e86a8a);
  }

  /* Progress section - aligned with controls */
  .progress-section {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
    position: relative;
    z-index: 1;
  }

  .time {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    min-width: 40px;
    font-variant-numeric: tabular-nums;
  }

  .current-time {
    text-align: right;
  }

  .duration-time {
    text-align: left;
  }

  /* Custom progress bar track - thicker with slight roundness */
  .seek-track {
    flex: 1;
    height: 16px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    position: relative;
    overflow: visible;
  }

  /* Progress fill - warm coral/orange color */
  .seek-progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: linear-gradient(90deg, #e07850 0%, #d86040 100%);
    border-radius: 3px 0 0 3px;
    pointer-events: none;
  }

  .seek-slider {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    margin: 0;
  }

  .seek-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 24px;
    height: 24px;
    background: white;
    cursor: pointer;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    margin-top: -4px;
  }

  .seek-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    background: white;
    cursor: pointer;
    border: none;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .seek-slider::-webkit-slider-runnable-track {
    height: 16px;
  }

  .seek-slider::-moz-range-track {
    height: 16px;
    background: transparent;
  }
</style>
