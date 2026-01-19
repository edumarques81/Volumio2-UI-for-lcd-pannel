<script lang="ts">
  import { volume, mute, playerActions } from '$lib/stores/player';
  import Icon from './Icon.svelte';

  function handleVolumeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    playerActions.setVolume(parseInt(target.value, 10));
  }

  $: volumeIcon = $mute ? 'volume-mute' :
                  $volume > 50 ? 'volume-high' :
                  $volume > 0 ? 'volume-low' : 'volume-mute';
</script>

<div class="volume-control">
  <button
    class="volume-btn"
    on:click={playerActions.toggleMute}
    aria-label={$mute ? 'Unmute' : 'Mute'}
  >
    <Icon name={volumeIcon} size={32} />
  </button>

  <div class="volume-slider">
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value={$volume}
      on:input={handleVolumeChange}
      aria-label="Volume"
      style="--volume: {$volume}%"
    />
  </div>

  <span class="volume-text">{$volume}%</span>
</div>

<style>
  .volume-control {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    min-width: 320px;
  }

  .volume-btn {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .volume-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: scale(1.05);
  }

  .volume-btn:active {
    transform: scale(0.95);
  }

  .volume-slider {
    flex: 1;
    min-width: 200px;
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

  input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 6px;
    background: linear-gradient(
      to right,
      var(--color-accent) 0%,
      var(--color-accent) var(--volume),
      rgba(255, 255, 255, 0.2) var(--volume),
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

  .volume-text {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-primary);
    min-width: 60px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
</style>
