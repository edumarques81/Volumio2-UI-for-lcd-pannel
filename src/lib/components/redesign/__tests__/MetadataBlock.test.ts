import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

vi.mock('$lib/services/socket', () => ({
  socketService: { emit: vi.fn(), on: vi.fn(() => () => {}) },
  emitWhenConnected: vi.fn(),
  connectionState: { subscribe: vi.fn(() => () => {}) },
}));

import { selectedArtist, libraryActions } from '$lib/stores/library';
import MetadataBlock from '../MetadataBlock.svelte';

describe('MetadataBlock', () => {
  beforeEach(() => {
    selectedArtist.set(null);
  });

  it('shows title, artist, album when all three present', () => {
    const { getByText } = render(MetadataBlock, {
      title: 'Blue in Green',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
    });
    expect(getByText('Blue in Green')).toBeTruthy();
    expect(getByText('Miles Davis')).toBeTruthy();
    expect(getByText('Kind of Blue')).toBeTruthy();
  });

  it('hides artist row entirely when artist is empty', () => {
    const { container, queryByText } = render(MetadataBlock, {
      title: 'Untitled', artist: '', album: 'Demo',
    });
    expect(queryByText('Untitled')).toBeTruthy();
    expect(container.querySelector('.artist-row')).toBeNull();
  });

  it('hides album row entirely when album is empty', () => {
    const { container } = render(MetadataBlock, {
      title: 'X', artist: 'Y', album: '',
    });
    expect(container.querySelector('.album-row')).toBeNull();
  });

  it('renders user icon for artist row', () => {
    const { container } = render(MetadataBlock, {
      title: 't', artist: 'a', album: 'b',
    });
    const artistRow = container.querySelector('.artist-row');
    expect(artistRow?.querySelector('svg')).toBeTruthy();
  });
});

describe('MetadataBlock filter accent', () => {
  beforeEach(() => {
    selectedArtist.set(null);
    vi.spyOn(libraryActions, 'clearArtistFilter').mockImplementation(() => {});
  });

  it('default state: no clear button, no is-filter-active class on artist row', () => {
    const { container, queryByTestId } = render(MetadataBlock, {
      title: 't', artist: 'Nils Frahm', album: 'a',
    });
    expect(queryByTestId('clear-artist-filter')).toBeNull();
    expect(container.querySelector('.artist-row')?.classList.contains('is-filter-active')).toBe(false);
  });

  it('selectedArtist matches: clear button present + is-filter-active class applied', () => {
    selectedArtist.set('Nils Frahm');
    const { container, getByTestId } = render(MetadataBlock, {
      title: 't', artist: 'Nils Frahm', album: 'a',
    });
    expect(getByTestId('clear-artist-filter')).toBeTruthy();
    expect(container.querySelector('.artist-row')?.classList.contains('is-filter-active')).toBe(true);
  });

  it('selectedArtist set but does NOT match the current artist: no accent', () => {
    selectedArtist.set('Different Person');
    const { container, queryByTestId } = render(MetadataBlock, {
      title: 't', artist: 'Nils Frahm', album: 'a',
    });
    expect(queryByTestId('clear-artist-filter')).toBeNull();
    expect(container.querySelector('.artist-row')?.classList.contains('is-filter-active')).toBe(false);
  });

  it('click clear-artist-filter invokes libraryActions.clearArtistFilter once', async () => {
    selectedArtist.set('Nils Frahm');
    const { getByTestId } = render(MetadataBlock, {
      title: 't', artist: 'Nils Frahm', album: 'a',
    });
    await fireEvent.click(getByTestId('clear-artist-filter'));
    expect(libraryActions.clearArtistFilter).toHaveBeenCalledTimes(1);
  });
});
