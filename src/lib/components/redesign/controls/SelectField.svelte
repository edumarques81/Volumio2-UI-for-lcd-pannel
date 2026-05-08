<script lang="ts">
  export interface SelectFieldOption<T extends string = string> {
    value: T;
    label: string;
    disabled?: boolean;
    group?: string;
  }

  interface SelectFieldProps<T extends string = string> {
    options: ReadonlyArray<SelectFieldOption<T>>;
    value: T | null;
    onchange: (next: T) => void;
    id: string;
    label?: string;
    ariaLabel?: string;
    placeholder?: string;
    disabled?: boolean;
  }

  const {
    options,
    value,
    onchange,
    id,
    label = undefined,
    ariaLabel = undefined,
    placeholder = undefined,
    disabled = false,
  }: SelectFieldProps = $props();

  // Effective aria-label: only applied when no visible label is rendered
  const effectiveAriaLabel = $derived(label ? undefined : ariaLabel);

  // Build group structure: collect unique group names in order of first appearance
  type GroupedSection =
    | { kind: 'group'; name: string; items: ReadonlyArray<SelectFieldOption> }
    | { kind: 'option'; item: SelectFieldOption };

  const sections = $derived((): GroupedSection[] => {
    const result: GroupedSection[] = [];
    const groupMap = new Map<string, SelectFieldOption[]>();

    for (const opt of options) {
      if (opt.group) {
        if (!groupMap.has(opt.group)) {
          groupMap.set(opt.group, []);
          result.push({ kind: 'group', name: opt.group, items: groupMap.get(opt.group)! });
        }
        groupMap.get(opt.group)!.push(opt);
      } else {
        result.push({ kind: 'option', item: opt });
      }
    }
    return result;
  });

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    onchange(target.value as Parameters<typeof onchange>[0]);
  }
</script>

<div class="select-field-wrapper">
  {#if label}
    <label class="select-label" for={id}>{label}</label>
  {/if}
  <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
  <div class="select-shell" class:disabled>
    <select
      id={id}
      aria-label={effectiveAriaLabel}
      {disabled}
      class="select-native"
      onchange={handleChange}
    >
      {#if value === null && placeholder}
        <option value="" disabled selected>{placeholder}</option>
      {/if}
      {#each sections() as section}
        {#if section.kind === 'group'}
          <optgroup label={section.name}>
            {#each section.items as opt}
              <option value={opt.value} disabled={opt.disabled ?? false} selected={opt.value === value}>
                {opt.label}
              </option>
            {/each}
          </optgroup>
        {:else}
          <option
            value={section.item.value}
            disabled={section.item.disabled ?? false}
            selected={section.item.value === value}
          >
            {section.item.label}
          </option>
        {/if}
      {/each}
    </select>
  </div>
</div>

<style>
  .select-field-wrapper {
    display: flex;
    flex-direction: column;
  }

  .select-label {
    display: block;
    color: var(--color-text-secondary);
    font-size: 13px;
    margin-bottom: 4px;
  }

  .select-shell {
    position: relative;
    display: flex;
    align-items: center;
  }

  .select-shell::after {
    content: '';
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23c9a961' d='M8 11L2 5h12z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    pointer-events: none;
  }

  .select-shell.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .select-native {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    background: var(--color-bg-base);
    color: var(--color-text-primary);
    border: 1px solid var(--color-text-secondary);
    border-radius: var(--radius-card);
    min-height: var(--hit-target-min);
    padding: 8px 32px 8px 12px;
    font-size: 16px;
    cursor: pointer;
  }

  .select-native:focus {
    outline: 2px solid var(--color-accent-bright);
    outline-offset: 2px;
  }

  .select-native option:disabled {
    color: #666;
  }
</style>
