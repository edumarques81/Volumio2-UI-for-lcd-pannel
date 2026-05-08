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

  describe('size variants', () => {
    it('defaults to subtle variant when no size prop provided', () => {
      const { getByRole } = render(PlayAlbumButton, { onPlay: vi.fn() });
      const button = getByRole('button', { name: /play album/i });
      expect(button.classList.contains('play-album')).toBe(true);
      expect(button.classList.contains('prominent')).toBe(false);
    });

    it('renders subtle variant when size="subtle" explicitly', () => {
      const { getByRole } = render(PlayAlbumButton, { onPlay: vi.fn(), size: 'subtle' });
      const button = getByRole('button', { name: /play album/i });
      expect(button.classList.contains('play-album')).toBe(true);
      expect(button.classList.contains('prominent')).toBe(false);
    });

    it('adds prominent class when size="prominent"', () => {
      const { getByRole } = render(PlayAlbumButton, { onPlay: vi.fn(), size: 'prominent' });
      const button = getByRole('button', { name: /play album/i });
      expect(button.classList.contains('play-album')).toBe(true);
      expect(button.classList.contains('prominent')).toBe(true);
    });

    it('renders larger icon for prominent variant', () => {
      const { container } = render(PlayAlbumButton, { onPlay: vi.fn(), size: 'prominent' });
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      // Icon component renders width/height attributes from size prop.
      expect(svg?.getAttribute('width')).toBe('24');
      expect(svg?.getAttribute('height')).toBe('24');
    });

    it('renders default icon size for subtle variant', () => {
      const { container } = render(PlayAlbumButton, { onPlay: vi.fn() });
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute('width')).toBe('18');
      expect(svg?.getAttribute('height')).toBe('18');
    });

    it('calls onPlay when prominent variant clicked', async () => {
      const onPlay = vi.fn();
      const { getByRole } = render(PlayAlbumButton, { onPlay, size: 'prominent' });
      await fireEvent.click(getByRole('button', { name: /play album/i }));
      expect(onPlay).toHaveBeenCalledTimes(1);
    });
  });
});
