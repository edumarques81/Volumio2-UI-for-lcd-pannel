<script lang="ts">
  import { queue, queueActions } from '$lib/stores/queue';
  import { playerState } from '$lib/stores/player';
  import { navigationActions } from '$lib/stores/navigation';

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

  // Handle clicking "Up Next" label to go to queue
  function goToQueue() {
    navigationActions.goToQueue();
  }

  // Image error handling
  let imageErrors: Record<number, boolean> = {};

  function handleImageError(index: number) {
    imageErrors[index] = true;
    imageErrors = imageErrors; // Trigger reactivity
  }
</script>

<div class="queue-strip" data-testid="miniplayer-queue-strip">
  <div class="queue-header">
    <button class="queue-label" on:click={goToQueue}>
      <span>Up Next</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  </div>

  {#if hasUpcoming}
    <div class="queue-strip-scroll" data-testid="queue-strip-scroll">
      {#each upcomingTracks as track, i}
        <button
          class="queue-tile"
          data-testid="queue-tile-{i}"
          on:click={() => handleTileClick(i)}
        >
          <div class="tile-art">
            {#if track.albumart && !imageErrors[i]}
              <img
                src={track.albumart}
                alt={track.name}
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
            <span class="tile-title">{track.name || 'Unknown'}</span>
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
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    z-index: 1;
  }

  .queue-header {
    display: flex;
    align-items: center;
  }

  .queue-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.5);
    background: none;
    border: none;
    padding: 4px 0;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .queue-label:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .queue-label svg {
    opacity: 0.6;
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
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .queue-tile:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .queue-tile:active {
    transform: scale(0.98);
  }

  .tile-art {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    overflow: hidden;
    background: rgba(40, 40, 45, 0.5);
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
    background: linear-gradient(135deg, #2a2a2e 0%, #1c1c1e 100%);
    color: rgba(255, 255, 255, 0.3);
  }

  .tile-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tile-title {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }

  .tile-artist {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
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
    color: rgba(255, 255, 255, 0.3);
    font-size: 13px;
  }
</style>
