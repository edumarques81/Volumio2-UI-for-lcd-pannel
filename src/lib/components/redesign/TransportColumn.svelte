<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  export let isPlaying: boolean = false;
  export let atQueueEnd: boolean = false;
  export let repeat: 'off' | 'all' | 'one' = 'off';
  export let hasTrack: boolean = true;
  export let loading: boolean = false;
  export let onTogglePlay: () => void;
  export let onPrev: () => void;
  export let onNext: () => void;

  $: nextDisabled = atQueueEnd && repeat === 'off';
  $: playDisabled = !hasTrack;
</script>

<div class="transport-column">
  <button
    class="play-pause"
    class:loading
    aria-label={isPlaying ? 'Pause' : 'Play'}
    disabled={playDisabled}
    on:click={onTogglePlay}
  >
    <Icon name={isPlaying ? 'pause-fill' : 'play-fill'} size={64} />
    {#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
  </button>

  <div class="skip-row">
    <button class="skip" aria-label="Previous track" on:click={onPrev}>
      <Icon name="skip-back-fill" size={32} />
    </button>
    <button class="skip" aria-label="Next track" disabled={nextDisabled} on:click={onNext}>
      <Icon name="skip-forward-fill" size={32} />
    </button>
  </div>
</div>

<style>
  .transport-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    border-right: 1px solid rgba(201, 169, 97, 0.15);
    padding: 0 16px;
  }
  .play-pause {
    position: relative;
    width: 200px; height: 200px;
    border-radius: 50%;
    border: 4px solid var(--color-accent);
    background: transparent;
    color: var(--color-accent);
    box-shadow: 0 0 12px var(--color-accent-glow);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .play-pause[disabled] {
    opacity: 0.4; cursor: not-allowed;
  }
  .skip-row {
    display: flex; gap: 24px;
  }
  .skip {
    width: 70px; height: 70px;
    border: none; background: transparent;
    color: var(--color-accent);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .skip[disabled] { opacity: 0.4; cursor: not-allowed; }

  .spinner {
    position: absolute;
    inset: -4px;
    border: 3px solid transparent;
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 800ms linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
