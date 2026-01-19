<script lang="ts">
  import { seek, duration, playerActions, formatTime } from '$lib/stores/player';

  let isDragging = false;
  let localSeek = 0;

  $: displaySeek = isDragging ? localSeek : $seek;
  $: progress = $duration > 0 ? (displaySeek / $duration) * 100 : 0;

  function handleSeekStart() {
    isDragging = true;
  }

  function handleSeekChange(event: Event) {
    const target = event.target as HTMLInputElement;
    localSeek = parseFloat(target.value);
  }

  function handleSeekEnd() {
    playerActions.seekTo(localSeek);
    isDragging = false;
  }
</script>

<div class="seekbar">
  <span class="time">{formatTime(displaySeek)}</span>

  <div class="track">
    <input
      type="range"
      min="0"
      max={$duration}
      step="0.1"
      value={displaySeek}
      on:mousedown={handleSeekStart}
      on:touchstart={handleSeekStart}
      on:input={handleSeekChange}
      on:mouseup={handleSeekEnd}
      on:touchend={handleSeekEnd}
      style="--progress: {progress}%"
      aria-label="Seek"
    />
  </div>

  <span class="time">{formatTime($duration)}</span>
</div>

<style>
  .seekbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    width: 100%;
  }

  .time {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    min-width: 60px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .track {
    flex: 1;
    position: relative;
    height: var(--touch-target-min);
    display: flex;
    align-items: center;
  }

  input[type="range"] {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  /* Track */
  input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 6px;
    background: linear-gradient(
      to right,
      var(--color-accent) 0%,
      var(--color-accent) var(--progress),
      rgba(255, 255, 255, 0.2) var(--progress),
      rgba(255, 255, 255, 0.2) 100%
    );
    border-radius: 3px;
  }

  input[type="range"]::-moz-range-track {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  input[type="range"]::-moz-range-progress {
    height: 6px;
    background: var(--color-accent);
    border-radius: 3px;
  }

  /* Thumb */
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    margin-top: -7px;
  }

  input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    border: none;
  }

  input[type="range"]:active::-webkit-slider-thumb,
  input[type="range"]:active::-moz-range-thumb {
    transform: scale(1.2);
  }
</style>
