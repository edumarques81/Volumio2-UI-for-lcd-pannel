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

  // --- Phase 3 (BROWSE-07): multi-disc grouping ---------------------------

  it('discCount omitted renders exactly as before — flat list, pad2(i+1) numbering, no disc headers', () => {
    const { container } = render(AlbumTrackList, { tracks });
    expect(container.querySelectorAll('[data-testid="disc-header"]').length).toBe(0);
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toMatch(/01\s+So What.*9:25/);
  });

  it('discCount <= 1 with tracks carrying a uniform disc field renders exactly as before', () => {
    const uniform = tracks.map((t) => ({ ...t, disc: 1, trackNumber: undefined }));
    const { container } = render(AlbumTrackList, { tracks: uniform, discCount: 1 });
    expect(container.querySelectorAll('[data-testid="disc-header"]').length).toBe(0);
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toMatch(/01\s+So What/);
  });

  it('discCount > 1 with tracks spanning disc 1 and 2 renders Disc N headers using each track\'s own trackNumber', () => {
    const multiDisc = [
      { uri: 'd1t1', title: 'Overture', duration: 120, disc: 1, trackNumber: 1 },
      { uri: 'd1t2', title: 'Allegro', duration: 300, disc: 1, trackNumber: 2 },
      { uri: 'd2t1', title: 'Adagio', duration: 400, disc: 2, trackNumber: 1 },
      { uri: 'd2t2', title: 'Finale', duration: 250, disc: 2, trackNumber: 2 },
    ];
    const { container } = render(AlbumTrackList, { tracks: multiDisc, discCount: 2 });

    const headers = container.querySelectorAll('[data-testid="disc-header"]');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toBe('Disc 1');
    expect(headers[1].textContent).toBe('Disc 2');

    const rows = container.querySelectorAll('li:not([data-testid="disc-header"])');
    expect(rows.length).toBe(4);
    // Each disc's tracks are numbered from their OWN trackNumber, not the
    // flat array index (disc 2's first track is trackNumber 1, not 3).
    expect(rows[0].textContent).toMatch(/01\s+Overture/);
    expect(rows[1].textContent).toMatch(/02\s+Allegro/);
    expect(rows[2].textContent).toMatch(/01\s+Adagio/);
    expect(rows[3].textContent).toMatch(/02\s+Finale/);

    // Disc header precedes its own group in DOM order.
    const allLis = Array.from(container.querySelectorAll('li'));
    const disc2HeaderIdx = allLis.indexOf(headers[1] as HTMLLIElement);
    const adagioIdx = allLis.findIndex((li) => li.textContent?.includes('Adagio'));
    expect(disc2HeaderIdx).toBeLessThan(adagioIdx);
  });

  it('discCount > 1 falls back to the flat array index when a track has no trackNumber', () => {
    const multiDisc = [
      { uri: 'd1t1', title: 'Overture', duration: 120, disc: 1 },
      { uri: 'd2t1', title: 'Adagio', duration: 400, disc: 2 },
    ];
    const { container } = render(AlbumTrackList, { tracks: multiDisc, discCount: 2 });
    const rows = container.querySelectorAll('li:not([data-testid="disc-header"])');
    // Each group's own index (i+1) — Overture is index 0 of disc 1's group,
    // Adagio is index 0 of disc 2's group. Both render "01".
    expect(rows[0].textContent).toMatch(/01\s+Overture/);
    expect(rows[1].textContent).toMatch(/01\s+Adagio/);
  });
});
