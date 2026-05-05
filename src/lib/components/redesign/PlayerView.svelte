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
    <AlbumArtPanel src={track.albumart || ''} alt={track.title || ''} size={400} />
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
    grid-template-columns: 23% 49% 15%; /* 13% nav lives in PlayerLayout */
    column-gap: 0;
    width: 100%;
    height: 100%;
    padding: 16px 20px;
    box-sizing: border-box;
  }
  .art-zone {
    display: flex;
    align-items: center;
    justify-content: center;
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
