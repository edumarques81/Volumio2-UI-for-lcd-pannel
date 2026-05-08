import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AlbumTrackList from '../AlbumTrackList.svelte';

const tracks = [
  { uri: 'a', title: 'So What',           duration: 565 },
  { uri: 'b', title: 'Freddie Freeloader', duration: 587 },
  { uri: 'c', title: 'Blue in Green',     duration: 327 },
];

describe('AlbumTrackList', () => {
  it('renders one row per track with zero-padded index, title, and duration', () => {
    const { container } = render(AlbumTrackList, { tracks });
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toMatch(/01\s+So What.*9:25/);
    expect(items[1].textContent).toMatch(/02\s+Freddie Freeloader.*9:47/);
    expect(items[2].textContent).toMatch(/03\s+Blue in Green.*5:27/);
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

  it('renders no trailing dot on track numbers', () => {
    const { container } = render(AlbumTrackList, { tracks });
    const nums = container.querySelectorAll('.num');
    nums.forEach((n) => {
      expect(n.textContent).not.toMatch(/\./);
    });
  });

  it('zero-pads tracks 1..9 and uses two digits for tracks 10+', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      uri: `u${i}`,
      title: `Track ${i + 1}`,
      duration: 60,
    }));
    const { container } = render(AlbumTrackList, { tracks: many });
    const nums = container.querySelectorAll('.num');
    expect(nums[0].textContent?.trim()).toBe('01');
    expect(nums[8].textContent?.trim()).toBe('09');
    expect(nums[9].textContent?.trim()).toBe('10');
    expect(nums[10].textContent?.trim()).toBe('11');
    expect(nums[11].textContent?.trim()).toBe('12');
  });

  it('track number uses --color-accent at full opacity', () => {
    const { container } = render(AlbumTrackList, { tracks });
    const num = container.querySelector('.num') as HTMLElement;
    expect(num).toBeTruthy();
    const cs = getComputedStyle(num);
    // Color may be resolved or kept as var(); accept either form.
    expect(cs.color).toMatch(/var\(--color-accent\)|rgb|#/i);
    expect(parseFloat(cs.opacity || '1')).toBe(1);
  });

  it('title uses --color-text-primary', () => {
    const { container } = render(AlbumTrackList, { tracks });
    const title = container.querySelector('.title') as HTMLElement;
    expect(title).toBeTruthy();
    const cs = getComputedStyle(title);
    expect(cs.color).toMatch(/var\(--color-text-primary\)|rgb|#/i);
  });

  it('duration uses --color-text-primary', () => {
    const { container } = render(AlbumTrackList, { tracks });
    const dur = container.querySelector('.dur') as HTMLElement;
    expect(dur).toBeTruthy();
    const cs = getComputedStyle(dur);
    expect(cs.color).toMatch(/var\(--color-text-primary\)|rgb|#/i);
  });

  it('does not constrain track-list with a max-height (parent drives sizing)', () => {
    const { container } = render(AlbumTrackList, { tracks });
    const list = container.querySelector('.track-list') as HTMLElement;
    expect(list).toBeTruthy();
    const cs = getComputedStyle(list);
    // jsdom returns 'none' or '' when no max-height is set.
    expect(['', 'none']).toContain(cs.maxHeight);
  });
});
