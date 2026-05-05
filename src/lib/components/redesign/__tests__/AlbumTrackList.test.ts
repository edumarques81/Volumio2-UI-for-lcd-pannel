import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AlbumTrackList from '../AlbumTrackList.svelte';

const tracks = [
  { uri: 'a', title: 'So What',           duration: 565 },
  { uri: 'b', title: 'Freddie Freeloader', duration: 587 },
  { uri: 'c', title: 'Blue in Green',     duration: 327 },
];

describe('AlbumTrackList', () => {
  it('renders one row per track with index, title, and duration', () => {
    const { container } = render(AlbumTrackList, { tracks });
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toMatch(/1\..*So What.*9:25/);
    expect(items[1].textContent).toMatch(/2\..*Freddie Freeloader.*9:47/);
    expect(items[2].textContent).toMatch(/3\..*Blue in Green.*5:27/);
  });

  it('renders empty list (no <li>) when tracks is []', () => {
    const { container } = render(AlbumTrackList, { tracks: [] });
    expect(container.querySelectorAll('li').length).toBe(0);
  });

  it('handles missing duration with em-dash placeholder', () => {
    const { container } = render(AlbumTrackList, {
      tracks: [{ uri: 'x', title: 'Untimed', duration: 0 }],
    });
    expect(container.textContent).toContain('Untimed');
    expect(container.textContent).toContain('—');
  });
});
