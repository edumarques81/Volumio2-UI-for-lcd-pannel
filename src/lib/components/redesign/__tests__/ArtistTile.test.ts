import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ArtistTile from '../ArtistTile.svelte';
import { artistHashColor } from '$lib/utils/artistAvatar';

const baseArtist = { name: 'Nils Frahm', albumCount: 7 };

describe('ArtistTile', () => {
  it('renders <img> with /artistart src URL-encoding the name', () => {
    const { container } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap: () => {},
    });
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('/artistart?name=Nils%20Frahm');
  });

  it('renders the name in the label', () => {
    const { getByText } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap: () => {},
    });
    expect(getByText('Nils Frahm')).toBeTruthy();
  });

  it('has role="button", aria-pressed reflecting selected, aria-label = name', () => {
    const { container, rerender } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap: () => {},
    });
    const el = container.querySelector('[role="button"]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('aria-pressed')).toBe('false');
    expect(el?.getAttribute('aria-label')).toBe('Nils Frahm');

    rerender({ artist: baseArtist, selected: true, onTap: () => {} });
    expect(container.querySelector('[role="button"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('adds the is-selected class when selected={true}', () => {
    const { container, rerender } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap: () => {},
    });
    expect(container.querySelector('.artist-tile')?.classList.contains('is-selected')).toBe(false);
    rerender({ artist: baseArtist, selected: true, onTap: () => {} });
    expect(container.querySelector('.artist-tile')?.classList.contains('is-selected')).toBe(true);
  });

  it('exposes data-testid="artist-tile-{slug}" derived from the name', () => {
    const { container } = render(ArtistTile, {
      artist: { name: 'Hollow Tides', albumCount: 1 },
      selected: false,
      onTap: () => {},
    });
    expect(container.querySelector('[data-testid="artist-tile-hollow-tides"]')).toBeTruthy();
  });

  it('on img error swaps to the avatar fallback with the expected initial and hash colour', async () => {
    const { container, queryByText } = render(ArtistTile, {
      artist: { name: 'Aethel & Ash', albumCount: 3 },
      selected: false,
      onTap: () => {},
    });
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    await fireEvent.error(img!);
    const fallback = container.querySelector('[data-testid="avatar-fallback"]');
    expect(fallback).toBeTruthy();
    expect(queryByText('A')).toBeTruthy();
    // jsdom v27 canonicalises `hsl()` to `rgb()` on both `style.background`
    // and the raw `style` attribute, so the literal hsl() is unrecoverable
    // from the DOM. Validate the invariant the plan cares about — the
    // fallback background reflects the deterministic name-hashed colour
    // (S=45%, L=35% encoded inside the hash colour) — by converting the
    // expected hsl to rgb and asserting equality.
    const expectedRgb = hslToRgb(artistHashColor('Aethel & Ash'));
    const bg = (fallback as HTMLElement)?.style.background;
    expect(bg).toBe(expectedRgb);
  });

  it('invokes onTap(name) on click', async () => {
    const onTap = vi.fn();
    const { container } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap,
    });
    await fireEvent.click(container.querySelector('[role="button"]')!);
    expect(onTap).toHaveBeenCalledWith('Nils Frahm');
  });

  it('invokes onTap on Enter and Space keypress', async () => {
    const onTap = vi.fn();
    const { container } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap,
    });
    const el = container.querySelector('[role="button"]')!;
    await fireEvent.keyDown(el, { key: 'Enter' });
    await fireEvent.keyDown(el, { key: ' ' });
    expect(onTap).toHaveBeenCalledTimes(2);
    expect(onTap).toHaveBeenNthCalledWith(1, 'Nils Frahm');
    expect(onTap).toHaveBeenNthCalledWith(2, 'Nils Frahm');
  });
});

// hsl(h, s%, l%) → "rgb(r, g, b)" — matches jsdom's serialisation so we can
// compare against `style.background` after jsdom canonicalises hsl→rgb.
function hslToRgb(hsl: string): string {
  const m = hsl.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
  if (!m) throw new Error(`bad hsl: ${hsl}`);
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}
