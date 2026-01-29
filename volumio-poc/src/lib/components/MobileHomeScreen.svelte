<script lang="ts">
  import { navigationActions } from '$lib/stores/navigation';
  import { browseActions } from '$lib/stores/browse';
  import { deviceType } from '$lib/stores/device';
  import Icon from './Icon.svelte';

  interface AppTile {
    id: string;
    title: string;
    icon: string;
    gradient: string;
    iconGradient: { from: string; to: string };
    action: () => void;
  }

  // Same app tiles as AppLauncher but optimized for mobile grid
  const apps: AppTile[] = [
    {
      id: 'local-music',
      title: 'Local Music',
      icon: 'folder',
      gradient: 'linear-gradient(180deg, #f5a623 0%, #c47f0a 100%)',
      iconGradient: { from: '#fffaf0', to: '#ffe4b3' },
      action: () => navigationActions.goToLocalMusic()
    },
    {
      id: 'nas',
      title: 'NAS',
      icon: 'storage',
      gradient: 'linear-gradient(180deg, #5ba3e0 0%, #2d7cc4 100%)',
      iconGradient: { from: '#f0f8ff', to: '#c9e4f9' },
      action: () => navigationActions.goToNASAlbums()
    },
    {
      id: 'library',
      title: 'Library',
      icon: 'music-note',
      gradient: 'linear-gradient(180deg, #e8576d 0%, #c43550 100%)',
      iconGradient: { from: '#fff5f6', to: '#ffd4db' },
      action: () => navigationActions.goToAllAlbums()
    },
    {
      id: 'artists',
      title: 'Artists',
      icon: 'artist',
      gradient: 'linear-gradient(180deg, #5a9e7c 0%, #3d7a5a 100%)',
      iconGradient: { from: '#f0fff7', to: '#c9f0dc' },
      action: () => navigationActions.goToArtists()
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
      icon: 'search',
      gradient: 'linear-gradient(180deg, #7b5ea7 0%, #4a3875 100%)',
      iconGradient: { from: '#f8f5ff', to: '#ddd4f0' },
      action: () => {
        browseActions.browse('qobuz');
        navigationActions.goToBrowse('qobuz', 'Qobuz');
      }
    },
    {
      id: 'audirvana',
      title: 'Audirvana',
      icon: 'headphones',
      gradient: 'linear-gradient(180deg, #6b4ea0 0%, #3d2d66 100%)',
      iconGradient: { from: '#f5f0ff', to: '#d4c8f0' },
      action: () => navigationActions.goToAudirvana()
    },
    {
      id: 'genres',
      title: 'Genres',
      icon: 'library',
      gradient: 'linear-gradient(180deg, #16a085 0%, #0e7a64 100%)',
      iconGradient: { from: '#f0fffc', to: '#c9f5ed' },
      action: () => {
        browseActions.browse('genres://');
        navigationActions.goToBrowse('genres://', 'Genres');
      }
    }
  ];

  // Determine icon size based on device
  $: iconSize = $deviceType === 'phone' ? 48 : 56;
</script>

<div class="mobile-home">
  <header class="home-header">
    <h1>Stellar - Volumio</h1>
  </header>

  <div class="tiles-grid">
    {#each apps as app}
      <button
        class="tile"
        data-testid="mobile-tile-{app.id}"
        on:click={app.action}
      >
        <div class="tile-icon" style="background: {app.gradient}">
          <Icon name={app.icon} size={iconSize} gradient={app.iconGradient} />
        </div>
        <span class="tile-label">{app.title}</span>
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
    background: var(--color-background);
    overflow: hidden;
  }

  .home-header {
    flex-shrink: 0;
    padding: 8px 16px;
    padding-top: max(8px, env(safe-area-inset-top));
  }

  .home-header h1 {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
    letter-spacing: -0.3px;
  }

  .tiles-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 8px 16px 24px;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px 12px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.15s ease-out;
    -webkit-tap-highlight-color: transparent;
  }

  .tile:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .tile:active {
    transform: scale(0.96);
    background: rgba(255, 255, 255, 0.06);
  }

  .tile-icon {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      inset 0 1px 2px rgba(255, 255, 255, 0.15);
  }

  .tile-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Tablet - 3 columns */
  @media (min-width: 600px) {
    .tiles-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding: 12px 24px 32px;
    }

    .tile {
      padding: 20px 16px 18px;
      gap: 12px;
    }

    .tile-icon {
      width: 80px;
      height: 80px;
      border-radius: 20px;
    }

    .tile-label {
      font-size: 14px;
    }

    .home-header h1 {
      font-size: 32px;
    }
  }

  /* Landscape phone - wider tiles */
  @media (max-width: 599px) and (orientation: landscape) {
    .tiles-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      padding: 8px 16px 16px;
    }

    .tile {
      padding: 12px 8px 10px;
      gap: 6px;
    }

    .tile-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
    }

    .tile-label {
      font-size: 11px;
    }

    .home-header {
      padding: 8px 16px;
    }

    .home-header h1 {
      font-size: 22px;
    }
  }
</style>
