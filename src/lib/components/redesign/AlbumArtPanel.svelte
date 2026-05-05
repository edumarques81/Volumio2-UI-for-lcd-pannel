<script lang="ts">
  // Square album art with 200ms crossfade keyed off the `src` prop.
  // No-art fallback is a pure-black square (no music-note icon, per spec).
  export let src: string = '';
  export let alt: string = '';
  export let size: number = 400;       // px on Pi LCD
</script>

<div class="album-art" data-testid="album-art-panel" style="width:{size}px;height:{size}px">
  {#if src}
    {#key src}
      <img class="art-img" {src} {alt} />
    {/key}
  {:else}
    <div class="no-art" aria-label={alt || 'No artwork'} role="img"></div>
  {/if}
</div>

<style>
  .album-art {
    border-radius: var(--radius-card);
    overflow: hidden;
    background: #000;
    flex-shrink: 0;
  }
  .art-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;        /* center-anchored square crop */
    object-position: center;
    animation: art-fade var(--crossfade-duration) var(--crossfade-ease);
  }
  .no-art {
    width: 100%;
    height: 100%;
    background: #000;
  }
  @keyframes art-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>
