import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

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
  return {
    castState,
    castActive: derived(castState, ($s) => $s.active),
    modalActions: { openOutput: vi.fn(), closeOutput: vi.fn(), openPower: vi.fn(), closePower: vi.fn() },
  };
});

vi.mock('$lib/stores/cast', () => ({ castState: mocks.castState, castActive: mocks.castActive }));
vi.mock('$lib/stores/navigation', () => ({ modalActions: mocks.modalActions }));

import OutputButton from '../OutputButton.svelte';

describe('OutputButton', () => {
  beforeEach(() => {
    mocks.modalActions.openOutput.mockClear();
    mocks.castState.update((s) => ({ ...s, active: false, deviceName: '', deviceId: '' }));
  });

  it('names the local DAC when nothing is casting', () => {
    const { container } = render(OutputButton);
    const button = container.querySelector('[data-testid="output-button"]')!;
    expect(button.textContent).toContain('Stellar DAC');
    expect(button.getAttribute('aria-label')).toBe('Output: Stellar DAC');
    expect(button.classList.contains('casting')).toBe(false);
  });

  it('names the device while a session is live', () => {
    mocks.castState.update((s) => ({ ...s, active: true, deviceId: 'hub', deviceName: 'Living Room Display' }));
    const { container } = render(OutputButton);
    const button = container.querySelector('[data-testid="output-button"]')!;
    expect(button.textContent).toContain('Living Room Display');
    expect(button.getAttribute('aria-label')).toBe('Output: Living Room Display');
    expect(button.classList.contains('casting')).toBe(true);
  });

  it('falls back to a generic name when the device reports none', () => {
    mocks.castState.update((s) => ({ ...s, active: true, deviceId: 'hub', deviceName: '' }));
    const { container } = render(OutputButton);
    expect(container.querySelector('[data-testid="output-button"]')!.textContent).toContain('Cast device');
  });

  it('opens the picker on tap', async () => {
    const { container } = render(OutputButton);
    await fireEvent.click(container.querySelector('[data-testid="output-button"]')!);
    expect(mocks.modalActions.openOutput).toHaveBeenCalledTimes(1);
  });
});
