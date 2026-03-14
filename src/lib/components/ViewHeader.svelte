<script lang="ts">
  import { navigationActions } from '$lib/stores/navigation';
  import Icon from './Icon.svelte';

  /** Title displayed in the header */
  export let title: string = '';
  /** Optional subtitle below the title */
  export let subtitle: string = '';
  /** Override the back action (defaults to goHome) */
  export let onBack: (() => void) | null = null;

  function handleBack() {
    if (onBack) onBack();
    else navigationActions.goHome();
  }
</script>

<header class="view-header">
  <div class="header-left">
    <button class="back-btn" on:click={handleBack} aria-label="Back">
      <Icon name="chevron-left" size={28} />
    </button>
    <div class="title-group">
      <h1 class="title">{title}</h1>
      {#if subtitle}
        <span class="subtitle">{subtitle}</span>
      {/if}
    </div>
  </div>

  <!-- Optional right-side actions (slot) -->
  <div class="header-right">
    <slot />
  </div>
</header>

<style>
  .view-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--header-height-slim, 52px);
    padding: 0 var(--spacing-xl, 24px) 0 var(--spacing-sm, 6px);
    background: rgba(30, 16, 20, 0.75);
    backdrop-filter: blur(8px) saturate(140%);
    -webkit-backdrop-filter: blur(8px) saturate(140%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--md-primary, #b5264c);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .back-btn:hover { background: rgba(255, 255, 255, 0.08); }
  .back-btn:active { transform: scale(0.88); }

  .title-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .title {
    font-size: var(--font-size-xl, 22px);
    font-weight: 600;
    color: var(--md-on-surface, #f5eaed);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .subtitle {
    font-size: var(--font-size-sm, 14px);
    color: rgba(245, 234, 237, 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
</style>
