import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';

vi.mock('$lib/stores/navigation', () => {
  const currentView = writable<'player' | 'library'>('player');
  const refreshInProgress = writable<boolean>(false);
  return {
    currentView,
    refreshInProgress,
    viewActions: {
      goToPlayer: vi.fn(() => currentView.set('player')),
      goToLibrary: vi.fn(() => currentView.set('library')),
      tapVuMeter: vi.fn(),
      tapSettings: vi.fn(),
      tapRefresh: vi.fn(),
      tapPower: vi.fn(),
    },
  };
});

import NavColumn from '../NavColumn.svelte';
import { viewActions, currentView, refreshInProgress } from '$lib/stores/navigation';

describe('NavColumn', () => {
  it('renders 6 cells with aria-labels Player/Library/VU Meter/Refresh/Settings/Power', () => {
    const { container } = render(NavColumn);
    expect(container.querySelector('[aria-label="Player"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Library"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="VU Meter"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Refresh"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Settings"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Power"]')).toBeTruthy();
  });

  it('Player cell carries .active class when currentView === "player"', () => {
    currentView.set('player');
    const { container } = render(NavColumn);
    const playerCell = container.querySelector('[aria-label="Player"]') as HTMLElement;
    expect(playerCell.classList.contains('active')).toBe(true);
  });

  it('Library cell carries .active class when currentView === "library"', () => {
    currentView.set('library');
    const { container } = render(NavColumn);
    const libCell = container.querySelector('[aria-label="Library"]') as HTMLElement;
    expect(libCell.classList.contains('active')).toBe(true);
  });

  it('VU Meter, Refresh, Settings, Power are NEVER active even when tapped', async () => {
    const { container } = render(NavColumn);
    await fireEvent.click(container.querySelector('[aria-label="VU Meter"]')!);
    expect(container.querySelector('[aria-label="VU Meter"]')!.classList.contains('active')).toBe(false);
  });

  it('tap Player -> viewActions.goToPlayer; tap Library -> goToLibrary', async () => {
    const { container } = render(NavColumn);
    await fireEvent.click(container.querySelector('[aria-label="Player"]')!);
    expect(viewActions.goToPlayer).toHaveBeenCalled();
    await fireEvent.click(container.querySelector('[aria-label="Library"]')!);
    expect(viewActions.goToLibrary).toHaveBeenCalled();
  });

  it('tap Refresh / Power dispatches the right handler; VU/Settings are silent', async () => {
    const { container } = render(NavColumn);
    await fireEvent.click(container.querySelector('[aria-label="Refresh"]')!);
    await fireEvent.click(container.querySelector('[aria-label="Power"]')!);
    await fireEvent.click(container.querySelector('[aria-label="VU Meter"]')!);
    await fireEvent.click(container.querySelector('[aria-label="Settings"]')!);
    expect(viewActions.tapRefresh).toHaveBeenCalled();
    expect(viewActions.tapPower).toHaveBeenCalled();
    expect(viewActions.tapVuMeter).toHaveBeenCalled();
    expect(viewActions.tapSettings).toHaveBeenCalled();
  });

  it('Refresh cell carries .spinning class when refreshInProgress is true', async () => {
    refreshInProgress.set(true);
    const { container } = render(NavColumn);
    const refreshCell = container.querySelector('[aria-label="Refresh"]') as HTMLElement;
    expect(refreshCell.classList.contains('spinning')).toBe(true);
    refreshInProgress.set(false);
  });

  it('Refresh cell does NOT carry .spinning class when refreshInProgress is false', async () => {
    refreshInProgress.set(false);
    const { container } = render(NavColumn);
    const refreshCell = container.querySelector('[aria-label="Refresh"]') as HTMLElement;
    expect(refreshCell.classList.contains('spinning')).toBe(false);
  });

  it('non-Refresh cells never carry .spinning even when refreshInProgress is true', async () => {
    refreshInProgress.set(true);
    const { container } = render(NavColumn);
    // Iterate every non-Refresh cell so a future regression on any of them
    // is caught (e.g. a class binding bug spreading the spinning state).
    const nonRefreshLabels = ['Player', 'Library', 'VU Meter', 'Settings', 'Power'];
    for (const label of nonRefreshLabels) {
      const cell = container.querySelector(`[aria-label="${label}"]`) as HTMLElement;
      expect(cell, `cell ${label} should be present`).toBeTruthy();
      expect(cell.classList.contains('spinning'), `cell ${label} must NOT carry .spinning`).toBe(false);
    }
    refreshInProgress.set(false);
  });
});
