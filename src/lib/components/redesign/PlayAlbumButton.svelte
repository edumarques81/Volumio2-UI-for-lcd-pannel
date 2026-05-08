<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  export let onPlay: () => void;
</script>

<button class="play-album" type="button" aria-label="Play Album" on:click={onPlay} data-testid="play-album-button">
  <Icon name="play" size={18} />
  <span class="label">Play Album</span>
</button>

<style>
  .play-album {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 999px;
    border: 1px solid rgba(201, 169, 97, 0.5);
    background: rgba(201, 169, 97, 0.08);
    color: var(--color-accent);
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, transform 80ms ease;
    min-height: var(--hit-target-min);
  }
  .play-album:hover,
  .play-album:focus-visible {
    background: rgba(201, 169, 97, 0.18);
    border-color: var(--color-accent);
    outline: none;
  }
  .play-album:active {
    transform: scale(0.98);
  }
  .label {
    line-height: 1;
  }
</style>
