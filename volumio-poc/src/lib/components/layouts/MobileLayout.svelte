<script lang="ts">
  import { currentView, navigationActions } from '$lib/stores/navigation';
  import { currentTrack, isPlaying } from '$lib/stores/player';
  import { deviceType } from '$lib/stores/device';
  import Icon from '../Icon.svelte';
  import MobileHomeScreen from '../MobileHomeScreen.svelte';
  import MobilePlayerView from '../MobilePlayerView.svelte';
  import BrowseView from '../views/BrowseView.svelte';
  import QueueView from '../views/QueueView.svelte';
  import SettingsView from '../views/SettingsView.svelte';
  import LocalMusicView from '../views/LocalMusicView.svelte';
  import AudirvanaView from '../views/AudirvanaView.svelte';
  import AllAlbumsView from '../views/AllAlbumsView.svelte';
  import NASAlbumsView from '../views/NASAlbumsView.svelte';
  import ArtistsView from '../views/ArtistsView.svelte';
  import RadioView from '../views/RadioView.svelte';
  import MobileMiniPlayer from '../MobileMiniPlayer.svelte';

  type TabId = 'home' | 'player' | 'queue' | 'settings';

  interface Tab {
    id: TabId;
    label: string;
    icon: string;
  }

  const tabs: Tab[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'player', label: 'Playing', icon: 'play-circle' },
    { id: 'queue', label: 'Queue', icon: 'queue' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  function handleTabClick(tab: Tab) {
    switch (tab.id) {
      case 'home':
        navigationActions.goHome();
        break;
      case 'player':
        navigationActions.goToPlayer();
        break;
      case 'queue':
        navigationActions.goToQueue();
        break;
      case 'settings':
        navigationActions.goToSettings();
        break;
    }
  }

  // Map currentView to active tab
  // Views like browse, localMusic, allAlbums etc. are accessed via Home
  $: activeTab = getActiveTab($currentView);

  function getActiveTab(view: string): TabId {
    if (view === 'player') return 'player';
    if (view === 'queue') return 'queue';
    if (view === 'settings') return 'settings';
    return 'home'; // home, browse, localMusic, allAlbums, nasAlbums, artists, radio, etc.
  }

  // Show mini player when:
  // - Not on full player view
  // - Has an active track
  $: hasActiveTrack = $currentTrack.title !== 'No track playing';
  $: showMiniPlayer = $currentView !== 'player' && hasActiveTrack;

  // Adjust icon size based on device
  $: iconSize = $deviceType === 'phone' ? 22 : 26;
</script>

<div class="mobile-layout">
  <!-- Main content area -->
  <div class="main-content">
    {#if $currentView === 'home'}
      <MobileHomeScreen />
    {:else if $currentView === 'player'}
      <MobilePlayerView />
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
    {:else}
      <!-- Fallback to home for unknown views -->
      <MobileHomeScreen />
    {/if}
  </div>

  <!-- Mini player bar (when not on player/home view and has track) -->
  {#if showMiniPlayer}
    <div class="mini-player-container">
      <MobileMiniPlayer />
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
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    overflow: hidden;
    position: relative;
    min-height: 0;
  }

  .mini-player-container {
    flex-shrink: 0;
  }

  .bottom-nav {
    display: flex;
    justify-content: space-around;
    align-items: stretch;
    background: rgba(20, 20, 24, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .nav-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    flex: 1;
    padding: 10px 8px 8px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    min-height: 52px;
  }

  .nav-tab:hover {
    color: rgba(255, 255, 255, 0.6);
  }

  .nav-tab:active {
    color: rgba(255, 255, 255, 0.8);
  }

  .nav-tab.active {
    color: var(--color-accent, #e86a8a);
  }

  .tab-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  /* Landscape phone adjustments */
  @media (orientation: landscape) and (max-height: 500px) {
    .bottom-nav {
      padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left);
    }

    .nav-tab {
      padding: 6px 12px;
      gap: 2px;
      min-height: 44px;
    }

    .tab-label {
      font-size: 9px;
    }
  }

  /* Tablet adjustments */
  @media (min-width: 600px) {
    .nav-tab {
      padding: 12px 16px 10px;
      gap: 4px;
    }

    .tab-label {
      font-size: 11px;
    }
  }
</style>
