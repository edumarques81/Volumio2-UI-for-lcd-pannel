<script lang="ts">
  import { navigationActions } from '$lib/stores/navigation';
  import { browseActions, browseData } from '$lib/stores/browse';
  import { audirvanaInstalled, audirvanaService, audirvanaInstanceCount } from '$lib/stores/audirvana';
  import { isDimmedStandby, lcdActions } from '$lib/stores/lcd';
  import { socketService } from '$lib/services/socket';
  import Icon from './Icon.svelte';

  // Reactive standby state - true when screen is blacked out via CSS overlay
  $: isInStandby = $isDimmedStandby;
  $: standbySubtitle = isInStandby ? 'ON' : 'OFF';

  interface AppTile {
    id: string;
    title: string;
    subtitle?: string;
    icon: string;
    gradient: string;
    iconGradient: { from: string; to: string };
    action: () => void;
  }

  // Qobuz action with error handling — shows toast if browse fails
  function handleQobuzTap() {
    browseActions.browse('qobuz');
    navigationActions.goToBrowse('qobuz', 'Qobuz');

    // Watch for error response: if pushBrowseLibrary returns no items,
    // show a toast after a brief delay
    const unsub = browseData.subscribe((data) => {
      if (data?.navigation?.lists) {
        const hasError = data.navigation.lists.some(
          (list: any) => list.items?.some((item: any) => item.type === 'error' || item.title?.toLowerCase().includes('error'))
        );
        const isEmpty = data.navigation.lists.every((list: any) => !list.items || list.items.length === 0);
        if (hasError || isEmpty) {
          socketService.simulateEvent('pushToastMessage', {
            type: 'warning',
            title: 'Qobuz',
            message: 'Sign in required — check Settings'
          });
        }
      }
    });
    // Unsubscribe after first response (don't leak)
    setTimeout(() => unsub(), 3000);
  }

  // iOS-style gradients matching the reference design
  // Icon gradients are subtle, light variations that complement the background
  // Static tiles that don't need reactive updates
  const staticApps: AppTile[] = [
    {
      id: 'local-music',
      title: 'Local',
      subtitle: 'USB + Internal',
      icon: 'folder',
      gradient: 'linear-gradient(180deg, #f5a623 0%, #c47f0a 100%)',
      iconGradient: { from: '#fffaf0', to: '#ffe4b3' },
      action: () => {
        navigationActions.goToLocalMusic();
      }
    },
    {
      id: 'nas',
      title: 'NAS',
      subtitle: 'Network storage',
      icon: 'storage',
      gradient: 'linear-gradient(180deg, #5ba3e0 0%, #2d7cc4 100%)',
      iconGradient: { from: '#f0f8ff', to: '#c9e4f9' },
      action: () => {
        navigationActions.goToNASAlbums();
      }
    },
    {
      id: 'library',
      title: 'Albums',
      subtitle: 'All albums',
      icon: 'music-note',
      gradient: 'linear-gradient(180deg, #e8576d 0%, #c43550 100%)',
      iconGradient: { from: '#fff5f6', to: '#ffd4db' },
      action: () => {
        navigationActions.goToAllAlbums();
      }
    },
    {
      id: 'qobuz',
      title: 'Qobuz',
      subtitle: 'Sign in required',
      icon: 'search',
      gradient: 'linear-gradient(180deg, #7b5ea7 0%, #4a3875 100%)',
      iconGradient: { from: '#f8f5ff', to: '#ddd4f0' },
      action: handleQobuzTap
    },
    {
      id: 'audirvana',
      title: 'Audirvana',
      subtitle: 'Hi-Fi Player',
      icon: 'headphones',
      gradient: 'linear-gradient(180deg, #6b4ea0 0%, #3d2d66 100%)',
      iconGradient: { from: '#f5f0ff', to: '#d4c8f0' },
      action: () => {
        navigationActions.goToAudirvana();
      }
    },
    {
      id: 'webradio',
      title: 'Web Radio',
      subtitle: 'Internet radio',
      icon: 'broadcast',
      gradient: 'linear-gradient(180deg, #e86a8a 0%, #c94466 100%)',
      iconGradient: { from: '#fff5f7', to: '#ffd6df' },
      action: () => {
        navigationActions.goToRadio();
      }
    },
    {
      id: 'playlists',
      title: 'Playlists',
      subtitle: 'Your playlists',
      icon: 'playlist',
      gradient: 'linear-gradient(180deg, #4a90d9 0%, #2563b0 100%)',
      iconGradient: { from: '#f0f7ff', to: '#c9e0f9' },
      action: () => {
        navigationActions.goToPlaylists();
      }
    },
    {
      id: 'favorites',
      title: 'Favorites',
      subtitle: 'Liked songs',
      icon: 'favorite',
      gradient: 'linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)',
      iconGradient: { from: '#fff5f5', to: '#ffd4d4' },
      action: () => {
        browseActions.browse('favourites');
        navigationActions.goToBrowse('favourites', 'Favorites');
      }
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'System',
      icon: 'settings',
      gradient: 'linear-gradient(180deg, #7f8c8d 0%, #5d6d6e 100%)',
      iconGradient: { from: '#f5f7f7', to: '#dce0e0' },
      action: () => {
        navigationActions.goToSettings();
      }
    }
  ];

  // Stand By tile with reactive subtitle based on standby mode state
  // ON = standby mode is active (screen dimmed/off)
  // OFF = standby mode is inactive (screen active)
  $: standbyTile = {
    id: 'standby',
    title: 'Stand By',
    subtitle: standbySubtitle,
    icon: 'power',
    gradient: 'linear-gradient(180deg, #4a4a4e 0%, #2d2d30 100%)',
    iconGradient: { from: '#f5f5f5', to: '#c0c0c0' },
    action: () => {
      if (isInStandby) {
        lcdActions.wake();
      } else {
        lcdActions.standby();
      }
    }
  };

  // Combined apps array with reactive Stand By tile
  $: apps = [...staticApps, standbyTile];

  function handleTileClick(app: AppTile) {
    app.action();
  }
</script>

<div class="app-launcher">
  <div class="tiles-container">
    <!-- App Tiles (NowPlayingTile removed - now using DockedMiniPlayer) -->
    {#each apps as app (app.id)}
      <button class="app-tile" data-testid="tile-{app.id}" on:click={() => handleTileClick(app)} on:touchend|preventDefault={() => handleTileClick(app)}>
        <div class="tile-icon" style="background: {app.gradient}">
          <Icon name={app.icon} size={36} gradient={app.iconGradient} />
        </div>
        <div class="tile-label">
          <span class="tile-title">{app.title}</span>
          {#if app.subtitle}
            <span class="tile-subtitle">{app.subtitle}</span>
          {/if}
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .app-launcher {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    padding: 12px 20px;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
  }

  .tiles-container {
    display: grid;
    grid-template-rows: 1fr 1fr;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 10px;
    width: 100%;
    height: 100%;
    align-items: stretch;
  }

  .app-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 8px;
    border: 1px solid var(--md-outline-variant);
    background: var(--md-surface-container);
    border-radius: var(--md-shape-extra-large);
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }

  .app-tile:hover {
    background: var(--md-surface-container-high);
  }

  .app-tile:active {
    transform: scale(0.96);
    background: var(--md-surface-container-highest);
  }

  .tile-icon {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--md-shape-extra-large);
    color: white;
    position: relative;
    overflow: hidden;
  }

  .tile-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }

  .tile-title {
    font-size: var(--md-title-small);
    font-weight: 500;
    color: var(--md-on-surface);
    white-space: nowrap;
  }

  .tile-subtitle {
    font-size: var(--md-label-medium);
    color: var(--md-on-surface-variant);
    white-space: nowrap;
  }
</style>
