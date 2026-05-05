import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const { currentAlbumBio, bioLoading } = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return {
    currentAlbumBio: writable({
      summary: 'Two-sentence bio.', sourceUrl: '', kind: 'album',
    }),
    bioLoading: writable(false),
  };
});

vi.mock('$lib/stores/bios', () => ({ currentAlbumBio, bioLoading }));
vi.mock('$lib/stores/player', () => ({
  formatTime: (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  },
}));

import AlbumPage from '../AlbumPage.svelte';

const album = {
  uri: 'mpd://kob',
  title: 'Kind of Blue',
  artist: 'Miles Davis',
  albumart: '/art/kob.jpg',
  trackQuality: { bitDepth: 24, sampleRate: 96000, codec: 'FLAC' },
};
const tracks = [
  { uri: 'a', title: 'So What', duration: 565 },
  { uri: 'b', title: 'Freddie Freeloader', duration: 587 },
];

describe('AlbumPage', () => {
  it('renders title, artist, cover, track list, bio', () => {
    const { container, getByText } = render(AlbumPage, {
      album, tracks, onPlayAlbum: () => {},
    });
    expect(getByText('Kind of Blue')).toBeTruthy();
    expect(getByText('Miles Davis')).toBeTruthy();
    expect(getByText(/So What/)).toBeTruthy();
    expect(container.textContent).toContain('Two-sentence bio.');
  });

  it('renders the format strip when trackQuality is set', () => {
    const { container } = render(AlbumPage, { album, tracks, onPlayAlbum: () => {} });
    expect(container.textContent).toContain('HI-RES');
    expect(container.textContent).toContain('96kHz');
  });

  it('hides format strip when trackQuality is null', () => {
    const { container } = render(AlbumPage, {
      album: { ...album, trackQuality: null }, tracks, onPlayAlbum: () => {},
    });
    expect(container.textContent).not.toContain('HI-RES');
  });

  it('passes onPlayAlbum to AlbumCover', async () => {
    const onPlayAlbum = vi.fn();
    const { container } = render(AlbumPage, { album, tracks, onPlayAlbum });
    const btn = container.querySelector('button.album-cover')! as HTMLButtonElement;
    btn.click();
    expect(onPlayAlbum).toHaveBeenCalledOnce();
  });
});
