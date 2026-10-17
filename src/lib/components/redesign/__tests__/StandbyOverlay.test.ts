import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get, writable } from 'svelte/store';

const { mockLastPlayed } = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return { mockLastPlayed: writable<Record<string, unknown> | null>(null) };
});

vi.mock('$lib/stores/player', () => ({
  lastPlayedAlbum: mockLastPlayed,
  isPlaying: writable(false)
}));
vi.mock('$lib/stores/device', () => ({ deviceType: writable('lcd-panel') }));

import StandbyOverlay from '../StandbyOverlay.svelte';
import { standbyActive, standbyBrightness, standbyActions } from '$lib/stores/standby';

describe('StandbyOverlay', () => {
  beforeEach(() => {
    standbyActive.set(false);
    standbyBrightness.set(55);
  });

  it('renders nothing while standby is off', () => {
    const { queryByTestId } = render(StandbyOverlay);
    expect(queryByTestId('standby-overlay')).toBeNull();
  });

  it('covers the screen with the departure board once standby is on', async () => {
    const { findByTestId, getByTestId } = render(StandbyOverlay);
    standbyActive.set(true);
    expect(await findByTestId('standby-overlay')).toBeTruthy();
    expect(getByTestId('standby-departure-board')).toBeTruthy();
  });

  it('paints the face at the configured brightness', async () => {
    standbyBrightness.set(20);
    const { findByTestId } = render(StandbyOverlay);
    standbyActive.set(true);
    const overlay = await findByTestId('standby-overlay');
    expect(overlay.getAttribute('style')).toContain('--standby-dim: 0.2');
  });

  it('a touch wakes the screen', async () => {
    const { findByTestId } = render(StandbyOverlay);
    standbyActive.set(true);
    const overlay = await findByTestId('standby-overlay');
    await fireEvent.pointerDown(overlay);
    expect(get(standbyActive)).toBe(false);
  });

  it('a key press wakes the screen', async () => {
    const { findByTestId } = render(StandbyOverlay);
    standbyActive.set(true);
    const overlay = await findByTestId('standby-overlay');
    await fireEvent.keyDown(overlay, { key: 'a' });
    expect(get(standbyActive)).toBe(false);
  });

  it('swallows the waking touch so it cannot reach a control underneath', async () => {
    const { findByTestId } = render(StandbyOverlay);
    standbyActive.set(true);
    const overlay = await findByTestId('standby-overlay');
    const underneath = vi.fn();
    document.body.addEventListener('pointerdown', underneath);
    const event = new Event('pointerdown', { bubbles: true, cancelable: true });
    overlay.dispatchEvent(event);
    document.body.removeEventListener('pointerdown', underneath);
    expect(underneath).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('is reachable and labelled for assistive tech', async () => {
    const { findByTestId } = render(StandbyOverlay);
    standbyActive.set(true);
    const overlay = await findByTestId('standby-overlay');
    expect(overlay.getAttribute('role')).toBe('button');
    expect(overlay.getAttribute('tabindex')).toBe('0');
    expect(overlay.getAttribute('aria-label')).toContain('wake');
  });

  it('exiting standby tears the face back down', async () => {
    const { findByTestId, queryByTestId } = render(StandbyOverlay);
    standbyActive.set(true);
    await findByTestId('standby-overlay');
    standbyActions.exit();
    await new Promise((r) => setTimeout(r, 0));
    expect(queryByTestId('standby-overlay')).toBeNull();
  });
});
