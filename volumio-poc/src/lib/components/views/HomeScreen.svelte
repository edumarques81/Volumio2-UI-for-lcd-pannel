<script lang="ts">
  import StatusBar from '../StatusBar.svelte';
  import AppLauncher from '../AppLauncher.svelte';
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
