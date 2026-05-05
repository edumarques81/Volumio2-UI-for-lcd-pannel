<script lang="ts">
  import { currentView } from '$lib/stores/navigation';
  import PlayerView from './PlayerView.svelte';
  import LibraryView from './LibraryView.svelte';
  import NavColumn from './NavColumn.svelte';
</script>

<div class="player-layout" data-testid="player-layout">
  <div class="content">
    {#if $currentView === 'player'}
      <PlayerView />
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
    background: var(--color-bg-base);
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
