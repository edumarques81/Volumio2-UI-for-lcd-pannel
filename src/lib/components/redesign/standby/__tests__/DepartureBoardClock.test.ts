import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';

const { mockLastPlayed } = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return { mockLastPlayed: writable<Record<string, unknown> | null>(null) };
});

vi.mock('$lib/stores/player', () => ({ lastPlayedAlbum: mockLastPlayed }));

import DepartureBoardClock from '../DepartureBoardClock.svelte';

const FROZEN = new Date(2026, 9, 18, 21, 47, 9);

function railText(container: HTMLElement): string {
  const rail = container.querySelector('[data-testid="standby-rail"]');
  return Array.from(rail?.querySelectorAll('.flap') ?? [])
    .map((cell) => cell.getAttribute('data-value') ?? '')
    .join('')
    .trimEnd();
}

describe('DepartureBoardClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLastPlayed.set(null);
  });
  afterEach(() => vi.useRealTimers());

  it('renders the frozen time across the hour and minute flaps', () => {
    const { getByTestId } = render(DepartureBoardClock, { props: { frozenAt: FROZEN } });
    expect(getByTestId('standby-h1').getAttribute('data-value')).toBe('2');
    expect(getByTestId('standby-h2').getAttribute('data-value')).toBe('1');
    expect(getByTestId('standby-m1').getAttribute('data-value')).toBe('4');
    expect(getByTestId('standby-m2').getAttribute('data-value')).toBe('7');
    expect(getByTestId('standby-s1').getAttribute('data-value')).toBe('0');
    expect(getByTestId('standby-s2').getAttribute('data-value')).toBe('9');
  });

  it('renders the long date', () => {
    const { getByTestId } = render(DepartureBoardClock, { props: { frozenAt: FROZEN } });
    expect(getByTestId('standby-date').textContent).toBe('SUN 18 OCT');
  });

  it('shows the wake prompt on the rail when nothing has been played', async () => {
    const { container } = render(DepartureBoardClock, { props: { frozenAt: FROZEN } });
    await vi.advanceTimersByTimeAsync(2000);
    expect(railText(container)).toBe('TOUCH ANYWHERE TO WAKE');
  });

  it('leads the rail with the last played album when there is one', async () => {
    mockLastPlayed.set({ album: 'Kind of Blue', artist: 'Miles Davis' });
    const { container } = render(DepartureBoardClock, { props: { frozenAt: FROZEN } });
    await vi.advanceTimersByTimeAsync(2000);
    expect(railText(container)).toBe('LAST PLAYED KIND OF BLUE');
  });

  it('cycles the rail to the next message', async () => {
    mockLastPlayed.set({ album: 'Kind of Blue', artist: 'Miles Davis' });
    const { container } = render(DepartureBoardClock, { props: { frozenAt: FROZEN } });
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(7000 + 2000);
    expect(railText(container)).toBe('TOUCH ANYWHERE TO WAKE');
  });

  it('describes itself to a screen reader without reading out every flap', () => {
    const { container } = render(DepartureBoardClock, { props: { frozenAt: FROZEN } });
    expect(container.querySelector('.sr-only')?.textContent).toContain('21:47');
    for (const flap of container.querySelectorAll('.flap')) {
      expect(flap.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('honours 12-hour mode', () => {
    const { getByTestId } = render(DepartureBoardClock, {
      props: { frozenAt: FROZEN, hour12: true }
    });
    expect(getByTestId('standby-h1').getAttribute('data-value')).toBe('0');
    expect(getByTestId('standby-h2').getAttribute('data-value')).toBe('9');
  });
});
