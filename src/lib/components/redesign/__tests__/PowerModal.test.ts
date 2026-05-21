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

  it('emits shutdown on Shutdown click (M1.D: bare event, converged with SettingsView)', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    await fireEvent.click(container.querySelector('[aria-label="Shutdown"]')!);
    expect(socketEmit).toHaveBeenCalledWith('shutdown');
  });

  it('emits reboot on Reset click (M1.D: bare event, converged with SettingsView)', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    await fireEvent.click(container.querySelector('[aria-label="Reset"]')!);
    expect(socketEmit).toHaveBeenCalledWith('reboot');
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

  it('shows error toast when system:action:error fires and stays open', async () => {
    // Focused unit: the handler renders the toast and leaves the modal open.
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    onHandlers.get('system:action:error')!({ action: 'shutdown', error: 'permission denied' });
    await tick();
    expect(get(powerModalOpen)).toBe(true);
    expect(container.textContent).toContain('Power command failed: permission denied');
  });

  it('end-to-end shutdown-fails: click Shutdown, simulate error, modal stays open with toast', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);

    // (a)+(b) modal is open and Shutdown is clicked
    await fireEvent.click(container.querySelector('[aria-label="Shutdown"]')!);

    // (c) emit was called with shutdown exactly once (M1.D bare event)
    expect(socketEmit).toHaveBeenCalledWith('shutdown');
    expect(socketEmit).toHaveBeenCalledTimes(1);

    // (d) backend reports failure via the captured handler
    onHandlers.get('system:action:error')!({ action: 'shutdown', error: 'permission denied' });
    await tick();

    // (e) modal still open, toast visible, emit count still exactly 1
    expect(get(powerModalOpen)).toBe(true);
    expect(container.querySelector('.error')?.textContent).toContain('Power command failed: permission denied');
    expect(socketEmit).toHaveBeenCalledTimes(1);
  });

  it('falls back to "unknown error" when payload omits error string (no action-name leak)', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    // Backend sends only the action name, no error message.
    onHandlers.get('system:action:error')!({ action: 'shutdown' });
    await tick();
    expect(container.textContent).toContain('Power command failed: unknown error');
    // Crucially: must NOT leak the action name as a fake error message.
    expect(container.textContent).not.toContain('Power command failed: shutdown');
  });

  it('clears stale errorMsg on close so re-opening starts clean', async () => {
    // Open + fail + see toast
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    onHandlers.get('system:action:error')!({ action: 'shutdown', error: 'boom' });
    await tick();
    expect(container.querySelector('.error')).toBeTruthy();

    // Close via backdrop
    await fireEvent.click(container.querySelector('.backdrop')!);
    await tick();
    expect(get(powerModalOpen)).toBe(false);

    // Re-open: stale toast must be gone
    powerModalOpen.set(true);
    await tick();
    expect(container.querySelector('.error')).toBeNull();
  });

  it('Shutdown and Reset buttons carry type="button" (defensive against form nesting)', () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    const shutdown = container.querySelector('[aria-label="Shutdown"]') as HTMLButtonElement;
    const reset = container.querySelector('[aria-label="Reset"]') as HTMLButtonElement;
    expect(shutdown.getAttribute('type')).toBe('button');
    expect(reset.getAttribute('type')).toBe('button');
  });

  it('renders a Cancel button with type="button" when open', () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    const cancel = container.querySelector('[aria-label="Cancel"]') as HTMLButtonElement;
    expect(cancel).toBeTruthy();
    expect(cancel.getAttribute('type')).toBe('button');
  });

  it('Cancel click closes the modal without emitting any socket event', async () => {
    powerModalOpen.set(true);
    const { container } = render(PowerModal);
    await fireEvent.click(container.querySelector('[aria-label="Cancel"]')!);
    expect(get(powerModalOpen)).toBe(false);
    expect(socketEmit).not.toHaveBeenCalled();
  });

  it('ESC key closes the modal when open', async () => {
    powerModalOpen.set(true);
    render(PowerModal);
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(get(powerModalOpen)).toBe(false);
  });

  it('ESC key is a no-op when modal is closed', async () => {
    powerModalOpen.set(false);
    render(PowerModal);
    const before = (modalActions.closePower as ReturnType<typeof vi.fn>).mock.calls.length;
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(get(powerModalOpen)).toBe(false);
    expect((modalActions.closePower as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });

  it('focuses the Shutdown button when the modal opens', async () => {
    const { container } = render(PowerModal);
    powerModalOpen.set(true);
    await tick();
    await tick();
    const shutdown = container.querySelector('[aria-label="Shutdown"]');
    expect(document.activeElement).toBe(shutdown);
  });
});
