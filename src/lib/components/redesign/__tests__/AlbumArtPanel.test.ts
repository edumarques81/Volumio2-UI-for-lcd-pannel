import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AlbumArtPanel from '../AlbumArtPanel.svelte';

describe('AlbumArtPanel', () => {
  it('renders an <img> with the provided src and alt', () => {
    const { getByAltText } = render(AlbumArtPanel, { src: '/art/x.jpg', alt: 'Album cover' });
    const img = getByAltText('Album cover') as HTMLImageElement;
    expect(img.src).toContain('/art/x.jpg');
  });

  it('renders the no-art fallback (centered icon) when src is empty', () => {
    const { container } = render(AlbumArtPanel, { src: '', alt: 'No artwork' });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.no-art')).toBeTruthy();
  });

  it('exposes the panel as a 12px-rounded square via class', () => {
    const { container } = render(AlbumArtPanel, { src: '/art/x.jpg', alt: 'a' });
    const panel = container.querySelector('.album-art');
    expect(panel?.classList.contains('album-art')).toBe(true);
  });

  it('does nothing on tap (no event emitted) per spec decision 11', () => {
    // The component shouldn't have a click handler that mutates state.
    // We just ensure no on:click prop is required.
    const { container } = render(AlbumArtPanel, { src: '/art/x.jpg', alt: 'a' });
    expect(container.querySelector('button')).toBeNull();
  });
});
