<script lang="ts">
  import {
    libraryAlbums,
    artistAlbums,
    selectedArtist,
    libraryPageKind,
    libraryAlbumTracks,
    currentLibraryIndex,
    libraryActions,
  } from '$lib/stores/library';
  import { bioActions } from '$lib/stores/bios';
  import { viewActions } from '$lib/stores/navigation';
  import AlbumPage from './AlbumPage.svelte';
  import EdgeChevron from './EdgeChevron.svelte';
  import { fly } from 'svelte/transition';
  import type { SvelteComponent } from 'svelte';

  const SWIPE_THRESHOLD = 50;
  const SWIPE_THRESHOLD_Y = 50;

  // When `selectedArtist` is set we render the filtered artistAlbums list
  // instead of the full library. The list-source switch is reactive so toggling
  // the artist filter (or clearing it via clearArtistFilter) hot-swaps the
  // visible slide without re-rendering the whole page-slot.
  $: albumsList = $selectedArtist ? ($artistAlbums || []) : ($libraryAlbums || []);
  $: currentAlbum = albumsList.length > 0 ? albumsList[$currentLibraryIndex % albumsList.length] : null;
  $: currentTracks = $libraryAlbumTracks || [];

  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerActive = false;
  let lastDirection: 'forward' | 'back' = 'forward';
  let lastVertDir: 'up' | 'down' = 'up';

  // Lazy-load ArtistsPage so it doesn't ship in the initial Library chunk.
  // The dynamic import is gated behind `libraryPageKind === 'artists'` so the
  // first vertical swipe upward triggers the fetch; subsequent toggles reuse
  // the resolved component. ArtistsPageComponent stays null until the first
  // transition, at which point we render a tiny loading shell.
  let ArtistsPageComponent: typeof SvelteComponent | null = null;
  let artistsPageImportStarted = false;
  $: if ($libraryPageKind === 'artists' && !artistsPageImportStarted) {
    artistsPageImportStarted = true;
    void import('./ArtistsPage.svelte').then((m) => {
      ArtistsPageComponent = m.default as typeof SvelteComponent;
    });
  }

  function advance(delta: 1 | -1) {
    if (albumsList.length === 0) return;
    const len = albumsList.length;
    lastDirection = delta === 1 ? 'forward' : 'back';
    currentLibraryIndex.update((i) => (((i + delta) % len) + len) % len);
  }

  function handlePointerDown(e: PointerEvent) {
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    pointerActive = true;
  }
  function handlePointerUp(e: PointerEvent) {
    if (!pointerActive) return;
    pointerActive = false;
    const dx = e.clientX - pointerStartX;
    const dy = e.clientY - pointerStartY;
    // Dominant-axis tie-break: when |dx| === |dy| we take the horizontal
    // branch. This matches the existing album-to-album swipe muscle memory.
    if (Math.abs(dy) > Math.abs(dx)) {
      if (Math.abs(dy) < SWIPE_THRESHOLD_Y) return;
      lastVertDir = dy < 0 ? 'up' : 'down';
      libraryActions.cyclePageKind(dy < 0 ? 1 : -1);
    } else {
      if ($libraryPageKind !== 'albums') return;  // M2.C: don't shift currentLibraryIndex while on ArtistsPage; the strip's pan-x bubbles pointerup up here
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      advance(dx < 0 ? 1 : -1);
    }
  }
  function handlePointerCancel() {
    pointerActive = false;
  }

  // Guard the fetch by uri so that re-emissions of $libraryAlbums (cache
  // rebuild, reconnect re-fetch, enrichment update) — which produce a new
  // array reference and therefore a new currentAlbum object reference —
  // don't spuriously re-fetch tracks/bio for the album already on screen.
  // Only fire while the renderer is showing the albums page; ArtistsPage
  // has its own data flow.
  let lastLoadedUri = '';
  $: if ($libraryPageKind === 'albums' && currentAlbum && currentAlbum.uri !== lastLoadedUri) {
    lastLoadedUri = currentAlbum.uri;
    libraryActions.fetchAlbumTracks(currentAlbum);
    bioActions.requestBio(currentAlbum.artist, currentAlbum.title);
  }

  function playCurrent() {
    if (!currentAlbum) return;
    // Use replaceAndPlay { type: 'folder' } so Volumio's MPD service expands
    // the folder URI and plays from track 1 server-side. The earlier
    // replaceQueueAndPlay path emitted addToQueue with an array of URIs, but
    // the backend's addToQueue handler only accepts a single uri string and
    // silently dropped array payloads — leaving the queue empty so play(0)
    // played nothing.
    libraryActions.playAlbum(currentAlbum);
    viewActions.goToPlayer();
  }

  // When the user selects an artist (from ArtistsPage tap), reset to the first
  // album in the filtered list. Without this, navigating into a filter while
  // currentLibraryIndex was pointing deep into the full list would render a
  // wrap-modulo-skewed album.
  $: if ($selectedArtist !== null) {
    currentLibraryIndex.set(0);
  }
</script>

<div
  class="library-view"
  data-testid="library-view"
  on:pointerdown={handlePointerDown}
  on:pointerup={handlePointerUp}
  on:pointercancel={handlePointerCancel}
>
  {#key $libraryPageKind}
    <div
      class="page-slot"
      in:fly|local={{ y: lastVertDir === 'up' ? 120 : -120, duration: 220, opacity: 0.2 }}
      out:fly|local={{ y: lastVertDir === 'up' ? -120 : 120, duration: 180, opacity: 0 }}
    >
      {#if $libraryPageKind === 'albums'}
        {#if currentAlbum}
          <div class="album-slot">
            {#key currentAlbum.uri}
              <div
                class="slide-wrapper"
                data-testid="album-slide-wrapper"
                data-direction={lastDirection}
                in:fly|local={{ x: lastDirection === 'forward' ? 120 : -120, duration: 220, opacity: 0.2 }}
                out:fly|local={{ x: lastDirection === 'forward' ? -120 : 120, duration: 180, opacity: 0 }}
              >
                <AlbumPage album={currentAlbum} tracks={currentTracks} onPlayAlbum={playCurrent} />
              </div>
            {/key}
          </div>
        {:else}
          <div class="empty" data-testid="library-empty">No albums in library</div>
        {/if}
        <!--
          Chevrons live OUTSIDE the .album-slot so they persist across the fly
          transition (the slide-wrapper is replaced on every key change). They
          are flush to the inner-rect's left/right edges — LibraryView itself
          fills PlayerLayout's .content (1fr column to the left of the 240px
          NavColumn), so left:0 / right:0 of this root *is* the inner-rect
          edge.
        -->
        <EdgeChevron side="left" onTap={() => advance(-1)} />
        <EdgeChevron side="right" onTap={() => advance(1)} />
      {:else if $libraryPageKind === 'artists'}
        {#if ArtistsPageComponent}
          <svelte:component this={ArtistsPageComponent} />
        {:else}
          <div class="empty" data-testid="artists-loading-shell">Loading…</div>
        {/if}
      {/if}
    </div>
  {/key}
</div>

<style>
  .library-view {
    width: 100%;
    height: 100%;
    /* Vertical-swipe needs to consume vertical drag too; touch-action: none
       lets the browser deliver pointer events instead of treating them as
       a native pan-y scroll. */
    touch-action: none;
    overflow: hidden;
    /* Positioning context for the absolutely-positioned EdgeChevrons and the
       full-bleed .page-slot. */
    position: relative;
  }
  /*
   * Chevrons must paint above .album-slot so taps register. EdgeChevron
   * itself is `position: absolute` and anchors top:50% / left|right:0.
   */
  .library-view :global(.edge-chevron) {
    z-index: 2;
  }
  .page-slot {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    font-size: 24px;
  }
  .album-slot {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .slide-wrapper {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .page-slot,
    .slide-wrapper {
      transition: none;
    }
  }
</style>
