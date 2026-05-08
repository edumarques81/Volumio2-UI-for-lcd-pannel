import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SegmentedControl from '../SegmentedControl.svelte';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'nas', label: 'NAS' },
  { value: 'local', label: 'Local' },
  { value: 'usb', label: 'USB' },
] as const;

type Scope = (typeof OPTIONS)[number]['value'];

describe('SegmentedControl', () => {
  let onchange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onchange = vi.fn();
  });

  // 1. Renders one role=radio per option with correct labels
  it('renders one radio button per option with correct aria-labels', () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'all',
      onchange,
      ariaLabel: 'Library scope',
    });
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(4);
    expect(radios[0].getAttribute('aria-label')).toBe('All');
    expect(radios[1].getAttribute('aria-label')).toBe('NAS');
    expect(radios[2].getAttribute('aria-label')).toBe('Local');
    expect(radios[3].getAttribute('aria-label')).toBe('USB');
  });

  // 2. Selected option has aria-checked="true", others "false"
  it('marks selected option aria-checked=true and others false', () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'nas',
      onchange,
      ariaLabel: 'Library scope',
    });
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios[0].getAttribute('aria-checked')).toBe('false');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(radios[2].getAttribute('aria-checked')).toBe('false');
    expect(radios[3].getAttribute('aria-checked')).toBe('false');
  });

  // 3. Selected option has tabindex=0, others tabindex=-1
  it('gives selected option tabindex=0 and others tabindex=-1', () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'local',
      onchange,
      ariaLabel: 'Library scope',
    });
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios[0].getAttribute('tabindex')).toBe('-1');
    expect(radios[1].getAttribute('tabindex')).toBe('-1');
    expect(radios[2].getAttribute('tabindex')).toBe('0');
    expect(radios[3].getAttribute('tabindex')).toBe('-1');
  });

  // 4. Click on an unselected segment fires onchange with that option's value
  it('fires onchange with the clicked option value', async () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'all',
      onchange,
      ariaLabel: 'Library scope',
    });
    const radios = container.querySelectorAll('[role="radio"]');
    await fireEvent.click(radios[2]);
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange).toHaveBeenCalledWith('local');
  });

  // 5. Click on the already-selected segment does NOT fire onchange
  it('does not fire onchange when clicking the already-selected segment', async () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'all',
      onchange,
      ariaLabel: 'Library scope',
    });
    const radios = container.querySelectorAll('[role="radio"]');
    await fireEvent.click(radios[0]);
    expect(onchange).not.toHaveBeenCalled();
  });

  // 6. ArrowRight on focused selected segment fires onchange with next option's value
  it('ArrowRight moves selection to next option', async () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'all',
      onchange,
      ariaLabel: 'Library scope',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onchange).toHaveBeenCalledWith('nas');
  });

  // 7. ArrowLeft wraps from first to last
  it('ArrowLeft from first option wraps to last', async () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'all',
      onchange,
      ariaLabel: 'Library scope',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onchange).toHaveBeenCalledWith('usb');
  });

  // 8. Home fires onchange with first option's value when not already first
  it('Home key selects first option', async () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'usb',
      onchange,
      ariaLabel: 'Library scope',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'Home' });
    expect(onchange).toHaveBeenCalledWith('all');
  });

  // 9. End fires onchange with last option's value when not already last
  it('End key selects last option', async () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'all',
      onchange,
      ariaLabel: 'Library scope',
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'End' });
    expect(onchange).toHaveBeenCalledWith('usb');
  });

  // 10. disabled=true makes clicks and keypresses no-ops
  it('disabled prop makes clicks and key events no-ops', async () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'all',
      onchange,
      ariaLabel: 'Library scope',
      disabled: true,
    });
    const radios = container.querySelectorAll('[role="radio"]');
    await fireEvent.click(radios[1]);
    const group = container.querySelector('[role="radiogroup"]')!;
    await fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onchange).not.toHaveBeenCalled();
  });

  // 11. Root container exposes role=radiogroup with the supplied aria-label
  it('root container has role=radiogroup with supplied aria-label', () => {
    const { container } = render(SegmentedControl, {
      options: OPTIONS,
      value: 'all',
      onchange,
      ariaLabel: 'Library scope',
      id: 'scope-control',
    });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).toBeTruthy();
    expect(group!.getAttribute('aria-label')).toBe('Library scope');
    expect(group!.getAttribute('id')).toBe('scope-control');
  });
});
