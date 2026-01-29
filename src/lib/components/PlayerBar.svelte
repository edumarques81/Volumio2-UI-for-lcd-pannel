<script lang="ts">
  import AlbumArt from './AlbumArt.svelte';
  import TrackInfo from './TrackInfo.svelte';
  import PlayerControls from './PlayerControls.svelte';
  import VolumeControl from './VolumeControl.svelte';
  import SeekBar from './SeekBar.svelte';
  import Icon from './Icon.svelte';

  let menuOpen = false;
</script>

<div class="player-bar">
  <!-- Left: Menu & Album Art (340px) -->
  <div class="section-left">
    <button class="menu-btn" on:click={() => menuOpen = !menuOpen} aria-label="Menu">
      <Icon name="menu" size={28} />
    </button>
    <AlbumArt size="large" />
  </div>

  <!-- Center: Track Info & Controls (1000px) -->
  <div class="section-center">
    <TrackInfo />
    <PlayerControls />
    <SeekBar />
  </div>

  <!-- Right: Volume & Settings (580px) -->
  <div class="section-right">
    <VolumeControl />
    <button class="settings-btn" aria-label="Settings">
      <Icon name="settings" size={28} />
    </button>
  </div>
</div>

<style>
  .player-bar {
    display: flex;
    width: 100%;
    height: 100%;
    padding: 32px 48px;
    gap: 48px;
    align-items: center;
    background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
    position: relative;
    box-sizing: border-box;
  }

  .section-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-xl);
    height: 100%;
    flex-shrink: 0;
  }

  .section-center {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--spacing-lg);
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: var(--spacing-md) 0;
  }

  .section-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-xl);
    flex-shrink: 0;
    padding-right: var(--spacing-md);
  }

  .menu-btn,
  .settings-btn {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .menu-btn:hover,
  .settings-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: scale(1.05);
  }

  .menu-btn:active,
  .settings-btn:active {
    transform: scale(0.95);
  }
</style>
