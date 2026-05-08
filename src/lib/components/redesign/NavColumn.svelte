<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { currentView, viewActions, refreshInProgress } from '$lib/stores/navigation';

  type Cell = {
    icon: string;
    label: string;
    activeWhen?: 'player' | 'library' | 'settings';
    onTap: () => void;
  };

  const cells: Cell[] = [
    { icon: 'music-2',     label: 'Player',   activeWhen: 'player',   onTap: viewActions.goToPlayer  },
    { icon: 'library',     label: 'Library',  activeWhen: 'library',  onTap: viewActions.goToLibrary },
    { icon: 'audio-lines', label: 'VU Meter',                          onTap: viewActions.tapVuMeter },
    { icon: 'refresh-cw',  label: 'Refresh',                           onTap: viewActions.tapRefresh },
    { icon: 'settings',    label: 'Settings', activeWhen: 'settings', onTap: viewActions.tapSettings },
    { icon: 'power',       label: 'Power',                             onTap: viewActions.tapPower   },
  ];
</script>

<nav class="nav-column" aria-label="Main navigation" data-testid="nav-column">
  {#each cells as c (c.label)}
    <button
      class="cell"
      class:active={c.activeWhen && $currentView === c.activeWhen}
      class:spinning={c.label === 'Refresh' && $refreshInProgress}
      aria-label={c.label}
      data-testid="nav-cell-{c.label.toLowerCase().replace(/\s+/g, '-')}"
      on:click={c.onTap}
    >
      <Icon name={c.icon} size={40} />
    </button>
  {/each}
</nav>

<style>
  .nav-column {
    display: flex;
    flex-direction: column;
    width: 240px;
    /* TransportColumn owns the gold divider via border-right; no border-left
       here, otherwise the seam doubles up. */
    height: 100%;
  }
  .cell {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--color-accent);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 80ms ease, transform 50ms ease;
    position: relative;
  }
  /* Soft white separator: fade in → bright center → fade out. */
  .cell:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%);
    pointer-events: none;
  }
  .cell:active { transform: scale(0.98); filter: brightness(1.2); }
  .cell.active {
    background: var(--color-bg-active-cell);
    color: var(--color-accent-bright);
  }
  .cell.active::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--color-accent);
  }
  .cell.spinning :global(svg) {
    animation: cell-spin 1s linear infinite;
  }
  @keyframes cell-spin {
    to { transform: rotate(360deg); }
  }
</style>
