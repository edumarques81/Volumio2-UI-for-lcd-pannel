<script lang="ts">
  import { currentView, navigationActions } from '$lib/stores/navigation';
  import { selectedBackground } from '$lib/stores/settings';
  import { playerState } from '$lib/stores/player';
  import { fixVolumioAssetUrl } from '$lib/config';
  import HomeScreen from '../views/HomeScreen.svelte';
  import PlayerView from '../views/PlayerView.svelte';
  import BrowseView from '../views/BrowseView.svelte';
  import QueueView from '../views/QueueView.svelte';
  import SettingsView from '../views/SettingsView.svelte';

  // Background - fallback to local bg.jpg
  $: viewBackground = $selectedBackground || '/bg.jpg';

  // Navigation items
  const navItems = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'player', icon: 'play', label: 'Now Playing' },
    { id: 'browse', icon: 'folder', label: 'Browse' },
    { id: 'queue', icon: 'list', label: 'Queue' },
    { id: 'settings', icon: 'settings', label: 'Settings' }
  ] as const;

  function navigate(view: typeof navItems[number]['id']) {
    switch (view) {
      case 'home':
        navigationActions.goHome();
        break;
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

  // SVG icons
  const icons: Record<string, string> = {
    home: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
    play: `<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>`,
    folder: `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`,
    list: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
    settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`
  };
</script>

<div class="desktop-layout">
  <!-- Background -->
  <div class="background" style="background-image: url({viewBackground})"></div>
  <div class="background-overlay"></div>

  <!-- Sidebar Navigation -->
  <nav class="sidebar">
    <div class="sidebar-header">
      <h1 class="logo">Stellar</h1>
    </div>

    <div class="nav-items">
      {#each navItems as item}
        <button
          class="nav-item"
          class:active={$currentView === item.id}
          on:click={() => navigate(item.id)}
        >
          <svg
            class="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            {@html icons[item.icon]}
          </svg>
          <span class="nav-label">{item.label}</span>
        </button>
      {/each}
    </div>

    <!-- Now Playing Mini (in sidebar) -->
    {#if $playerState && $playerState.status !== 'stop' && $currentView !== 'player'}
      <button class="now-playing-mini" on:click={() => navigate('player')}>
        <img
          class="mini-art"
          src={fixVolumioAssetUrl($playerState.albumart) || '/default-album.svg'}
          alt="Album Art"
        />
        <div class="mini-info">
          <span class="mini-title">{$playerState.title || 'Unknown'}</span>
          <span class="mini-artist">{$playerState.artist || 'Unknown Artist'}</span>
        </div>
      </button>
    {/if}
  </nav>

  <!-- Main Content Area -->
  <main class="content">
    {#if $currentView === 'home'}
      <HomeScreen />
    {:else if $currentView === 'player'}
      <PlayerView />
    {:else if $currentView === 'browse'}
      <BrowseView />
    {:else if $currentView === 'queue'}
      <QueueView />
    {:else if $currentView === 'settings'}
      <SettingsView />
    {/if}
  </main>
</div>

<style>
  .desktop-layout {
    display: flex;
    width: 100%;
    height: 100%;
    position: relative;
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
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.85) 0%,
      rgba(0, 0, 0, 0.6) 30%,
      rgba(0, 0, 0, 0.4) 100%
    );
    z-index: 1;
  }

  .sidebar {
    position: relative;
    z-index: 2;
    width: 240px;
    min-width: 240px;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 24px 16px;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }

  .sidebar-header {
    padding: 0 8px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 24px;
  }

  .logo {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0;
    letter-spacing: -0.5px;
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s ease;
    text-align: left;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .nav-item.active {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .nav-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .nav-label {
    white-space: nowrap;
  }

  .now-playing-mini {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    margin-top: auto;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .now-playing-mini:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .mini-art {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    object-fit: cover;
    background: rgba(255, 255, 255, 0.1);
  }

  .mini-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    flex: 1;
  }

  .mini-title {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-artist {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .content {
    position: relative;
    z-index: 2;
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }
</style>
