import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PlayAlbumButton from '../PlayAlbumButton.svelte';

describe('PlayAlbumButton', () => {
  it('renders with label "Play Album"', () => {
    const { getByRole } = render(PlayAlbumButton, { onPlay: vi.fn() });
    expect(getByRole('button', { name: /play album/i })).toBeInTheDocument();
  });

  it('calls onPlay when clicked', async () => {
    const onPlay = vi.fn();
    const { getByRole } = render(PlayAlbumButton, { onPlay });
    await fireEvent.click(getByRole('button', { name: /play album/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('renders a play icon (svg)', () => {
    const { container } = render(PlayAlbumButton, { onPlay: vi.fn() });
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
