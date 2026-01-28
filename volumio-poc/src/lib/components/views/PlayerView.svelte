<script lang="ts">
  import { playerState, currentTrack, isPlaying, seek, duration, shuffle, repeat, playerActions } from '$lib/stores/player';
  import { queue, queueActions } from '$lib/stores/queue';
  import { selectedBackground } from '$lib/stores/settings';
  import { navigationActions } from '$lib/stores/navigation';
  import { classifySource, getSourceLabel, shouldShowSource } from '$lib/utils/sourceClassifier';
  import { fixVolumioAssetUrl } from '$lib/config';
  import Icon from '../Icon.svelte';

  // Use selected background, album art, or fallback to default
  $: backgroundImage = $selectedBackground || $currentTrack.albumart || '/backgrounds/default.svg';

  // Derived source info from current track URI
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
  function goToHome() {
    navigationActions.goHome();
  }

  // Queue - get upcoming tracks
  $: currentPosition = $playerState?.position ?? 0;
  $: upcomingTracks = $queue.slice(currentPosition + 1, currentPosition + 10);
  $: hasUpcoming = upcomingTracks.length > 0;

  function handleQueueTileClick(index: number) {
    const queueIndex = currentPosition + 1 + index;
    queueActions.play(queueIndex);
  }

  function getTrackTitle(track: any): string {
    return track.name || track.title || 'Unknown';
  }

  function getArtworkUrl(track: any): string | null {
    if (!track.albumart) return null;
    return fixVolumioAssetUrl(track.albumart);
  }

  let queueImageErrors: Record<number, boolean> = {};

  function handleQueueImageError(index: number) {
    queueImageErrors[index] = true;
    queueImageErrors = queueImageErrors;
  }

  // Format info for badge
  $: formatBadge = $playerState?.trackType?.toUpperCase() || '';
  $: sampleRateBadge = $playerState?.samplerate
    ? `${(parseInt($playerState.samplerate) / 1000).toFixed(1)}kHz`
    : '';
  $: bitDepthBadge = $playerState?.bitdepth ? `${$playerState.bitdepth}bit` : '';
</script>

<div class="player-view" data-view="player">
  <!-- Background with blur -->
  <div class="background">
    <div class="background-image" style="background-image: url('{backgroundImage}')"></div>
    <div class="background-overlay"></div>
  </div>

  <!-- Top-right light effect overlay -->
  <div class="light-effect"></div>

  <!-- Header row with source and minimize on the right -->
  <div class="header-row">
    <div class="header-left"></div>
    <div class="header-right">
      {#if showSource}
        <span class="source-label">{sourceLabel}</span>
      {/if}
      <button
        class="minimize-btn"
        on:click={goToHome}
        aria-label="Minimize player"
      >
        <Icon name="collapse" size={24} />
      </button>
    </div>
  </div>

  <!-- Main content -->
  <div class="player-content">
    <!-- Large album art -->
    <div class="artwork-section">
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

    <!-- Right side: Track info, controls, progress, queue -->
    <div class="info-controls-section">
      <!-- Track info -->
      <div class="track-info">
        <span class="track-title">{$currentTrack.title || 'Not Playing'}</span>
        <span class="track-artist">{$currentTrack.artist || 'Unknown Artist'}</span>
        <span class="track-album">{$currentTrack.album || ''}</span>

        <!-- Format badges -->
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
      </div>

      <!-- Transport controls -->
      <div class="transport-controls">
        <button
          class="control-btn shuffle-btn"
          class:active={$shuffle}
          on:click={handleShuffle}
          aria-label="Shuffle"
        >
          <Icon name="shuffle" size={28} />
        </button>

        <button class="control-btn" on:click={handlePrev} aria-label="Previous">
          <Icon name="skip-back" size={40} />
        </button>

        <button
          class="control-btn play-btn"
          on:click={handlePlayPause}
          aria-label={$isPlaying ? 'Pause' : 'Play'}
        >
          <Icon name={$isPlaying ? 'pause' : 'play'} size={48} />
        </button>

        <button class="control-btn" on:click={handleNext} aria-label="Next">
          <Icon name="skip-forward" size={40} />
        </button>

        <button
          class="control-btn repeat-btn"
          class:active={$repeat !== 'off'}
          on:click={handleRepeat}
          aria-label="Repeat"
        >
          <Icon name={$repeat === 'one' ? 'repeat-1' : 'repeat'} size={28} />
        </button>
      </div>

      <!-- Progress bar -->
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

      <!-- Queue strip -->
      <div class="queue-section">
        {#if hasUpcoming}
          <div class="queue-strip-scroll">
            {#each upcomingTracks as track, i}
              <button
                class="queue-tile"
                on:click={() => handleQueueTileClick(i)}
              >
                <div class="tile-art">
                  {#if getArtworkUrl(track) && !queueImageErrors[i]}
                    <img
                      src={getArtworkUrl(track)}
                      alt={getTrackTitle(track)}
                      loading="lazy"
                      on:error={() => handleQueueImageError(i)}
                    />
                  {:else}
                    <div class="art-placeholder-small">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                      </svg>
                    </div>
                  {/if}
                </div>
                <div class="tile-info">
                  <span class="tile-title">{getTrackTitle(track)}</span>
                  <span class="tile-artist">{track.artist || 'Unknown Artist'}</span>
                </div>
              </button>
            {/each}
          </div>
        {:else}
          <div class="empty-queue">
            <span>No upcoming tracks</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .player-view {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px 24px 16px;
    box-sizing: border-box;
    overflow: hidden;
    background: linear-gradient(165deg, rgba(38, 38, 44, 0.97) 0%, rgba(22, 22, 26, 0.99) 60%, rgba(18, 18, 22, 1) 100%);
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
    top: -20px;
    left: -20px;
    right: -20px;
    bottom: -20px;
    background-size: cover;
    background-position: center;
    filter: blur(40px) brightness(0.3) saturate(1.2);
    transform: scale(1.1);
  }

  .background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      165deg,
      rgba(28, 28, 32, 0.85) 0%,
      rgba(18, 18, 22, 0.9) 60%,
      rgba(14, 14, 18, 0.95) 100%
    );
  }

  /* Top-right light effect */
  .light-effect {
    position: absolute;
    top: -50%;
    right: -20%;
    width: 70%;
    height: 120%;
    pointer-events: none;
    background: radial-gradient(
      ellipse at center,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.03) 25%,
      rgba(255, 255, 255, 0.01) 50%,
      transparent 70%
    );
    transform: rotate(-15deg);
    z-index: 1;
  }

  /* Header row */
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    position: relative;
    z-index: 10;
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
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 16px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
  }

  .minimize-btn {
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

  .minimize-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .minimize-btn:active {
    transform: scale(0.95);
  }

  /* Main content */
  .player-content {
    flex: 1;
    display: flex;
    gap: 40px;
    min-height: 0;
    position: relative;
    z-index: 2;
  }

  /* Artwork section - large album art */
  .artwork-section {
    width: 340px;
    height: 340px;
    flex-shrink: 0;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(40, 40, 45, 0.5);
    box-shadow:
      0 8px 40px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    align-self: center;
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
    width: 220px;
    height: 220px;
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
    top: 30px;
    left: 30px;
    right: 30px;
    bottom: 30px;
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
    width: 70px;
    height: 70px;
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
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #1a1a1c;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  /* Info and controls section */
  .info-controls-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    gap: 16px;
  }

  /* Track info */
  .track-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .track-title {
    font-size: 32px;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .track-artist {
    font-size: 22px;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-album {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Format badges */
  .format-badges {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .badge {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 4px 10px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Transport controls */
  .transport-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .control-btn {
    width: 56px;
    height: 56px;
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
    width: 80px;
    height: 80px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 12px;
  }

  .control-btn.play-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .control-btn.shuffle-btn,
  .control-btn.repeat-btn {
    width: 48px;
    height: 48px;
    color: rgba(255, 255, 255, 0.5);
  }

  .control-btn.shuffle-btn.active,
  .control-btn.repeat-btn.active {
    color: var(--color-accent, #e86a8a);
  }

  /* Progress section */
  .progress-section {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 4px 0;
  }

  .time {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    min-width: 45px;
    font-variant-numeric: tabular-nums;
  }

  .current-time {
    text-align: right;
  }

  .duration-time {
    text-align: left;
  }

  /* Progress bar - matching mini player style */
  .seek-track {
    flex: 1;
    height: 16px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    position: relative;
    overflow: visible;
  }

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

  /* Queue section */
  .queue-section {
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    min-height: 80px;
  }

  .queue-strip-scroll {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    padding: 4px 0;
  }

  .queue-strip-scroll::-webkit-scrollbar {
    display: none;
  }

  .queue-tile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 200px;
    max-width: 240px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .queue-tile:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .queue-tile:active {
    transform: scale(0.98);
  }

  .tile-art {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(40, 40, 45, 0.5);
    flex-shrink: 0;
  }

  .tile-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .art-placeholder-small {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2a2a2e 0%, #1c1c1e 100%);
    color: rgba(255, 255, 255, 0.3);
  }

  .tile-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .tile-title {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }

  .tile-artist {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }

  .empty-queue {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: rgba(255, 255, 255, 0.3);
    font-size: 14px;
  }
</style>
