<script lang="ts">
  import { currentTrack, isPlaying, seek, duration, playerState, playerActions, lastPlayedAlbum, transitioning } from '$lib/stores/player';
  import { queue } from '$lib/stores/queue';

  import AlbumArtPanel from './AlbumArtPanel.svelte';
  import MetadataBlock from './MetadataBlock.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import FormatStrip from './FormatStrip.svelte';
  import TransportColumn from './TransportColumn.svelte';
  import { parseBitDepth, parseSampleRate, normalizeCodec } from './playerStateParsers';

  // currentTrack derives { title, artist, album, albumart } from playerState
  $: track = $currentTrack ?? { title: '', artist: '', album: '', albumart: '' };
  $: hasLiveTrack = !!(track.title && track.title !== 'No track playing');
  // Idle resume: when MPD is stopped (no live track) but the backend
  // already told us about a last-played album, render that album's
  // metadata/cover/format strip so the Player view never looks empty
  // on first boot. Tapping play hydrates the queue with the saved
  // track URI; we never autoplay.
  $: isResumed = !hasLiveTrack && !!$lastPlayedAlbum;
  $: hasTrack = hasLiveTrack || isResumed;
  $: atQueueEnd = $queue.length > 0 && ($playerState?.position ?? 0) === $queue.length - 1;
  // PlayerState.repeat is a boolean (Volumio shape). Map onto NavColumn enum.
  $: repeat = (
    $playerState?.repeatSingle ? 'one' :
    $playerState?.repeat ? 'all' :
    'off'
  ) as 'off' | 'all' | 'one';

  // Effective fields: prefer live track when playing, else fall back to
  // the last-played row. Quality fields use the same fallback so the
  // FormatStrip lights up on resume too.
  $: displayTitle = hasLiveTrack ? track.title : ($lastPlayedAlbum?.album ?? '');
  $: displayArtist = hasLiveTrack ? track.artist : ($lastPlayedAlbum?.artist ?? '');
  $: displayAlbum = hasLiveTrack ? track.album : ($lastPlayedAlbum?.album ?? '');
  $: displayAlbumArt = hasLiveTrack ? track.albumart : ($lastPlayedAlbum?.albumArt ?? '');

  // FormatStrip needs numeric sampleRate (Hz) + bitDepth + codec.
  $: bitDepth = parseBitDepth(hasLiveTrack ? $playerState?.bitdepth : $lastPlayedAlbum?.bitDepth);
  $: sampleRateHz = parseSampleRate(hasLiveTrack ? $playerState?.samplerate : $lastPlayedAlbum?.sampleRate);
  $: codec = normalizeCodec(hasLiveTrack ? $playerState?.trackType : $lastPlayedAlbum?.trackType);

  function togglePlay() {
    if ($isPlaying) {
      playerActions.pause();
      return;
    }
    // In resumed-only state the queue is empty, so the standard play()
    // would no-op. Hydrate from the saved track URI instead.
    if (isResumed) {
      playerActions.playLastPlayed();
      return;
    }
    playerActions.play();
  }
</script>

<section class="player-view" aria-label="Now playing" data-testid="player-view" data-resumed={isResumed ? 'true' : 'false'}>
  <div class="art-zone">
    <AlbumArtPanel src={displayAlbumArt || ''} alt={displayTitle || ''} />
  </div>

  <div class="meta-zone">
    {#if hasTrack}
      <MetadataBlock title={displayTitle} artist={displayArtist} album={displayAlbum} />

      <ProgressBar
        seek={isResumed ? 0 : $seek}
        duration={isResumed ? 0 : $duration}
        onSeek={(s) => playerActions.seekTo(s)}
      />

      <FormatStrip
        bitDepth={bitDepth}
        sampleRate={sampleRateHz}
        codec={codec}
      />
    {/if}
  </div>

  <TransportColumn
    isPlaying={$isPlaying}
    atQueueEnd={atQueueEnd}
    repeat={repeat}
    hasTrack={hasTrack}
    loading={$transitioning}
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
