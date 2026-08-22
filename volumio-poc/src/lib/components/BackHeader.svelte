<script lang="ts">
  import { navigationActions } from '$lib/stores/navigation';
  import Icon from './Icon.svelte';

  export let title: string = '';
</script>

<header class="back-header">
  <h1 class="title">{title}</h1>
  <button class="back-btn" on:click={navigationActions.goHome} aria-label="Back to home">
    <Icon name="chevron-left" size={28} />
  </button>
</header>

<style>
  .back-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .title {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-accent);
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: rgba(0, 122, 255, 0.1);
  }

  .back-btn:active {
    transform: scale(0.95);
  }
</style>
