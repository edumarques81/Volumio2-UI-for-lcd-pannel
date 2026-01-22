<script lang="ts">
  import { currentView, navigationActions, type ViewType } from '$lib/stores/navigation';
  import Icon from './Icon.svelte';

  interface NavItem {
    id: ViewType;
    label: string;
    icon: string;
  }

  const navItems: NavItem[] = [
    { id: 'player', label: 'Now Playing', icon: 'music-note' },
    { id: 'browse', label: 'Browse', icon: 'library' },
    { id: 'queue', label: 'Queue', icon: 'queue' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  function handleNavClick(view: ViewType) {
    navigationActions.goto(view);
  }
</script>

<nav class="navbar">
  {#each navItems as item}
    <button
      class="nav-item"
      class:active={$currentView === item.id}
      data-testid="nav-{item.id}"
      on:click={() => handleNavClick(item.id)}
      aria-label={item.label}
    >
      <Icon name={item.icon} size={28} />
      <span class="label">{item.label}</span>
    </button>
  {/each}
</nav>

<style>
  .navbar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-xl);
    min-width: 100px;
    min-height: var(--touch-target-min);
    border: none;
    border-radius: var(--radius-lg);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
  }

  .nav-item.active {
    background: rgba(0, 122, 255, 0.2);
    color: var(--color-accent);
  }

  .nav-item:active {
    transform: scale(0.95);
  }

  .label {
    font-size: var(--font-size-sm);
    font-weight: 500;
  }
</style>
