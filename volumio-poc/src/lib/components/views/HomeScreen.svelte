<script lang="ts">
  import { selectedBackground } from '$lib/stores/settings';
  import StatusBar from '../StatusBar.svelte';
  import AppLauncher from '../AppLauncher.svelte';

  // Background - fallback to local bg.jpg
  $: viewBackground = $selectedBackground || '/bg.jpg';
</script>

<div class="home-screen">
  <!-- Background -->
  <div class="background" style="background-image: url({viewBackground})"></div>
  <div class="background-overlay"></div>

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
    background-size: cover;
    background-position: center;
    z-index: 0;
    background-color: #1a1a2e;
  }

  .background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(180deg,
      rgba(0, 0, 0, 0.2) 0%,
      rgba(0, 0, 0, 0.1) 30%,
      rgba(0, 0, 0, 0.1) 70%,
      rgba(0, 0, 0, 0.3) 100%
    );
    z-index: 1;
  }

  .content {
    position: relative;
    z-index: 2;
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
