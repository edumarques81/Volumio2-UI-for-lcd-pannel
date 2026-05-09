<script lang="ts">
  import { currentView } from '$lib/stores/navigation';
  import PlayerView from './PlayerView.svelte';
  import LibraryView from './LibraryView.svelte';
  import NavColumn from './NavColumn.svelte';
  import type { Component } from 'svelte';

  // Lazy-load SettingsView (rare-path, heaviest siblings include NasShareList) so
  // it doesn't ship in the initial App chunk. See plan §C6.1. The import is
  // gated on the user actually navigating to Settings — a derived $-store read
  // inside the unsubscribe pattern triggers the load on first transition.
  let SettingsView = $state<Component | null>(null);
  let importStarted = false;

  // Subscribe directly to the navigation store so the lazy-load fires on the
  // first 'settings' transition. ($effect on a $-store read worked in dev but
  // proved unreliable in jsdom test runs; an explicit subscription is the
  // simplest reactive primitive that's portable across both runtimes.)
  const unsubscribeView = currentView.subscribe((view) => {
    if (view === 'settings' && !importStarted) {
      importStarted = true;
      void import('./SettingsView.svelte').then((m) => {
        SettingsView = m.default as Component;
      });
    }
  });
  // Clean up on component teardown so the subscription doesn't leak.
  $effect(() => () => unsubscribeView());
</script>

<div class="player-layout" data-testid="player-layout">
  <div class="content">
    {#if $currentView === 'player'}
      <PlayerView />
    {:else if $currentView === 'settings'}
      {#if SettingsView}
        <SettingsView />
      {/if}
    {:else}
      <LibraryView />
    {/if}
  </div>
  <NavColumn />
</div>

<style>
  .player-layout {
    width: 100%;
    height: 100vh;
    background:
      radial-gradient(ellipse 43% 58% at 85% 15%, rgba(255, 255, 255, 0.085), transparent 55%),
      radial-gradient(ellipse 40% 60% at 80% 90%, rgba(40, 60, 90, 0.15), transparent 55%),
      #050507;
    display: grid;
    grid-template-columns: 1fr 240px;   /* nav column = 240px on Pi LCD */
    color: var(--color-text-primary);
    position: relative;
    isolation: isolate;
  }
  /* Diagonal sheen + glass overlay (decisions 41–42) */
  .player-layout::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 70% at 75% 0%, var(--color-sheen-tint), transparent 70%),
      linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 12%);
    pointer-events: none;
    z-index: 1;
  }
  .content {
    position: relative;
    z-index: 2;
    overflow: hidden;
  }
</style>
