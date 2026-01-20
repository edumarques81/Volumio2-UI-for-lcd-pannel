<script lang="ts">
  import { onMount } from 'svelte';
  import { socketService, connectionState } from '$lib/services/socket';
  import { initPlayerStore } from '$lib/stores/player';
  import { initBrowseStore } from '$lib/stores/browse';
  import { initQueueStore } from '$lib/stores/queue';
  import { initSettingsStore, selectedBackground } from '$lib/stores/settings';
  import { initFavoritesStore } from '$lib/stores/favorites';
  import { initIssueStore, issueActions } from '$lib/stores/issues';
  import { currentView, layoutMode } from '$lib/stores/navigation';
  import { socketService as socket } from '$lib/services/socket';
  import { getVolumioHost } from '$lib/config';

  // Views
  import HomeScreen from '$lib/components/views/HomeScreen.svelte';
  import PlayerView from '$lib/components/views/PlayerView.svelte';
  import BrowseView from '$lib/components/views/BrowseView.svelte';
  import QueueView from '$lib/components/views/QueueView.svelte';
  import SettingsView from '$lib/components/views/SettingsView.svelte';

  // Components
  import BackHeader from '$lib/components/BackHeader.svelte';
  import MiniPlayer from '$lib/components/MiniPlayer.svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import PlaylistSelector from '$lib/components/PlaylistSelector.svelte';
  import TrackInfoModal from '$lib/components/TrackInfoModal.svelte';
  import StatusDrawer from '$lib/components/StatusDrawer.svelte';
  import Toast from '$lib/components/Toast.svelte';

  const volumioHost = getVolumioHost();

  onMount(() => {
    console.log('App mounted, initializing...');

    // Connect to Volumio backend
    socketService.connect();

    // Initialize all stores after socket is connecting
    initPlayerStore();
    initBrowseStore();
    initQueueStore();
    initSettingsStore();
    initFavoritesStore();
    initIssueStore();

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

    console.log('Test functions available: testToast.error(), testToast.warning(), testToast.success(), testToast.info()');
    console.log('Test functions available: testIssue.mpdError(), testIssue.playbackWarning(), testIssue.networkError(), testIssue.clear()');

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  });

  // Show mini player when not on home or player view
  $: showMiniPlayer = $currentView !== 'home' && $currentView !== 'player';

  // Show back header when not on home view
  $: showBackHeader = $currentView !== 'home';

  // Get current view title
  $: viewTitle = {
    'player': 'Now Playing',
    'browse': 'Browse',
    'queue': 'Queue',
    'settings': 'Settings'
  }[$currentView] || '';

  // Background for non-home views - fallback to local bg.jpg
  $: viewBackground = $selectedBackground || '/bg.jpg';
</script>

<main>
  {#if $connectionState === 'connected'}
    <div class="app-container">
      {#if $currentView === 'home'}
        <!-- Home Screen (full screen with own layout) -->
        <HomeScreen />
      {:else}
        <!-- Background for non-home views -->
        <div class="view-background" style="background-image: url({viewBackground})"></div>
        <div class="view-background-overlay"></div>

        <!-- Other Views with back header -->
        {#if showBackHeader}
          <BackHeader title={viewTitle} />
        {/if}

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
  {:else if $connectionState === 'connecting'}
    <div class="status">
      <div class="spinner"></div>
      <p>Connecting to Volumio...</p>
    </div>
  {:else}
    <div class="status error">
      <p>Connection Failed</p>
      <p class="detail">Could not connect to Volumio backend at {volumioHost}</p>
      <button on:click={() => socketService.connect()}>Retry Connection</button>
    </div>
  {/if}

  <!-- Global modals -->
  <ContextMenu />
  <PlaylistSelector />
  <TrackInfoModal />
  <StatusDrawer />
  <Toast />
</main>

<style>
  main {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    background: transparent;
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
</style>
