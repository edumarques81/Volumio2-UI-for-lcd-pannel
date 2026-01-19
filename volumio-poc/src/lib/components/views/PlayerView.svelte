<script lang="ts">
  import { currentTrack } from '$lib/stores/player';
  import { selectedBackground } from '$lib/stores/settings';
  import AlbumArt from '../AlbumArt.svelte';
  import TrackInfo from '../TrackInfo.svelte';
  import PlayerControls from '../PlayerControls.svelte';
  import VolumeControl from '../VolumeControl.svelte';
  import SeekBar from '../SeekBar.svelte';

  // Use selected background, album art, or fallback to default
  $: backgroundImage = $selectedBackground || $currentTrack.albumart || '/backgrounds/default.svg';
</script>

<div class="player-view">
  <!-- Background with blur -->
  <div class="background">
    <div class="background-image" style="background-image: url('{backgroundImage}')"></div>
    <div class="background-overlay"></div>
  </div>

  <div class="player-content">
    <!-- Album Art -->
    <div class="art-section">
      <AlbumArt size="large" />
    </div>

    <!-- Track Info & Controls -->
    <div class="info-section">
      <TrackInfo />
      <PlayerControls />
      <SeekBar />
    </div>

    <!-- Volume -->
    <div class="volume-section">
      <VolumeControl />
    </div>
  </div>
</div>

<style>
  .player-view {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    box-sizing: border-box;
    overflow: hidden;
  }

  .background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
  }

  .background-image {
    position: absolute;
    top: -20px;
    left: -20px;
    right: -20px;
    bottom: -20px;
    background-size: cover;
    background-position: center;
    filter: blur(30px) brightness(0.5);
    transform: scale(1.1);
  }

  .background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.4) 0%,
      rgba(0, 0, 0, 0.2) 50%,
      rgba(0, 0, 0, 0.5) 100%
    );
  }

  .player-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--spacing-2xl);
    width: 100%;
    max-width: 1800px;
    height: 100%;
  }

  .art-section {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    flex-shrink: 0;
  }

  .info-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--spacing-lg);
    min-width: 0;
    padding: var(--spacing-md) 0;
  }

  .volume-section {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    min-width: 320px;
  }
</style>
