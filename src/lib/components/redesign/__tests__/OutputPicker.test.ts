import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { tick } from 'svelte';

const mocks = await vi.hoisted(async () => {
  const { writable, derived } = await import('svelte/store');
  const castState = writable({
    active: false,
    deviceId: '',
    deviceName: '',
    status: 'stop' as const,
    title: '', artist: '', album: '', albumart: '', uri: '',
    seek: 0, duration: 0, volume: 0, mute: false,
    queueIndex: 0, queueLength: 0,
  });
  const castDevices = writable<any[]>([]);
  const castDiscovering = writable(false);
  const outputPickerOpen = writable(false);
  return {
    castState,
    castActive: derived(castState, ($s) => $s.active),
    castDevices,
    castDiscovering,
    outputPickerOpen,
    castActions: {
      listDevices: vi.fn(async () => get(castDevices)),
      connect: vi.fn(async () => ({ ok: true })),
      disconnect: vi.fn(async () => ({ ok: true })),
      stop: vi.fn(async () => ({ ok: true })),
    },
    modalActions: {
      openOutput: vi.fn(() => outputPickerOpen.set(true)),
      closeOutput: vi.fn(() => outputPickerOpen.set(false)),
    },
  };
});

vi.mock('$lib/stores/cast', () => ({
  castState: mocks.castState,
  castActive: mocks.castActive,
  castDevices: mocks.castDevices,
  castDiscovering: mocks.castDiscovering,
  castActions: mocks.castActions,
}));
vi.mock('$lib/stores/navigation', () => ({
  outputPickerOpen: mocks.outputPickerOpen,
  modalActions: mocks.modalActions,
}));

import OutputPicker from '../OutputPicker.svelte';

const HUB = { id: 'hub', name: 'Living Room Display', model: 'Google Nest Hub' };
const GROUP = { id: 'grp', name: 'Whole House', isGroup: true };

/** Flush the awaited action chain inside a click handler. */
async function settle() {
  await tick();
  await Promise.resolve();
  await tick();
}

describe('OutputPicker', () => {
  beforeEach(() => {
    mocks.outputPickerOpen.set(false);
    mocks.castDevices.set([]);
    mocks.castDiscovering.set(false);
    mocks.castState.set({
      active: false, deviceId: '', deviceName: '', status: 'stop',
      title: '', artist: '', album: '', albumart: '', uri: '',
      seek: 0, duration: 0, volume: 0, mute: false, queueIndex: 0, queueLength: 0,
    });
    Object.values(mocks.castActions).forEach((fn: any) => fn.mockClear());
    mocks.castActions.connect.mockImplementation(async () => ({ ok: true }));
    mocks.castActions.stop.mockImplementation(async () => ({ ok: true }));
    mocks.castActions.disconnect.mockImplementation(async () => ({ ok: true }));
    mocks.modalActions.closeOutput.mockClear();
  });

  it('renders nothing while closed', () => {
    const { container } = render(OutputPicker);
    expect(container.querySelector('[data-testid="output-picker"]')).toBeNull();
    expect(mocks.castActions.listDevices).not.toHaveBeenCalled();
  });

  it('browses for devices on open', async () => {
    const { container } = render(OutputPicker);
    mocks.outputPickerOpen.set(true);
    await tick();
    expect(container.querySelector('[data-testid="output-picker"]')).toBeTruthy();
    expect(mocks.castActions.listDevices).toHaveBeenCalledTimes(1);
  });

  it('always offers the local DAC, ticked when nothing is casting', async () => {
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    const local = container.querySelector('[data-testid="output-row-local"]')!;
    expect(local.textContent).toContain('Stellar DAC');
    expect(local.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-testid="output-row-local-tick"]')).toBeTruthy();
  });

  it('lists discovered devices, labelling groups', async () => {
    mocks.castDevices.set([HUB, GROUP]);
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    const hub = container.querySelector('[data-testid="output-row-hub"]')!;
    expect(hub.textContent).toContain('Living Room Display');
    expect(hub.textContent).toContain('Google Nest Hub');
    expect(container.querySelector('[data-testid="output-row-grp"]')!.textContent).toContain('Speaker group');
  });

  it('ticks the connected device instead of the DAC', async () => {
    mocks.castDevices.set([HUB]);
    mocks.castState.update((s) => ({ ...s, active: true, deviceId: 'hub', deviceName: HUB.name }));
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    expect(container.querySelector('[data-testid="output-row-local"]')!.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-testid="output-row-hub"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('connects on tapping a device and closes', async () => {
    mocks.castDevices.set([HUB]);
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    await fireEvent.click(container.querySelector('[data-testid="output-row-hub"]')!);
    await settle();
    expect(mocks.castActions.connect).toHaveBeenCalledWith('hub');
    expect(mocks.modalActions.closeOutput).toHaveBeenCalled();
  });

  it('keeps the picker open and shows why when connect fails', async () => {
    mocks.castDevices.set([HUB]);
    mocks.castActions.connect.mockImplementation(async () => ({ ok: false, error: 'dial tcp: timeout' }));
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    await fireEvent.click(container.querySelector('[data-testid="output-row-hub"]')!);
    await settle();
    expect(container.querySelector('[data-testid="output-picker-error"]')!.textContent).toContain('dial tcp: timeout');
    expect(mocks.modalActions.closeOutput).not.toHaveBeenCalled();
  });

  it('stops casting when the local DAC is picked', async () => {
    mocks.castState.update((s) => ({ ...s, active: true, deviceId: 'hub', deviceName: HUB.name }));
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    await fireEvent.click(container.querySelector('[data-testid="output-row-local"]')!);
    await settle();
    // Picking the DAC must silence the device, not merely hand it over.
    expect(mocks.castActions.stop).toHaveBeenCalledTimes(1);
    expect(mocks.castActions.disconnect).not.toHaveBeenCalled();
    expect(mocks.modalActions.closeOutput).toHaveBeenCalled();
  });

  it('does not emit anything when the DAC is already the output', async () => {
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    await fireEvent.click(container.querySelector('[data-testid="output-row-local"]')!);
    await settle();
    expect(mocks.castActions.stop).not.toHaveBeenCalled();
    expect(mocks.modalActions.closeOutput).toHaveBeenCalled();
  });

  it('does not reconnect when the already-selected device is tapped', async () => {
    mocks.castDevices.set([HUB]);
    mocks.castState.update((s) => ({ ...s, active: true, deviceId: 'hub', deviceName: HUB.name }));
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    await fireEvent.click(container.querySelector('[data-testid="output-row-hub"]')!);
    await settle();
    expect(mocks.castActions.connect).not.toHaveBeenCalled();
    expect(mocks.modalActions.closeOutput).toHaveBeenCalled();
  });

  it('offers leave-playing only while a session is live', async () => {
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    expect(container.querySelector('[data-testid="output-picker-leave-playing"]')).toBeNull();

    mocks.castState.update((s) => ({ ...s, active: true, deviceId: 'hub', deviceName: HUB.name }));
    await tick();
    const leave = container.querySelector('[data-testid="output-picker-leave-playing"]')!;
    expect(leave.textContent).toContain('Living Room Display');
    await fireEvent.click(leave);
    await settle();
    expect(mocks.castActions.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.castActions.stop).not.toHaveBeenCalled();
  });

  it('re-browses on the refresh button', async () => {
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    mocks.castActions.listDevices.mockClear();
    await fireEvent.click(container.querySelector('[data-testid="output-picker-refresh"]')!);
    expect(mocks.castActions.listDevices).toHaveBeenCalledTimes(1);
  });

  it('distinguishes searching from nothing found', async () => {
    mocks.castDiscovering.set(true);
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    expect(container.querySelector('[data-testid="output-picker-empty"]')!.textContent).toContain('Searching');

    mocks.castDiscovering.set(false);
    await tick();
    expect(container.querySelector('[data-testid="output-picker-empty"]')!.textContent).toContain('No Cast devices found');

    mocks.castDevices.set([HUB]);
    await tick();
    expect(container.querySelector('[data-testid="output-picker-empty"]')).toBeNull();
  });

  it('closes on the backdrop, Done, and Escape', async () => {
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();

    await fireEvent.click(container.querySelector('[data-testid="output-picker-backdrop"]')!);
    expect(mocks.modalActions.closeOutput).toHaveBeenCalledTimes(1);

    mocks.outputPickerOpen.set(true);
    await tick();
    await fireEvent.click(container.querySelector('[data-testid="output-picker-done"]')!);
    expect(mocks.modalActions.closeOutput).toHaveBeenCalledTimes(2);

    mocks.outputPickerOpen.set(true);
    await tick();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(mocks.modalActions.closeOutput).toHaveBeenCalledTimes(3);
  });

  it('clears a stale error when the picker is reopened', async () => {
    mocks.castDevices.set([HUB]);
    mocks.castActions.connect.mockImplementation(async () => ({ ok: false, error: 'boom' }));
    mocks.outputPickerOpen.set(true);
    const { container } = render(OutputPicker);
    await tick();
    await fireEvent.click(container.querySelector('[data-testid="output-row-hub"]')!);
    await settle();
    expect(container.querySelector('[data-testid="output-picker-error"]')).toBeTruthy();

    mocks.outputPickerOpen.set(false);
    await tick();
    mocks.outputPickerOpen.set(true);
    await tick();
    expect(container.querySelector('[data-testid="output-picker-error"]')).toBeNull();
  });
});
