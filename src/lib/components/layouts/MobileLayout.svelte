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
  import PlaylistsView from '../views/PlaylistsView.svelte';
  import FavoritesView from '../views/FavoritesView.svelte';
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
  $: iconSize = $deviceType === 'phone' ? 24 : 26;
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
    {:else if $currentView === 'playlists'}
      <PlaylistsView />
    {:else if $currentView === 'favorites'}
      <FavoritesView />
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

  <!-- Bottom navigation — MD3 Navigation Bar -->
  <nav class="bottom-nav">
    {#each tabs as tab}
      <button
        class="nav-tab"
        class:active={activeTab === tab.id}
        on:click={() => handleTabClick(tab)}
        aria-label={tab.label}
      >
        <div class="nav-indicator">
          <Icon name={tab.icon} size={iconSize} />
        </div>
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
    background: var(--md-background);
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    overflow: hidden;
    position: relative;
    min-height: 0;
    transform: translateZ(0); /* GPU layer — prevent layout repaint propagation */
  }

  .mini-player-container {
    flex-shrink: 0;
  }

  /* MD3 Navigation Bar */
  .bottom-nav {
    display: flex;
    justify-content: space-around;
    align-items: stretch;
    background: var(--md-surface-container);
    border-top: 1px solid var(--md-outline-variant);
    flex-shrink: 0;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .nav-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex: 1;
    padding: 12px 8px 16px;
    background: none;
    border: none;
    color: var(--md-on-surface-variant);
    cursor: pointer;
    touch-action: manipulation;
    transition: color 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    will-change: transform;
    min-height: 80px;
  }

  .nav-tab:hover {
    color: var(--md-on-surface);
  }

  /* Active indicator pill behind icon */
  .nav-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 32px;
    border-radius: var(--md-shape-full);
    background: transparent;
    transition: background-color 0.2s ease;
  }

  .nav-tab.active .nav-indicator {
    background: var(--md-primary-container);
  }

  .nav-tab.active .nav-indicator :global(svg) {
    color: var(--md-on-primary-container);
  }

  .nav-tab.active {
    color: var(--md-on-surface);
  }

  .tab-label {
    font-size: var(--md-label-medium);
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .nav-tab.active .tab-label {
    font-weight: 600;
  }

  /* Landscape phone adjustments */
  @media (orientation: landscape) and (max-height: 500px) {
    .bottom-nav {
      padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left);
    }

    .nav-tab {
      padding: 8px 12px;
      gap: 2px;
      min-height: 56px;
    }

    .nav-indicator {
      width: 48px;
      height: 28px;
    }

    .tab-label {
      font-size: var(--md-label-small);
    }
  }

  /* Tablet adjustments */
  @media (min-width: 600px) {
    .nav-tab {
      padding: 14px 16px 18px;
      gap: 4px;
    }

    .nav-indicator {
      width: 72px;
      height: 36px;
    }

    .tab-label {
      font-size: var(--md-label-medium);
    }
  }
</style>
