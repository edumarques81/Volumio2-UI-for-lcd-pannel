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

  // The live clock rebuilds its `parts` object every 200ms so the seconds cell
  // cannot lag the wall clock. That wakes every FlapUnit five times a second,
  // including the ones whose character has not changed. A cell that reacted to
  // the tick rather than to the character re-entered its flip on every one of
  // them, cancelling the timer that would have settled it: it animated for
  // ever, flickered, and never recovered. These two run the real board against
  // a real (faked) clock, which is the only shape that reproduces it.
  it('settles every cell after a tick, with no animation left running', async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 8, 8, 10, 0));
    const { getByTestId, container } = render(DepartureBoardClock);

    // Two full seconds -- two flips of the units cell, and a dozen bare ticks
    // landing on the cells that did not change -- plus long enough for the
    // last flip to finish.
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(400);

    expect(getByTestId('standby-s2').getAttribute('data-value')).toBe('2');
    for (const flap of container.querySelectorAll('.flap')) {
      expect(flap.classList.contains('falling')).toBe(false);
      expect(flap.classList.contains('landing')).toBe(false);
    }
  });

  it('leaves an unchanged cell alone while a neighbour flips', async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 8, 8, 10, 0));
    const { getByTestId } = render(DepartureBoardClock);
    const minutes = getByTestId('standby-m2');

    // Five seconds of ticks without the minute ever changing.
    await vi.advanceTimersByTimeAsync(5000);

    expect(minutes.getAttribute('data-value')).toBe('8');
    expect(minutes.classList.contains('falling')).toBe(false);
    expect(minutes.classList.contains('landing')).toBe(false);
  });

  it('honours 12-hour mode', () => {
    const { getByTestId } = render(DepartureBoardClock, {
      props: { frozenAt: FROZEN, hour12: true }
    });
    expect(getByTestId('standby-h1').getAttribute('data-value')).toBe('0');
    expect(getByTestId('standby-h2').getAttribute('data-value')).toBe('9');
  });
});
