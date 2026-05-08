<script lang="ts">
  interface Props {
    open?: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onconfirm?: () => void;
    oncancel?: () => void;
  }

  const {
    open = false,
    title = '',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onconfirm,
    oncancel,
  }: Props = $props();
</script>

<!--
  Stub for ConfirmDialog. Renders a div[role=dialog] when open is true.
  Exposes data-destructive so tests can verify destructive variant.
-->
{#if open}
  <div
    role="dialog"
    aria-modal="true"
    data-destructive={destructive}
    data-title={title}
  >
    <p class="dialog-message">{message ?? ''}</p>
    <button type="button" onclick={() => onconfirm?.()}>{confirmLabel}</button>
    <button type="button" onclick={() => oncancel?.()}>{cancelLabel}</button>
  </div>
{/if}
