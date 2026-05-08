<script lang="ts">
  import { libraryAlbums, libraryAlbumTracks, currentLibraryIndex, libraryActions } from '$lib/stores/library';
  import { bioActions } from '$lib/stores/bios';
  import AlbumPage from './AlbumPage.svelte';
  import { fly } from 'svelte/transition';

  const SWIPE_THRESHOLD = 50;

  $: albumsList = $libraryAlbums || [];
  $: currentAlbum = albumsList.length > 0 ? albumsList[$currentLibraryIndex % albumsList.length] : null;
  $: currentTracks = $libraryAlbumTracks || [];

  let pointerStartX = 0;
  let pointerActive = false;
  let lastDirection: 'forward' | 'back' = 'forward';

  function advance(delta: 1 | -1) {
    if (albumsList.length === 0) return;
    const len = albumsList.length;
    lastDirection = delta === 1 ? 'forward' : 'back';
    currentLibraryIndex.update((i) => (((i + delta) % len) + len) % len);
  }

  function handlePointerDown(e: PointerEvent) {
    pointerStartX = e.clientX;
    pointerActive = true;
  }
  function handlePointerUp(e: PointerEvent) {
    if (!pointerActive) return;
    pointerActive = false;
    const dx = e.clientX - pointerStartX;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    advance(dx < 0 ? 1 : -1);
  }
  function handlePointerCancel() {
    pointerActive = false;
  }

  // Guard the fetch by uri so that re-emissions of $libraryAlbums (cache
  // rebuild, reconnect re-fetch, enrichment update) — which produce a new
  // array reference and therefore a new currentAlbum object reference —
  // don't spuriously re-fetch tracks/bio for the album already on screen.
  let lastLoadedUri = '';
  $: if (currentAlbum && currentAlbum.uri !== lastLoadedUri) {
    lastLoadedUri = currentAlbum.uri;
    libraryActions.fetchAlbumTracks(currentAlbum);
    bioActions.requestBio(currentAlbum.artist, currentAlbum.title);
  }

  function playCurrent() {
    if (currentAlbum) libraryActions.replaceQueueAndPlay(currentAlbum);
  }
</script>

<div
  class="library-view"
  data-testid="library-view"
  on:pointerdown={handlePointerDown}
  on:pointerup={handlePointerUp}
  on:pointercancel={handlePointerCancel}
>
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
</div>

<style>
  .library-view {
    width: 100%;
    height: 100%;
    touch-action: pan-y;
    overflow: hidden;
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
</style>
