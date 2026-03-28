<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { socketService } from '$lib/services/socket';
  import { playlistActions } from '$lib/stores/playlist';
  import { libraryActions, type Track } from '$lib/stores/library';
  import Skeleton from '../Skeleton.svelte';
  import { IconBack, IconPlay, IconAddToQueue } from '$lib/components/icons';

  export let playlistName: string;

  const dispatch = createEventDispatcher<{ back: void }>();

  let tracks: Track[] = [];
  let loading = true;
  let error: string | null = null;

  function formatDuration(seconds: number): string {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function formatTotalDuration(seconds: number): string {
    const total = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  }

  function handleBack() {
    dispatch('back');
  }

  function handlePlayAll() {
    playlistActions.playPlaylist(playlistName);
  }

  function handleAddAllToQueue() {
    playlistActions.enqueuePlaylist(playlistName);
  }

  function handlePlayTrack(track: Track, index: number) {
    // Play the playlist starting from this track
    // Use replaceAndPlay for individual track
    socketService.emit('replaceAndPlay', {
      service: track.source || 'mpd',
      type: 'song',
      title: track.title,
      uri: track.uri
    });
  }

  function handleAddTrackToQueue(track: Track) {
    libraryActions.addTrackToQueue(track);
  }

  onMount(() => {
    loading = true;
    error = null;

    // Browse the playlist URI to get its contents
    const playlistUri = `playlists/${playlistName}`;

    // Listen for the browse response
    const handler = (data: any) => {
      try {
        const lists = data?.navigation?.lists;
        if (lists && lists.length > 0) {
          const items = lists[0].items || [];
          tracks = items.map((item: any, idx: number) => ({
            id: item.uri || `${idx}`,
            title: item.title || item.name || 'Untitled',
            artist: item.artist || '',
            album: item.album || '',
            uri: item.uri,
            trackNumber: idx + 1,
            duration: item.duration || 0,
            albumArt: item.albumart || '',
            source: item.service || 'mpd'
          }));
        } else {
          tracks = [];
        }
      } catch {
        error = 'Failed to load playlist';
      }
      loading = false;
    };

    // Use on + unsubscribe pattern
    let unsubscribe: (() => void) | null = null;
    const wrappedHandler = (data: any) => {
      handler(data);
      if (unsubscribe) unsubscribe();
    };

    unsubscribe = socketService.on('pushBrowseLibrary', wrappedHandler);
    socketService.emit('browseLibrary', { uri: playlistUri });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  });
</script>

<div class="pl-detail">
  <div class="pl-detail-header">
    <button class="pl-detail-back" on:click={handleBack} aria-label="Back to playlists">
      <IconBack size={14} />
    </button>
    <div class="pl-detail-meta">
      <div class="pl-detail-title">{playlistName}</div>
      {#if !loading}
        <div class="pl-detail-info">
          {tracks.length} tracks · {formatTotalDuration(0)}
        </div>
      {/if}
    </div>
  </div>

  <div class="pl-detail-actions">
    <button class="action-btn primary" on:click={handlePlayAll}>
      <IconPlay size={12} />
      Play All
    </button>
    <button class="action-btn" on:click={handleAddAllToQueue}>
      <IconAddToQueue size={14} />
      Add to Queue
    </button>
  </div>

  {#if error}
    <div class="error-state">
      <p class="error-text">{error}</p>
    </div>
  {:else if loading}
    <div class="pl-detail-tracks">
      {#each Array(6) as _}
        <div class="pl-track">
          <Skeleton width="18px" height="12px" />
          <Skeleton width="60%" height="12px" />
          <Skeleton width="30px" height="10px" />
        </div>
      {/each}
    </div>
  {:else}
    <div class="pl-detail-tracks">
      {#each tracks as track, index (track.uri + index)}
        <div class="pl-track">
          <button class="pl-track-main" on:click={() => handlePlayTrack(track, index)}>
            <span class="pl-track-num">{index + 1}</span>
            <span class="pl-track-title">{track.title}</span>
            {#if track.artist}
              <span class="pl-track-artist">{track.artist}</span>
            {/if}
            <span class="pl-track-dur">{formatDuration(track.duration)}</span>
          </button>
          <button
            class="pl-track-add"
            on:click|stopPropagation={() => handleAddTrackToQueue(track)}
            aria-label="Add to queue"
          >
            <IconAddToQueue size={14} />
          </button>
        </div>
      {:else}
        <div class="empty-text">No tracks in playlist</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pl-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(16, 10, 14, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .pl-detail-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--md-outline-variant);
    margin-bottom: 8px;
    flex-shrink: 0;
  }

  .pl-detail-back {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: var(--md-surface-container-high, #312228);
    color: var(--md-on-surface);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms ease-out;
    flex-shrink: 0;
  }
  .pl-detail-back:hover {
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
  }

  .pl-detail-meta {
    min-width: 0;
    flex: 1;
  }
  .pl-detail-title {
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pl-detail-info {
    font-size: 10px;
    color: var(--md-outline);
    margin-top: 2px;
  }

  .pl-detail-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    flex-shrink: 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--md-shape-full, 9999px);
    border: 1px solid var(--md-outline-variant);
    background: transparent;
    color: var(--md-on-surface-variant);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease-out;
    min-height: 36px;
    font-family: inherit;
  }
  .action-btn:hover {
    background: rgba(255, 177, 200, 0.06);
  }
  .action-btn.primary {
    background: var(--md-primary);
    color: var(--md-on-primary);
    border-color: var(--md-primary);
  }
  .action-btn.primary:hover {
    background: var(--md-on-primary-container);
    color: var(--md-primary);
  }

  .pl-detail-tracks {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--md-outline-variant) transparent;
    display: flex;
    flex-direction: column;
  }

  .pl-track {
    display: flex;
    align-items: center;
    gap: 0;
    min-height: 44px;
  }

  .pl-track-main {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border-radius: var(--md-shape-xs, 4px);
    cursor: pointer;
    transition: background 200ms ease-out;
    min-height: 38px;
    border: none;
    background: none;
    color: var(--md-on-surface);
    text-align: left;
    font-family: inherit;
    flex: 1;
    min-width: 0;
  }
  .pl-track-main:hover {
    background: rgba(255, 177, 200, 0.06);
  }

  .pl-track-num {
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    color: var(--md-outline);
    min-width: 18px;
    text-align: right;
    flex-shrink: 0;
  }
  .pl-track-title {
    font-size: 12px;
    font-weight: 500;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .pl-track-artist {
    font-size: 11px;
    color: var(--md-outline);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
    flex-shrink: 0;
  }
  .pl-track-dur {
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    color: var(--md-outline);
    flex-shrink: 0;
  }

  .pl-track-add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--md-outline-variant);
    cursor: pointer;
    transition: all 200ms ease-out;
    flex-shrink: 0;
  }
  .pl-track-add:hover {
    color: var(--md-primary);
    background: rgba(255, 177, 200, 0.1);
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
  }
  .error-text {
    font-size: 12px;
    color: var(--md-error, #FFB4AB);
  }

  .empty-text {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--md-outline);
  }
</style>
