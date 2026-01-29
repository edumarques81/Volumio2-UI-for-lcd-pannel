<script lang="ts">
  import { playerState, currentTrack, isPlaying, seek, duration, shuffle, repeat, playerActions } from '$lib/stores/player';
  import { selectedBackground } from '$lib/stores/settings';
  import { navigationActions } from '$lib/stores/navigation';
  import { classifySource, getSourceLabel, shouldShowSource } from '$lib/utils/sourceClassifier';
  import Icon from './Icon.svelte';

  // Background
  $: backgroundImage = $selectedBackground || $currentTrack.albumart || '/backgrounds/default.svg';

  // Source info
  $: sourceType = classifySource($playerState?.uri, $playerState?.service);
  $: showSource = shouldShowSource(sourceType);
  $: sourceLabel = getSourceLabel(sourceType);

  // Image error handling
  let imageError = false;

  function handleImageError() {
    imageError = true;
  }

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

  // Repeat mode cycling
  function handleRepeat() {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf($repeat);
    const nextIndex = (currentIndex + 1) % modes.length;
    playerActions.setRepeat(modes[nextIndex]);
  }

  // Navigation
  function goToHome() {
    navigationActions.goHome();
  }

  function goToQueue() {
    navigationActions.goToQueue();
  }

  // Format badges
  $: formatBadge = $playerState?.trackType?.toUpperCase() || '';
  $: sampleRateBadge = $playerState?.samplerate
    ? `${(parseInt($playerState.samplerate) / 1000).toFixed(1)}kHz`
    : '';
  $: bitDepthBadge = $playerState?.bitdepth ? `${$playerState.bitdepth}bit` : '';
</script>

<div class="mobile-player" data-view="mobile-player">
  <!-- Background with blur -->
  <div class="background">
    <div class="background-image" style="background-image: url('{backgroundImage}')"></div>
    <div class="background-overlay"></div>
  </div>

  <!-- Content -->
  <div class="player-content">
    <!-- Header with close button -->
    <header class="player-header">
      <button class="header-btn" on:click={goToHome} aria-label="Close player">
        <Icon name="chevron-down" size={28} />
      </button>
      {#if showSource}
        <span class="source-label">{sourceLabel}</span>
      {/if}
      <button class="header-btn" on:click={goToQueue} aria-label="View queue">
        <Icon name="queue" size={24} />
      </button>
    </header>

    <!-- Album artwork -->
    <div class="artwork-container">
      <div class="artwork">
        {#if !showPlaceholder}
          <img
            src={$currentTrack.albumart}
            alt={$currentTrack.title}
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
    </div>

    <!-- Track info -->
    <div class="track-info">
      <h1 class="track-title">{$currentTrack.title || 'Not Playing'}</h1>
      <p class="track-artist">{$currentTrack.artist || 'Unknown Artist'}</p>
      {#if $currentTrack.album}
        <p class="track-album">{$currentTrack.album}</p>
      {/if}

      <!-- Format badges -->
      {#if formatBadge || sampleRateBadge || bitDepthBadge}
        <div class="format-badges">
          {#if formatBadge}
            <span class="badge">{formatBadge}</span>
          {/if}
          {#if sampleRateBadge}
            <span class="badge">{sampleRateBadge}</span>
          {/if}
          {#if bitDepthBadge}
            <span class="badge">{bitDepthBadge}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Progress bar - LCD mini player style -->
    <div class="progress-section">
      <span class="time current-time">{formatTime(isSeeking ? seekValue : $seek)}</span>
      <div class="seek-track">
        <div class="seek-progress" style="width: {$duration > 0 ? ((isSeeking ? seekValue : $seek) / $duration) * 100 : 0}%"></div>
        <input
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

    <!-- Transport controls -->
    <div class="transport-controls">
      <button
        class="control-btn secondary"
        class:active={$shuffle}
        on:click={playerActions.toggleShuffle}
        aria-label="Shuffle"
      >
        <Icon name="shuffle" size={24} />
      </button>

      <button class="control-btn" on:click={playerActions.prev} aria-label="Previous">
        <Icon name="skip-back" size={32} />
      </button>

      <button
        class="control-btn play-btn"
        on:click={handlePlayPause}
        aria-label={$isPlaying ? 'Pause' : 'Play'}
      >
        <Icon name={$isPlaying ? 'pause' : 'play'} size={36} />
      </button>

      <button class="control-btn" on:click={playerActions.next} aria-label="Next">
        <Icon name="skip-forward" size={32} />
      </button>

      <button
        class="control-btn secondary"
        class:active={$repeat !== 'off'}
        on:click={handleRepeat}
        aria-label="Repeat"
      >
        <Icon name={$repeat === 'one' ? 'repeat-1' : 'repeat'} size={24} />
      </button>
    </div>
  </div>
</div>

<style>
  .mobile-player {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Background with blur */
  .background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
  }

  .background-image {
    position: absolute;
    top: -40px;
    left: -40px;
    right: -40px;
    bottom: -40px;
    background-size: cover;
    background-position: center;
    filter: blur(60px) brightness(0.25) saturate(1.3);
    transform: scale(1.2);
  }

  .background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(18, 18, 22, 0.7) 0%,
      rgba(18, 18, 22, 0.5) 30%,
      rgba(18, 18, 22, 0.7) 70%,
      rgba(18, 18, 22, 0.9) 100%
    );
  }

  /* Content */
  .player-content {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px 20px;
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    overflow: hidden;
  }

  /* Header */
  .player-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    margin-bottom: 8px;
  }

  .header-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .header-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .header-btn:active {
    transform: scale(0.95);
  }

  .source-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
  }

  /* Artwork */
  .artwork-container {
    flex: 0 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: 8px 0;
  }

  .artwork {
    width: auto;
    height: auto;
    max-width: min(240px, 60vw);
    max-height: min(240px, 35dvh);
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(40, 40, 45, 0.5);
    box-shadow:
      0 12px 36px rgba(0, 0, 0, 0.5),
      0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .artwork img {
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
    width: 60%;
    aspect-ratio: 1;
    position: relative;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a1a1c 0%, #2d2d30 100%);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.4),
      inset 0 1px 1px rgba(255, 255, 255, 0.05);
  }

  .vinyl-outer {
    position: absolute;
    top: 2%;
    left: 2%;
    right: 2%;
    bottom: 2%;
    border-radius: 50%;
    background: linear-gradient(135deg, #252528 0%, #1a1a1c 100%);
  }

  .vinyl-grooves {
    position: absolute;
    top: 14%;
    left: 14%;
    right: 14%;
    bottom: 14%;
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
    width: 32%;
    aspect-ratio: 1;
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
    width: 8%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #1a1a1c;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  /* Track info */
  .track-info {
    flex-shrink: 0;
    text-align: center;
    padding: 10px 0;
  }

  .track-title {
    font-size: 18px;
    font-weight: 600;
    color: white;
    margin: 0 0 4px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .track-artist {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-album {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .format-badges {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: 10px;
  }

  .badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
  }

  /* Progress section - LCD mini player style */
  .progress-section {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
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
    width: 20px;
    height: 20px;
    background: white;
    cursor: pointer;
    border-radius: 5px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    margin-top: -2px;
  }

  .seek-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: white;
    cursor: pointer;
    border: none;
    border-radius: 5px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .seek-slider::-webkit-slider-runnable-track {
    height: 16px;
  }

  .seek-slider::-moz-range-track {
    height: 16px;
    background: transparent;
  }

  /* Transport controls */
  .transport-controls {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 0;
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
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .control-btn:active {
    transform: scale(0.9);
  }

  .control-btn.secondary {
    width: 44px;
    height: 44px;
    color: rgba(255, 255, 255, 0.5);
  }

  .control-btn.secondary.active {
    color: var(--color-accent, #e86a8a);
  }

  .control-btn.play-btn {
    width: 64px;
    height: 64px;
    background: white;
    color: #1a1a1c;
    margin: 0 6px;
  }

  .control-btn.play-btn:hover {
    background: rgba(255, 255, 255, 0.9);
  }

  /* Landscape adjustments */
  @media (orientation: landscape) and (max-height: 500px) {
    .player-content {
      flex-direction: row;
      padding: 12px 24px;
      gap: 24px;
    }

    .player-header {
      position: absolute;
      top: max(8px, env(safe-area-inset-top));
      left: 16px;
      right: 16px;
      margin-bottom: 0;
    }

    .artwork-container {
      flex: 0 0 auto;
      width: 40%;
      max-width: none;
      padding: 40px 0 0;
    }

    .artwork {
      max-width: 100%;
      max-height: 100%;
    }

    .track-info,
    .progress-section,
    .transport-controls {
      flex: 1;
    }

    .track-info {
      text-align: left;
      padding: 40px 0 8px;
    }

    .format-badges {
      justify-content: flex-start;
    }

    .track-title {
      font-size: 20px;
    }

    .track-artist {
      font-size: 14px;
    }

    .control-btn.play-btn {
      width: 64px;
      height: 64px;
    }
  }
</style>
