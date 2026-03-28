<script lang="ts">
  import LibraryTab from './LibraryTab.svelte';
  import QueueTab from './QueueTab.svelte';
  import SettingsTab from './SettingsTab.svelte';
  import AlbumDetailOverlay from './AlbumDetailOverlay.svelte';
  import ArtistDetailOverlay from './ArtistDetailOverlay.svelte';
  import type { Album } from '$lib/stores/library';

  type PanelTab = 'library' | 'queue' | 'settings';

  /** Controllable from parent (e.g. GalleryLayout navigation mapping). */
  export let activeTab: PanelTab = 'library';
  export let selectedAlbum: Album | null = null;
  export let selectedArtistName: string | null = null;

  const tabs: { id: PanelTab; label: string }[] = [
    { id: 'library', label: 'Library' },
    { id: 'queue', label: 'Queue' },
    { id: 'settings', label: 'Settings' }
  ];

  function selectTab(tab: PanelTab) {
    activeTab = tab;
    // Clear overlays on tab switch
    selectedAlbum = null;
    selectedArtistName = null;
  }

  function handleAlbumSelect(e: CustomEvent<Album>) {
    selectedAlbum = e.detail;
    selectedArtistName = null;
  }

  function handleAlbumBack() {
    selectedAlbum = null;
  }

  function handleArtistBack() {
    selectedArtistName = null;
  }

  function handleArtistAlbumSelect(e: CustomEvent<Album>) {
    selectedAlbum = e.detail;
  }
</script>

<div class="utility-panel">
  <div class="right-tabs" role="tablist">
    {#each tabs as tab (tab.id)}
      <button
        class="right-tab"
        class:active={activeTab === tab.id}
        role="tab"
        aria-selected={activeTab === tab.id}
        on:click={() => selectTab(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="right-body">
    {#if activeTab === 'library'}
      <div class="right-view" class:hidden={!!selectedAlbum || !!selectedArtistName}>
        <LibraryTab on:albumSelect={handleAlbumSelect} />
      </div>
      {#if selectedAlbum}
        <div class="right-view overlay">
          <AlbumDetailOverlay album={selectedAlbum} on:back={handleAlbumBack} />
        </div>
      {/if}
      {#if selectedArtistName && !selectedAlbum}
        <div class="right-view overlay">
          <ArtistDetailOverlay
            artist={selectedArtistName}
            on:back={handleArtistBack}
            on:albumSelect={handleArtistAlbumSelect}
          />
        </div>
      {/if}
    {:else if activeTab === 'queue'}
      <div class="right-view">
        <QueueTab />
      </div>
    {:else if activeTab === 'settings'}
      <div class="right-view">
        <SettingsTab />
      </div>
    {/if}
  </div>
</div>

<style>
  .utility-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    background: rgba(26, 17, 20, 0.5);
    backdrop-filter: blur(24px) saturate(1.3);
    -webkit-backdrop-filter: blur(24px) saturate(1.3);
    border: 1px solid rgba(81, 67, 71, 0.55);
    border-radius: var(--md-shape-lg, 16px);
    overflow: hidden;
    transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .right-tabs {
    display: flex;
    border-bottom: 1px solid rgba(81, 67, 71, 0.3);
    flex-shrink: 0;
  }

  .right-tab {
    flex: 1;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--md-outline);
    cursor: pointer;
    text-align: center;
    transition: all 200ms ease-out;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
  }
  .right-tab:hover {
    color: var(--md-on-surface-variant);
    background: rgba(255, 177, 200, 0.03);
  }
  .right-tab.active {
    color: var(--md-primary);
    border-bottom-color: var(--md-primary);
  }

  .right-body {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .right-view {
    position: absolute;
    inset: 0;
    padding: 12px 16px;
    overflow-y: auto;
    transition: opacity 300ms ease-out, transform 300ms ease-out;
    scrollbar-width: thin;
    scrollbar-color: var(--md-outline-variant) transparent;
  }
  .right-view.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateX(10px);
  }
  .right-view.overlay {
    z-index: 5;
  }

  /* Scrollbar webkit */
  .right-view::-webkit-scrollbar {
    width: 4px;
  }
  .right-view::-webkit-scrollbar-track {
    background: transparent;
  }
  .right-view::-webkit-scrollbar-thumb {
    background: var(--md-outline-variant);
    border-radius: 2px;
  }
  .right-view::-webkit-scrollbar-thumb:hover {
    background: var(--md-outline);
  }
</style>
