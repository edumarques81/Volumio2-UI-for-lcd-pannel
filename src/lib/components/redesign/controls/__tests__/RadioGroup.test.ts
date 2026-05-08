import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import RadioGroup from '../RadioGroup.svelte';

const OPTIONS = [
  { value: 'native', label: 'Native DSD', description: 'Pass DSD bitstream directly to the DAC' },
  { value: 'dop', label: 'DSD over PCM', description: 'Wrap DSD in PCM frames (wider DAC support)' },
  { value: 'pcm', label: 'Convert to PCM' },
] as const;

type DsdMode = (typeof OPTIONS)[number]['value'];

describe('RadioGroup', () => {
  let onchange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onchange = vi.fn();
  });

  // 1. Renders one role=radio per option with correct labels and descriptions
  it('renders one radio button per option with correct labels', () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
    });
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(3);
    expect(radios[0].textContent).toContain('Native DSD');
    expect(radios[1].textContent).toContain('DSD over PCM');
    expect(radios[2].textContent).toContain('Convert to PCM');
  });

  // 1b. Descriptions rendered when supplied
  it('renders descriptions when supplied and omits them when absent', () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
    });
    const descs = container.querySelectorAll('[data-testid="radio-description"]');
    // Only first two options have descriptions
    expect(descs).toHaveLength(2);
    expect(descs[0].textContent).toContain('Pass DSD bitstream directly to the DAC');
    expect(descs[1].textContent).toContain('Wrap DSD in PCM frames');
  });

  // 2. Selected has aria-checked="true", others "false"
  it('marks selected option aria-checked=true and others false', () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'dop',
      onchange,
      ariaLabel: 'DSD mode',
    });
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios[0].getAttribute('aria-checked')).toBe('false');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(radios[2].getAttribute('aria-checked')).toBe('false');
  });

  // 3. Selected has tabindex=0, others tabindex=-1
  it('gives selected option tabindex=0 and others tabindex=-1', () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'pcm',
      onchange,
      ariaLabel: 'DSD mode',
    });
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios[0].getAttribute('tabindex')).toBe('-1');
    expect(radios[1].getAttribute('tabindex')).toBe('-1');
    expect(radios[2].getAttribute('tabindex')).toBe('0');
  });

  // 4. Click on an unselected option fires onchange(next)
  it('fires onchange with the clicked option value', async () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
    });
    const radios = container.querySelectorAll('[role="radio"]');
    await fireEvent.click(radios[1]);
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange).toHaveBeenCalledWith('dop');
  });

  // 5. ArrowDown (default vertical) on selected fires onchange with next option
  it('ArrowDown moves selection to next option in vertical orientation', async () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(onchange).toHaveBeenCalledWith('dop');
  });

  // 6. ArrowUp wraps from first to last
  it('ArrowUp from first option wraps to last', async () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'ArrowUp' });
    expect(onchange).toHaveBeenCalledWith('pcm');
  });

  // 7. Home fires onchange(firstOption.value)
  it('Home key selects first option', async () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'pcm',
      onchange,
      ariaLabel: 'DSD mode',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'Home' });
    expect(onchange).toHaveBeenCalledWith('native');
  });

  // 8. End fires onchange(lastOption.value)
  it('End key selects last option', async () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'End' });
    expect(onchange).toHaveBeenCalledWith('pcm');
  });

  // 9. orientation='horizontal' makes ArrowRight advance; ArrowDown is also treated as ArrowRight
  // (both horizontal axes advance in horizontal mode; vertical arrows map to horizontal navigation)
  it('ArrowRight advances selection in horizontal orientation', async () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
      orientation: 'horizontal',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onchange).toHaveBeenCalledWith('dop');
  });

  it('ArrowDown is a no-op in horizontal orientation', async () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
      orientation: 'horizontal',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(onchange).not.toHaveBeenCalled();
  });

  // 10. disabled=true blocks all interactions
  it('disabled prop makes clicks and key events no-ops', async () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
      disabled: true,
    });
    const radios = container.querySelectorAll('[role="radio"]');
    await fireEvent.click(radios[1]);
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(onchange).not.toHaveBeenCalled();
  });

  // 11. Description text rendered when supplied; absent when not
  it('omits description element when option has no description', () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'pcm',
      onchange,
      ariaLabel: 'DSD mode',
    });
    // pcm option (index 2) has no description
    const radios = container.querySelectorAll('[role="radio"]');
    const pcmRow = radios[2];
    const desc = pcmRow.querySelector('[data-testid="radio-description"]');
    expect(desc).toBeNull();
  });

  // Root element attributes
  it('root container has role=radiogroup with supplied aria-label and id', () => {
    const { container } = render(RadioGroup, {
      options: OPTIONS,
      value: 'native',
      onchange,
      ariaLabel: 'DSD mode',
      id: 'dsd-mode-group',
    });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).toBeTruthy();
    expect(group!.getAttribute('aria-label')).toBe('DSD mode');
    expect(group!.getAttribute('id')).toBe('dsd-mode-group');
    expect(group!.getAttribute('aria-orientation')).toBe('vertical');
  });
});
