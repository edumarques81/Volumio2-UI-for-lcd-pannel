<script lang="ts">
  import { playerState, currentTrack, isPlaying, seek, duration, progress, trackQuality, shuffle, repeat, playerActions, formatSampleRate } from '$lib/stores/player';
  import { queue, queueActions } from '$lib/stores/queue';
  import { navigationActions } from '$lib/stores/navigation';
  import { classifySource, getSourceLabel, shouldShowSource } from '$lib/utils/sourceClassifier';
  import { activeEngine } from '$lib/stores/audioEngine';
  import { isFavorite, favoritesActions } from '$lib/stores/favorites';
  import Icon from '../Icon.svelte';
  import MiniPlayerQueueStrip from './MiniPlayerQueueStrip.svelte';

  // Derived source info from current track URI
  $: sourceType = classifySource($playerState?.uri, $playerState?.service);
  $: showSource = shouldShowSource(sourceType);
  $: sourceLabel = getSourceLabel(sourceType);
  $: isAudirvana = sourceType === 'AUDIRVANA' || $activeEngine === 'audirvana';

  // "Audirvana has real track info" — only true when the backend is explicitly
  // pushing state with service:'audirvana' AND a track title. In all other cases
  // (Audirvana active but MPD is idle, no title, etc.) we show the branded placeholder.
  $: audirvanaHasTrack = isAudirvana
    && $playerState?.service?.toLowerCase() === 'audirvana'
    && !!$playerState?.title;

  // Show "Audirvana Active" placeholder whenever Audirvana is the active engine
  // and there's no confirmed Audirvana track info being pushed.
  // The old `status === 'stop'` guard was wrong: it was accidentally correct
  // (MPD is always 'stop' when Audirvana plays independently) but fragile.
  $: audirvanaNoTrack = isAudirvana && !audirvanaHasTrack;

  // Image error handling
  let imageError = false;

  function handleImageError() {
    imageError = true;
  }

  // Reset error state when albumart changes
  $: if ($currentTrack.albumart) {
    imageError = false;
  }

  // Show Stellar placeholder when: no track title, image load error, OR no real albumart.
  // NOTE: currentTrack.albumart always falls back to '/default-album.svg' in the store,
  // so we must check $playerState?.albumart (the raw value) — falsy when nothing is playing.
  $: showPlaceholder = !$currentTrack.title || !$playerState?.albumart || imageError;

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

  // Title marquee: auto-scroll when text overflows the wrap container
  let titleEl: HTMLSpanElement | null = null;
  let titleNeedsMarquee = false;
  let marqueeDistance = 0;

  function checkTitleOverflow() {
    if (!titleEl) return;
    const wrap = titleEl.parentElement;
    if (!wrap) return;
    const overflow = titleEl.scrollWidth - wrap.clientWidth;
    titleNeedsMarquee = overflow > 4;
    if (titleNeedsMarquee) {
      marqueeDistance = overflow + 32; // extra 32px breathing gap at the end
    }
  }

  $: {
    void $currentTrack.title;
    titleNeedsMarquee = false;
    setTimeout(checkTitleOverflow, 100);
  }

  // Favorites — disabled in Audirvana mode (Audirvana manages its own library)
  function handleToggleFavorite() {
    if (isAudirvana) return;
    favoritesActions.toggleCurrentFavorite($isFavorite);
  }

  // Navigation
  function goToFullPlayer() {
    navigationActions.goToPlayer();
  }

  // Format info for badge
  $: formatBadge = $playerState?.trackType?.toUpperCase() || '';
  $: sampleRateBadge = formatSampleRate($playerState?.samplerate);
  $: bitDepthBadge = $playerState?.bitdepth ? `${$playerState.bitdepth}bit` : '';
</script>

<div class="docked-mini-player" data-testid="docked-mini-player">

  <!-- Source + expand floated over the top-right — no header bar -->
  <div class="top-right-overlay">
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

  <!-- Main content area -->
  <div class="main-content">
    <!-- Artwork wrapper stretches cleanly in the flex row; inner section uses height:100% of that definite size -->
    <div class="artwork-wrapper">
      <div class="artwork-section" class:audirvana-mode={isAudirvana} data-testid="miniplayer-artwork">
        {#if isAudirvana}
          <!-- Audirvana mode: show branded logo instead of album art -->
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
          <!-- Nothing playing — show Stellar / Italian Greyhound logo -->
          <div class="art-placeholder stellar-bg">
            <img src="/stellar-logo.svg" alt="Stellar" class="stellar-logo-img" />
          </div>
        {/if}
      </div>
    </div>

    <!-- Track info + controls column -->
    <div class="info-controls-column">
      <!-- Track info -->
      <div class="track-info" data-testid="miniplayer-track-info">
        {#if audirvanaNoTrack}
          <div class="track-title-wrap"><span class="track-title">Audirvana Active</span></div>
          <span class="track-artist audirvana-hint">No track info available</span>
        {:else}
          <div class="track-title-wrap">
            <span
              class="track-title"
              class:marquee={titleNeedsMarquee}
              style={titleNeedsMarquee ? `--marquee-end: -${marqueeDistance}px` : ''}
              bind:this={titleEl}
            >{$currentTrack.title || 'Not Playing'}</span>
          </div>
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

        <button
          class="control-btn fav-btn"
          class:fav-active={$isFavorite}
          class:fav-disabled={isAudirvana}
          on:click={handleToggleFavorite}
          disabled={isAudirvana}
          aria-label={$isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          title={isAudirvana ? 'Not available in Audirvana mode' : ($isFavorite ? 'In Favorites' : 'Add to Favorites')}
        >
          <Icon name={$isFavorite ? 'heart-filled' : 'heart'} size={24} />
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

  /* Source label + expand button — absolute overlay, no header bar */
  .top-right-overlay {
    position: absolute;
    top: 12px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 10;
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

  /* Stellar logo (no art — Italian Greyhound tribute) */
  .stellar-bg {
    background: linear-gradient(145deg,
      color-mix(in srgb, var(--md-primary) 8%, var(--md-surface-container-low)) 0%,
      var(--md-surface-container-low) 100%
    );
  }

  .stellar-logo-img {
    width: 82%;
    height: 82%;
    object-fit: contain;
    opacity: 0.82;
    filter: drop-shadow(0 2px 12px color-mix(in srgb, var(--md-primary) 30%, transparent));
  }

  /* Audirvana logo artwork */
  .audirvana-bg {
    background: linear-gradient(145deg, rgba(107, 78, 160, 0.25) 0%, rgba(61, 40, 112, 0.35) 100%);
    border: 1px solid rgba(107, 78, 160, 0.3);
  }

  .audirvana-logo-img {
    width: 68%;
    height: 68%;
    object-fit: contain;
    filter: drop-shadow(0 4px 16px rgba(107, 78, 160, 0.6));
  }

  .artwork-section.audirvana-mode {
    box-shadow: 0 8px 32px rgba(107, 78, 160, 0.35);
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
    /* 100vh=440px − 24px padding − 72px queue strip = 344px */
    max-height: calc(100vh - 96px);
    overflow: hidden;
    position: relative;
    z-index: 1;
    align-items: stretch;
  }

  /* Wrapper: stretch within the row, capped by viewport so height:100% inside always resolves */
  .artwork-wrapper {
    align-self: stretch;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    overflow: hidden;
    min-height: 0;
    /* cap matches .main-content: 100vh − 24px padding − 72px queue = 344px */
    max-height: calc(100vh - 96px);
  }

  /* Artwork: square — height:100% resolves against wrapper's capped height */
  .artwork-section {
    height: 100%;
    aspect-ratio: 1;
    flex-shrink: 0;
    border-radius: var(--md-shape-large);
    overflow: hidden;
    background: var(--md-surface-container);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
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

  /* Info and controls column — fills full height, evenly spaced */
  .info-controls-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
    gap: 4px;
    padding-top: 0;
    padding-bottom: 6px;
  }

  /* Track info */
  .track-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Title wrap: clips overflow + reserves right-edge space for the top-right overlay
     (expand btn 44px + gap 10px + source badge ≤95px + padding 20px = ~130px buffer) */
  .track-title-wrap {
    overflow: hidden;
    padding-right: 130px;
    line-height: 1.2;
  }

  .track-title {
    display: inline-block;
    font-size: var(--md-title-large); /* reduced from headline-medium — fits better in tighter space */
    font-weight: 600;
    color: var(--md-on-surface);
    white-space: nowrap;
  }

  /* Marquee: only activates when JS detects text overflows the wrap */
  .track-title.marquee {
    animation: title-marquee 14s ease-in-out infinite;
  }

  @keyframes title-marquee {
    0%, 20%  { transform: translateX(0); }
    75%, 100% { transform: translateX(var(--marquee-end, -80px)); }
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
    background: color-mix(in srgb, var(--md-on-surface) 10%, transparent);
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
  .control-btn.repeat-btn,
  .control-btn.fav-btn {
    width: 40px;
    height: 40px;
    color: var(--md-on-surface-variant);
  }

  .control-btn.shuffle-btn.active,
  .control-btn.repeat-btn.active {
    color: var(--md-primary);
  }

  /* Favorites button */
  .control-btn.fav-btn.fav-active {
    color: #FF4458; /* filled heart: warm red regardless of theme */
  }

  .control-btn.fav-btn.fav-disabled {
    opacity: 0.25;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Progress section — pushed to bottom with margin-top: auto for breathing room */
  .progress-section {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
    margin-top: auto;
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
    top: 50%;
    transform: translateY(-50%);
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
    box-shadow: 0 2px 8px color-mix(in srgb, var(--md-primary) 40%, transparent);
    /* Centre 20px thumb on 4px track: −(thumbH − trackH) / 2 = −8px */
    margin-top: -8px;
  }

  .seek-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: var(--md-primary);
    cursor: pointer;
    border: 2px solid var(--md-on-primary);
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
</style>
