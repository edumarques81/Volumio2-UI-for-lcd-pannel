<script lang="ts">
  import { playerState, currentTrack, isPlaying, seek, duration, progress, trackQuality, shuffle, repeat, playerActions } from '$lib/stores/player';
  import { queue, queueActions } from '$lib/stores/queue';
  import { navigationActions } from '$lib/stores/navigation';
  import { classifySource, getSourceLabel, shouldShowSource } from '$lib/utils/sourceClassifier';
  import { activeEngine } from '$lib/stores/audioEngine';
  import Icon from '../Icon.svelte';
  import MiniPlayerQueueStrip from './MiniPlayerQueueStrip.svelte';

  // Derived source info from current track URI
  $: sourceType = classifySource($playerState?.uri, $playerState?.service);
  $: showSource = shouldShowSource(sourceType);
  $: sourceLabel = getSourceLabel(sourceType);
  $: isAudirvana = sourceType === 'AUDIRVANA' || $activeEngine === 'audirvana';
  $: audirvanaNoTrack = isAudirvana && $playerState?.status === 'stop' && !$playerState?.title;

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
  <!-- Header row with source and expand on the right -->
  <div class="header-row">
    <div class="header-left">
      <!-- Empty for balance -->
    </div>
    <div class="header-right">
      {#if isAudirvana}
        <span class="source-label source-audirvana" data-testid="miniplayer-source">AUDIRVANA</span>
      {:else if showSource}
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
    <!-- Large album art -->
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
        {#if audirvanaNoTrack}
          <span class="track-title">Audirvana Active</span>
          <span class="track-artist audirvana-hint">No track info available</span>
        {:else}
          <span class="track-title">{$currentTrack.title || 'Not Playing'}</span>
          <span class="track-artist">{$currentTrack.artist || 'Unknown Artist'}</span>
          <span class="track-album">{$currentTrack.album || ''}</span>
        {/if}

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

      <!-- Progress bar -->
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
    background: linear-gradient(160deg, var(--md-surface-container-low) 0%, var(--md-surface) 100%);
    box-sizing: border-box;
    overflow: hidden;
    transform: translateZ(0);
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
    font-size: var(--md-label-large);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 14px;
    background: var(--md-surface-container-highest);
    border-radius: var(--md-shape-medium);
    color: var(--md-on-surface-variant);
  }

  .source-audirvana {
    background: rgba(107, 78, 160, 0.25);
    color: #c4a8ff;
    border: 1px solid rgba(107, 78, 160, 0.3);
  }

  .audirvana-hint {
    font-style: italic;
    color: rgba(196, 168, 255, 0.6);
  }

  .expand-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--md-surface-container-high);
    border: none;
    border-radius: var(--md-shape-medium);
    color: var(--md-on-surface-variant);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .expand-btn:hover {
    background: var(--md-surface-container-highest);
    color: var(--md-on-surface);
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

  /* Artwork section */
  .artwork-section {
    width: 260px;
    height: 260px;
    flex-shrink: 0;
    border-radius: var(--md-shape-large);
    overflow: hidden;
    background: var(--md-surface-container);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
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
    background: var(--md-surface-container-low);
  }

  .vinyl-icon {
    width: 180px;
    height: 180px;
    position: relative;
    border-radius: 50%;
    background: var(--md-surface-container);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
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
    top: 25px;
    left: 25px;
    right: 25px;
    bottom: 25px;
    border-radius: 50%;
    background: repeating-radial-gradient(
      circle at center,
      var(--md-surface-container-high) 0px,
      var(--md-surface-container) 1px,
      var(--md-surface-container-high) 2px
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
    background: linear-gradient(145deg, var(--md-primary) 0%, color-mix(in srgb, var(--md-primary) 70%, black 30%) 100%);
  }

  .vinyl-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--md-surface-container-lowest);
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
    font-size: var(--md-headline-medium);
    font-weight: 600;
    color: var(--md-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .track-artist {
    font-size: var(--md-title-large);
    color: var(--md-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-album {
    font-size: var(--md-title-small);
    color: var(--md-on-surface-variant);
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Format badges — warm rose container */
  .format-badges {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .badge {
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
    border: none;
    border-radius: var(--md-shape-small);
    font-size: var(--md-label-small);
    font-weight: 700;
    padding: 3px 8px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
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
    border-radius: var(--md-shape-full);
    color: var(--md-on-surface-variant);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .control-btn:hover {
    background: rgba(239, 224, 225, 0.1);
    color: var(--md-on-surface);
  }

  .control-btn:active {
    transform: scale(0.9);
  }

  .control-btn.play-btn {
    width: 64px;
    height: 64px;
    background: var(--md-primary);
    color: var(--md-on-primary);
    border-radius: var(--md-shape-full);
    margin: 0 8px;
  }

  .control-btn.play-btn:hover {
    background: color-mix(in srgb, var(--md-primary) 85%, white 15%);
  }

  .control-btn.shuffle-btn,
  .control-btn.repeat-btn {
    width: 40px;
    height: 40px;
    color: var(--md-on-surface-variant);
  }

  .control-btn.shuffle-btn.active,
  .control-btn.repeat-btn.active {
    color: var(--md-primary);
  }

  /* Progress section */
  .progress-section {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
    position: relative;
    z-index: 1;
  }

  .time {
    font-size: var(--md-label-medium);
    font-weight: 500;
    color: var(--md-on-surface-variant);
    min-width: 40px;
    font-variant-numeric: tabular-nums;
  }

  .current-time {
    text-align: right;
  }

  .duration-time {
    text-align: left;
  }

  /* MD3 slider-style seek bar */
  .seek-track {
    flex: 1;
    height: 4px;
    background: var(--md-outline-variant);
    border-radius: var(--md-shape-full);
    position: relative;
    overflow: visible;
  }

  .seek-progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--md-primary);
    border-radius: var(--md-shape-full);
    pointer-events: none;
  }

  .seek-slider {
    position: absolute;
    top: -8px;
    left: 0;
    width: 100%;
    height: 20px;
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
    background: var(--md-primary);
    cursor: pointer;
    border-radius: var(--md-shape-full);
    border: 2px solid var(--md-on-primary);
    box-shadow: 0 2px 8px rgba(181, 38, 76, 0.4);
  }

  .seek-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: var(--md-primary);
    cursor: pointer;
    border: 2px solid var(--md-on-primary);
    border-radius: var(--md-shape-full);
    box-shadow: 0 2px 8px rgba(181, 38, 76, 0.4);
  }

  .seek-slider::-webkit-slider-runnable-track {
    height: 4px;
  }

  .seek-slider::-moz-range-track {
    height: 4px;
    background: transparent;
  }
</style>
