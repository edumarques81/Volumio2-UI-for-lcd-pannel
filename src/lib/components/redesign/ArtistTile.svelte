<script lang="ts">
  import type { Artist } from '$lib/stores/library';
  import { artistInitial, artistHashColor } from '$lib/utils/artistAvatar';

  interface Props {
    artist: Artist;
    selected: boolean;
    onTap: (name: string) => void;
  }

  let { artist, selected, onTap }: Props = $props();

  let imageFailed = $state(false);

  const initial = $derived(artistInitial(artist.name));
  const hashColor = $derived(artistHashColor(artist.name));
  const imgSrc = $derived(`/artistart?name=${encodeURIComponent(artist.name)}`);
  const slug = $derived(
    artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  );

  function handleTap() {
    onTap(artist.name);
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTap();
    }
  }
</script>

<div
  class="artist-tile"
  class:is-selected={selected}
  role="button"
  tabindex="0"
  aria-pressed={selected}
  aria-label={artist.name}
  data-testid={`artist-tile-${slug}`}
  on:click={handleTap}
  on:keydown={handleKey}
>
  <div class="artist-tile-circle">
    {#if !imageFailed}
      <img src={imgSrc} alt="" on:error={() => (imageFailed = true)} />
    {:else}
      <div class="avatar-fallback" data-testid="avatar-fallback" style={`background:${hashColor}`}>
        {initial}
      </div>
    {/if}
  </div>
  <div class="artist-tile-name">{artist.name}</div>
</div>

<style>
  .artist-tile {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 160px;
    flex-shrink: 0;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .artist-tile:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
    border-radius: 8px;
  }
  .artist-tile-circle {
    width: 160px;
    height: 160px;
    border-radius: 50%;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: border-color 200ms ease-out, box-shadow 200ms ease-out;
  }
  .artist-tile.is-selected .artist-tile-circle {
    border: 2px solid var(--color-accent);
    box-shadow: 0 0 16px var(--color-accent-glow);
  }
  .artist-tile-circle img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 56px;
    font-weight: 700;
    line-height: 1;
  }
  .artist-tile-name {
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    letter-spacing: 0.01em;
    max-width: 160px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 200ms ease-out;
  }
  .artist-tile.is-selected .artist-tile-name {
    color: var(--color-accent-bright);
  }

  @media (prefers-reduced-motion: reduce) {
    .artist-tile-circle, .artist-tile-name { transition: none; }
  }
</style>
