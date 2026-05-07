<script lang="ts">
  // Square album art with 200ms crossfade keyed off the `src` prop.
  // No-art fallback is a pure-black square (no music-note icon, per spec).
  // When `size` is provided, the panel renders at exactly that pixel size.
  // When omitted, the panel fills its container's height as a 1:1 square,
  // capped to 100% of available width — keeps the art square at any
  // letterboxed viewport without clipping.
  export let src: string = '';
  export let alt: string = '';
  export let size: number | undefined = undefined;

  $: sizedStyle = size != null ? `width:${size}px;height:${size}px` : '';
</script>

<div
  class="album-art"
  class:responsive={size == null}
  data-testid="album-art-panel"
  style={sizedStyle}
>
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
  .album-art.responsive {
    /* Container queries clamp to the smaller of inline (width) and block (height)
       so the art stays square regardless of whether the parent is taller-than-wide
       or wider-than-tall. Falls back to height:100% on browsers without container
       query support — still gives a square in the LCD case. */
    aspect-ratio: 1 / 1;
    width: min(100cqi, 100cqb);
    height: min(100cqi, 100cqb);
  }
  .art-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
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
