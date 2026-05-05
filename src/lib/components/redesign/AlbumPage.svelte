<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import AlbumCover from './AlbumCover.svelte';
  import AlbumTrackList from './AlbumTrackList.svelte';
  import AlbumInfo from './AlbumInfo.svelte';
  import FormatStrip from './FormatStrip.svelte';
  import { parseBitDepth, parseSampleRate, normalizeCodec } from './playerStateParsers';
  import type { Album } from '$lib/stores/library';

  export let album: Album;
  export let tracks: { uri: string; title: string; duration: number }[] = [];
  // Optional + safe-called (matches AlbumCover.onTap convention). Tapping the
  // cover when no handler is wired becomes a deliberate no-op rather than a
  // runtime TypeError.
  export let onPlayAlbum: (() => void) | undefined = undefined;

  // Album.quality is a pre-formatted string like "192kHz/24bit FLAC".
  // Parse it once per album for the format-strip props. The parsers are
  // tolerant of missing units, so an album with quality="flac" still works.
  $: bitDepth   = parseBitDepth(album.quality ?? null);
  $: sampleRate = parseSampleRate(album.quality ?? null);
  $: codec      = normalizeCodec(album.trackType ?? null);
</script>

<section class="album-page" aria-label="Album {album.title}">
  <div class="cover-zone">
    <AlbumCover src={album.albumArt || ''} alt={album.title} size={380} onTap={onPlayAlbum} />
  </div>

  <div class="info-zone">
    <h1 class="title">{album.title}</h1>
    <div class="artist-row">
      <Icon name="user" size={22} />
      <span>{album.artist}</span>
    </div>

    <AlbumTrackList {tracks} />

    <AlbumInfo />

    <FormatStrip {bitDepth} {sampleRate} {codec} />
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
