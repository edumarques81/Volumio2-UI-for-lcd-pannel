<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  export let onPlay: () => void;
  export let size: 'subtle' | 'prominent' = 'subtle';
  /**
   * Why this album cannot be played to the current output, or null when it
   * can. Non-null disables the button and shows the reason: the user is told
   * before the tap instead of after it.
   */
  export let blockedReason: string | null = null;

  $: iconSize = size === 'prominent' ? 24 : 18;
  $: blocked = !!blockedReason;

  // `disabled` already stops a real pointer, but the guard is what makes the
  // refusal true for every caller — a synthesised click, a programmatic
  // .click(), a future keyboard shortcut.
  function handleClick() {
    if (blocked) return;
    onPlay();
  }
</script>

<button
  class="play-album"
  class:prominent={size === 'prominent'}
  class:blocked
  type="button"
  aria-label={blocked ? `Play Album unavailable: ${blockedReason}` : 'Play Album'}
  disabled={blocked}
  on:click={handleClick}
  data-testid="play-album-button"
>
  <Icon name="play" size={iconSize} />
  <span class="label">Play Album</span>
</button>
{#if blocked}
  <p class="blocked-reason" data-testid="play-album-blocked-reason">{blockedReason}</p>
{/if}

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
  .play-album.blocked {
    cursor: default;
    opacity: 0.45;
    border-color: rgba(201, 169, 97, 0.25);
    background: transparent;
  }
  .play-album.blocked:hover,
  .play-album.blocked:focus-visible {
    background: transparent;
    border-color: rgba(201, 169, 97, 0.25);
  }
  .play-album.blocked:active {
    transform: none;
  }
  .blocked-reason {
    margin: 8px 0 0;
    font-size: 14px;
    color: var(--color-text-secondary);
    max-width: 44ch;
  }

  /* Prominent variant: larger CTA for AlbumPage info column.
     Less pronounced than the subtle pill — outlined rounded rectangle
     with no background fill, matching the user's design direction. */
  .play-album.prominent {
    gap: 12px;
    padding: 14px 32px;
    font-size: 22px;
    border-radius: 12px;
    background: transparent;
  }
  .play-album.prominent:hover,
  .play-album.prominent:focus-visible {
    background: rgba(201, 169, 97, 0.10);
  }
</style>
