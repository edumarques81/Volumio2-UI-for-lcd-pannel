<script lang="ts">
  import { navigationActions } from '$lib/stores/navigation';
  import { browseActions, browseData } from '$lib/stores/browse';
  import { deviceType } from '$lib/stores/device';
  import { lcdState, lcdActions } from '$lib/stores/lcd';
  import { socketService } from '$lib/services/socket';
  import Icon from './Icon.svelte';

  interface AppTile {
    id: string;
    title: string;
    subtitle?: string;
    icon: string;
    gradient: string;
    iconGradient: { from: string; to: string };
    action: () => void;
  }

  // Qobuz action with error handling
  function handleQobuzTap() {
    browseActions.browse('qobuz');
    navigationActions.goToBrowse('qobuz', 'Qobuz');
    const unsub = browseData.subscribe((data) => {
      if (data?.navigation?.lists) {
        const isEmpty = data.navigation.lists.every((list: any) => !list.items || list.items.length === 0);
        if (isEmpty) {
          socketService.simulateEvent('pushToastMessage', {
            type: 'warning',
            title: 'Qobuz',
            message: 'Sign in required — check Settings'
          });
        }
      }
    });
    setTimeout(() => unsub(), 3000);
  }

  // Same app tiles as AppLauncher but optimized for mobile grid
  const staticApps: AppTile[] = [
    {
      id: 'local-music',
      title: 'Local',
      subtitle: 'USB + Internal',
      icon: 'folder',
      gradient: 'linear-gradient(180deg, #f5a623 0%, #c47f0a 100%)',
      iconGradient: { from: '#fffaf0', to: '#ffe4b3' },
      action: () => navigationActions.goToLocalMusic()
    },
    {
      id: 'nas',
      title: 'NAS',
      subtitle: 'Network storage',
      icon: 'storage',
      gradient: 'linear-gradient(180deg, #5ba3e0 0%, #2d7cc4 100%)',
      iconGradient: { from: '#f0f8ff', to: '#c9e4f9' },
      action: () => navigationActions.goToNASAlbums()
    },
    {
      id: 'library',
      title: 'Albums',
      icon: 'music-note',
      gradient: 'linear-gradient(180deg, #e8576d 0%, #c43550 100%)',
      iconGradient: { from: '#fff5f6', to: '#ffd4db' },
      action: () => navigationActions.goToAllAlbums()
    },
    {
      id: 'playlists',
      title: 'Playlists',
      icon: 'playlist',
      gradient: 'linear-gradient(180deg, #4a90d9 0%, #2563b0 100%)',
      iconGradient: { from: '#f0f7ff', to: '#c9e0f9' },
      action: () => navigationActions.goToPlaylists()
    },
    {
      id: 'favorites',
      title: 'Favorites',
      icon: 'favorite',
      gradient: 'linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)',
      iconGradient: { from: '#fff5f5', to: '#ffd4d4' },
      action: () => {
        browseActions.browse('favourites');
        navigationActions.goToBrowse('favourites', 'Favorites');
      }
    },
    {
      id: 'webradio',
      title: 'Radio',
      icon: 'broadcast',
      gradient: 'linear-gradient(180deg, #e86a8a 0%, #c94466 100%)',
      iconGradient: { from: '#fff5f7', to: '#ffd6df' },
      action: () => navigationActions.goToRadio()
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
      icon: 'headphones',
      gradient: 'linear-gradient(180deg, #6b4ea0 0%, #3d2d66 100%)',
      iconGradient: { from: '#f5f0ff', to: '#d4c8f0' },
      action: () => navigationActions.goToAudirvana()
    }
  ];

  // LCD Panel tile with reactive subtitle showing hardware state
  $: lcdTile = {
    id: 'lcd-panel',
    title: 'LCD Panel',
    subtitle: $lcdState === 'off' ? 'OFF' : 'ON',
    icon: 'power',
    gradient: 'linear-gradient(180deg, #4a4a4e 0%, #2d2d30 100%)',
    iconGradient: { from: '#f5f5f5', to: '#c0c0c0' },
    action: () => {
      if ($lcdState === 'off') {
        lcdActions.turnOn();
      } else {
        lcdActions.turnOff();
      }
    }
  } as AppTile;

  // Combined apps array with reactive LCD tile
  $: apps = [...staticApps, lcdTile];

  // Determine icon size based on device
  $: iconSize = $deviceType === 'phone' ? 32 : 36;
</script>

<div class="mobile-home">
  <header class="home-header">
    <h1>Stellar</h1>
  </header>

  <div class="tiles-grid">
    {#each apps as app (app.id)}
      <button
        class="tile"
        data-testid="mobile-tile-{app.id}"
        on:click={app.action}
      >
        <div class="tile-icon-circle">
          <Icon name={app.icon} size={iconSize} gradient={app.iconGradient} />
        </div>
        <span class="tile-label">{app.title}</span>
        {#if app.subtitle}
          <span class="tile-subtitle">{app.subtitle}</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .mobile-home {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--md-background);
    overflow: hidden;
  }

  .home-header {
    flex-shrink: 0;
    padding: 12px var(--md-page-padding);
    padding-top: max(12px, env(safe-area-inset-top));
  }

  .home-header h1 {
    font-size: var(--md-headline-medium);
    font-weight: 600;
    color: var(--md-on-background);
    margin: 0;
    letter-spacing: -0.3px;
  }

  .tiles-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--md-grid-gap);
    padding: 8px var(--md-page-padding) 24px;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px 12px 16px;
    background: var(--md-surface-container-high);
    border: none;
    border-radius: var(--md-shape-large);
    cursor: pointer;
    touch-action: manipulation;
    transition: all 0.15s ease-out;
    -webkit-tap-highlight-color: transparent;
    will-change: transform;
    box-shadow: 0 1px 3px rgba(181, 38, 76, 0.08);
  }

  .tile:hover {
    background: var(--md-surface-container-highest);
  }

  .tile:active {
    transform: scale(0.97);
    background: var(--md-surface-container-highest);
  }

  .tile-icon-circle {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--md-shape-large);
    background: var(--md-primary-container);
  }

  .tile-label {
    font-size: var(--md-label-large);
    font-weight: 500;
    color: var(--md-on-surface);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .tile-subtitle {
    font-size: var(--md-label-small);
    font-weight: 400;
    color: var(--md-on-surface-variant);
    text-align: center;
    margin-top: -4px;
  }

  /* Tablet - 3 columns */
  @media (min-width: 600px) {
    .tiles-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding: 12px 24px 32px;
    }

    .tile {
      padding: 24px 16px 18px;
      gap: 12px;
    }

    .tile-icon-circle {
      width: 72px;
      height: 72px;
      border-radius: 20px;
    }

    .tile-label {
      font-size: var(--md-body-medium);
    }

    .home-header h1 {
      font-size: var(--md-headline-large);
    }
  }

  /* Landscape phone - 4 columns */
  @media (max-width: 599px) and (orientation: landscape) {
    .tiles-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      padding: 8px 16px 16px;
    }

    .tile {
      padding: 14px 8px 10px;
      gap: 6px;
    }

    .tile-icon-circle {
      width: 48px;
      height: 48px;
      border-radius: var(--md-shape-medium);
    }

    .tile-label {
      font-size: var(--md-label-small);
    }

    .home-header {
      padding: 8px 16px;
    }

    .home-header h1 {
      font-size: var(--md-headline-small);
    }
  }
</style>
