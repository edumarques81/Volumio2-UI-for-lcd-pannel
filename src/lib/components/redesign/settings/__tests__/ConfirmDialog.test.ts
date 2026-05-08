import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

import ConfirmDialog from '../ConfirmDialog.svelte';

describe('ConfirmDialog', () => {
  let onconfirm: ReturnType<typeof vi.fn>;
  let oncancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onconfirm = vi.fn();
    oncancel = vi.fn();
  });

  // Test 1: open=false renders nothing
  it('renders nothing when open is false', () => {
    const { queryByRole } = render(ConfirmDialog, {
      props: { open: false, title: 'Test', onconfirm, oncancel },
    });
    expect(queryByRole('dialog')).toBeNull();
  });

  // Test 2: open=true renders dialog with title and default labels
  it('renders dialog with title and default labels when open is true', () => {
    const { getByRole, getByText } = render(ConfirmDialog, {
      props: { open: true, title: 'Reboot Stellar?', onconfirm, oncancel },
    });
    expect(getByRole('dialog')).toBeTruthy();
    expect(getByText('Reboot Stellar?')).toBeTruthy();
    expect(getByText('Confirm')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  // Test 3: custom confirmLabel and cancelLabel are honored
  it('renders custom confirmLabel and cancelLabel', () => {
    const { getByText } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Shutdown?',
        confirmLabel: 'Shut Down',
        cancelLabel: 'Go Back',
        onconfirm,
        oncancel,
      },
    });
    expect(getByText('Shut Down')).toBeTruthy();
    expect(getByText('Go Back')).toBeTruthy();
  });

  // Test 4: optional message is rendered when present
  it('renders optional message when provided', () => {
    const { getByText } = render(ConfirmDialog, {
      props: {
        open: true,
        title: 'Reboot?',
        message: 'The system will restart.',
        onconfirm,
        oncancel,
      },
    });
    expect(getByText('The system will restart.')).toBeTruthy();
  });

  // Test 5: aria-modal="true" and role="dialog"
  it('has aria-modal="true" and role="dialog" on the root element', () => {
    const { getByRole } = render(ConfirmDialog, {
      props: { open: true, title: 'Test', onconfirm, oncancel },
    });
    const dialog = getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  // Test 6: aria-labelledby points to the title's id
  it('has aria-labelledby pointing to the title element id', () => {
    const { getByRole, getByText } = render(ConfirmDialog, {
      props: { open: true, title: 'Delete Item?', onconfirm, oncancel },
    });
    const dialog = getByRole('dialog');
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(labelledById).toBeTruthy();
    const titleEl = getByText('Delete Item?');
    expect(titleEl.id).toBe(labelledById);
  });

  // Test 7: confirm button click calls onconfirm once, oncancel not called
  it('clicking confirm button calls onconfirm once and not oncancel', async () => {
    const { getByText } = render(ConfirmDialog, {
      props: { open: true, title: 'Confirm?', onconfirm, oncancel },
    });
    await fireEvent.click(getByText('Confirm'));
    expect(onconfirm).toHaveBeenCalledTimes(1);
    expect(oncancel).not.toHaveBeenCalled();
  });

  // Test 8: cancel button click calls oncancel once, onconfirm not called
  it('clicking cancel button calls oncancel once and not onconfirm', async () => {
    const { getByText } = render(ConfirmDialog, {
      props: { open: true, title: 'Confirm?', onconfirm, oncancel },
    });
    await fireEvent.click(getByText('Cancel'));
    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(onconfirm).not.toHaveBeenCalled();
  });

  // Test 9: click on backdrop calls oncancel
  it('clicking on the backdrop calls oncancel', async () => {
    const { container } = render(ConfirmDialog, {
      props: { open: true, title: 'Confirm?', onconfirm, oncancel },
    });
    const backdrop = container.querySelector('.backdrop') as HTMLElement;
    expect(backdrop).toBeTruthy();
    await fireEvent.click(backdrop);
    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(onconfirm).not.toHaveBeenCalled();
  });

  // Test 10: click inside body (not on button) does NOT trigger cancel
  it('clicking inside body (not on buttons) does not trigger cancel', async () => {
    const { container } = render(ConfirmDialog, {
      props: { open: true, title: 'Confirm?', message: 'Are you sure?', onconfirm, oncancel },
    });
    const body = container.querySelector('.dialog-body') as HTMLElement;
    expect(body).toBeTruthy();
    await fireEvent.click(body);
    expect(oncancel).not.toHaveBeenCalled();
    expect(onconfirm).not.toHaveBeenCalled();
  });

  // Test 11: ESC keydown while open calls oncancel
  it('pressing ESC while open calls oncancel', async () => {
    render(ConfirmDialog, {
      props: { open: true, title: 'Confirm?', onconfirm, oncancel },
    });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(onconfirm).not.toHaveBeenCalled();
  });

  // Test 12: ESC keydown while closed is a no-op
  it('pressing ESC while closed is a no-op', async () => {
    render(ConfirmDialog, {
      props: { open: false, title: 'Confirm?', onconfirm, oncancel },
    });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(oncancel).not.toHaveBeenCalled();
    expect(onconfirm).not.toHaveBeenCalled();
  });

  // Test 13: destructive=true applies destructive class to confirm button
  it('destructive=true adds destructive class to confirm button', () => {
    const { getByText } = render(ConfirmDialog, {
      props: { open: true, title: 'Delete?', destructive: true, onconfirm, oncancel },
    });
    const confirmBtn = getByText('Confirm');
    expect(confirmBtn.classList.contains('destructive')).toBe(true);
  });

  // Test 14: after open flips false->true, cancel button receives focus
  it('focuses the cancel button when open flips from false to true', async () => {
    const { container, rerender } = render(ConfirmDialog, {
      props: { open: false, title: 'Confirm?', onconfirm, oncancel },
    });
    await rerender({ open: true, title: 'Confirm?', onconfirm, oncancel });
    await tick();
    await tick();
    const cancelBtn = container.querySelector('button.cancel') as HTMLElement;
    expect(cancelBtn).toBeTruthy();
    expect(document.activeElement).toBe(cancelBtn);
  });
});
