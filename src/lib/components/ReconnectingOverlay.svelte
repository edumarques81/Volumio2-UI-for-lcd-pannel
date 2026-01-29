<script lang="ts">
  import { isReconnecting } from '$lib/services/socket';
  import { fade } from 'svelte/transition';
</script>

{#if $isReconnecting}
  <div
    class="reconnecting-overlay"
    transition:fade={{ duration: 200 }}
    role="status"
    aria-live="polite"
    aria-label="Reconnecting to server"
  >
    <div class="reconnecting-indicator">
      <div class="spinner-small" aria-hidden="true"></div>
      <span>Reconnecting...</span>
    </div>
  </div>
{/if}

<style>
  .reconnecting-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 60px;
    z-index: 1500;
    /* Allow clicks through to the app below */
    pointer-events: none;
  }

  .reconnecting-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    background: rgba(30, 30, 35, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
  }

  .spinner-small {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: var(--color-warning, #f5a623);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* LCD panel adjustments */
  :global(.device-lcd) .reconnecting-overlay {
    padding-top: 20px;
  }

  :global(.device-lcd) .reconnecting-indicator {
    padding: 8px 16px;
    font-size: 12px;
    gap: 8px;
  }

  :global(.device-lcd) .spinner-small {
    width: 14px;
    height: 14px;
    border-width: 2px;
  }

  /* Mobile adjustments */
  :global(.device-phone) .reconnecting-overlay,
  :global(.device-tablet) .reconnecting-overlay {
    padding-top: 80px;
  }
</style>
