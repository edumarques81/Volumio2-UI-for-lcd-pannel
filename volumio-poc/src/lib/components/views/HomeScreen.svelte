<script lang="ts">
  import { currentTrack } from '$lib/stores/player';
  import { selectedBackground } from '$lib/stores/settings';
  import StatusBar from '../StatusBar.svelte';
  import AppLauncher from '../AppLauncher.svelte';

  // Use selected background, album art, or fallback to local bg.jpg
  $: backgroundImage = $selectedBackground || $currentTrack.albumart || '/bg.jpg';
</script>

<div class="home-screen">
  <!-- Content -->
  <div class="content">
    <!-- Status Bar -->
    <StatusBar />

    <!-- App Launcher (center, includes NowPlayingTile) -->
    <div class="launcher-section">
      <AppLauncher />
    </div>
  </div>
</div>

<style>
  .home-screen {
    position: relative;
    width: 100%;
    height: 100%;
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-size: cover;
    background-position: center;
  }

  .background-gradient {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      #1a1a2e 0%,
      #16213e 25%,
      #0f3460 50%,
      #1a1a2e 75%,
      #16213e 100%
    );
  }

  .background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.15) 0%,
      rgba(0, 0, 0, 0.05) 40%,
      rgba(0, 0, 0, 0.05) 60%,
      rgba(0, 0, 0, 0.25) 100%
    );
  }

  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .launcher-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
