<script lang="ts">
  export interface RadioGroupOption<T extends string = string> {
    value: T;
    label: string;
    description?: string;
  }

  interface RadioGroupProps<T extends string = string> {
    options: ReadonlyArray<RadioGroupOption<T>>;
    value: T;
    onchange: (next: T) => void;
    ariaLabel: string;
    id?: string;
    disabled?: boolean;
    orientation?: 'vertical' | 'horizontal';
  }

  const {
    options,
    value,
    onchange,
    ariaLabel,
    id,
    disabled = false,
    orientation = 'vertical',
  }: RadioGroupProps = $props();

  function handleClick(optValue: string) {
    if (disabled) return;
    onchange(optValue as Parameters<typeof onchange>[0]);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return;

    const currentIndex = options.findIndex((o) => o.value === value);
    const count = options.length;

    let nextIndex: number | null = null;

    if (orientation === 'vertical') {
      if (e.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % count;
      } else if (e.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + count) % count;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = count - 1;
      } else if (e.key === 'Space' || e.key === 'Enter') {
        // Space/Enter on the group itself — no-op since selection is per-button
      }
    } else {
      // horizontal orientation: ArrowRight/ArrowLeft navigate; ArrowDown/ArrowUp are no-ops
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % count;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + count) % count;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = count - 1;
      }
      // ArrowDown and ArrowUp are intentional no-ops in horizontal orientation
    }

    if (nextIndex !== null) {
      e.preventDefault();
      onchange(options[nextIndex].value as Parameters<typeof onchange>[0]);
    }
  }

  function handleButtonKeyDown(e: KeyboardEvent, optValue: string) {
    if (disabled) return;
    if (e.key === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      onchange(optValue as Parameters<typeof onchange>[0]);
    }
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  role="radiogroup"
  aria-label={ariaLabel}
  {id}
  aria-orientation={orientation}
  class="radio-group"
  class:radio-group--horizontal={orientation === 'horizontal'}
  class:radio-group--disabled={disabled}
  onkeydown={handleKeyDown}
>
  {#each options as option (option.value)}
    {@const isSelected = option.value === value}
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      tabindex={isSelected ? 0 : -1}
      class="radio-row"
      class:radio-row--selected={isSelected}
      onclick={() => handleClick(option.value)}
      onkeydown={(e) => handleButtonKeyDown(e, option.value)}
      aria-disabled={disabled}
    >
      <span class="radio-indicator" class:radio-indicator--selected={isSelected} aria-hidden="true">
        {#if isSelected}
          <span class="radio-dot"></span>
        {/if}
      </span>
      <span class="radio-content">
        <span class="radio-label">{option.label}</span>
        {#if option.description}
          <span class="radio-description" data-testid="radio-description">{option.description}</span>
        {/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .radio-group {
    display: flex;
    flex-direction: column;
  }

  .radio-group--horizontal {
    flex-direction: row;
    gap: 16px;
  }

  .radio-group--disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .radio-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-height: var(--hit-target-min);
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: var(--radius-card);
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background var(--crossfade-duration) var(--crossfade-ease);
  }

  .radio-group--horizontal .radio-row {
    width: auto;
  }

  .radio-row:hover:not(.radio-row--selected) {
    background: rgba(255, 255, 255, 0.04);
  }

  .radio-row--selected {
    background: var(--color-bg-active-cell);
  }

  .radio-row:focus-visible {
    outline: 2px solid var(--color-accent-bright);
    outline-offset: 2px;
  }

  .radio-indicator {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border: 2px solid var(--color-text-secondary);
    border-radius: 50%;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 2px;
  }

  .radio-indicator--selected {
    border-color: var(--color-accent);
  }

  .radio-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-accent);
  }

  .radio-content {
    display: flex;
    flex-direction: column;
  }

  .radio-label {
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 500;
    line-height: 1.3;
  }

  .radio-description {
    color: var(--color-text-secondary);
    font-size: 13px;
    margin-top: 2px;
    line-height: 1.4;
  }
</style>
