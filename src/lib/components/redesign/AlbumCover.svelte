<script lang="ts">
  import AlbumArtPanel from './AlbumArtPanel.svelte';
  export let src: string = '';
  export let alt: string = '';
  export let size: number = 380;
  // Optional + safe-called. Marking the callback optional makes "no handler"
  // a deliberate type-system decision; the safe-call below stops a stray
  // tap from throwing TypeError if a parent forgets to wire it up.
  export let onTap: (() => void) | undefined = undefined;
</script>

<button class="album-cover" type="button" on:click={() => onTap?.()} aria-label={`Play ${alt || 'album'}`}>
  <AlbumArtPanel {src} {alt} {size} />
</button>

<style>
  .album-cover {
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
  }
  .album-cover:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
    border-radius: var(--radius-card);
  }
</style>
