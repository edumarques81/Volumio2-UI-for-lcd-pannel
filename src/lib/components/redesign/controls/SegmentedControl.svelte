<script lang="ts">
  interface Option<T extends string> {
    value: T;
    label: string;
  }

  interface Props<T extends string = string> {
    options: ReadonlyArray<Option<T>>;
    value: T;
    onchange: (next: T) => void;
    ariaLabel: string;
    id?: string;
    disabled?: boolean;
  }

  const {
    options,
    value,
    onchange,
    ariaLabel,
    id,
    disabled = false,
  }: Props = $props();

  function handleClick(optionValue: string) {
    if (disabled) return;
    if (optionValue === value) return;
    onchange(optionValue as Parameters<typeof onchange>[0]);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return;

    const currentIndex = options.findIndex((o) => o.value === value);
    const last = options.length - 1;

    let nextIndex: number | null = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = currentIndex >= last ? 0 : currentIndex + 1;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = currentIndex <= 0 ? last : currentIndex - 1;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = last;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      // Space/Enter on the focused button — already handled via click
      return;
    }

    if (nextIndex !== null && options[nextIndex].value !== value) {
      onchange(options[nextIndex].value as Parameters<typeof onchange>[0]);
    }
  }
</script>

<div
  role="radiogroup"
  aria-label={ariaLabel}
  {id}
  tabindex="-1"
  class="segmented-control"
  class:disabled
  onkeydown={handleKeyDown}
>
  {#each options as option (option.value)}
    {@const isSelected = option.value === value}
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={option.label}
      tabindex={isSelected ? 0 : -1}
      class="segment"
      class:selected={isSelected}
      onclick={() => handleClick(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented-control {
    display: inline-flex;
    align-items: stretch;
    background: var(--color-bg-base);
    border: 1px solid var(--color-text-secondary);
    border-radius: var(--radius-card);
    overflow: hidden;
    min-height: var(--hit-target-min);
  }

  .segmented-control.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .segment {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    min-height: var(--hit-target-min);
    background: transparent;
    color: var(--color-text-primary);
    border: none;
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    transition: background var(--crossfade-duration) var(--crossfade-ease),
      color var(--crossfade-duration) var(--crossfade-ease);
    outline: none;
  }

  .segment:focus-visible {
    outline: 2px solid var(--color-accent-bright);
    outline-offset: 2px;
  }

  .segment.selected {
    background: var(--color-accent);
    color: var(--color-bg-base);
  }
</style>
