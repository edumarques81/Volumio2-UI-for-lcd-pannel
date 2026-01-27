<script lang="ts">
  import { onMount } from 'svelte';
  import { socketService, connectionState } from '$lib/services/socket';
  import { initPlayerStore } from '$lib/stores/player';
  import { initBrowseStore } from '$lib/stores/browse';
  import { initQueueStore } from '$lib/stores/queue';
  import { initSettingsStore, selectedBackground } from '$lib/stores/settings';
  import { initFavoritesStore } from '$lib/stores/favorites';
  import { initIssueStore, issueActions } from '$lib/stores/issues';
  import { audioDevicesActions } from '$lib/stores/audioDevices';
  import { initNetworkStore, cleanupNetworkStore } from '$lib/stores/network';
  import { initLcdStore, cleanupLcdStore, lcdActions } from '$lib/stores/lcd';
  import { initAudioStore, cleanupAudioStore } from '$lib/stores/audio';
  import { initAudirvanaStore, cleanupAudirvanaStore } from '$lib/stores/audirvana';
  import { initLibraryStore } from '$lib/stores/library';
  import { initAudioEngineStore, cleanupAudioEngineStore } from '$lib/stores/audioEngine';
  import { initDeviceStore, cleanupDeviceStore, deviceType, isLcdPanel, isDesktop, isMobile } from '$lib/stores/device';
  import { currentView, layoutMode, navigationActions } from '$lib/stores/navigation';
  import { socketService as socket } from '$lib/services/socket';
  import { getVolumioHost } from '$lib/config';
  import { performanceActions, performanceMetrics, fpsEnabled } from '$lib/stores/performance';
  import { get } from 'svelte/store';

  // Layouts
  import LCDLayout from '$lib/components/layouts/LCDLayout.svelte';
  import DesktopLayout from '$lib/components/layouts/DesktopLayout.svelte';
  import MobileLayout from '$lib/components/layouts/MobileLayout.svelte';

  // Components (global modals)
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import PlaylistSelector from '$lib/components/PlaylistSelector.svelte';
  import TrackInfoModal from '$lib/components/TrackInfoModal.svelte';
  import StatusDrawer from '$lib/components/StatusDrawer.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import PerformanceOverlay from '$lib/components/PerformanceOverlay.svelte';

  const volumioHost = getVolumioHost();

  onMount(() => {
    console.log('App mounted, initializing...');

    // Initialize device detection first (doesn't depend on socket)
    initDeviceStore();

    // Connect to Volumio backend
    socketService.connect();

    // Initialize all stores after socket is connecting
    initPlayerStore();
    initBrowseStore();
    initQueueStore();
    initSettingsStore();
    initFavoritesStore();
    initIssueStore();
    initNetworkStore();
    initLcdStore();
    initAudioStore();
    initAudirvanaStore();
    initAudioEngineStore();
    initLibraryStore();

    // Expose test functions for debugging (can be called from browser console)
    (window as any).testToast = {
      error: (title = 'Test Error', message = 'This is a test error message') => {
        socket.simulateEvent('pushToastMessage', { type: 'error', title, message });
      },
      warning: (title = 'Test Warning', message = 'This is a test warning message') => {
        socket.simulateEvent('pushToastMessage', { type: 'warning', title, message });
      },
      success: (title = 'Test Success', message = 'This is a test success message') => {
        socket.simulateEvent('pushToastMessage', { type: 'success', title, message });
      },
      info: (title = 'Test Info', message = 'This is a test info message') => {
        socket.simulateEvent('pushToastMessage', { type: 'info', title, message });
      }
    };

    (window as any).testIssue = {
      mpdError: () => {
        issueActions.upsertIssue({
          id: 'mpd:test_error',
          domain: 'mpd',
          severity: 'error',
          title: 'MPD Connection Failed',
          detail: 'Could not connect to music player daemon',
          ts: Date.now(),
          persistent: false,
          source: 'test',
          actions: [{ label: 'Restart MPD', actionId: 'restart-mpd' }]
        });
      },
      playbackWarning: () => {
        issueActions.upsertIssue({
          id: 'playback:test_warning',
          domain: 'playback',
          severity: 'warning',
          title: 'Stream Buffering',
          detail: 'Network stream is buffering slowly',
          ts: Date.now(),
          persistent: false,
          source: 'test'
        });
      },
      networkError: () => {
        issueActions.upsertIssue({
          id: 'network:test_error',
          domain: 'network',
          severity: 'error',
          title: 'Network Unavailable',
          detail: 'Cannot reach streaming service',
          ts: Date.now(),
          persistent: false,
          source: 'test'
        });
      },
      clear: () => {
        issueActions.clearAll();
      }
    };

    // Expose latency debugging helpers
    (window as any).__latency = {
      getStats: (event?: string) => socketService.getLatencyStats(event),
      getAllStats: () => {
        const events = ['pushState', 'pushQueue', 'pushNetworkStatus', 'pushLcdStatus', 'pushBrowseLibrary'];
        return events.reduce((acc, e) => {
          acc[e] = socketService.getLatencyStats(e);
          return acc;
        }, {} as Record<string, any>);
      },
      clear: () => socketService.clearLatencyMetrics()
    };

    // Expose socket for E2E testing
    (window as any).__socket = socketService.getSocket();

    // Expose navigation actions for E2E testing
    (window as any).__navigation = {
      goToQueue: () => navigationActions.goToQueue(),
      goToPlayer: () => navigationActions.goToPlayer(),
      goToBrowse: () => navigationActions.goToBrowse(),
      goToSettings: () => navigationActions.goToSettings(),
      goHome: () => navigationActions.goHome(),
      // MPD-driven library views
      goToAllAlbums: () => navigationActions.goToAllAlbums(),
      goToNASAlbums: () => navigationActions.goToNASAlbums(),
      goToArtists: () => navigationActions.goToArtists(),
      goToRadio: () => navigationActions.goToRadio()
    };

    // Expose LCD actions for E2E testing
    (window as any).lcdActions = lcdActions;

    // Expose audio devices test helper for E2E testing
    (window as any).__testAudioDevices = {
      loadMockDevices: () => {
        audioDevicesActions.processPlaybackOptions({
          options: [
            {
              id: 'output',
              name: 'Audio Output',
              attributes: [
                {
                  name: 'output_device',
                  type: 'select',
                  value: 'U20SU6',
                  options: [
                    { value: 'vc4hdmi0', name: 'HDMI 0 Out' },
                    { value: 'vc4hdmi1', name: 'HDMI 1 Out' },
                    { value: 'U20SU6', name: 'USB Audio 2.0(SU-6)' }
                  ]
                }
              ]
            }
          ]
        });
      }
    };

    // Expose performance monitoring controls for testing
    (window as any).__performance = {
      start: () => performanceActions.start(),
      stop: () => performanceActions.stop(),
      toggle: () => performanceActions.toggle(),
      reset: () => performanceActions.reset(),
      getMetrics: () => get(performanceMetrics),
      isEnabled: () => get(fpsEnabled)
    };

    // Cleanup on unmount
    return () => {
      cleanupNetworkStore();
      cleanupLcdStore();
      cleanupAudioStore();
      cleanupAudirvanaStore();
      cleanupAudioEngineStore();
      cleanupDeviceStore();
      socketService.disconnect();
    };
  });

  // Device class for root element
  $: deviceClass = `device-${$deviceType}`;
</script>

<main class={deviceClass}>
  {#if $connectionState === 'connected'}
    <div class="app-container">
      <!-- Choose layout based on device type -->
      {#if $isLcdPanel}
        <LCDLayout />
      {:else if $isDesktop}
        <DesktopLayout />
      {:else}
        <MobileLayout />
      {/if}
    </div>
  {:else if $connectionState === 'connecting'}
    <div class="status">
      <div class="spinner"></div>
      <p>Connecting to Stellar Volumio...</p>
      <p class="detail">Backend: {volumioHost}</p>
    </div>
  {:else}
    <div class="status error">
      <p>Connection Failed</p>
      <p class="detail">Could not connect to Stellar backend at {volumioHost}</p>
      <button on:click={() => socketService.connect()}>Retry Connection</button>
    </div>
  {/if}

  <!-- Global modals -->
  <ContextMenu />
  <PlaylistSelector />
  <TrackInfoModal />
  <StatusDrawer />
  <Toast />

  <!-- Performance monitoring overlay (toggle with __performance.toggle()) -->
  <PerformanceOverlay position="top-right" />
</main>

<style>
  main {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    background: var(--color-background);
    margin: 0;
    padding: 0;
    position: fixed;
    top: 0;
    left: 0;
    overflow: hidden;
  }

  .app-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: relative;
  }

  .status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-lg);
    text-align: center;
    padding: var(--spacing-2xl);
    width: 100%;
    height: 100%;
  }

  .status p {
    font-size: var(--font-size-lg);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .status .detail {
    font-size: var(--font-size-base);
    color: var(--color-text-tertiary);
  }

  .status button {
    padding: 12px 24px;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: #ffffff;
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s;
    min-height: var(--touch-target-min);
  }

  .status button:hover {
    background: var(--color-accent-dark);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
  }

  .status button:active {
    transform: translateY(0);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive adjustments for mobile/tablet */
  main.device-phone,
  main.device-tablet {
    background: var(--color-background);
  }

  main.device-phone .status p,
  main.device-tablet .status p {
    font-size: var(--font-size-xl);
  }

  main.device-phone .status button,
  main.device-tablet .status button {
    padding: 16px 32px;
    font-size: var(--font-size-lg);
    min-height: 56px;
  }
</style>
