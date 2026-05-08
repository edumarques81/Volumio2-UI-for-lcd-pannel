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

  describe('italic title-match rendering', () => {
    it('renders no <em> tags when summary contains no occurrence of the title', () => {
      currentAlbumBio.set({
        summary: 'A simple description',
        sourceUrl: '', kind: 'album',
      });
      const { container } = render(AlbumInfo, { props: { title: 'Midnight Shores' } });
      const ems = container.querySelectorAll('p.bio em');
      expect(ems.length).toBe(0);
      expect(container.querySelector('p.bio')?.textContent).toBe('A simple description');
    });

    it('wraps a single occurrence of the title in <em>', () => {
      currentAlbumBio.set({
        summary: 'Midnight Shores blends ambient textures.',
        sourceUrl: '', kind: 'album',
      });
      const { container } = render(AlbumInfo, { props: { title: 'Midnight Shores' } });
      const ems = container.querySelectorAll('p.bio em');
      expect(ems.length).toBe(1);
      expect(ems[0].textContent).toBe('Midnight Shores');
    });

    it('wraps multiple occurrences of the title in <em>', () => {
      currentAlbumBio.set({
        summary: 'Midnight Shores opens softly, then Midnight Shores closes.',
        sourceUrl: '', kind: 'album',
      });
      const { container } = render(AlbumInfo, { props: { title: 'Midnight Shores' } });
      const ems = container.querySelectorAll('p.bio em');
      expect(ems.length).toBe(2);
      expect(ems[0].textContent).toBe('Midnight Shores');
      expect(ems[1].textContent).toBe('Midnight Shores');
    });

    it('matches case-insensitively but preserves the original casing', () => {
      currentAlbumBio.set({
        summary: 'The album midnight shores is gentle.',
        sourceUrl: '', kind: 'album',
      });
      const { container } = render(AlbumInfo, { props: { title: 'Midnight Shores' } });
      const ems = container.querySelectorAll('p.bio em');
      expect(ems.length).toBe(1);
      expect(ems[0].textContent).toBe('midnight shores');
    });

    it('treats regex-special characters in the title as literal substrings', () => {
      currentAlbumBio.set({
        summary: 'Track from Hello.World+ today.',
        sourceUrl: '', kind: 'album',
      });
      const { container } = render(AlbumInfo, { props: { title: 'Hello.World+' } });
      const ems = container.querySelectorAll('p.bio em');
      expect(ems.length).toBe(1);
      expect(ems[0].textContent).toBe('Hello.World+');
    });

    it('renders nothing meaningful when summary is empty even with a title set', () => {
      currentAlbumBio.set({ summary: '', sourceUrl: '', kind: '' });
      const { container } = render(AlbumInfo, { props: { title: 'Midnight Shores' } });
      expect(container.querySelector('p.bio')).toBeNull();
    });

    it('renders summary as plain text when title prop is empty', () => {
      currentAlbumBio.set({
        summary: 'Midnight Shores blends ambient textures.',
        sourceUrl: '', kind: 'album',
      });
      const { container } = render(AlbumInfo, { props: { title: '' } });
      const ems = container.querySelectorAll('p.bio em');
      expect(ems.length).toBe(0);
      expect(container.querySelector('p.bio')?.textContent).toBe(
        'Midnight Shores blends ambient textures.',
      );
    });

    it('does not allow HTML/script injection from the summary string', () => {
      currentAlbumBio.set({
        summary: "Note: <script>alert('x')</script> here.",
        sourceUrl: '', kind: 'album',
      });
      const { container } = render(AlbumInfo, { props: { title: 'Whatever' } });
      // The literal "<script>" must appear as text, not as a real script element.
      expect(container.querySelector('p.bio script')).toBeNull();
      expect(container.querySelector('p.bio')?.textContent).toContain("<script>alert('x')</script>");
    });
  });
});
