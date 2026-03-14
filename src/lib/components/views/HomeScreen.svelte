<script lang="ts">
  import AppLauncher from '../AppLauncher.svelte';
  import DockedMiniPlayer from '../miniplayer/DockedMiniPlayer.svelte';
</script>

<div class="home-screen">
  <!-- Content fills the full height — no top status bar -->
  <div class="content">
    <!-- Main area: Docked Mini Player (left) + App Launcher (right) -->
    <div class="main-area">
      <!-- Docked Mini Player (40% width) -->
      <div class="mini-player-panel">
        <DockedMiniPlayer />
      </div>

      <!-- App Launcher (2-row grid) -->
      <div class="launcher-panel">
        <AppLauncher />
      </div>
    </div>
  </div>
</div>

<style>
  .home-screen {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--md-background);
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
    grid-template-rows: 100%;   /* gives grid items a definite height to resolve % against */
    min-height: 0;
    overflow: hidden;
  }

  .mini-player-panel {
    border-right: 1px solid var(--md-outline-variant);
    background: linear-gradient(160deg, var(--md-surface-container-low) 0%, var(--md-surface) 100%);
    position: relative;
    height: 100%;
    min-width: 0;
    z-index: 10;
  }

  .launcher-panel {
    background: transparent;
    height: 100%;
    min-width: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
  }
</style>
