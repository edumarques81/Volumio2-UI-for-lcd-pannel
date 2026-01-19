<script lang="ts">
  import { currentTrack, playerState } from '$lib/stores/player';
  import { selectedBackground } from '$lib/stores/settings';
  import { isFavorite, favoritesActions } from '$lib/stores/favorites';
  import { uiActions } from '$lib/stores/ui';
  import AlbumArt from '../AlbumArt.svelte';
  import TrackInfo from '../TrackInfo.svelte';
  import PlayerControls from '../PlayerControls.svelte';
  import VolumeControl from '../VolumeControl.svelte';
  import SeekBar from '../SeekBar.svelte';
  import Icon from '../Icon.svelte';

  // Use selected background, album art, or fallback to default
  $: backgroundImage = $selectedBackground || $currentTrack.albumart || '/backgrounds/default.svg';

  function handleToggleFavorite() {
    favoritesActions.toggleCurrentFavorite($isFavorite);
  }

  function handleShowInfo() {
    if (!$playerState) return;

    // Create a ContextMenuItem from current player state
    const item = {
      service: $playerState.uri?.split('/')[0] || 'mpd',
      type: 'song' as const,
      title: $playerState.title || 'Unknown',
      artist: $playerState.artist,
      album: $playerState.album,
      uri: $playerState.uri,
      albumart: $playerState.albumart,
    };

    uiActions.openTrackInfoModal(item);
  }
</script>

<div class="player-view">
  <!-- Background with blur -->
  <div class="background">
    <div class="background-image" style="background-image: url('{backgroundImage}')"></div>
    <div class="background-overlay"></div>
  </div>

  <div class="player-content">
    <!-- Album Art -->
    <div class="art-section">
      <AlbumArt size="large" />
    </div>

    <!-- Track Info & Controls -->
    <div class="info-section">
      <div class="track-header">
        <TrackInfo />
        <div class="track-actions">
          <button
            class="action-btn"
            class:active={$isFavorite}
            on:click={handleToggleFavorite}
            aria-label={$isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Icon name={$isFavorite ? 'heart-filled' : 'heart'} size={24} />
          </button>
          <button
            class="action-btn"
            on:click={handleShowInfo}
            aria-label="Track info"
          >
            <Icon name="info" size={24} />
          </button>
        </div>
      </div>
      <PlayerControls />
      <SeekBar />
    </div>

    <!-- Volume -->
    <div class="volume-section">
      <VolumeControl />
    </div>
  </div>
</div>

<style>
  .player-view {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    box-sizing: border-box;
    overflow: hidden;
  }

  .background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
  }

  .background-image {
    position: absolute;
    top: -20px;
    left: -20px;
    right: -20px;
    bottom: -20px;
    background-size: cover;
    background-position: center;
    filter: blur(30px) brightness(0.5);
    transform: scale(1.1);
  }

  .background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.4) 0%,
      rgba(0, 0, 0, 0.2) 50%,
      rgba(0, 0, 0, 0.5) 100%
    );
  }

  .player-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--spacing-2xl);
    width: 100%;
    max-width: 1800px;
    height: 100%;
  }

  .art-section {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    flex-shrink: 0;
  }

  .info-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--spacing-lg);
    min-width: 0;
    padding: var(--spacing-md) 0;
  }

  .volume-section {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    min-width: 320px;
  }

  .track-header {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-lg);
  }

  .track-actions {
    display: flex;
    gap: var(--spacing-sm);
    flex-shrink: 0;
    padding-top: var(--spacing-sm);
  }

  .action-btn {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: var(--color-text-primary);
  }

  .action-btn.active {
    color: var(--color-accent);
  }

  .action-btn.active:hover {
    background: rgba(255, 59, 48, 0.2);
    color: #ff3b30;
  }
</style>
