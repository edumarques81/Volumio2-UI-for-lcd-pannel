<script lang="ts">
  import { currentTrack, isPlaying, seek, duration, playerState, playerActions, lastPlayedAlbum, transitioning } from '$lib/stores/player';
  import { queue } from '$lib/stores/queue';
  import { airplayState, airplayActive, airplayActions } from '$lib/stores/airplay';

  import AlbumArtPanel from './AlbumArtPanel.svelte';
  import MetadataBlock from './MetadataBlock.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import FormatStrip from './FormatStrip.svelte';
  import TransportColumn from './TransportColumn.svelte';
  import AirplaySourceBadge from './AirplaySourceBadge.svelte';
  import { parseBitDepth, parseSampleRate, normalizeCodec } from './playerStateParsers';

  // AirPlay mode wins over MPD playback when a session is active.
  // The user has explicitly redirected audio to this Pi from another
  // device; surfacing the MPD queue underneath would be misleading.
  // We do NOT mutate $playerState — the MPD watcher's pre-hook pauses it
  // on the backend side, and resumes it cleanly when the AirPlay session
  // ends. The UI just hides MPD while AirPlay is live.

  // currentTrack derives { title, artist, album, albumart } from playerState
  $: track = $currentTrack ?? { title: '', artist: '', album: '', albumart: '' };
  $: hasLiveTrack = !!(track.title && track.title !== 'No track playing');
  // Idle resume: when MPD is stopped (no live track) but the backend
  // already told us about a last-played album, render that album's
  // metadata/cover/format strip so the Player view never looks empty
  // on first boot. Tapping play hydrates the queue with the saved
  // track URI; we never autoplay.
  $: isResumed = !hasLiveTrack && !!$lastPlayedAlbum;
  $: hasTrack = $airplayActive || hasLiveTrack || isResumed;
  $: atQueueEnd = $queue.length > 0 && ($playerState?.position ?? 0) === $queue.length - 1;
  // PlayerState.repeat is a boolean (Volumio shape). Map onto NavColumn enum.
  $: repeat = (
    $playerState?.repeatSingle ? 'one' :
    $playerState?.repeat ? 'all' :
    'off'
  ) as 'off' | 'all' | 'one';

  // Effective fields:
  //   1. AirPlay session active → use AirPlay state (overrides everything).
  //   2. Live MPD track → use the queue's current track.
  //   3. Resume idle state → fall back to the last-played album row.
  $: displayTitle =
    $airplayActive ? $airplayState.title :
    hasLiveTrack ? track.title : ($lastPlayedAlbum?.album ?? '');
  $: displayArtist =
    $airplayActive ? $airplayState.artist :
    hasLiveTrack ? track.artist : ($lastPlayedAlbum?.artist ?? '');
  $: displayAlbum =
    $airplayActive ? $airplayState.album :
    hasLiveTrack ? track.album : ($lastPlayedAlbum?.album ?? '');
  $: displayAlbumArt =
    $airplayActive ? $airplayState.coverDataURL :
    hasLiveTrack ? track.albumart : ($lastPlayedAlbum?.albumArt ?? '');

  // FormatStrip needs numeric sampleRate (Hz) + bitDepth + codec.
  // AirPlay supplies these as numbers; MPD/last-played supply strings
  // which parseBitDepth/parseSampleRate already accept. The codec field
  // is unknown for AirPlay (the iPhone sends decoded PCM over the link)
  // — we leave it null so FormatStrip shows just the rate+depth cells.
  $: bitDepth =
    $airplayActive ? ($airplayState.bitDepth || null) :
    parseBitDepth(hasLiveTrack ? $playerState?.bitdepth : $lastPlayedAlbum?.bitDepth);
  $: sampleRateHz =
    $airplayActive ? ($airplayState.sampleRate || null) :
    parseSampleRate(hasLiveTrack ? $playerState?.samplerate : $lastPlayedAlbum?.sampleRate);
  $: codec =
    $airplayActive ? null :
    normalizeCodec(hasLiveTrack ? $playerState?.trackType : $lastPlayedAlbum?.trackType);

  // Progress: AirPlay overrides MPD's seek/duration with its own (already
  // in seconds, not ms — different from PlayerState.seek which is ms).
  $: displaySeek = $airplayActive ? $airplayState.seekSeconds : (isResumed ? 0 : $seek);
  $: displayDuration = $airplayActive ? $airplayState.durationSeconds : (isResumed ? 0 : $duration);

  // Transport behaviour differs between MPD and AirPlay:
  //   - MPD: button state derived from $isPlaying / queue position.
  //   - AirPlay: backend's session.canControl gates the buttons until
  //     shairport-sync hands us an Active-Remote token. Status flips
  //     are owned by the iPhone — toggle is the safe universal verb.
  //
  // We don't currently get an "is playing" boolean over the AirPlay
  // contract; the iPhone owns playback state. Render the pause icon
  // optimistically while a session is active (the most common state
  // is "playing"); tapping toggles via DACP either way.
  $: airplayCanControl = $airplayActive && $airplayState.canControl;

  function togglePlay() {
    if ($airplayActive) {
      airplayActions.toggle();
      return;
    }
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

  function onPrev() {
    if ($airplayActive) {
      airplayActions.prev();
      return;
    }
    playerActions.prev();
  }

  function onNext() {
    if ($airplayActive) {
      airplayActions.next();
      return;
    }
    playerActions.next();
  }

  function onSeek(s: number) {
    // AirPlay does not expose a DACP seek primitive in this contract;
    // ProgressBar drags in AirPlay mode are a no-op for now. We pass a
    // handler anyway so the bar stays interactive when MPD is active.
    if ($airplayActive) return;
    playerActions.seekTo(s);
  }
</script>

<section
  class="player-view"
  aria-label="Now playing"
  data-testid="player-view"
  data-resumed={isResumed ? 'true' : 'false'}
  data-airplay={$airplayActive ? 'true' : 'false'}
>
  <div class="art-zone">
    <AlbumArtPanel src={displayAlbumArt || ''} alt={displayTitle || ''} />
  </div>

  <div class="meta-zone">
    {#if hasTrack}
      <MetadataBlock title={displayTitle} artist={displayArtist} album={displayAlbum} />

      <!-- AirPlay hides the progress bar entirely (seek + elapsed + duration).
           shairport-sync's prgr cadence is too sparse to sustain per-second
           accuracy, and the chain of backend fixes (Phase H seek-reset, Phase K
           wall-clock advance) still left visible drift + clamp regressions.
           User chose 2026-05-28 to cut the feature on both iOS + LCD rather
           than patch further. See feedback_drop_airplay_time_tracking in the
           project memory. -->
      {#if !$airplayActive}
        <ProgressBar
          seek={displaySeek}
          duration={displayDuration}
          onSeek={onSeek}
        />
      {/if}

      <div class="format-row">
        <FormatStrip
          bitDepth={bitDepth}
          sampleRate={sampleRateHz}
          codec={codec}
        />
        {#if $airplayActive}
          <AirplaySourceBadge sender={$airplayState.sender} />
        {/if}
      </div>
    {/if}
  </div>

  <TransportColumn
    isPlaying={$airplayActive ? $airplayState.isPlaying : $isPlaying}
    atQueueEnd={$airplayActive ? false : atQueueEnd}
    repeat={repeat}
    hasTrack={$airplayActive ? airplayCanControl : hasTrack}
    loading={$airplayActive ? false : $transitioning}
    onTogglePlay={togglePlay}
    onPrev={onPrev}
    onNext={onNext}
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
  /* Format strip + AirPlay badge sit side by side on the same row so the
     LCD layout doesn't reflow when an AirPlay session starts. */
  .format-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
</style>
