<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import AlbumCover from './AlbumCover.svelte';
  import AlbumTrackList from './AlbumTrackList.svelte';
  import AlbumInfo from './AlbumInfo.svelte';
  import HiResAudioStrip from './HiResAudioStrip.svelte';
  import PlayAlbumButton from './PlayAlbumButton.svelte';
  import { parseBitDepth, parseSampleRate, normalizeCodec } from './playerStateParsers';
  import { libraryAlbumTotalDuration, type Album } from '$lib/stores/library';
  import { formatTime } from '$lib/stores/player';

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

  // Meta strip: "12 songs • 48:37 • 2023 • Ambient / Post-Rock".
  // Each part conditional — empty parts produce no separator, so we never
  // ship a leading or trailing "•" or a doubled "• •" gap when one of the
  // optional fields (year, genre, total duration) is missing.
  $: metaParts = (() => {
    const parts: string[] = [];
    if (album.trackCount > 0) parts.push(`${album.trackCount} songs`);
    if ($libraryAlbumTotalDuration > 0) parts.push(formatTime($libraryAlbumTotalDuration));
    if (typeof album.year === 'number') parts.push(String(album.year));
    if (album.genre && album.genre.trim().length > 0) parts.push(album.genre.trim());
    return parts;
  })();
  $: metaText = metaParts.join(' • ');
</script>

<section class="album-page" aria-label="Album {album.title}">
  <div class="cover-zone">
    <AlbumCover src={album.albumArt || ''} alt={album.title} size={380} onTap={onPlayAlbum} />
  </div>

  <div class="info-zone">
    <span class="album-eyebrow">ALBUM</span>
    <h1 class="title">{album.title}</h1>
    <div class="artist-row">
      <Icon name="user" size={22} />
      <span>{album.artist}</span>
    </div>

    {#if metaParts.length > 0}
      <div class="meta-strip" data-testid="album-meta-strip">{metaText}</div>
    {/if}

    {#if onPlayAlbum}
      <div class="play-row">
        <PlayAlbumButton onPlay={onPlayAlbum} size="prominent" />
      </div>
    {/if}

    <AlbumInfo title={album.title} />

    <hr class="gold-rule" aria-hidden="true" />

    <HiResAudioStrip {bitDepth} {sampleRate} {codec} />
  </div>

  <div class="tracklist-zone">
    <AlbumTrackList {tracks} />
  </div>
</section>

<style>
  .album-page {
    display: grid;
    /* 3-column composition matching library-screen-target-2026-05-08.png:
       cover ~40% / info ~32% / tracklist ~28%. The cover butts directly
       against the info column (no gap, hairline, or feather per locked
       brief). The visible gap sits only between info and tracklist. */
    grid-template-columns: 30fr 38fr 27fr;
    grid-template-areas: 'cover info tracks';
    column-gap: 0;
    width: 100%;
    height: 100%;
    /* Minimal top/bottom/left padding; zero right so the tracklist sits
       flush against the nav column. Mirrors PlayerView padding. */
    padding: 4px 0 4px 4px;
    box-sizing: border-box;
  }
  .cover-zone {
    grid-area: cover;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .info-zone {
    grid-area: info;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
    overflow: hidden;
    /* The visible gap between info and tracklist lives here, on the right
       margin of the info column. Cover→info stays butted (column-gap: 0). */
    margin-right: 24px;
  }
  .tracklist-zone {
    grid-area: tracks;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    /* Reserve clear space on the right so track durations don't overlap
       the right EdgeChevron (88px button at right:0 with a 64px glyph
       centered). 80px combined with AlbumTrackList's internal 16px
       scrollbar-gutter yields 96px of total clearance from the LCD edge. */
    padding-right: 80px;
  }
  .album-eyebrow {
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-accent);
    line-height: 1;
  }
  .title {
    font-size: 48px;
    font-weight: 400;
    color: var(--color-text-primary);
    margin: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    /* line-height needs >1.0 so descenders (y, g, j, p, q) aren't clipped
       by overflow:hidden — overflow:hidden is required for the ellipsis on
       horizontal overflow but it also clips vertically when the line box
       exactly equals font-size. 1.2 gives ~9.6px of leading at 48px,
       enough for descenders without visible vertical spacing. */
    line-height: 1.2;
  }
  .artist-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 24px; font-weight: 300;
    color: var(--color-accent);
  }
  .artist-row :global(svg) { color: var(--color-accent); flex-shrink: 0; }
  .meta-strip {
    color: var(--color-text-secondary);
    font-size: 17px;
    font-weight: 400;
    line-height: 1.2;
  }
  .play-row {
    margin: 18px 0 18px 0;
  }
  .gold-rule {
    border: none;
    height: 1px;
    width: 100%;
    background: rgba(201, 169, 97, 0.35);
    margin: 4px 0;
  }
</style>
