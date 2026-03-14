<script lang="ts">
  import { onMount } from 'svelte';
  import {
    radioStations,
    radioLoading,
    radioError,
    libraryActions,
    initLibraryStore,
    type RadioStation
  } from '$lib/stores/library';
  import Icon from '../Icon.svelte';
  import SkeletonList from '../SkeletonList.svelte';
  import ViewHeader from '../ViewHeader.svelte';

  function handleStationClick(station: RadioStation) {
    libraryActions.playRadioStation(station);
  }

  onMount(() => {
    initLibraryStore();
    libraryActions.fetchRadioStations();
  });
</script>

<div class="radio-view" data-view="radio">
  <ViewHeader title="Web Radio" />

  <!-- Content -->
  <div class="view-content">
    {#if $radioError}
      <div class="error-message">
        <Icon name="warning" size={48} />
        <p>{$radioError}</p>
        <button class="retry-btn" on:click={() => libraryActions.fetchRadioStations()}>
          Retry
        </button>
      </div>
    {:else if $radioLoading}
      <SkeletonList count={8} variant="browse" />
    {:else if $radioStations.length === 0}
      <div class="empty">
        <Icon name="broadcast" size={64} />
        <p>No radio stations found</p>
        <span class="hint">Add stations to your Radio playlists</span>
      </div>
    {:else}
      <div class="stations-grid">
        {#each $radioStations as station}
          <button
            class="station-card"
            on:click={() => handleStationClick(station)}
            data-testid="station-card-{station.id}"
          >
            <div class="station-icon">
              {#if station.icon}
                <img src={station.icon} alt={station.name} loading="lazy" />
              {:else}
                <div class="station-placeholder">
                  <Icon name="broadcast" size={48} />
                </div>
              {/if}
              <div class="station-overlay">
                <div class="play-indicator">
                  <Icon name="play-filled" size={32} />
                </div>
              </div>
            </div>
            <div class="station-info">
              <span class="station-name">{station.name}</span>
              {#if station.genre}
                <span class="station-genre">{station.genre}</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .radio-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .view-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--spacing-md) var(--spacing-xl);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--spacing-md);
    color: var(--color-text-secondary);
  }

  .empty .hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .error-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--spacing-md);
    color: var(--color-text-secondary);
  }

  .retry-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: white;
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .retry-btn:hover {
    opacity: 0.9;
  }

  /* Stations Grid — fills the LCD width, fixed short card height */
  .stations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--spacing-md);
  }

  .station-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--md-surface-container, rgba(45, 30, 35, 0.8));
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: background 0.18s, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
    text-align: left;
  }

  .station-card:hover {
    background: var(--md-surface-container-high, rgba(55, 38, 43, 0.9));
  }

  .station-card:active {
    transform: scale(0.96);
  }

  .station-icon {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: linear-gradient(135deg, #e86a8a 0%, #c94466 100%);
  }

  .station-icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .station-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.8);
  }

  .station-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .station-card:hover .station-overlay {
    opacity: 1;
  }

  .play-indicator {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: transform 0.2s;
  }

  .station-card:hover .play-indicator {
    transform: scale(1.1);
  }

  .station-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .station-name {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .station-genre {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

</style>
