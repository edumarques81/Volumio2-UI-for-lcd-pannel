<script lang="ts">
  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    options?: ReadonlyArray<Option>;
    value?: string;
    onchange?: (next: string) => void;
    ariaLabel?: string;
    id?: string;
    disabled?: boolean;
  }

  const { options = [], value = '', onchange, ariaLabel, id, disabled = false }: Props = $props();

  // Pick a predictable "next" value to fire: second option, or first if none
  function pickNext(): string {
    if (options.length === 0) return '';
    const idx = options.findIndex((o) => o.value === value);
    return options[(idx + 1) % options.length]?.value ?? options[0].value;
  }
</script>

<!--
  Stub for SegmentedControl. Renders:
  - A wrapper div with data-testid, id, and data-value (for inspection)
  - A change trigger button (fires onchange with the next option value)
-->
<div
  data-testid={`stub-segmented-${id}`}
  data-value={value}
  aria-label={ariaLabel}
  {id}
  class:disabled
>
  <button
    type="button"
    data-testid={`stub-segmented-${id}-change`}
    onclick={() => onchange?.(pickNext())}
  >
    change
  </button>
</div>
