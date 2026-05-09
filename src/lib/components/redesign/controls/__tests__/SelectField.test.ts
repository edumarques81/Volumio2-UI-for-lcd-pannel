import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SelectField from '../SelectField.svelte';

const OPTIONS = [
  { value: 'hdmi', label: 'HDMI Out' },
  { value: 'headphones', label: 'Headphones' },
  { value: 'usb-dac', label: 'USB DAC', disabled: true },
  { value: 'bluetooth', label: 'Bluetooth' },
] as const;

type Device = (typeof OPTIONS)[number]['value'];

const GROUPED_OPTIONS = [
  { value: 'hdmi', label: 'HDMI Out', group: 'Built-in' },
  { value: 'headphones', label: 'Headphones', group: 'Built-in' },
  { value: 'usb-dac', label: 'USB DAC', group: 'External' },
  { value: 'bluetooth', label: 'Bluetooth' },
] as const;

describe('SelectField', () => {
  let onchange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onchange = vi.fn();
  });

  // 1. <select> carries the supplied id
  it('select element carries the supplied id', () => {
    const { container } = render(SelectField, {
      options: OPTIONS,
      value: 'hdmi' as Device,
      onchange,
      id: 'settings-audio-output-device',
    });
    const select = container.querySelector('select');
    expect(select).toBeTruthy();
    expect(select!.getAttribute('id')).toBe('settings-audio-output-device');
  });

  // 2. Renders one <option> per option with correct value + label
  it('renders one option per entry with correct value and label text', () => {
    const { container } = render(SelectField, {
      options: OPTIONS,
      value: 'hdmi' as Device,
      onchange,
      id: 'settings-audio-output-device',
    });
    const opts = container.querySelectorAll('select option');
    // 4 data options, no placeholder
    expect(opts).toHaveLength(4);
    expect((opts[0] as HTMLOptionElement).value).toBe('hdmi');
    expect(opts[0].textContent?.trim()).toBe('HDMI Out');
    expect((opts[1] as HTMLOptionElement).value).toBe('headphones');
    expect(opts[1].textContent?.trim()).toBe('Headphones');
  });

  // 3. Renders <optgroup> wrappers when options have group set; ungrouped options stay outside
  it('wraps grouped options in optgroup and leaves ungrouped options outside', () => {
    const { container } = render(SelectField, {
      options: GROUPED_OPTIONS,
      value: 'hdmi',
      onchange,
      id: 'settings-audio-output-device',
    });
    const groups = container.querySelectorAll('optgroup');
    expect(groups).toHaveLength(2);
    expect(groups[0].getAttribute('label')).toBe('Built-in');
    expect(groups[0].querySelectorAll('option')).toHaveLength(2);
    expect(groups[1].getAttribute('label')).toBe('External');
    expect(groups[1].querySelectorAll('option')).toHaveLength(1);

    // "bluetooth" has no group — it should be a direct child of select, outside any optgroup
    const directOptions = Array.from(container.querySelectorAll('select > option'));
    expect(directOptions.some((o) => (o as HTMLOptionElement).value === 'bluetooth')).toBe(true);
  });

  // 4. Disabled option renders with disabled attribute
  it('disabled option renders with the disabled attribute', () => {
    const { container } = render(SelectField, {
      options: OPTIONS,
      value: 'hdmi' as Device,
      onchange,
      id: 'settings-audio-output-device',
    });
    const opts = container.querySelectorAll('select option');
    const usbOpt = Array.from(opts).find((o) => (o as HTMLOptionElement).value === 'usb-dac');
    expect(usbOpt).toBeTruthy();
    expect((usbOpt as HTMLOptionElement).disabled).toBe(true);
  });

  // 5. Selecting an option fires onchange(next)
  it('fires onchange with the new value when selection changes', async () => {
    const { container } = render(SelectField, {
      options: OPTIONS,
      value: 'hdmi' as Device,
      onchange,
      id: 'settings-audio-output-device',
    });
    const select = container.querySelector('select')!;
    await fireEvent.change(select, { target: { value: 'headphones' } });
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange).toHaveBeenCalledWith('headphones');
  });

  // 6. value === null and placeholder set → first option is the placeholder, disabled and selected
  it('renders a disabled selected placeholder option when value is null and placeholder is set', () => {
    const { container } = render(SelectField, {
      options: OPTIONS,
      value: null,
      onchange,
      id: 'settings-audio-output-device',
      placeholder: 'Select a device',
    });
    const opts = container.querySelectorAll('select option');
    const firstOpt = opts[0] as HTMLOptionElement;
    expect(firstOpt.textContent?.trim()).toBe('Select a device');
    expect(firstOpt.disabled).toBe(true);
    expect(firstOpt.selected).toBe(true);
    expect(firstOpt.value).toBe('');
  });

  // 7. disabled=true on the field disables the <select> element
  it('disabled prop disables the select element', () => {
    const { container } = render(SelectField, {
      options: OPTIONS,
      value: 'hdmi' as Device,
      onchange,
      id: 'settings-audio-output-device',
      disabled: true,
    });
    const select = container.querySelector('select')!;
    expect(select.disabled).toBe(true);
  });

  // 8. <label> rendered with for={id} when label prop is set
  it('renders a label element with for attribute matching the id when label prop is set', () => {
    const { container } = render(SelectField, {
      options: OPTIONS,
      value: 'hdmi' as Device,
      onchange,
      id: 'settings-audio-output-device',
      label: 'Audio Output Device',
    });
    const label = container.querySelector('label');
    expect(label).toBeTruthy();
    expect(label!.getAttribute('for')).toBe('settings-audio-output-device');
    expect(label!.textContent?.trim()).toBe('Audio Output Device');
  });

  // 9. When no label is set, aria-label is applied to the <select> using ariaLabel prop
  it('applies ariaLabel to the select when no visible label is set', () => {
    const { container } = render(SelectField, {
      options: OPTIONS,
      value: 'hdmi' as Device,
      onchange,
      id: 'settings-audio-output-device',
      ariaLabel: 'Audio output device',
    });
    const label = container.querySelector('label');
    expect(label).toBeNull();
    const select = container.querySelector('select')!;
    expect(select.getAttribute('aria-label')).toBe('Audio output device');
  });

  // 10. Controlled DOM contract — initial value drives the select's DOM value.
  it('reflects the value prop on the underlying <select>.value at mount', () => {
    const { container } = render(SelectField, {
      options: OPTIONS,
      value: 'headphones' as Device,
      onchange,
      id: 'settings-audio-output-device',
    });
    const select = container.querySelector('select')!;
    expect(select.value).toBe('headphones');
  });

  // 11. When the parent's value prop changes, the <select>.value follows it.
  // This is the new contract that audioDevices rollback relies on: if the
  // store keeps the prior selection (because the backend rejected the new
  // pick), the visible <select> rolls back too.
  it('updates the <select>.value when the value prop changes', async () => {
    const { container, rerender } = render(SelectField, {
      options: OPTIONS,
      value: 'hdmi' as Device,
      onchange,
      id: 'settings-audio-output-device',
    });
    const select = container.querySelector('select')!;
    expect(select.value).toBe('hdmi');

    await rerender({
      options: OPTIONS,
      value: 'bluetooth' as Device,
      onchange,
      id: 'settings-audio-output-device',
    });
    expect(select.value).toBe('bluetooth');
  });
});
