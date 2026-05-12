<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import {
    libraryArtists,
    libraryArtistsLoading,
    libraryArtistsError,
    selectedArtist,
    libraryActions,
  } from '$lib/stores/library';
  import ArtistTile from './ArtistTile.svelte';

  // Exposed for unit-test invocation of the tap-handler flow without
  // going through the (often-mocked) ArtistTile click event surface.
  export function handleTileTap(name: string) {
    libraryActions.fetchArtistAlbums(name);
    libraryActions.cyclePageKind(-1);
  }

  function retry() {
    libraryActions.fetchArtists();
  }

  onMount(() => {
    if (get(libraryArtists).length === 0 && !get(libraryArtistsLoading)) {
      libraryActions.fetchArtists();
    }
    // No auto-scroll on revisit: the `'albums' → 'artists'` subscriber inside
    // library.ts clears `selectedArtist` whenever the user lands here, so the
    // strip always starts at scroll-position 0 with no tile selected.
  });
</script>

<section class="artists-page" data-testid="artists-page">
  <header class="artists-page-header" data-testid="artists-page-header">Artists</header>

  {#if $libraryArtistsError}
    <div class="state-error" data-testid="artists-error" role="alert" on:click={retry}>
      Could not load artists. Tap to retry.
    </div>
  {:else if $libraryArtistsLoading && $libraryArtists.length === 0}
    <div class="artists-strip" data-testid="artists-strip-loading">
      {#each Array(7) as _, i (i)}
        <div class="tile-skeleton" data-testid="artist-tile-skeleton"></div>
      {/each}
    </div>
  {:else if $libraryArtists.length === 0}
    <div class="state-empty" data-testid="artists-empty">No artists in library</div>
  {:else}
    <div class="artists-strip">
      {#each $libraryArtists as artist (artist.name)}
        <ArtistTile
          {artist}
          selected={$selectedArtist === artist.name}
          onTap={handleTileTap}
        />
      {/each}
    </div>
  {/if}
</section>

<style>
  .artists-page {
    width: 100%;
    height: 100%;
    background: #050507;
    padding: 20px 0 0 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .artists-page-header {
    padding-left: 48px;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-accent);
    letter-spacing: 0.04em;
  }
  .artists-strip {
    display: flex;
    flex-direction: row;
    gap: 24px;
    padding: 0 48px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-behavior: smooth;
    touch-action: pan-x;
    container-type: inline-size;
  }
  .artists-strip::-webkit-scrollbar { display: none; }
  .tile-skeleton {
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: linear-gradient(90deg, #15171a 0%, #1c1f24 50%, #15171a 100%);
    background-size: 200% 100%;
    flex-shrink: 0;
    animation: skel-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes skel-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .state-empty, .state-error {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    font-size: 16px;
  }
  .state-error {
    color: var(--color-accent-bright);
    cursor: pointer;
  }

  @container (max-width: 1200px) {
    .tile-skeleton { width: 120px; height: 120px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tile-skeleton { animation: none; }
    .artists-strip { scroll-behavior: auto; }
  }
</style>
