<script lang="ts">
  interface Props {
    pressed?: boolean;
    onchange?: (next: boolean) => void;
    ariaLabel?: string;
    id?: string;
    label?: string;
    disabled?: boolean;
    loading?: boolean;
  }

  const {
    pressed = false,
    onchange,
    ariaLabel,
    id,
    label,
    disabled = false,
    loading = false,
  }: Props = $props();

  function handleClick() {
    if (disabled || loading) return;
    onchange?.(!pressed);
  }
</script>

<!--
  Stub for Toggle. Renders a button with aria-pressed and data-loading attributes
  so tests can verify state and fire click events.
-->
<div class="stub-toggle-row">
  {#if label}
    <span>{label}</span>
  {/if}
  <button
    type="button"
    role="switch"
    aria-checked={pressed}
    aria-pressed={pressed}
    aria-label={ariaLabel}
    {id}
    data-loading={loading}
    onclick={handleClick}
  >
    toggle
  </button>
</div>
