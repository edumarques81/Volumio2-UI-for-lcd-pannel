<script lang="ts">
  import { onMount } from 'svelte';
  import {
    favoritesList,
    favoritesLoading,
    favoritesError,
    favoritesActions,
  } from '$lib/stores/favorites';
  import type { BrowseItem } from '$lib/stores/browse';
  import Icon from '../Icon.svelte';
  import ViewHeader from '../ViewHeader.svelte';

  let imageErrors: Set<string> = new Set();

  function handleImageError(uri: string) {
    imageErrors = new Set([...imageErrors, uri]);
  }

  function formatDuration(sec?: number): string {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  onMount(() => {
    favoritesActions.fetchFavorites();
  });
</script>

<div class="favorites-view" data-view="favorites">

  <ViewHeader title="Favorites">
    <!-- right slot: Play All + Refresh -->
    {#if $favoritesList.length > 0}
      <button class="action-btn primary" on:click={favoritesActions.playAll} aria-label="Play all">
        <Icon name="play-filled" size={20} />
        <span>Play All</span>
      </button>
    {/if}
    <button
      class="action-btn"
      on:click={favoritesActions.fetchFavorites}
      aria-label="Refresh"
    >
      <Icon name="refresh" size={20} />
    </button>
  </ViewHeader>

  <div class="view-content">

    {#if $favoritesLoading}
      <!-- Skeleton rows -->
      <div class="skeleton-list">
        {#each Array(5) as _}
          <div class="skeleton-row">
            <div class="skeleton-art"></div>
            <div class="skeleton-text">
              <div class="skeleton-line long"></div>
              <div class="skeleton-line short"></div>
            </div>
          </div>
        {/each}
      </div>

    {:else if $favoritesError}
      <div class="empty-state">
        <Icon name="warning" size={52} />
        <p>{$favoritesError}</p>
        <button class="retry-btn" on:click={favoritesActions.fetchFavorites}>Retry</button>
      </div>

    {:else if $favoritesList.length === 0}
      <div class="empty-state">
        <Icon name="favorite-border" size={64} />
        <p>No favourites yet</p>
        <span class="hint">Long-press any track in the library and choose "Add to Favourites"</span>
      </div>

    {:else}
      <ul class="fav-list">
        {#each $favoritesList as item (item.uri)}
          <li class="fav-row">

            <!-- Art -->
            <div class="art-wrap">
              {#if item.albumart && !imageErrors.has(item.uri)}
                <img
                  src={item.albumart}
                  alt={item.title}
                  class="art-img"
                  on:error={() => handleImageError(item.uri)}
                  loading="lazy"
                />
              {:else}
                <div class="art-placeholder">
                  <Icon name="music-note" size={24} />
                </div>
              {/if}
            </div>

            <!-- Info -->
            <div class="info">
              <span class="track-title">{item.title ?? 'Unknown'}</span>
              <span class="track-meta">
                {#if item.artist}{item.artist}{/if}
                {#if item.artist && item.album} · {/if}
                {#if item.album}<span class="album">{item.album}</span>{/if}
                {#if item.duration}
                  <span class="duration">{formatDuration(item.duration)}</span>
                {/if}
              </span>
            </div>

            <!-- Actions -->
            <div class="actions">
              <button
                class="icon-btn play-btn"
                on:click={() => favoritesActions.playItem(item)}
                aria-label="Play {item.title}"
              >
                <Icon name="play-filled" size={22} />
              </button>
              <button
                class="icon-btn queue-btn"
                on:click={() => favoritesActions.addItemToQueue(item)}
                aria-label="Add to queue"
              >
                <Icon name="queue" size={22} />
              </button>
              <button
                class="icon-btn remove-btn"
                on:click={() => favoritesActions.removeFavorite(item)}
                aria-label="Remove from favourites"
              >
                <Icon name="favorite" size={22} />
              </button>
            </div>

          </li>
        {/each}
      </ul>
    {/if}

  </div>
</div>

<style>
  .favorites-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: transparent;
  }

  /* ── Content ─────────────────────────────────────────────────────── */

  .view-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ── Favourites list ──────────────────────────────────────────────── */

  .fav-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .fav-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 24px;
    height: 62px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: background 0.15s;
  }

  .fav-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  /* ── Album art ────────────────────────────────────────────────────── */

  .art-wrap {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 6px;
    overflow: hidden;
    background: var(--md-surface-container, rgba(45, 28, 33, 0.9));
  }

  .art-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .art-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.3);
  }

  /* ── Track info ────────────────────────────────────────────────────── */

  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .track-title {
    font-size: 15px;
    font-weight: 500;
    color: var(--md-on-surface, #f5eaed);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-meta {
    font-size: 13px;
    color: rgba(245, 234, 237, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .duration {
    margin-left: auto;
    padding-right: 8px;
    font-variant-numeric: tabular-nums;
    color: rgba(245, 234, 237, 0.35);
    font-size: 12px;
  }

  /* ── Row actions ───────────────────────────────────────────────────── */

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: background 0.15s, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
    color: rgba(245, 234, 237, 0.6);
  }

  .icon-btn:hover { background: rgba(255, 255, 255, 0.08); }
  .icon-btn:active { transform: scale(0.88); }

  .play-btn { color: var(--md-primary, #b5264c); }
  .remove-btn { color: var(--md-primary, #b5264c); }

  /* ── Header action buttons ─────────────────────────────────────────── */

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px;
    height: 36px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 18px;
    background: transparent;
    color: rgba(245, 234, 237, 0.75);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .action-btn:hover { background: rgba(255, 255, 255, 0.08); }
  .action-btn:active { transform: scale(0.95); }

  .action-btn.primary {
    background: var(--md-primary, #b5264c);
    border-color: transparent;
    color: var(--md-on-primary, #fff);
  }

  .action-btn.primary:hover { opacity: 0.9; }

  /* ── Empty / Error state ───────────────────────────────────────────── */

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 10px;
    color: rgba(245, 234, 237, 0.45);
    text-align: center;
    padding: 24px;
  }

  .empty-state p {
    font-size: 16px;
    margin: 0;
    color: rgba(245, 234, 237, 0.65);
  }

  .hint {
    font-size: 13px;
    max-width: 480px;
    line-height: 1.5;
  }

  .retry-btn {
    margin-top: 8px;
    padding: 8px 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    background: transparent;
    color: var(--md-primary, #b5264c);
    font-size: 14px;
    cursor: pointer;
  }

  /* ── Loading skeleton ──────────────────────────────────────────────── */

  .skeleton-list { padding: 0; }

  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 24px;
    height: 62px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .skeleton-art {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    animation: shimmer 1.4s infinite;
  }

  .skeleton-text { flex: 1; display: flex; flex-direction: column; gap: 6px; }

  .skeleton-line {
    height: 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.07);
    animation: shimmer 1.4s infinite;
  }

  .skeleton-line.long  { width: 55%; }
  .skeleton-line.short { width: 32%; }

  @keyframes shimmer {
    0%   { opacity: 0.5; }
    50%  { opacity: 1;   }
    100% { opacity: 0.5; }
  }
</style>
