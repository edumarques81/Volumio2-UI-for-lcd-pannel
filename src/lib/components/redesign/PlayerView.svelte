<script lang="ts">
  import { currentTrack, isPlaying, seek, duration, playerState, playerActions } from '$lib/stores/player';
  import { queue } from '$lib/stores/queue';

  import AlbumArtPanel from './AlbumArtPanel.svelte';
  import MetadataBlock from './MetadataBlock.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import FormatStrip from './FormatStrip.svelte';
  import TransportColumn from './TransportColumn.svelte';
  import { parseBitDepth, parseSampleRate, normalizeCodec } from './playerStateParsers';

  // currentTrack derives { title, artist, album, albumart } from playerState
  $: track = $currentTrack ?? { title: '', artist: '', album: '', albumart: '' };
  $: hasTrack = !!(track.title && track.title !== 'No track playing');
  $: atQueueEnd = $queue.length > 0 && ($playerState?.position ?? 0) === $queue.length - 1;
  // PlayerState.repeat is a boolean (Volumio shape). Map onto NavColumn enum.
  $: repeat = (
    $playerState?.repeatSingle ? 'one' :
    $playerState?.repeat ? 'all' :
    'off'
  ) as 'off' | 'all' | 'one';

  // FormatStrip needs numeric sampleRate (Hz) + bitDepth + codec.
  // Derive from playerState's string fields ("96 kHz", "24 bit", "flac").
  $: bitDepth = parseBitDepth($playerState?.bitdepth);
  $: sampleRateHz = parseSampleRate($playerState?.samplerate);
  $: codec = normalizeCodec($playerState?.trackType);

  function togglePlay() {
    if ($isPlaying) playerActions.pause();
    else playerActions.play();
  }
</script>

<section class="player-view" aria-label="Now playing" data-testid="player-view">
  <div class="art-zone">
    <AlbumArtPanel src={track.albumart || ''} alt={track.title || ''} />
  </div>

  <div class="meta-zone">
    <MetadataBlock title={track.title} artist={track.artist} album={track.album} />

    <ProgressBar
      seek={$seek}
      duration={$duration}
      onSeek={(s) => playerActions.seekTo(s)}
    />

    <FormatStrip
      bitDepth={bitDepth}
      sampleRate={sampleRateHz}
      codec={codec}
    />
  </div>

  <TransportColumn
    isPlaying={$isPlaying}
    atQueueEnd={atQueueEnd}
    repeat={repeat}
    hasTrack={hasTrack}
    onTogglePlay={togglePlay}
    onPrev={() => playerActions.prev()}
    onNext={() => playerActions.next()}
  />
</section>

<style>
  .player-view {
    display: grid;
    /* fr units fill the inner area (PlayerLayout already removed the nav strip).
       Spec ratios 23/49/15 preserved verbatim. */
    grid-template-columns: 23fr 49fr 15fr;
    column-gap: 0;
    width: 100%;
    height: 100%;
    /* Minimal top/bottom/left margins; zero right so the meta zone sits flush
       against the transport column. */
    padding: 4px 0 4px 4px;
    box-sizing: border-box;
  }
  .art-zone {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    height: 100%;
    min-width: 0;
    /* Make this a container so AlbumArtPanel's `cqi`/`cqb` units resolve
       against this cell's actual dimensions. */
    container-type: size;
  }
  .meta-zone {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 24px;
    padding: 0 24px;
    overflow: hidden;
  }
</style>
