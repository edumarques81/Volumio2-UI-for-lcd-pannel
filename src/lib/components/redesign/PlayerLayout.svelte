<script lang="ts">
  import { currentView } from '$lib/stores/navigation';
  import PlayerView from './PlayerView.svelte';
  import NavColumn from './NavColumn.svelte';
</script>

<div class="player-layout">
  <div class="content">
    {#if $currentView === 'player'}
      <PlayerView />
    {:else}
      <!-- Library content ships in Plan 4. Placeholder keeps layout grid honest. -->
      <div class="library-pending">Library — coming in Plan 4</div>
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
  .library-pending {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: #555;
  }
</style>
