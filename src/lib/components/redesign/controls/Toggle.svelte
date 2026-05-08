<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  interface ToggleProps {
    pressed: boolean;
    onchange: (next: boolean) => void;
    ariaLabel: string;
    id?: string;
    label?: string;
    disabled?: boolean;
    loading?: boolean;
  }

  const {
    pressed,
    onchange,
    ariaLabel,
    id,
    label,
    disabled = false,
    loading = false,
  }: ToggleProps = $props();

  function handleClick() {
    if (disabled || loading) return;
    onchange(!pressed);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (disabled || loading) return;
      onchange(!pressed);
    }
  }
</script>

{#if label}
  <div class="toggle-row">
    <span class="toggle-label">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      {id}
      class="toggle-btn"
      class:on={pressed}
      class:is-disabled={disabled}
      class:is-loading={loading}
      onclick={handleClick}
      onkeydown={handleKeydown}
    >
      {#if loading}
        <span class="spinning"><Icon name="refresh" size={20} /></span>
      {:else}
        <span class="track">
          <span class="thumb"></span>
        </span>
      {/if}
    </button>
  </div>
{:else}
  <button
    type="button"
    role="switch"
    aria-checked={pressed}
    aria-pressed={pressed}
    aria-label={ariaLabel}
    {id}
    class="toggle-btn"
    class:on={pressed}
    class:is-disabled={disabled}
    class:is-loading={loading}
    onclick={handleClick}
    onkeydown={handleKeydown}
  >
    {#if loading}
      <span class="spinning"><Icon name="refresh" size={20} /></span>
    {:else}
      <span class="track">
        <span class="thumb"></span>
      </span>
    {/if}
  </button>
{/if}

<style>
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .toggle-label {
    color: var(--color-text-primary);
    font-size: 16px;
  }

  .toggle-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--hit-target-min);
    min-height: var(--hit-target-min);
    padding: 0 6px;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .toggle-btn:focus-visible {
    outline: 2px solid var(--color-accent-bright);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .toggle-btn.is-disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .toggle-btn.is-loading {
    pointer-events: none;
  }

  .track {
    position: relative;
    display: inline-block;
    width: 56px;
    height: 32px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid var(--color-text-secondary);
    transition:
      background var(--crossfade-duration) var(--crossfade-ease),
      border-color var(--crossfade-duration) var(--crossfade-ease);
  }

  .toggle-btn.on .track {
    background: var(--color-accent);
    border-color: var(--color-accent-bright);
  }

  .thumb {
    position: absolute;
    top: 50%;
    left: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-text-primary);
    transform: translateY(-50%) translateX(0);
    transition: transform var(--crossfade-duration) var(--crossfade-ease);
  }

  .toggle-btn.on .thumb {
    /* track 56px wide, thumb 24px, 4px from right: 56 - 24 - 4 - 4 = 24px */
    transform: translateY(-50%) translateX(24px);
  }

  .spinning {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-primary);
  }

  .spinning :global(svg) {
    animation: toggle-spin 1s linear infinite;
  }

  @keyframes toggle-spin {
    to { transform: rotate(360deg); }
  }
</style>
