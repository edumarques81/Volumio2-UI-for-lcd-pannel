import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Stub ArtistTile so this test stays focused on ArtistsPage orchestration.
// `vi.fn(() => null)` (the plan's original mock) doesn't render a DOM node,
// which breaks the strip-childElementCount assertion, so we point at a tiny
// real Svelte stub component (same pattern SettingsView.test.ts uses for its
// section views).
vi.mock('../ArtistTile.svelte', async () => {
  const stub = await import('./stubs/StubArtistTile.svelte');
  return { default: stub.default };
});

// Mock socket service so initLibraryStore's listeners don't blow up.
vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    socket: { connected: true },
  },
  emitWhenConnected: vi.fn(),
  connectionState: { subscribe: vi.fn(() => () => {}) },
}));

import {
  libraryArtists,
  libraryArtistsLoading,
  libraryArtistsError,
  selectedArtist,
  libraryActions,
  libraryPageKind,
} from '$lib/stores/library';
import ArtistsPage from '../ArtistsPage.svelte';

describe('ArtistsPage', () => {
  beforeEach(() => {
    // `vi.spyOn` returns the existing spy on subsequent calls, so call counts
    // leak across tests unless we explicitly clear. clearAllMocks() resets
    // call history without touching the spy/mock impls we set up below.
    vi.clearAllMocks();
    libraryArtists.set([]);
    libraryArtistsLoading.set(false);
    libraryArtistsError.set(null);
    selectedArtist.set(null);
    libraryPageKind.set('artists');
    vi.spyOn(libraryActions, 'fetchArtists').mockImplementation(() => {});
    vi.spyOn(libraryActions, 'fetchArtistAlbums').mockImplementation(() => {});
    vi.spyOn(libraryActions, 'cyclePageKind').mockImplementation(() => {});
  });

  it('renders the amber "Artists" header', () => {
    const { getByTestId } = render(ArtistsPage);
    const header = getByTestId('artists-page-header');
    expect(header.textContent?.trim()).toBe('Artists');
  });

  it('on mount with empty store calls fetchArtists once', () => {
    render(ArtistsPage);
    expect(libraryActions.fetchArtists).toHaveBeenCalledTimes(1);
  });

  it('on mount with already-populated store does NOT call fetchArtists', () => {
    libraryArtists.set([
      { name: 'A', albumCount: 1 },
      { name: 'B', albumCount: 2 },
    ]);
    render(ArtistsPage);
    expect(libraryActions.fetchArtists).not.toHaveBeenCalled();
  });

  it('on mount while loading does NOT re-trigger fetchArtists', () => {
    libraryArtistsLoading.set(true);
    render(ArtistsPage);
    expect(libraryActions.fetchArtists).not.toHaveBeenCalled();
  });

  it('renders the loading-skeleton row when loading + empty', () => {
    libraryArtistsLoading.set(true);
    const { getAllByTestId } = render(ArtistsPage);
    expect(getAllByTestId('artist-tile-skeleton')).toHaveLength(7);
  });

  it('renders the empty state when not-loading + empty', () => {
    const { getByTestId } = render(ArtistsPage);
    expect(getByTestId('artists-empty').textContent).toContain('No artists in library');
  });

  it('renders the error state when libraryArtistsError is set; tap re-fires fetchArtists', async () => {
    libraryArtistsError.set('boom');
    const { getByTestId } = render(ArtistsPage);
    const err = getByTestId('artists-error');
    expect(err.textContent).toContain('Could not load artists');
    // The verbatim implementation's onMount guard only inspects
    // libraryArtists.length + libraryArtistsLoading (not libraryArtistsError),
    // so mounting with an error still fires one fetch. Clear that count to
    // isolate the "tap re-fires" assertion.
    (libraryActions.fetchArtists as unknown as { mockClear: () => void }).mockClear();
    await fireEvent.click(err);
    expect(libraryActions.fetchArtists).toHaveBeenCalledTimes(1);
  });

  it('renders one ArtistTile per artist when the store is populated', () => {
    libraryArtists.set([
      { name: 'Hollow Tides', albumCount: 1 },
      { name: 'The Midnight Sun', albumCount: 2 },
      { name: 'Lunar Ways', albumCount: 3 },
    ]);
    const { container } = render(ArtistsPage);
    const strip = container.querySelector('.artists-strip');
    expect(strip).toBeTruthy();
    expect(strip?.childElementCount ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('handleTileTap calls fetchArtistAlbums(name) and cyclePageKind(-1)', () => {
    libraryArtists.set([{ name: 'Max Richter', albumCount: 5 }]);
    const { component } = render(ArtistsPage) as { component: { handleTileTap?: (name: string) => void } };
    expect(component.handleTileTap).toBeDefined();
    component.handleTileTap!('Max Richter');
    expect(libraryActions.fetchArtistAlbums).toHaveBeenCalledWith('Max Richter');
    expect(libraryActions.cyclePageKind).toHaveBeenCalledWith(-1);
  });
});
