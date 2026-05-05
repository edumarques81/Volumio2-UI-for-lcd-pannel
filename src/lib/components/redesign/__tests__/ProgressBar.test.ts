import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ProgressBar from '../ProgressBar.svelte';

describe('ProgressBar', () => {
  it('formats time as M:SS for tracks under an hour', () => {
    const { getByText } = render(ProgressBar, { seek: 65, duration: 250, onSeek: () => {} });
    expect(getByText('1:05')).toBeTruthy();
    expect(getByText('4:10')).toBeTruthy();
  });

  it('formats time as H:MM:SS for tracks over an hour', () => {
    const { getByText } = render(ProgressBar, { seek: 0, duration: 4000, onSeek: () => {} });
    expect(getByText('1:06:40')).toBeTruthy();
  });

  it('shows 0:00 when duration is 0', () => {
    const { container } = render(ProgressBar, { seek: 0, duration: 0, onSeek: () => {} });
    expect(container.textContent).toContain('0:00');
  });

  it('calls onSeek with the click position when track tapped', async () => {
    const onSeek = vi.fn();
    const { container } = render(ProgressBar, { seek: 0, duration: 100, onSeek });
    const track = container.querySelector('.track')!;
    // Mock getBoundingClientRect for predictable math
    track.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 9, width: 200, height: 9, x: 0, y: 0, toJSON: () => '' });
    await fireEvent.click(track, { clientX: 100 });
    expect(onSeek).toHaveBeenCalledWith(50); // 50% of 100
  });

  it('renders the played-portion fill width as percentage of seek/duration', () => {
    const { container } = render(ProgressBar, { seek: 25, duration: 100, onSeek: () => {} });
    const fill = container.querySelector('.fill') as HTMLElement;
    expect(fill.style.width).toBe('25%');
  });
});
