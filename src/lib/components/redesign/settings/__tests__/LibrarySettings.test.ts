/**
 * LibrarySettings.test.ts
 * TDD: tests written BEFORE the component. All must fail initially.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';

// ---------------------------------------------------------------------------
// Hoist mocks — must be vi.hoisted so they are available before vi.mock calls
// ---------------------------------------------------------------------------

const { mockLibraryScope, mockLibrarySort, mockSetScope, mockSetSort, mockRebuildCache } =
  await vi.hoisted(async () => {
    const { writable } = await import('svelte/store');
    const mockSetScope = vi.fn();
    const mockSetSort = vi.fn();
    const mockRebuildCache = vi.fn();
    return {
      mockLibraryScope: writable<string>('all'),
      mockLibrarySort: writable<string>('alphabetical'),
      mockSetScope,
      mockSetSort,
      mockRebuildCache,
    };
  });

const { mockRescanLibrary } = await vi.hoisted(async () => {
  const mockRescanLibrary = vi.fn();
  return { mockRescanLibrary };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('$lib/stores/library', () => ({
  libraryScope: mockLibraryScope,
  librarySort: mockLibrarySort,
  libraryActions: {
    setScope: mockSetScope,
    setSort: mockSetSort,
    rebuildCache: mockRebuildCache,
  },
}));

vi.mock('$lib/stores/settings', () => ({
  settingsActions: {
    rescanLibrary: mockRescanLibrary,
  },
}));

// Stub SegmentedControl — renders a div[id] with buttons so we can fire onchange
vi.mock('$lib/components/redesign/controls/SegmentedControl.svelte', async () => {
  const { default: StubSegmented } = await import('./stubs/StubSegmentedControl.svelte');
  return { default: StubSegmented };
});

// Stub NasShareList — renders a recognisable sentinel
vi.mock(
  '$lib/components/redesign/settings/NasShareList.svelte',
  async () => {
    const { default: StubNasShareList } = await import('./stubs/StubNasShareList.svelte');
    return { default: StubNasShareList };
  }
);

// Import the component AFTER mocks are registered
import LibrarySettings from '../LibrarySettings.svelte';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LibrarySettings', () => {
  beforeEach(() => {
    mockLibraryScope.set('all');
    mockLibrarySort.set('alphabetical');
    vi.clearAllMocks();
  });

  // 1. Renders the column title
  it('renders column title "Library"', () => {
    const { getByText } = render(LibrarySettings);
    expect(getByText('Library')).toBeTruthy();
  });

  // 2. Renders Scope SegmentedControl with current libraryScope value
  it('renders Scope SegmentedControl with the current libraryScope value', () => {
    mockLibraryScope.set('nas');
    const { getByTestId } = render(LibrarySettings);
    const scopeControl = getByTestId('stub-segmented-settings-library-scope');
    expect(scopeControl.getAttribute('data-value')).toBe('nas');
  });

  // 3. Changing scope calls libraryActions.setScope
  it('calls libraryActions.setScope when scope SegmentedControl changes', async () => {
    const { getByTestId } = render(LibrarySettings);
    const scopeBtn = getByTestId('stub-segmented-settings-library-scope-change');
    await fireEvent.click(scopeBtn);
    expect(mockSetScope).toHaveBeenCalledOnce();
    expect(mockSetScope).toHaveBeenCalledWith('nas');
  });

  // 4. Renders Sort SegmentedControl with current librarySort value
  it('renders Sort SegmentedControl with the current librarySort value', () => {
    mockLibrarySort.set('by_artist');
    const { getByTestId } = render(LibrarySettings);
    const sortControl = getByTestId('stub-segmented-settings-library-sort');
    expect(sortControl.getAttribute('data-value')).toBe('by_artist');
  });

  // 5. Changing sort calls libraryActions.setSort
  it('calls libraryActions.setSort when sort SegmentedControl changes', async () => {
    // Default librarySort is 'alphabetical' (index 0); stub fires the next option = 'by_artist'
    const { getByTestId } = render(LibrarySettings);
    const sortBtn = getByTestId('stub-segmented-settings-library-sort-change');
    await fireEvent.click(sortBtn);
    expect(mockSetSort).toHaveBeenCalledOnce();
    expect(mockSetSort).toHaveBeenCalledWith('by_artist');
  });

  // 6. "Rebuild library cache" button click calls libraryActions.rebuildCache
  it('clicking "Rebuild library cache" calls libraryActions.rebuildCache', async () => {
    const { getByText } = render(LibrarySettings);
    await fireEvent.click(getByText('Rebuild library cache'));
    expect(mockRebuildCache).toHaveBeenCalledOnce();
  });

  // 7. "Rescan MPD" button click calls settingsActions.rescanLibrary
  it('clicking "Rescan MPD" calls settingsActions.rescanLibrary', async () => {
    const { getByText } = render(LibrarySettings);
    await fireEvent.click(getByText('Rescan MPD'));
    expect(mockRescanLibrary).toHaveBeenCalledOnce();
  });

  // 8. Renders NasShareList component — lazy-loaded since C6.2.
  //
  // NasShareList is now dynamically imported (plan §C6.2 — bundle-size split).
  // Vitest's `vi.mock` does not reliably intercept dynamic `import()` calls of
  // .svelte files when the real Vite-Svelte plugin is in the resolver chain,
  // so the stub-NasShareList sentinel approach used pre-C6 no longer works.
  // We instead assert the real NasShareList mounts under the "Network shares"
  // block once the dynamic import resolves — its `.nas-share-list` root is
  // a stable production marker.
  it('renders the NasShareList component', async () => {
    const { container } = render(LibrarySettings);
    await vi.waitFor(
      () => {
        const el = container.querySelector('.nas-share-list');
        if (!el) throw new Error('NasShareList not yet mounted');
        return el;
      },
      { timeout: 2000, interval: 25 },
    );
    expect(container.querySelector('.nas-share-list')).toBeTruthy();
  });

  // 9. Scope and Sort SegmentedControl have the expected ids
  it('Scope SegmentedControl has id="settings-library-scope"', () => {
    const { getByTestId } = render(LibrarySettings);
    const el = getByTestId('stub-segmented-settings-library-scope');
    expect(el.getAttribute('id')).toBe('settings-library-scope');
  });

  it('Sort SegmentedControl has id="settings-library-sort"', () => {
    const { getByTestId } = render(LibrarySettings);
    const el = getByTestId('stub-segmented-settings-library-sort');
    expect(el.getAttribute('id')).toBe('settings-library-sort');
  });
});
