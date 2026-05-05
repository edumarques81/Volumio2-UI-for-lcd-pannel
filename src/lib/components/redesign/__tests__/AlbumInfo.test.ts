import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const { currentAlbumBio, bioLoading } = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return {
    currentAlbumBio: writable({ summary: '', sourceUrl: '', kind: '' }),
    bioLoading: writable(false),
  };
});

vi.mock('$lib/stores/bios', () => ({
  currentAlbumBio, bioLoading,
}));

import AlbumInfo from '../AlbumInfo.svelte';

describe('AlbumInfo', () => {
  it('renders nothing meaningful when summary is empty', () => {
    currentAlbumBio.set({ summary: '', sourceUrl: '', kind: '' });
    const { container } = render(AlbumInfo);
    expect(container.querySelector('p.bio')).toBeNull();
  });

  it('shows the bio paragraph when summary is present', () => {
    currentAlbumBio.set({
      summary: 'A 1959 jazz album by Miles Davis, often cited as influential.',
      sourceUrl: 'https://w/ko', kind: 'album',
    });
    const { container } = render(AlbumInfo);
    expect(container.textContent).toContain('1959 jazz album');
  });

  it('shows a small loader hint when bioLoading is true and summary is empty', () => {
    currentAlbumBio.set({ summary: '', sourceUrl: '', kind: '' });
    bioLoading.set(true);
    const { container } = render(AlbumInfo);
    expect(container.querySelector('.loading')).toBeTruthy();
  });

  it('hides the loader once summary arrives', () => {
    bioLoading.set(false);
    currentAlbumBio.set({ summary: 'OK', sourceUrl: '', kind: 'album' });
    const { container } = render(AlbumInfo);
    expect(container.querySelector('.loading')).toBeNull();
  });
});
