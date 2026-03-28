<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let activeTab: string = 'nas';
  export let tabs: { id: string; label: string }[] = [
    { id: 'nas', label: 'NAS' },
    { id: 'local', label: 'Local' },
    { id: 'usb', label: 'USB' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'radio', label: 'Radio' },
    { id: 'favorites', label: 'Favorites' }
  ];

  const dispatch = createEventDispatcher<{ tabChange: string }>();

  function selectTab(id: string) {
    activeTab = id;
    dispatch('tabChange', id);
  }
</script>

<div class="source-tabs" role="tablist">
  {#each tabs as tab (tab.id)}
    <button
      class="source-tab"
      class:active={activeTab === tab.id}
      role="tab"
      id="tab-source-{tab.id}"
      aria-selected={activeTab === tab.id}
      aria-controls="panel-source-{tab.id}"
      on:click={() => selectTab(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .source-tabs {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .source-tabs::-webkit-scrollbar {
    display: none;
  }
  .source-tab {
    padding: 10px 16px;
    border-radius: var(--md-shape-full, 9999px);
    font-size: 13px;
    font-weight: 600;
    color: var(--md-on-surface-variant);
    cursor: pointer;
    transition: all 200ms ease-out;
    white-space: nowrap;
    border: none;
    background: transparent;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
  }
  .source-tab:hover {
    background: rgba(255, 177, 200, 0.06);
  }
  .source-tab.active {
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
  }
</style>
