<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { powerModalOpen, modalActions } from '$lib/stores/navigation';
  import { socketService } from '$lib/services/socket';

  /** Backend shape for system:action:error broadcasts. */
  interface SystemActionError {
    action?: string;
    error?: string;
  }

  let errorMsg = '';
  let unsubError: (() => void) | null = null;

  // Clear any stale errorMsg whenever the modal closes so re-opening
  // never shows the previous failure's toast.
  const unsubOpen = powerModalOpen.subscribe(open => {
    if (!open) errorMsg = '';
  });

  onMount(() => {
    unsubError = socketService.on<SystemActionError>('system:action:error', (payload) => {
      // Don't surface the action name as a fake "error message"; if the
      // backend omits an error string, fall back to a generic label.
      errorMsg = `Power command failed: ${payload?.error ?? 'unknown error'}`;
      // Modal stays open per spec decision; user sees toast.
    });
  });
  onDestroy(() => {
    unsubError?.();
    unsubOpen();
  });

  function shutdown() {
    errorMsg = '';
    socketService.emit('system:shutdown');
  }
  function reboot() {
    errorMsg = '';
    socketService.emit('system:reboot');
  }
  function backdropClick() {
    modalActions.closePower();
  }
</script>

{#if $powerModalOpen}
  <div class="power-modal" data-testid="power-modal" role="dialog" aria-modal="true" aria-label="Power options">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="backdrop" data-testid="power-modal-backdrop" on:click={backdropClick}></div>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="body" data-testid="power-modal-body" on:click|stopPropagation>
      <h2>Power</h2>
      <div class="buttons">
        <button type="button" class="action shutdown" data-testid="power-modal-shutdown" aria-label="Shutdown" on:click={shutdown}>Shutdown</button>
        <button type="button" class="action reset" data-testid="power-modal-reset" aria-label="Reset" on:click={reboot}>Reset</button>
      </div>
      {#if errorMsg}
        <p class="error" role="alert">{errorMsg}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .power-modal {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
  }
  .body {
    position: relative;
    width: 50%;
    max-width: 800px;
    background: #0e0e0e;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-card);
    padding: 32px;
    color: var(--color-text-primary);
    box-shadow: 0 0 60px rgba(0,0,0,0.8);
  }
  h2 {
    margin: 0 0 24px;
    font-size: 32px;
    font-weight: 400;
    color: var(--color-accent);
    text-align: center;
  }
  .buttons {
    display: flex;
    gap: 24px;
    justify-content: center;
  }
  .action {
    min-width: 240px;
    min-height: 80px;
    padding: 16px 32px;
    font-size: 24px;
    font-weight: 600;
    color: var(--color-accent);
    background: #1a1408;
    border: 2px solid var(--color-accent);
    border-radius: var(--radius-card);
    cursor: pointer;
  }
  .action:hover { background: #251c0e; }
  .action.reset { color: var(--color-text-primary); border-color: var(--color-text-secondary); }
  .error {
    margin: 16px 0 0;
    color: #ff6b6b;
    text-align: center;
    font-size: 18px;
  }
</style>
