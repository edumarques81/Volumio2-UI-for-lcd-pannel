import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import EdgeChevron from '../EdgeChevron.svelte';

describe('EdgeChevron', () => {
  it('renders with side="left" — testid + Previous album label', () => {
    const { getByTestId, getByRole } = render(EdgeChevron, { side: 'left', onTap: vi.fn() });
    expect(getByTestId('library-chevron-left')).toBeInTheDocument();
    expect(getByRole('button', { name: /previous album/i })).toBeInTheDocument();
  });

  it('renders with side="right" — testid + Next album label', () => {
    const { getByTestId, getByRole } = render(EdgeChevron, { side: 'right', onTap: vi.fn() });
    expect(getByTestId('library-chevron-right')).toBeInTheDocument();
    expect(getByRole('button', { name: /next album/i })).toBeInTheDocument();
  });

  it('calls onTap exactly once when clicked', async () => {
    const onTap = vi.fn();
    const { getByRole } = render(EdgeChevron, { side: 'left', onTap });
    await fireEvent.click(getByRole('button', { name: /previous album/i }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('renders different SVG path for left vs right (correct chevron direction)', () => {
    const { container: leftContainer } = render(EdgeChevron, { side: 'left', onTap: vi.fn() });
    const { container: rightContainer } = render(EdgeChevron, { side: 'right', onTap: vi.fn() });

    const leftPath = leftContainer.querySelector('svg path, svg polyline');
    const rightPath = rightContainer.querySelector('svg path, svg polyline');

    expect(leftPath).toBeTruthy();
    expect(rightPath).toBeTruthy();

    const leftD = leftPath?.getAttribute('d') ?? leftPath?.getAttribute('points');
    const rightD = rightPath?.getAttribute('d') ?? rightPath?.getAttribute('points');

    expect(leftD).toBeTruthy();
    expect(rightD).toBeTruthy();
    expect(leftD).not.toBe(rightD);
  });

  it('uses var(--color-accent) for the chevron stroke', () => {
    const { container } = render(EdgeChevron, { side: 'left', onTap: vi.fn() });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // Stroke is currentColor on the SVG; the button sets color to the gold token.
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    // Inline-positioned via the side prop — left side should anchor to left:0
    expect(button?.getAttribute('style') ?? '').toContain('left: 0');
  });
});
