<script lang="ts">
  import { currentView, navigationActions } from '$lib/stores/navigation';
  import { currentTrack, isPlaying } from '$lib/stores/player';
  import { deviceType } from '$lib/stores/device';
  import Icon from '../Icon.svelte';
  import StatusBar from '../StatusBar.svelte';
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
  import MiniPlayer from '../MiniPlayer.svelte';

  type TabId = 'player' | 'browse' | 'queue' | 'settings';

  interface Tab {
    id: TabId;
    label: string;
    icon: string;
  }

  const tabs: Tab[] = [
    { id: 'browse', label: 'Browse', icon: 'music-library' },
    { id: 'player', label: 'Now Playing', icon: 'play-circle' },
    { id: 'queue', label: 'Queue', icon: 'queue' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  function handleTabClick(tab: Tab) {
    switch (tab.id) {
      case 'player':
        navigationActions.goToPlayer();
        break;
      case 'browse':
        navigationActions.goToBrowse();
        break;
      case 'queue':
        navigationActions.goToQueue();
        break;
      case 'settings':
        navigationActions.goToSettings();
        break;
    }
  }

  // Map currentView to tab id
  $: activeTab = $currentView === 'home' ? 'browse' : $currentView as TabId;

  // Show mini player when not on player view
  $: showMiniPlayer = $currentView !== 'player';

  // Check if we have a track playing
  $: hasActiveTrack = $currentTrack.title !== 'No track playing';

  // Adjust icon size based on device
  $: iconSize = $deviceType === 'phone' ? 24 : 28;
</script>

<div class="mobile-layout">
  <!-- Main content area -->
  <div class="main-content">
    {#if $currentView === 'player' || $currentView === 'home'}
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
    {/if}
  </div>

  <!-- Mini player bar (when not on player view and has track) -->
  {#if showMiniPlayer && hasActiveTrack}
    <div class="mini-player-container">
      <MiniPlayer />
    </div>
  {/if}

  <!-- Bottom navigation -->
  <nav class="bottom-nav">
    {#each tabs as tab}
      <button
        class="nav-tab"
        class:active={activeTab === tab.id}
        on:click={() => handleTabClick(tab)}
        aria-label={tab.label}
      >
        <Icon name={tab.icon} size={iconSize} />
        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}
  </nav>
</div>

<style>
  .mobile-layout {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--color-background);
  }

  .main-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .mini-player-container {
    flex-shrink: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .bottom-nav {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 8px 0;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
    background: rgba(30, 30, 35, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .nav-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 16px;
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all 0.2s;
    -webkit-tap-highlight-color: transparent;
    min-width: 64px;
    min-height: 48px;
  }

  .nav-tab:hover {
    color: var(--color-text-secondary);
  }

  .nav-tab:active {
    transform: scale(0.95);
  }

  .nav-tab.active {
    color: var(--color-accent);
  }

  .tab-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  /* Phone-specific adjustments */
  @media (max-width: 767px) {
    .nav-tab {
      padding: 6px 12px;
      min-width: 56px;
    }

    .tab-label {
      font-size: 9px;
    }
  }

  /* Tablet landscape - larger touch targets */
  @media (min-width: 768px) and (orientation: landscape) {
    .bottom-nav {
      padding: 12px 0;
    }

    .nav-tab {
      padding: 10px 24px;
      gap: 6px;
    }

    .tab-label {
      font-size: 12px;
    }
  }
</style>
