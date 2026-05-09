<script lang="ts">
  import { onMount } from 'svelte';
  import SegmentedControl from '$lib/components/redesign/controls/SegmentedControl.svelte';
  import {
    libraryScope,
    librarySort,
    libraryActions,
    type Scope,
    type SortOrder,
  } from '$lib/stores/library';
  import { settingsActions } from '$lib/stores/settings';
  import type { Component } from 'svelte';

  // Lazy-load NasShareList — at 619 lines (browse/discover forms) it's the
  // heaviest piece of the Settings panel. Splitting it out keeps the initial
  // SettingsView chunk small. See plan §C6.2.
  let NasShareList = $state<Component | null>(null);

  onMount(() => {
    void import('$lib/components/redesign/settings/NasShareList.svelte').then((m) => {
      NasShareList = m.default as Component;
    });
  });

  // ---------------------------------------------------------------------------
  // SegmentedControl option arrays — defined as constants (no props, self-contained)
  // ---------------------------------------------------------------------------

  const SCOPE_OPTIONS: ReadonlyArray<{ value: Scope; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'nas', label: 'NAS' },
    { value: 'local', label: 'Local' },
    { value: 'usb', label: 'USB' },
  ];

  const SORT_OPTIONS: ReadonlyArray<{ value: SortOrder; label: string }> = [
    { value: 'alphabetical', label: 'A–Z' },
    { value: 'by_artist', label: 'Artist' },
    { value: 'recently_added', label: 'Recent' },
    { value: 'year', label: 'Year' },
  ];
</script>

<section class="library-settings">
  <!-- Column title -->
  <h2 class="column-title">Library</h2>

  <!-- Scope block -->
  <div class="block">
    <p class="block-label">Library scope</p>
    <div data-testid="library-scope">
      <SegmentedControl
        options={SCOPE_OPTIONS}
        value={$libraryScope}
        onchange={libraryActions.setScope}
        ariaLabel="Library scope"
        id="settings-library-scope"
      />
    </div>
  </div>

  <!-- Sort block -->
  <div class="block">
    <p class="block-label">Library sort</p>
    <div data-testid="library-sort">
      <SegmentedControl
        options={SORT_OPTIONS}
        value={$librarySort}
        onchange={libraryActions.setSort}
        ariaLabel="Library sort"
        id="settings-library-sort"
      />
    </div>
  </div>

  <!-- Maintenance block -->
  <div class="block">
    <p class="block-label">Maintenance</p>
    <div class="maintenance-buttons">
      <button
        type="button"
        class="maintenance-btn"
        data-testid="library-rebuild"
        onclick={libraryActions.rebuildCache}
      >
        Rebuild library cache
      </button>
      <button
        type="button"
        class="maintenance-btn"
        onclick={settingsActions.rescanLibrary}
      >
        Rescan MPD
      </button>
    </div>
  </div>

  <!-- Network shares block -->
  <div class="block">
    <p class="block-label">Network shares</p>
    {#if NasShareList}
      <NasShareList />
    {/if}
  </div>
</section>

<style>
  .library-settings {
    padding: 24px;
    overflow-y: auto;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .column-title {
    color: var(--color-text-primary);
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 24px;
  }

  .block {
    margin-bottom: 24px;
  }

  .block-label {
    color: var(--color-text-secondary);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 8px;
  }

  .maintenance-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .maintenance-btn {
    width: 100%;
    min-height: var(--hit-target-min);
    border: 1px solid var(--color-text-secondary);
    background: transparent;
    color: var(--color-text-primary);
    border-radius: var(--radius-card);
    padding: 0 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    transition: background 150ms ease;
  }

  .maintenance-btn:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .maintenance-btn:active {
    background: rgba(255, 255, 255, 0.08);
  }
</style>
