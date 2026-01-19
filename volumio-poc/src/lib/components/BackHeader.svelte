<script lang="ts">
  import { navigationActions } from '$lib/stores/navigation';
  import Icon from './Icon.svelte';

  export let title: string = '';
</script>

<header class="back-header">
  <button class="back-btn" on:click={navigationActions.goHome} aria-label="Back to home">
    <Icon name="chevron-left" size={32} />
    <span>Home</span>
  </button>
  <h1 class="title">{title}</h1>
  <div class="spacer"></div>
</header>

<style>
  .back-header {
    display: flex;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-xl);
    height: 52px;
    /* Frosted glass - 30% more blur/saturation than tiles */
    background: rgba(45, 45, 50, 0.7);
    backdrop-filter: blur(1.5px) saturate(135%);
    -webkit-backdrop-filter: blur(1.5px) saturate(135%);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
    /* Subtle 3D effect */
    box-shadow:
      0 1px 4px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    min-height: var(--touch-target-min);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-accent);
    font-size: var(--font-size-lg);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: rgba(0, 122, 255, 0.1);
  }

  .back-btn:active {
    transform: scale(0.98);
  }

  .title {
    flex: 1;
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--color-text-primary);
    text-align: center;
    margin: 0;
  }

  .spacer {
    width: 100px; /* Match back button width for centering */
  }
</style>
