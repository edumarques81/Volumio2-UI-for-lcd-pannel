<script lang="ts">
  import { playerState, currentTrack, isPlaying, seek, duration, shuffle, repeat, playerActions, formatSampleRate } from '$lib/stores/player';
  import { queue, queueActions } from '$lib/stores/queue';
  import { selectedBackground } from '$lib/stores/settings';
  import { navigationActions } from '$lib/stores/navigation';
  import { classifySource, getSourceLabel, shouldShowSource } from '$lib/utils/sourceClassifier';
  import { activeEngine } from '$lib/stores/audioEngine';
  import { fixVolumioAssetUrl } from '$lib/config';
  import Icon from '../Icon.svelte';

  // Use selected background, album art, or fallback to default
  $: backgroundImage = $selectedBackground || $currentTrack.albumart || '/backgrounds/default.svg';

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
  $: sampleRateBadge = formatSampleRate($playerState?.samplerate);
  $: bitDepthBadge = $playerState?.bitdepth ? `${$playerState.bitdepth}bit` : '';
</script>

<div class="player-view" data-view="player">
  <!-- Background with blur -->
  <div class="background">
    <div class="background-image" style="background-image: url('{backgroundImage}')"></div>
    <div class="background-overlay"></div>
  </div>

  <!-- Floating minimize button (top-right, source label removed for cleaner layout) -->
  <div class="floating-controls">
    <button
      class="minimize-btn"
      on:click={goToHome}
      aria-label="Minimize player"
    >
      <Icon name="collapse" size={24} />
    </button>
  </div>

  <!-- 3-zone layout -->
  <div class="player-zones">
    <!-- Zone 1: Art -->
    <div class="zone-art">
      <div class="artwork-section" class:audirvana-mode={isAudirvana}>
        {#if isAudirvana}
          <div class="art-placeholder audirvana-bg">
            <img src="/audirvana-logo.svg" alt="Audirvana" class="audirvana-logo-img" />
          </div>
        {:else if !showPlaceholder}
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
      <!-- Format badges below art -->
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

    <!-- Zone 2: Controls -->
    <div class="zone-controls">
      <div class="track-info">
        {#if audirvanaNoTrack}
          <span class="track-title">Audirvana Active</span>
          <span class="track-artist audirvana-hint">No track info available</span>
        {:else}
          <span class="track-title">{$currentTrack.title || 'Not Playing'}</span>
          <span class="track-artist">{$currentTrack.artist || 'Unknown Artist'}</span>
          <span class="track-album">{$currentTrack.album || ''}</span>
        {/if}
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
            id="player-seek-slider"
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

    <!-- Zone 3: Queue -->
    <div class="zone-queue">
      <div class="up-next-label">UP NEXT</div>
      {#if hasUpcoming}
        <div class="queue-list">
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
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

<style>
  .player-view {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--md-background);
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
      rgba(28, 17, 18, 0.85) 0%,
      rgba(28, 17, 18, 0.9) 60%,
      rgba(28, 17, 18, 0.95) 100%
    );
  }

  /* Floating controls */
  .floating-controls {
    position: absolute;
    top: 16px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10;
  }

  .audirvana-hint {
    font-style: italic;
    color: rgba(196, 168, 255, 0.6);
  }

  .minimize-btn {
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
    transition: background 0.15s, color 0.15s, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .minimize-btn:hover {
    background: var(--md-surface-container-highest);
    color: var(--md-on-surface);
  }

  .minimize-btn:active {
    transform: scale(0.90);
  }

  /* 3-zone layout */
  .player-zones {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 28fr 44fr 28fr;
    height: 100%;
    align-items: center;
    gap: 0;
  }

  /* Zone 1: Art */
  .zone-art {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 24px;
    height: 100%;
    border-right: 1px solid var(--md-outline-variant);
  }

  .artwork-section {
    width: 280px;
    height: 280px;
    border-radius: var(--md-shape-extra-large);
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
    background: var(--md-surface-container);
    flex-shrink: 0;
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

  .audirvana-bg {
    background: linear-gradient(145deg, rgba(107, 78, 160, 0.25) 0%, rgba(61, 40, 112, 0.35) 100%);
    border: 1px solid rgba(107, 78, 160, 0.3);
  }

  .audirvana-logo-img {
    width: 60%;
    height: 60%;
    object-fit: contain;
    filter: drop-shadow(0 6px 24px rgba(107, 78, 160, 0.7));
  }

  .artwork-section.audirvana-mode {
    box-shadow: 0 12px 48px rgba(107, 78, 160, 0.4);
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

  .format-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .badge {
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
    border: none;
    border-radius: var(--md-shape-small);
    font-size: var(--md-label-small);
    font-weight: 700;
    padding: 4px 10px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* Zone 2: Controls */
  .zone-controls {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
    padding: 20px 40px;
    height: 100%;
  }

  .track-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .track-title {
    font-size: var(--md-headline-large);
    font-weight: 700;
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

  /* Transport controls */
  .transport-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-btn {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--md-shape-full);
    color: var(--md-on-surface-variant);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .control-btn:hover {
    background: color-mix(in srgb, var(--md-on-surface) 10%, transparent);
    color: var(--md-on-surface);
  }

  .control-btn:active {
    transform: scale(0.88);
  }

  .control-btn.play-btn {
    width: 72px;
    height: 72px;
    background: var(--md-primary);
    color: var(--md-on-primary);
    margin: 0 12px;
    box-shadow: 0 4px 20px color-mix(in srgb, var(--md-primary) 40%, transparent);
    transition: background 0.15s, filter 0.15s, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s;
  }

  .control-btn.play-btn:active {
    transform: scale(0.92);
    filter: brightness(0.9);
  }

  .control-btn.play-btn:hover {
    filter: brightness(1.1);
  }

  .control-btn.shuffle-btn,
  .control-btn.repeat-btn {
    width: 48px;
    height: 48px;
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
  }

  .time {
    font-size: var(--md-label-medium);
    color: var(--md-on-surface-variant);
    font-variant-numeric: tabular-nums;
    min-width: 40px;
  }

  .current-time {
    text-align: right;
  }

  .duration-time {
    text-align: left;
  }

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
    border: 2px solid white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--md-primary) 40%, transparent);
  }

  .seek-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: var(--md-primary);
    cursor: pointer;
    border: 2px solid white;
    border-radius: var(--md-shape-full);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--md-primary) 40%, transparent);
  }

  .seek-slider::-webkit-slider-runnable-track {
    height: 4px;
  }

  .seek-slider::-moz-range-track {
    height: 4px;
    background: transparent;
  }

  /* Zone 3: Queue */
  .zone-queue {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 20px;
    height: 100%;
    border-left: 1px solid var(--md-outline-variant);
    overflow: hidden;
  }

  .up-next-label {
    font-size: var(--md-label-large);
    font-weight: 700;
    color: var(--md-primary);
    text-transform: uppercase;
    letter-spacing: 1px;
    flex-shrink: 0;
    padding-top: 40px;
  }

  .queue-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    flex: 1;
    min-height: 0;
  }

  .queue-list::-webkit-scrollbar {
    display: none;
  }

  .queue-tile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--md-surface-container);
    border-radius: var(--md-shape-medium);
    border: none;
    cursor: pointer;
    transition: background 0.15s, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
    text-align: left;
    width: 100%;
    color: var(--md-on-surface);
    flex-shrink: 0;
  }

  .queue-tile:hover {
    background: var(--md-surface-container-high);
  }

  .queue-tile:active {
    transform: scale(0.97);
    background: var(--md-surface-container-highest);
  }

  .tile-art {
    width: 44px;
    height: 44px;
    border-radius: var(--md-shape-small);
    overflow: hidden;
    background: var(--md-surface-container-high);
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
    background: var(--md-surface-container-high);
    color: var(--md-on-surface-variant);
  }

  .tile-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tile-title {
    font-size: var(--md-body-medium);
    color: var(--md-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tile-artist {
    font-size: var(--md-label-medium);
    color: var(--md-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-queue {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--md-on-surface-variant);
    font-size: var(--md-body-medium);
  }
</style>
