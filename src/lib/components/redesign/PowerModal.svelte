<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { powerModalOpen, modalActions } from '$lib/stores/navigation';
  import { socketService } from '$lib/services/socket';

  /** Backend shape for system:action:error broadcasts. */
  interface SystemActionError {
    action?: string;
    error?: string;
  }

  let errorMsg = '';
  let unsubError: (() => void) | null = null;
  let shutdownButton: HTMLButtonElement | undefined;

  // Clear any stale errorMsg whenever the modal closes so re-opening
  // never shows the previous failure's toast. Also focus the first
  // interactive element on open so the user can ESC immediately.
  const unsubOpen = powerModalOpen.subscribe(async (open) => {
    if (!open) {
      errorMsg = '';
      return;
    }
    await tick();
    shutdownButton?.focus();
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
    // Canonical bare event name; SettingsView emits the same. Backend
    // `SystemActionHandlers` dispatches both — auth-gated, routed to Pi
    // via mount-control /api/system/* on Mac/Windows backend hosts.
    socketService.emit('shutdown');
  }
  function reboot() {
    errorMsg = '';
    socketService.emit('reboot');
  }
  function cancel() {
    modalActions.closePower();
  }
  function backdropClick() {
    modalActions.closePower();
  }
  function onKeydown(e: KeyboardEvent) {
    if (!$powerModalOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      modalActions.closePower();
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $powerModalOpen}
  <div class="power-modal" data-testid="power-modal" role="dialog" aria-modal="true" aria-label="Power options">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="backdrop" data-testid="power-modal-backdrop" on:click={backdropClick}></div>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="body" data-testid="power-modal-body" on:click|stopPropagation>
      <h2>Power</h2>
      <div class="buttons">
        <button bind:this={shutdownButton} type="button" class="action shutdown" data-testid="power-modal-shutdown" aria-label="Shutdown" on:click={shutdown}>Shutdown</button>
        <button type="button" class="action reset" data-testid="power-modal-reset" aria-label="Reset" on:click={reboot}>Reset</button>
        <button type="button" class="action cancel" data-testid="power-modal-cancel" aria-label="Cancel" on:click={cancel}>Cancel</button>
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
  .action.cancel {
    color: var(--color-text-primary);
    border-color: var(--color-text-secondary);
    background: transparent;
  }
  .action.cancel:hover { background: rgba(255, 255, 255, 0.04); }
  .error {
    margin: 16px 0 0;
    color: #ff6b6b;
    text-align: center;
    font-size: 18px;
  }
</style>
