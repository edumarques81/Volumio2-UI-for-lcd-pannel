<script lang="ts">
  import { onMount } from 'svelte';
  import { navigationActions } from '$lib/stores/navigation';
  import {
    playlists,
    playlistsLoading,
    playlistsError,
    playlistActions,
    initPlaylistStore
  } from '$lib/stores/playlist';
  import Icon from '../Icon.svelte';
  import SkeletonList from '../SkeletonList.svelte';

  // Local state
  let searchQuery = $state('');
  let showCreateModal = $state(false);
  let showDeleteConfirm = $state(false);
  let newPlaylistName = $state('');
  let playlistToDelete = $state<string | null>(null);
  let createError = $state<string | null>(null);

  // Filtered playlists based on search
  let filteredPlaylists = $derived(
    searchQuery.trim()
      ? $playlists.filter(name =>
          name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : $playlists
  );

  function handleBack() {
    navigationActions.goHome();
  }

  function handlePlaylistClick(name: string) {
    playlistActions.playPlaylist(name);
  }

  function openCreateModal() {
    newPlaylistName = '';
    createError = null;
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
    newPlaylistName = '';
    createError = null;
  }

  function handleCreate() {
    const trimmedName = newPlaylistName.trim();
    if (!trimmedName) {
      createError = 'Playlist name cannot be empty';
      return;
    }
    if (trimmedName.length > 100) {
      createError = 'Playlist name is too long';
      return;
    }
    if ($playlists.includes(trimmedName)) {
      createError = 'A playlist with this name already exists';
      return;
    }
    playlistActions.createPlaylist(trimmedName);
    closeCreateModal();
    // Refresh playlists after creating
    setTimeout(() => playlistActions.listPlaylists(), 500);
  }

  function confirmDelete(name: string) {
    playlistToDelete = name;
    showDeleteConfirm = true;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
    playlistToDelete = null;
  }

  function handleDelete() {
    if (playlistToDelete) {
      playlistActions.deletePlaylist(playlistToDelete);
      // Refresh playlists after deleting
      setTimeout(() => playlistActions.listPlaylists(), 500);
    }
    cancelDelete();
  }

  function clearSearch() {
    searchQuery = '';
  }

  function generateTestId(name: string): string {
    return `playlist-card-${name.replace(/\s+/g, '-').toLowerCase()}`;
  }

  onMount(() => {
    initPlaylistStore();
    playlistActions.listPlaylists();
  });
</script>

<div class="playlists-view" data-view="playlists">
  <!-- Header -->
  <header class="view-header">
    <div class="header-left">
      <button class="back-btn" data-testid="back-button" onclick={handleBack} aria-label="Go back">
        <Icon name="chevron-left" size={28} />
      </button>
      <h1 class="title">Playlists</h1>
      <span class="subtitle">{filteredPlaylists.length} playlist{filteredPlaylists.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="header-right">
      <button class="create-btn" data-testid="create-playlist-btn" onclick={openCreateModal}>
        <Icon name="plus" size={20} />
        <span>New</span>
      </button>
    </div>
  </header>

  <!-- Search Bar (below header) -->
  <div class="search-section">
    <div class="search-input-wrapper">
      <Icon name="search" size={18} />
      <input
        type="text"
        placeholder="Search playlists..."
        bind:value={searchQuery}
        data-testid="search-input"
      />
      {#if searchQuery}
        <button class="clear-btn" onclick={clearSearch} aria-label="Clear search">
          <Icon name="x" size={16} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Content -->
  <div class="view-content">
    {#if $playlistsError}
      <div class="error-message" data-testid="error-state">
        <Icon name="warning" size={48} />
        <p>{$playlistsError}</p>
        <button class="retry-btn" onclick={() => playlistActions.listPlaylists()}>
          Retry
        </button>
      </div>
    {:else if $playlistsLoading && $playlists.length === 0}
      <SkeletonList count={8} variant="browse" />
    {:else if filteredPlaylists.length === 0}
      <div class="empty" data-testid="empty-state">
        <Icon name="playlist" size={64} />
        {#if searchQuery && $playlists.length > 0}
          <p>No playlists match "{searchQuery}"</p>
          <button class="clear-search-btn" onclick={clearSearch}>
            Clear Search
          </button>
        {:else}
          <p>No playlists yet</p>
          <span class="hint">Create your first playlist to get started</span>
          <button class="create-first-btn" onclick={openCreateModal}>
            <Icon name="plus" size={18} />
            Create Playlist
          </button>
        {/if}
      </div>
    {:else}
      <div class="playlists-grid" data-testid="playlists-grid">
        {#each filteredPlaylists as playlist}
          <div
            class="playlist-card"
            role="button"
            tabindex="0"
            onclick={() => handlePlaylistClick(playlist)}
            onkeydown={(e) => e.key === 'Enter' && handlePlaylistClick(playlist)}
            data-testid={generateTestId(playlist)}
          >
            <div class="playlist-icon">
              <div class="playlist-placeholder">
                <Icon name="playlist" size={48} />
              </div>
              <div class="playlist-overlay">
                <div class="play-indicator">
                  <Icon name="play-filled" size={32} />
                </div>
              </div>
            </div>
            <div class="playlist-info">
              <span class="playlist-name">{playlist}</span>
            </div>
            <button
              class="delete-btn"
              onclick={(e) => { e.stopPropagation(); confirmDelete(playlist); }}
              data-testid={`delete-playlist-${playlist.replace(/\s+/g, '-').toLowerCase()}`}
              aria-label="Delete playlist"
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Create Playlist Modal -->
  {#if showCreateModal}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={closeCreateModal} onkeydown={(e) => e.key === 'Escape' && closeCreateModal()} role="dialog" aria-modal="true" aria-label="Create Playlist" tabindex="-1">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
        <div class="modal-header">
          <h2>Create Playlist</h2>
          <button class="modal-close" onclick={closeCreateModal} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div class="modal-body">
          <label for="playlist-name">Playlist Name</label>
          <input
            type="text"
            id="playlist-name"
            placeholder="Enter playlist name..."
            bind:value={newPlaylistName}
            onkeydown={(e) => e.key === 'Enter' && handleCreate()}
          />
          {#if createError}
            <span class="error-text">{createError}</span>
          {/if}
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" onclick={closeCreateModal}>Cancel</button>
          <button class="btn-create" onclick={handleCreate}>Create</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Confirmation Modal -->
  {#if showDeleteConfirm}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={cancelDelete} onkeydown={(e) => e.key === 'Escape' && cancelDelete()} role="dialog" aria-modal="true" aria-label="Delete Playlist" tabindex="-1">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
        <div class="modal-header">
          <h2>Delete Playlist</h2>
          <button class="modal-close" onclick={cancelDelete} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete "{playlistToDelete}"?</p>
          <span class="warning-text">This action cannot be undone.</span>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" data-testid="cancel-delete-btn" onclick={cancelDelete}>Cancel</button>
          <button class="btn-delete" data-testid="confirm-delete-btn" onclick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .playlists-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .view-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--header-height-slim);
    padding: var(--spacing-sm) var(--spacing-xl);
    background: rgba(45, 45, 50, 0.7);
    backdrop-filter: blur(1.5px) saturate(135%);
    -webkit-backdrop-filter: blur(1.5px) saturate(135%);
    flex-shrink: 0;
    box-shadow:
      0 1px 4px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .back-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .back-btn :global(svg) {
    stroke-width: 3;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .back-btn:active {
    transform: scale(0.95);
  }

  .title {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .subtitle {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    opacity: 0.8;
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .create-btn:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }

  .create-btn:active {
    transform: scale(0.98);
  }

  /* Search Section */
  .search-section {
    padding: var(--spacing-sm) var(--spacing-xl);
    background: rgba(45, 45, 50, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s;
  }

  .search-input-wrapper:focus-within {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .search-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    outline: none;
  }

  .search-input-wrapper input::placeholder {
    color: var(--color-text-tertiary);
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: var(--color-text-primary);
  }

  /* View Content */
  .view-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
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

  .clear-search-btn,
  .create-first-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: white;
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .clear-search-btn:hover,
  .create-first-btn:hover {
    opacity: 0.9;
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

  /* Playlists Grid */
  .playlists-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .playlist-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: rgba(45, 45, 50, 0.6);
    backdrop-filter: blur(1px);
    border-radius: var(--radius-lg);
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    overflow: hidden;
    min-width: 0;
  }

  .playlist-card:hover {
    background: rgba(55, 55, 60, 0.7);
    transform: translateY(-2px);
  }

  .playlist-card:active {
    transform: scale(0.98);
  }

  .playlist-icon {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  }

  .playlist-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.8);
  }

  .playlist-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .playlist-card:hover .playlist-overlay {
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

  .playlist-card:hover .play-indicator {
    transform: scale(1.1);
  }

  .playlist-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    min-width: 0;
    overflow: hidden;
  }

  .playlist-name {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .delete-btn {
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s;
  }

  .playlist-card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.8);
    color: white;
  }

  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    width: 90%;
    max-width: 400px;
    background: rgba(45, 45, 50, 0.95);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-xl);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .modal-close {
    width: 32px;
    height: 32px;
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

  .modal-close:hover {
    background: rgba(255, 255, 255, 0.2);
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: var(--spacing-lg);
  }

  .modal-body label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .modal-body input {
    width: 100%;
    padding: var(--spacing-md);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    outline: none;
    transition: all 0.2s;
  }

  .modal-body input:focus {
    border-color: var(--color-primary);
    background: rgba(255, 255, 255, 0.12);
  }

  .modal-body p {
    margin: 0;
    color: var(--color-text-primary);
    line-height: 1.5;
  }

  .error-text {
    display: block;
    margin-top: var(--spacing-sm);
    font-size: var(--font-size-sm);
    color: #ef4444;
  }

  .warning-text {
    display: block;
    margin-top: var(--spacing-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn-cancel {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  .btn-create {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: white;
    font-size: var(--font-size-base);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-create:hover {
    opacity: 0.9;
  }

  .btn-delete {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-md);
    background: #ef4444;
    color: white;
    font-size: var(--font-size-base);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-delete:hover {
    background: #dc2626;
  }

  /* LCD panel optimization */
  @media (max-height: 500px) {
    .playlists-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: var(--spacing-md);
    }

    .playlist-name {
      font-size: var(--font-size-sm);
    }

    .play-indicator {
      width: 44px;
      height: 44px;
    }

    .search-section {
      padding: var(--spacing-xs) var(--spacing-lg);
    }

    .search-input-wrapper {
      padding: var(--spacing-xs) var(--spacing-sm);
    }
  }

  /* Mobile optimization */
  @media (max-width: 640px) {
    .view-header {
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .search-section {
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .view-content {
      padding: var(--spacing-md);
    }

    .playlists-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--spacing-md);
    }

    .create-btn span {
      display: none;
    }

    .create-btn {
      padding: var(--spacing-sm);
    }
  }
</style>
