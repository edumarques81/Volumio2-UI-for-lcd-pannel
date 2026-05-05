import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AlbumCover from '../AlbumCover.svelte';

describe('AlbumCover', () => {
  it('renders the album art', () => {
    const onTap = vi.fn();
    const { container } = render(AlbumCover, {
      src: '/art/x.jpg', alt: 'Kind of Blue cover', onTap,
    });
    expect(container.querySelector('img')).toBeTruthy();
  });

  it('calls onTap when the cover is clicked', async () => {
    const onTap = vi.fn();
    const { container } = render(AlbumCover, {
      src: '/art/x.jpg', alt: 'a', onTap,
    });
    await fireEvent.click(container.querySelector('button.album-cover')!);
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('uses a button element so it is keyboard-activatable', () => {
    const { container } = render(AlbumCover, { src: '/x', alt: 'a', onTap: () => {} });
    expect(container.querySelector('button.album-cover')).toBeTruthy();
  });

  it('falls back to no-art square when src is empty', () => {
    const { container } = render(AlbumCover, { src: '', alt: 'a', onTap: () => {} });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.no-art')).toBeTruthy();
  });
});
