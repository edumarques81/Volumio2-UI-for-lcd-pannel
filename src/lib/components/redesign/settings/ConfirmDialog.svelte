<script lang="ts">
  import { tick } from 'svelte';

  interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  }

  const {
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onconfirm,
    oncancel,
  }: ConfirmDialogProps = $props();

  const titleId = 'confirm-dialog-title';
  const messageId = 'confirm-dialog-message';

  let cancelButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if (open) {
      tick().then(() => {
        cancelButton?.focus();
      });
    }
  });

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      oncancel();
    }
  }

  function handleBackdropClick() {
    oncancel();
  }

  function handleBodyClick(e: MouseEvent) {
    e.stopPropagation();
  }

  function handleConfirm() {
    onconfirm();
  }

  function handleCancel() {
    oncancel();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div
    class="backdrop"
    role="presentation"
    onclick={handleBackdropClick}
    onkeydown={undefined}
  ></div>

  <div class="dialog-positioner">
    <div
      class="dialog-body"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      tabindex="-1"
      onclick={handleBodyClick}
      onkeydown={undefined}
    >
      <h2 id={titleId} class="dialog-title">{title}</h2>

      {#if message}
        <p id={messageId} class="dialog-message">{message}</p>
      {/if}

      <div class="actions">
        <button
          bind:this={cancelButton}
          type="button"
          class="cancel"
          onclick={handleCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          class="confirm"
          class:destructive
          onclick={handleConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 999;
  }

  .dialog-positioner {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    z-index: 1000;
    pointer-events: none;
  }

  .dialog-body {
    pointer-events: auto;
    background: var(--color-bg-base);
    border: 1px solid var(--color-text-secondary);
    border-radius: var(--radius-card);
    padding: 24px 28px;
    min-width: 320px;
    max-width: 480px;
  }

  .dialog-title {
    color: var(--color-text-primary);
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .dialog-message {
    color: var(--color-text-secondary);
    font-size: 14px;
    margin: 0 0 24px;
  }

  .actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .cancel,
  .confirm {
    border-radius: var(--radius-card);
    min-height: var(--hit-target-min);
    padding: 0 20px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .cancel:focus-visible,
  .confirm:focus-visible {
    outline: 2px solid var(--color-accent-bright);
    outline-offset: 2px;
  }

  .cancel {
    background: transparent;
    color: var(--color-text-primary);
    border: 1px solid var(--color-text-secondary);
  }

  .confirm {
    background: var(--color-accent);
    color: var(--color-bg-base);
    border: 1px solid var(--color-accent-bright);
  }

  .confirm.destructive {
    background: #d04545;
    color: #fff;
    border-color: #f06060;
  }
</style>
