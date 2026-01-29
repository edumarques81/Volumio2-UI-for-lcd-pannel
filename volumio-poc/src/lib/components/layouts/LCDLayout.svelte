<script lang="ts">
  import { currentView } from '$lib/stores/navigation';
  import { selectedBackground } from '$lib/stores/settings';
  import HomeScreen from '../views/HomeScreen.svelte';
  import PlayerView from '../views/PlayerView.svelte';
  import BrowseView from '../views/BrowseView.svelte';
  import QueueView from '../views/QueueView.svelte';
  import SettingsView from '../views/SettingsView.svelte';
  import LocalMusicView from '../views/LocalMusicView.svelte';
  import AudirvanaView from '../views/AudirvanaView.svelte';
  // MPD-driven library views
  import AllAlbumsView from '../views/AllAlbumsView.svelte';
  import NASAlbumsView from '../views/NASAlbumsView.svelte';
  import ArtistsView from '../views/ArtistsView.svelte';
  import RadioView from '../views/RadioView.svelte';
  import PlaylistsView from '../views/PlaylistsView.svelte';
  import MiniPlayer from '../MiniPlayer.svelte';
  import StandbyOverlay from '../StandbyOverlay.svelte';

  // Show mini player when not on home or player view
  $: showMiniPlayer = $currentView !== 'home' && $currentView !== 'player';

  // Background for non-home views - fallback to local bg.jpg
  $: viewBackground = $selectedBackground || '/bg.jpg';
</script>

<!-- Standby/Brightness overlay (covers entire screen, handles wake) -->
<StandbyOverlay />

<div class="lcd-layout">
  {#if $currentView === 'home'}
    <!-- Home Screen (full screen with own layout) -->
    <HomeScreen />
  {:else}
    <!-- Background for non-home views -->
    <div class="view-background" style="background-image: url({viewBackground})"></div>
    <div class="view-background-overlay"></div>

    <!-- Main Content Area -->
    <div class="content-section">
      {#if $currentView === 'player'}
        <PlayerView />
      {:else if $currentView === 'browse'}
        <BrowseView />
      {:else if $currentView === 'queue'}
        <QueueView />
      {:else if $currentView === 'settings'}
        <SettingsView />
      {:else if $currentView === 'localMusic'}
        <LocalMusicView />
      {:else if $currentView === 'audirvana'}
        <AudirvanaView />
      {:else if $currentView === 'allAlbums'}
        <AllAlbumsView />
      {:else if $currentView === 'nasAlbums'}
        <NASAlbumsView />
      {:else if $currentView === 'artists'}
        <ArtistsView />
      {:else if $currentView === 'radio'}
        <RadioView />
      {:else if $currentView === 'playlists'}
        <PlaylistsView />
      {/if}
    </div>

    <!-- Mini Player (when not on home or player view) -->
    {#if showMiniPlayer}
      <div class="mini-player-section">
        <MiniPlayer />
      </div>
    {/if}
  {/if}
</div>

<style>
  .lcd-layout {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: relative;
  }

  .view-background {
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

  .view-background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(180deg,
      rgba(0, 0, 0, 0.15) 0%,
      rgba(0, 0, 0, 0.05) 40%,
      rgba(0, 0, 0, 0.05) 60%,
      rgba(0, 0, 0, 0.25) 100%
    );
    z-index: 1;
  }

  .content-section {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
    z-index: 2;
  }

  .mini-player-section {
    flex-shrink: 0;
    z-index: 100;
    position: relative;
  }
</style>
