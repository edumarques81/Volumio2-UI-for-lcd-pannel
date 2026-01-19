<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationActions } from '$lib/stores/navigation';
  import { browseActions } from '$lib/stores/browse';
  import Icon from './Icon.svelte';
  import NowPlayingTile from './NowPlayingTile.svelte';

  let scrollContainer: HTMLElement;

  // iOS-like momentum scrolling
  onMount(() => {
    if (!scrollContainer) return;

    let isDown = false;
    let startX: number;
    let scrollLeft: number;
    let velX = 0;
    let momentumID: number;

    const friction = 0.92; // Higher = longer momentum
    const minVelocity = 0.5;

    function cancelMomentum() {
      if (momentumID) {
        cancelAnimationFrame(momentumID);
      }
    }

    function momentum() {
      if (Math.abs(velX) > minVelocity) {
        scrollContainer.scrollLeft -= velX;
        velX *= friction;
        momentumID = requestAnimationFrame(momentum);
      }
    }

    function onPointerDown(e: PointerEvent) {
      isDown = true;
      cancelMomentum();
      startX = e.pageX - scrollContainer.offsetLeft;
      scrollLeft = scrollContainer.scrollLeft;
      velX = 0;
      scrollContainer.style.cursor = 'grabbing';
    }

    function onPointerUp() {
      isDown = false;
      scrollContainer.style.cursor = 'grab';
      momentum();
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 1.5; // Scroll speed multiplier
      const newScrollLeft = scrollLeft - walk;
      velX = scrollContainer.scrollLeft - newScrollLeft;
      scrollContainer.scrollLeft = newScrollLeft;
    }

    function onPointerLeave() {
      if (isDown) {
        isDown = false;
        scrollContainer.style.cursor = 'grab';
        momentum();
      }
    }

    scrollContainer.addEventListener('pointerdown', onPointerDown);
    scrollContainer.addEventListener('pointerup', onPointerUp);
    scrollContainer.addEventListener('pointermove', onPointerMove);
    scrollContainer.addEventListener('pointerleave', onPointerLeave);

    return () => {
      cancelMomentum();
      scrollContainer.removeEventListener('pointerdown', onPointerDown);
      scrollContainer.removeEventListener('pointerup', onPointerUp);
      scrollContainer.removeEventListener('pointermove', onPointerMove);
      scrollContainer.removeEventListener('pointerleave', onPointerLeave);
    };
  });

  interface AppTile {
    id: string;
    title: string;
    subtitle?: string;
    icon: string;
    gradient: string;
    iconGradient: { from: string; to: string };
    action: () => void;
  }

  // iOS-style gradients matching the reference design
  // Icon gradients are subtle, light variations that complement the background
  const apps: AppTile[] = [
    {
      id: 'local-music',
      title: 'Local Music',
      subtitle: 'Local Raspberry Pi',
      icon: 'folder',
      gradient: 'linear-gradient(180deg, #f5a623 0%, #c47f0a 100%)',
      iconGradient: { from: '#fffaf0', to: '#ffe4b3' },
      action: () => {
        browseActions.browse('music-library/INTERNAL');
        navigationActions.goToBrowse('music-library/INTERNAL', 'Local Music');
      }
    },
    {
      id: 'nas',
      title: 'NAS Drives',
      subtitle: 'Local network NAS Server',
      icon: 'storage',
      gradient: 'linear-gradient(180deg, #5ba3e0 0%, #2d7cc4 100%)',
      iconGradient: { from: '#f0f8ff', to: '#c9e4f9' },
      action: () => {
        browseActions.browse('music-library/NAS');
        navigationActions.goToBrowse('music-library/NAS', 'NAS Drives');
      }
    },
    {
      id: 'qobuz',
      title: 'Qobuz',
      subtitle: 'Qobuz',
      icon: 'search',
      gradient: 'linear-gradient(180deg, #7b5ea7 0%, #4a3875 100%)',
      iconGradient: { from: '#f8f5ff', to: '#ddd4f0' },
      action: () => {
        browseActions.browse('qobuz');
        navigationActions.goToBrowse('qobuz', 'Qobuz');
      }
    },
    {
      id: 'webradio',
      title: 'Web Radio',
      subtitle: 'Web Radio',
      icon: 'broadcast',
      gradient: 'linear-gradient(180deg, #e86a8a 0%, #c94466 100%)',
      iconGradient: { from: '#fff5f7', to: '#ffd6df' },
      action: () => {
        browseActions.browse('radio');
        navigationActions.goToBrowse('radio', 'Web Radio');
      }
    },
    {
      id: 'library',
      title: 'Music Library',
      subtitle: '',
      icon: 'music-note',
      gradient: 'linear-gradient(180deg, #e8576d 0%, #c43550 100%)',
      iconGradient: { from: '#fff5f6', to: '#ffd4db' },
      action: () => {
        browseActions.browse('');
        navigationActions.goToBrowse('', 'Music Library');
      }
    },
    {
      id: 'artists',
      title: 'Artists',
      subtitle: '',
      icon: 'artist',
      gradient: 'linear-gradient(180deg, #5a9e7c 0%, #3d7a5a 100%)',
      iconGradient: { from: '#f0fff7', to: '#c9f0dc' },
      action: () => {
        browseActions.browse('artists://');
        navigationActions.goToBrowse('artists://', 'Artists');
      }
    },
    {
      id: 'albums',
      title: 'Albums',
      subtitle: '',
      icon: 'album',
      gradient: 'linear-gradient(180deg, #d4854a 0%, #b5612a 100%)',
      iconGradient: { from: '#fff8f0', to: '#f5dcc8' },
      action: () => {
        browseActions.browse('albums://');
        navigationActions.goToBrowse('albums://', 'Albums');
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
        browseActions.browse('playlists');
        navigationActions.goToBrowse('playlists', 'Playlists');
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
      id: 'spotify',
      title: 'Spotify',
      subtitle: 'Streaming',
      icon: 'music-note',
      gradient: 'linear-gradient(180deg, #1db954 0%, #158a3d 100%)',
      iconGradient: { from: '#f0fff5', to: '#c9f5d9' },
      action: () => {
        browseActions.browse('spotify');
        navigationActions.goToBrowse('spotify', 'Spotify');
      }
    },
    {
      id: 'tidal',
      title: 'Tidal',
      subtitle: 'Hi-Fi Streaming',
      icon: 'headphones',
      gradient: 'linear-gradient(180deg, #000000 0%, #333333 100%)',
      iconGradient: { from: '#ffffff', to: '#e0e0e0' },
      action: () => {
        browseActions.browse('tidal');
        navigationActions.goToBrowse('tidal', 'Tidal');
      }
    },
    {
      id: 'usb',
      title: 'USB',
      subtitle: 'USB Drives',
      icon: 'storage',
      gradient: 'linear-gradient(180deg, #9b59b6 0%, #7d3c98 100%)',
      iconGradient: { from: '#faf5ff', to: '#e8d4f5' },
      action: () => {
        browseActions.browse('music-library/USB');
        navigationActions.goToBrowse('music-library/USB', 'USB');
      }
    },
    {
      id: 'genres',
      title: 'Genres',
      subtitle: 'By genre',
      icon: 'library',
      gradient: 'linear-gradient(180deg, #16a085 0%, #0e7a64 100%)',
      iconGradient: { from: '#f0fffc', to: '#c9f5ed' },
      action: () => {
        browseActions.browse('genres://');
        navigationActions.goToBrowse('genres://', 'Genres');
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

  function handleTileClick(app: AppTile) {
    app.action();
  }
</script>

<div class="app-launcher" bind:this={scrollContainer}>
  <div class="tiles-container">
    <!-- Now Playing Tile (wider, at the start) -->
    <NowPlayingTile />

    <!-- App Tiles -->
    {#each apps as app}
      <button class="app-tile" on:click={() => handleTileClick(app)}>
        <div class="tile-icon" style="background: {app.gradient}">
          <Icon name={app.icon} size={90} gradient={app.iconGradient} />
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
    align-items: center;
    justify-content: flex-start;
    padding: var(--spacing-lg) var(--spacing-xl);
    width: 100%;
    overflow-x: scroll;
    overflow-y: hidden;
    scrollbar-width: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }

  .app-launcher::-webkit-scrollbar {
    display: none;
  }

  .tiles-container {
    display: flex;
    gap: 7px;
    padding: var(--spacing-md);
  }

  .app-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 23px 33px 29px;
    min-width: 224px;
    border: none;
    /* Frosted glass with blur only (no transparency tint) */
    background: rgba(45, 45, 50, 0.65);
    backdrop-filter: blur(1px) saturate(105%);
    -webkit-backdrop-filter: blur(1px) saturate(105%);
    border-radius: 33px;
    cursor: pointer;
    transition: all 0.15s ease-out;
    -webkit-tap-highlight-color: transparent;
    /* Subtle 3D pop-out effect */
    box-shadow:
      0 1px 4px rgba(0, 0, 0, 0.2),
      0 2px 6px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .app-tile:hover {
    background: rgba(55, 55, 60, 0.7);
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.25),
      0 3px 8px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .app-tile:active {
    transform: scale(0.97);
    background: rgba(50, 50, 55, 0.75);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .tile-icon {
    width: 179px;
    height: 179px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 40px;
    color: white;
    position: relative;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.4),
      inset 0 1px 1px rgba(255, 255, 255, 0.3);
    transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
  }

  /* iOS-style inner highlight */
  .tile-icon::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 100%);
    border-radius: 24px 24px 0 0;
    pointer-events: none;
  }

  .app-tile:hover .tile-icon {
    transform: scale(1.05);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.5),
      inset 0 1px 1px rgba(255, 255, 255, 0.3);
  }

  .app-tile:active .tile-icon {
    transform: scale(0.95);
  }

  .tile-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }

  .tile-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-primary);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    white-space: nowrap;
  }

  .tile-subtitle {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    white-space: nowrap;
  }
</style>
