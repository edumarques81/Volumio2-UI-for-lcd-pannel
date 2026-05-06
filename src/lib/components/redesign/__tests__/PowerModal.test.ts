import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { tick } from 'svelte';

const { powerModalOpen, modalActions, onHandlers, socketEmit } = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  const open = writable(false);
  const handlers = new Map<string, (p: any) => void>();
  return {
    powerModalOpen: open,
    modalActions: {
      openPower:  vi.fn(() => open.set(true)),
      closePower: vi.fn(() => open.set(false)),
    },
    onHandlers: handlers,
    socketEmit: vi.fn(),
  };
});

vi.mock('$lib/stores/navigation', () => ({ powerModalOpen, modalActions }));
vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: socketEmit,
    on: vi.fn((event: string, fn: (p: any) => void) => {
      onHandlers.set(event, fn);
      return () => onHandlers.delete(event);
    }),
  },
}));

import PowerModal from '../PowerModal.svelte';

describe('PowerModal', () => {
  beforeEach(() => {
    powerModalOpen.set(false);
    socketEmit.mockClear();
    onHandlers.clear();
  });

  it('renders nothing when closed', () => {
    const { container } = render(PowerModal);
    expect(container.querySelector('.power-modal')).toBeNull();
  });

  it('renders Shutdown and Reset buttons when open', () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    expect(container.querySelector('[aria-label="Shutdown"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Reset"]')).toBeTruthy();
  });

  it('emits system:shutdown on Shutdown click', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    await fireEvent.click(container.querySelector('[aria-label="Shutdown"]')!);
    expect(socketEmit).toHaveBeenCalledWith('system:shutdown');
  });

  it('emits system:reboot on Reset click', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    await fireEvent.click(container.querySelector('[aria-label="Reset"]')!);
    expect(socketEmit).toHaveBeenCalledWith('system:reboot');
  });

  it('closes when backdrop is clicked (tap-outside)', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    await fireEvent.click(container.querySelector('.backdrop')!);
    expect(get(powerModalOpen)).toBe(false);
  });

  it('does NOT close when the modal body itself is clicked', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    await fireEvent.click(container.querySelector('.body')!);
    expect(get(powerModalOpen)).toBe(true);
  });

  it('shows error toast when system:action:error fires for shutdown and stays open', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    onHandlers.get('system:action:error')!({ action: 'shutdown', error: 'permission denied' });
    await tick();
    expect(get(powerModalOpen)).toBe(true);
    expect(container.textContent).toContain('Power command failed');
  });
});
