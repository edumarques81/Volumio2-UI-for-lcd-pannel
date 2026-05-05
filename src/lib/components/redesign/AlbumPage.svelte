<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import AlbumCover from './AlbumCover.svelte';
  import AlbumTrackList from './AlbumTrackList.svelte';
  import AlbumInfo from './AlbumInfo.svelte';
  import FormatStrip from './FormatStrip.svelte';

  export let album: {
    uri: string; title: string; artist: string; albumart: string;
    trackQuality?: { bitDepth: number | null; sampleRate: number | null; codec: string | null } | null;
  };
  export let tracks: { uri: string; title: string; duration: number }[] = [];
  export let onPlayAlbum: () => void;
</script>

<section class="album-page" aria-label="Album {album.title}">
  <div class="cover-zone">
    <AlbumCover src={album.albumart || ''} alt={album.title} size={380} onTap={onPlayAlbum} />
  </div>

  <div class="info-zone">
    <h1 class="title">{album.title}</h1>
    <div class="artist-row">
      <Icon name="user" size={22} />
      <span>{album.artist}</span>
    </div>

    <AlbumTrackList {tracks} />

    <AlbumInfo />

    {#if album.trackQuality}
      <FormatStrip
        bitDepth={album.trackQuality.bitDepth ?? null}
        sampleRate={album.trackQuality.sampleRate ?? null}
        codec={album.trackQuality.codec ?? null}
      />
    {/if}
  </div>
</section>

<style>
  .album-page {
    display: grid;
    grid-template-columns: 30% 57%;
    column-gap: 24px;
    width: 100%;
    height: 100%;
    padding: 16px 20px;
    box-sizing: border-box;
  }
  .cover-zone {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .info-zone {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    overflow: hidden;
  }
  .title {
    font-size: 56px;
    font-weight: 400;
    color: var(--color-text-primary);
    margin: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1.1;
  }
  .artist-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 24px; font-weight: 300;
    color: var(--color-text-secondary);
  }
  .artist-row :global(svg) { color: var(--color-accent); flex-shrink: 0; }
</style>
