<script lang="ts">
  import { queue, queueActions } from '$lib/stores/queue';
  import { playerState } from '$lib/stores/player';
  import { navigationActions } from '$lib/stores/navigation';
  import { fixVolumioAssetUrl } from '$lib/config';

  // Get upcoming tracks (after current position)
  $: currentPosition = $playerState?.position ?? 0;
  $: upcomingTracks = $queue.slice(currentPosition + 1, currentPosition + 8); // Show up to 7 upcoming
  $: hasUpcoming = upcomingTracks.length > 0;

  // Handle tile click - play that track
  function handleTileClick(index: number) {
    // Index in the full queue = currentPosition + 1 + tile index
    const queueIndex = currentPosition + 1 + index;
    queueActions.play(queueIndex);
  }

  // Handle clicking queue strip area to go to queue
  function goToQueue() {
    navigationActions.goToQueue();
  }

  // Get track title - try multiple property names for compatibility
  function getTrackTitle(track: any): string {
    return track.name || track.title || 'Unknown';
  }

  // Get fixed artwork URL with cache support
  function getArtworkUrl(track: any): string | null {
    if (!track.albumart) return null;
    return fixVolumioAssetUrl(track.albumart);
  }

  // Image error handling
  let imageErrors: Record<number, boolean> = {};

  function handleImageError(index: number) {
    imageErrors[index] = true;
    imageErrors = imageErrors; // Trigger reactivity
  }
</script>

<div class="queue-strip" data-testid="miniplayer-queue-strip">
  {#if hasUpcoming}
    <div class="queue-strip-scroll" data-testid="queue-strip-scroll">
      {#each upcomingTracks as track, i}
        <button
          class="queue-tile"
          data-testid="queue-tile-{i}"
          on:click={() => handleTileClick(i)}
        >
          <div class="tile-art">
            {#if getArtworkUrl(track) && !imageErrors[i]}
              <img
                src={getArtworkUrl(track)}
                alt={getTrackTitle(track)}
                loading="lazy"
                on:error={() => handleImageError(i)}
              />
            {:else}
              <div class="art-placeholder-small">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
            {/if}
          </div>
          <div class="tile-info">
            <span class="tile-title">{getTrackTitle(track)}</span>
            <span class="tile-artist">{track.artist || 'Unknown Artist'}</span>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="empty-queue">
      <span>No upcoming tracks</span>
    </div>
  {/if}
</div>

<style>
  .queue-strip {
    display: flex;
    flex-direction: column;
    padding-top: 8px;
    border-top: 1px solid var(--md-outline-variant);
    position: relative;
    z-index: 1;
    min-height: 72px;
  }

  .queue-strip-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    padding: 4px 0;
    margin: 0 -20px;
    padding-left: 20px;
    padding-right: 20px;
  }

  .queue-strip-scroll::-webkit-scrollbar {
    display: none;
  }

  .queue-tile {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 180px;
    max-width: 200px;
    padding: 8px;
    background: var(--md-surface-container);
    border: 1px solid var(--md-outline-variant);
    border-radius: var(--md-shape-medium);
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
    color: var(--md-on-surface);
  }

  .queue-tile:hover {
    background: var(--md-surface-container-high);
  }

  .queue-tile:active {
    transform: scale(0.98);
  }

  .tile-art {
    width: 48px;
    height: 48px;
    border-radius: var(--md-shape-small);
    overflow: hidden;
    background: var(--md-surface-container-high);
    flex-shrink: 0;
  }

  .tile-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .art-placeholder-small {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--md-surface-container-high);
    color: var(--md-on-surface-variant);
  }

  .tile-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tile-title {
    font-size: var(--md-body-medium);
    font-weight: 500;
    color: var(--md-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }

  .tile-artist {
    font-size: var(--md-label-medium);
    color: var(--md-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }

  .empty-queue {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    color: var(--md-on-surface-variant);
    font-size: var(--md-body-medium);
  }
</style>
