<script lang="ts">
  import { onDestroy } from 'svelte';
  import { trackInfoModal, uiActions, type ContextMenuItem } from '$lib/stores/ui';
  import { trackInfo, trackInfoLoading, playerActions, type TrackInfo } from '$lib/stores/player';
  import { favoritesActions } from '$lib/stores/favorites';
  import { browseActions, type BrowseItem } from '$lib/stores/browse';
  import Icon from './Icon.svelte';

  // Reactive state from store
  $: isOpen = $trackInfoModal.isOpen;
  $: item = $trackInfoModal.item;
  $: info = $trackInfo;
  $: loading = $trackInfoLoading;

  // Request track info when modal opens
  $: if (isOpen && item) {
    playerActions.getTrackInfo(item.uri, item.service);
  }

  // Clear track info when modal closes
  $: if (!isOpen) {
    playerActions.clearTrackInfo();
  }

  function handleClose() {
    uiActions.closeTrackInfoModal();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handlePlayNow() {
    if (!item) return;
    browseActions.play(item as BrowseItem);
    handleClose();
  }

  function handleAddToFavorites() {
    if (!item) return;
    favoritesActions.addToFavorites(item.service, item.uri, getItemTitle());
    handleClose();
  }

  function handleAddToPlaylist() {
    if (!item) return;
    uiActions.closeTrackInfoModal();
    uiActions.openPlaylistSelector(item, 'browse');
  }

  function getItemTitle(): string {
    if (!item) return '';
    return 'name' in item ? item.name : item.title;
  }

  function formatDuration(seconds: number | undefined): string {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Metadata fields to display (key, label pairs)
  const metadataFields = [
    { key: 'artist', label: 'Artist' },
    { key: 'album', label: 'Album' },
    { key: 'year', label: 'Year' },
    { key: 'genre', label: 'Genre' },
    { key: 'composer', label: 'Composer' },
    { key: 'tracknumber', label: 'Track' },
    { key: 'trackType', label: 'Format' },
    { key: 'samplerate', label: 'Sample Rate' },
    { key: 'bitdepth', label: 'Bit Depth' },
    { key: 'bitrate', label: 'Bitrate' },
    { key: 'channels', label: 'Channels' },
    { key: 'duration', label: 'Duration', format: formatDuration },
    { key: 'filesize', label: 'File Size', format: formatFileSize },
    { key: 'path', label: 'Path' },
  ];
</script>

{#if isOpen && item}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="track-info-backdrop" on:click={handleBackdropClick}>
    <div class="track-info-modal">
      <!-- Header -->
      <div class="track-info-header">
        <h2>Track Info</h2>
        <button class="close-btn" on:click={handleClose}>
          <Icon name="x" size={24} />
        </button>
      </div>

      <!-- Content -->
      <div class="track-info-content">
        {#if loading}
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading track info...</p>
          </div>
        {:else}
          <!-- Album art and basic info -->
          <div class="track-hero">
            {#if item.albumart}
              <img src={item.albumart} alt="" class="track-art" />
            {:else}
              <div class="track-art-placeholder">
                <Icon name="music" size={64} />
              </div>
            {/if}
            <div class="track-title">{getItemTitle()}</div>
            {#if info?.artist || item.artist}
              <div class="track-artist">{info?.artist || item.artist}</div>
            {/if}
          </div>

          <!-- Action buttons -->
          <div class="track-actions">
            <button class="action-btn primary" on:click={handlePlayNow}>
              <Icon name="play" size={20} />
              <span>Play</span>
            </button>
            <button class="action-btn" on:click={handleAddToFavorites}>
              <Icon name="heart" size={20} />
              <span>Favorite</span>
            </button>
            <button class="action-btn" on:click={handleAddToPlaylist}>
              <Icon name="playlist" size={20} />
              <span>Playlist</span>
            </button>
          </div>

          <!-- Metadata table -->
          <div class="track-metadata">
            <h3>Details</h3>
            <dl class="metadata-list">
              {#each metadataFields as field}
                {#if info?.[field.key] !== undefined && info?.[field.key] !== null && info?.[field.key] !== ''}
                  <div class="metadata-row">
                    <dt>{field.label}</dt>
                    <dd>
                      {#if field.format}
                        {field.format(info[field.key])}
                      {:else}
                        {info[field.key]}
                      {/if}
                    </dd>
                  </div>
                {/if}
              {/each}
            </dl>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .track-info-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1002;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .track-info-modal {
    background: var(--surface-color, #1e1e1e);
    border-radius: 16px;
    width: 100%;
    max-width: 420px;
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .track-info-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
    flex-shrink: 0;
  }

  .track-info-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, #888);
    padding: 8px;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--surface-hover, #333);
    color: var(--text-primary, #fff);
  }

  .track-info-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    gap: 16px;
    color: var(--text-secondary, #888);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--accent-color, #22c55e);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .track-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 24px;
  }

  .track-art {
    width: 160px;
    height: 160px;
    border-radius: 8px;
    object-fit: cover;
    margin-bottom: 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .track-art-placeholder {
    width: 160px;
    height: 160px;
    border-radius: 8px;
    background: var(--surface-hover, #333);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, #666);
    margin-bottom: 16px;
  }

  .track-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    margin-bottom: 4px;
  }

  .track-artist {
    font-size: 14px;
    color: var(--text-secondary, #888);
  }

  .track-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--surface-hover, #333);
    border: none;
    border-radius: 8px;
    color: var(--text-primary, #fff);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--surface-active, #444);
  }

  .action-btn.primary {
    background: var(--accent-color, #22c55e);
    color: #000;
  }

  .action-btn.primary:hover {
    opacity: 0.9;
  }

  .track-metadata h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px 0;
  }

  .metadata-list {
    margin: 0;
  }

  .metadata-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color, #2a2a2a);
  }

  .metadata-row:last-child {
    border-bottom: none;
  }

  .metadata-row dt {
    font-size: 13px;
    color: var(--text-secondary, #888);
  }

  .metadata-row dd {
    font-size: 13px;
    color: var(--text-primary, #fff);
    margin: 0;
    text-align: right;
    max-width: 200px;
    word-break: break-all;
  }
</style>
