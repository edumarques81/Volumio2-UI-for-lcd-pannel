<script lang="ts">
  import { selectedBackground } from '$lib/stores/settings';
  import StatusBar from '../StatusBar.svelte';
  import AppLauncher from '../AppLauncher.svelte';
  import DockedMiniPlayer from '../miniplayer/DockedMiniPlayer.svelte';

  // Background - fallback to local bg.jpg
  $: viewBackground = $selectedBackground || '/bg.jpg';
</script>

<div class="home-screen">
  <!-- Background -->
  <div class="background" style="background-image: url({viewBackground})"></div>
  <div class="background-overlay"></div>

  <!-- Content with CSS Grid layout -->
  <div class="content">
    <!-- Status Bar spans full width -->
    <StatusBar />

    <!-- Main area: Docked Mini Player (left) + App Launcher (right) -->
    <div class="main-area">
      <!-- Docked Mini Player (40% width) -->
      <div class="mini-player-panel">
        <DockedMiniPlayer />
      </div>

      <!-- App Launcher (scrollable tiles) -->
      <div class="launcher-panel">
        <AppLauncher />
      </div>
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

  .main-area {
    flex: 1;
    display: grid;
    grid-template-columns: 40% 1fr;
    min-height: 0;
    overflow: hidden;
  }

  .mini-player-panel {
    position: relative;
    height: 100%;
    min-width: 0;
    /* Subtle inner glow on right for depth separation */
    box-shadow:
      inset -1px 0 0 rgba(255, 255, 255, 0.03),
      4px 0 20px -5px rgba(0, 0, 0, 0.3);
    z-index: 10;
  }

  .launcher-panel {
    height: 100%;
    min-width: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
  }
</style>
