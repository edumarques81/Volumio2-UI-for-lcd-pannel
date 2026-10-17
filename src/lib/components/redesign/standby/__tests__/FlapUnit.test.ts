import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import FlapUnit from '../FlapUnit.svelte';

describe('FlapUnit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders the value in all four painted halves at rest', () => {
    const { getByTestId } = render(FlapUnit, {
      props: { value: '7', w: 100, h: 160, fs: 120, testid: 'flap' }
    });
    const flap = getByTestId('flap');
    expect(flap.getAttribute('data-value')).toBe('7');
    expect(flap.textContent?.replace(/\s/g, '')).toBe('7777');
  });

  it('applies the geometry props as custom properties', () => {
    const { getByTestId } = render(FlapUnit, {
      props: { value: '0', w: 66, h: 62, fs: 40, testid: 'flap' }
    });
    const style = getByTestId('flap').getAttribute('style') ?? '';
    expect(style).toContain('--w: 66px');
    expect(style).toContain('--h: 62px');
    expect(style).toContain('--fs: 40px');
  });

  it('bare cells get the bare class so the card and hinge are dropped', () => {
    const { getByTestId } = render(FlapUnit, {
      props: { value: 'A', w: 20, h: 20, fs: 20, bare: true, testid: 'flap' }
    });
    expect(getByTestId('flap').classList.contains('bare')).toBe(true);
  });

  it('settles on the new value once the flip has run', async () => {
    const { getByTestId, rerender } = render(FlapUnit, {
      props: { value: '1', w: 100, h: 160, fs: 120, testid: 'flap' }
    });
    await rerender({ value: '2', w: 100, h: 160, fs: 120, testid: 'flap' });
    await vi.advanceTimersByTimeAsync(400);
    const flap = getByTestId('flap');
    expect(flap.getAttribute('data-value')).toBe('2');
    expect(flap.classList.contains('falling')).toBe(false);
    expect(flap.classList.contains('landing')).toBe(false);
  });

  it('a change arriving mid-flip lands on the latest value, not the skipped one', async () => {
    const props = { w: 100, h: 160, fs: 120, testid: 'flap' };
    const { getByTestId, rerender } = render(FlapUnit, {
      props: { value: '1', ...props }
    });
    await rerender({ value: '2', ...props });
    await vi.advanceTimersByTimeAsync(60); // mid-fall
    await rerender({ value: '3', ...props });
    await vi.advanceTimersByTimeAsync(400);
    expect(getByTestId('flap').getAttribute('data-value')).toBe('3');
  });

  it('is hidden from assistive tech — the face has its own description', () => {
    const { getByTestId } = render(FlapUnit, {
      props: { value: '7', w: 100, h: 160, fs: 120, testid: 'flap' }
    });
    expect(getByTestId('flap').getAttribute('aria-hidden')).toBe('true');
  });
});
