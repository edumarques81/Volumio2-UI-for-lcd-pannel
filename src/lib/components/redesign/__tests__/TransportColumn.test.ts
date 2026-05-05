import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TransportColumn from '../TransportColumn.svelte';

describe('TransportColumn', () => {
  it('shows play icon when paused, pause icon when playing', () => {
    const { container, rerender } = render(TransportColumn, {
      isPlaying: false,
      onTogglePlay: () => {},
      onPrev: () => {},
      onNext: () => {},
    });
    expect(container.querySelector('[aria-label="Play"]')).toBeTruthy();
    rerender({ isPlaying: true, onTogglePlay: () => {}, onPrev: () => {}, onNext: () => {} });
    expect(container.querySelector('[aria-label="Pause"]')).toBeTruthy();
  });

  it('emits onTogglePlay when play/pause button clicked', async () => {
    const onTogglePlay = vi.fn();
    const { container } = render(TransportColumn, {
      isPlaying: false, onTogglePlay, onPrev: () => {}, onNext: () => {},
    });
    await fireEvent.click(container.querySelector('[aria-label="Play"]')!);
    expect(onTogglePlay).toHaveBeenCalledOnce();
  });

  it('emits onPrev / onNext when skip buttons clicked', async () => {
    const onPrev = vi.fn(), onNext = vi.fn();
    const { container } = render(TransportColumn, {
      isPlaying: false, onTogglePlay: () => {}, onPrev, onNext,
    });
    await fireEvent.click(container.querySelector('[aria-label="Previous track"]')!);
    await fireEvent.click(container.querySelector('[aria-label="Next track"]')!);
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('disables next button when atQueueEnd is true and repeat is off', () => {
    const { container } = render(TransportColumn, {
      isPlaying: true, atQueueEnd: true, repeat: 'off',
      onTogglePlay: () => {}, onPrev: () => {}, onNext: () => {},
    });
    const nextBtn = container.querySelector('[aria-label="Next track"]') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });
});
