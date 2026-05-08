import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { Album } from '$lib/stores/library';

const { currentAlbumBio, bioLoading, libraryAlbumTotalDuration } = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return {
    currentAlbumBio: writable({
      summary: 'Two-sentence bio.', sourceUrl: '', kind: 'album',
    }),
    bioLoading: writable(false),
    libraryAlbumTotalDuration: writable(0),
  };
});

vi.mock('$lib/stores/bios', () => ({ currentAlbumBio, bioLoading }));
vi.mock('$lib/stores/library', async () => {
  const actual = await vi.importActual<typeof import('$lib/stores/library')>('$lib/stores/library');
  return {
    ...actual,
    libraryAlbumTotalDuration,
  };
});
vi.mock('$lib/stores/player', () => ({
  formatTime: (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  },
}));

import AlbumPage from '../AlbumPage.svelte';

const album: Album = {
  id: 'kob',
  uri: 'mpd://kob',
  title: 'Kind of Blue',
  artist: 'Miles Davis',
  albumArt: '/art/kob.jpg',
  trackCount: 5,
  source: 'local',
  quality: '96kHz/24bit FLAC',
  trackType: 'flac',
};
const tracks = [
  { uri: 'a', title: 'So What', duration: 565 },
  { uri: 'b', title: 'Freddie Freeloader', duration: 587 },
];

describe('AlbumPage', () => {
  it('renders title, artist, cover, track list, bio', () => {
    libraryAlbumTotalDuration.set(0);
    const { container, getByText } = render(AlbumPage, {
      album, tracks, onPlayAlbum: () => {},
    });
    expect(getByText('Kind of Blue')).toBeTruthy();
    expect(getByText('Miles Davis')).toBeTruthy();
    expect(getByText(/So What/)).toBeTruthy();
    expect(container.textContent).toContain('Two-sentence bio.');
  });

  it('renders the HiResAudioStrip (not the legacy FormatStrip) when quality is set', () => {
    libraryAlbumTotalDuration.set(0);
    const { container } = render(AlbumPage, { album, tracks, onPlayAlbum: () => {} });
    expect(container.querySelector('[data-testid="hi-res-audio-strip"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="format-strip"]')).toBeNull();
    expect(container.textContent).toContain('HI-RES');
    expect(container.textContent).toContain('96kHz');
  });

  it('hides format strip when quality + trackType are missing', () => {
    libraryAlbumTotalDuration.set(0);
    const { container } = render(AlbumPage, {
      album: { ...album, quality: undefined, trackType: undefined }, tracks, onPlayAlbum: () => {},
    });
    expect(container.querySelector('[data-testid="format-strip"]')).toBeNull();
    expect(container.querySelector('[data-testid="hi-res-audio-strip"]')).toBeNull();
  });

  it('passes onPlayAlbum to AlbumCover', async () => {
    libraryAlbumTotalDuration.set(0);
    const onPlayAlbum = vi.fn();
    const { container } = render(AlbumPage, { album, tracks, onPlayAlbum });
    const btn = container.querySelector('button.album-cover')! as HTMLButtonElement;
    btn.click();
    expect(onPlayAlbum).toHaveBeenCalledOnce();
  });

  it('renders PlayAlbumButton and calls onPlayAlbum when clicked', async () => {
    libraryAlbumTotalDuration.set(0);
    const onPlayAlbum = vi.fn();
    const { getByTestId } = render(AlbumPage, {
      album,
      tracks,
      onPlayAlbum,
    });
    const btn = getByTestId('play-album-button');
    expect(btn).toBeInTheDocument();
    await fireEvent.click(btn);
    expect(onPlayAlbum).toHaveBeenCalledTimes(1);
  });

  it('renders the "ALBUM" eyebrow above the title', () => {
    libraryAlbumTotalDuration.set(0);
    const { container } = render(AlbumPage, { album, tracks, onPlayAlbum: () => {} });
    const eyebrow = container.querySelector('.album-eyebrow');
    expect(eyebrow).not.toBeNull();
    expect(eyebrow?.textContent).toBe('ALBUM');
    // Eyebrow precedes the title in DOM order.
    const title = container.querySelector('.title');
    expect(title).not.toBeNull();
    if (eyebrow && title) {
      const pos = eyebrow.compareDocumentPosition(title);
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('renders the meta strip with all four parts when year, genre, trackCount, and total duration are set', () => {
    libraryAlbumTotalDuration.set(2917); // 48:37
    const { container } = render(AlbumPage, {
      album: { ...album, trackCount: 12, year: 2023, genre: 'Ambient / Post-Rock' },
      tracks,
      onPlayAlbum: () => {},
    });
    const meta = container.querySelector('[data-testid="album-meta-strip"]');
    expect(meta).not.toBeNull();
    const text = meta?.textContent ?? '';
    expect(text).toContain('12 songs');
    expect(text).toContain('48:37');
    expect(text).toContain('2023');
    expect(text).toContain('Ambient / Post-Rock');
    // Three separators between four parts.
    const sepCount = (text.match(/•/g) || []).length;
    expect(sepCount).toBe(3);
  });

  it('omits genre from the meta strip when album.genre is undefined', () => {
    libraryAlbumTotalDuration.set(2917);
    const { container } = render(AlbumPage, {
      album: { ...album, trackCount: 12, year: 2023, genre: undefined },
      tracks,
      onPlayAlbum: () => {},
    });
    const meta = container.querySelector('[data-testid="album-meta-strip"]');
    const text = meta?.textContent ?? '';
    expect(text).toContain('2023');
    expect(text).not.toContain('Ambient');
    // No trailing bullet.
    expect(text.trim().endsWith('•')).toBe(false);
    // Only two separators between three parts.
    const sepCount = (text.match(/•/g) || []).length;
    expect(sepCount).toBe(2);
  });

  it('omits genre from the meta strip when album.genre is empty/whitespace', () => {
    libraryAlbumTotalDuration.set(2917);
    const { container } = render(AlbumPage, {
      album: { ...album, trackCount: 12, year: 2023, genre: '   ' },
      tracks,
      onPlayAlbum: () => {},
    });
    const meta = container.querySelector('[data-testid="album-meta-strip"]');
    const text = meta?.textContent ?? '';
    expect(text).not.toContain('   •');
    const sepCount = (text.match(/•/g) || []).length;
    expect(sepCount).toBe(2);
  });

  it('omits year from the meta strip when album.year is missing', () => {
    libraryAlbumTotalDuration.set(2917);
    const { container } = render(AlbumPage, {
      album: { ...album, trackCount: 12, year: undefined, genre: 'Ambient / Post-Rock' },
      tracks,
      onPlayAlbum: () => {},
    });
    const meta = container.querySelector('[data-testid="album-meta-strip"]');
    const text = meta?.textContent ?? '';
    expect(text).toContain('12 songs');
    expect(text).toContain('48:37');
    expect(text).toContain('Ambient / Post-Rock');
    expect(text).not.toMatch(/\b20\d{2}\b/);
    const sepCount = (text.match(/•/g) || []).length;
    expect(sepCount).toBe(2);
  });

  it('artist row uses the gold accent color', async () => {
    libraryAlbumTotalDuration.set(0);
    const { container } = render(AlbumPage, { album, tracks, onPlayAlbum: () => {} });
    const artistRow = container.querySelector('.artist-row') as HTMLElement | null;
    expect(artistRow).not.toBeNull();
    expect(artistRow!.classList.contains('artist-row')).toBe(true);
    // jsdom + Svelte's vite-plugin do not always inject scoped <style> tags
    // into the document, so assert the .artist-row rule lives in the
    // component source itself (the design-token contract).
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.resolve(here, '../AlbumPage.svelte'), 'utf8');
    // Locked rule: .artist-row's color is var(--color-accent) (gold).
    expect(src).toMatch(/\.artist-row[\s\S]*?color:\s*var\(--color-accent\)/);
  });

  it('passes size="prominent" to PlayAlbumButton', () => {
    libraryAlbumTotalDuration.set(0);
    const { getByTestId } = render(AlbumPage, {
      album, tracks, onPlayAlbum: () => {},
    });
    const btn = getByTestId('play-album-button');
    expect(btn.classList.contains('prominent')).toBe(true);
  });

  it('does not render a "more" / overflow button next to Play Album', () => {
    libraryAlbumTotalDuration.set(0);
    const { container } = render(AlbumPage, { album, tracks, onPlayAlbum: () => {} });
    // No element with the more-button affordance lives in AlbumPage.
    expect(container.querySelector('[data-testid="album-more-button"]')).toBeNull();
  });

  it('renders the track list with rows in order', () => {
    libraryAlbumTotalDuration.set(0);
    const { container } = render(AlbumPage, { album, tracks, onPlayAlbum: () => {} });
    const rows = Array.from(container.querySelectorAll('.track-list li'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('So What');
    expect(rows[1].textContent).toContain('Freddie Freeloader');
  });

  it('renders the gradient-white section rule between description and HiResAudioStrip', () => {
    libraryAlbumTotalDuration.set(0);
    const { container } = render(AlbumPage, { album, tracks, onPlayAlbum: () => {} });
    const rule = container.querySelector('.section-rule');
    expect(rule).not.toBeNull();
  });
});
