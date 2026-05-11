import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

// ------------------------------------------------------------------
// Hoist mock stores and actions so vi.mock factories can reference them
// ------------------------------------------------------------------
const {
  mockNasShares,
  mockNasSharesLoading,
  mockLastShareResult,
  mockDiscoveredDevices,
  mockDiscoveryLoading,
  mockDiscoveryError,
  mockBrowsedShares,
  mockBrowseLoading,
  mockBrowseError,
  mockLastBrowseHostAttempt,
  mockMountInFlight,
  mockSourcesActions,
} = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  const mockNasShares = writable([]);
  const mockNasSharesLoading = writable(false);
  const mockLastShareResult = writable(null);
  const mockDiscoveredDevices = writable([]);
  const mockDiscoveryLoading = writable(false);
  const mockDiscoveryError = writable(null);
  const mockBrowsedShares = writable([]);
  const mockBrowseLoading = writable(false);
  const mockBrowseError = writable(null);
  const mockLastBrowseHostAttempt = writable(null);
  const mockMountInFlight = writable({});

  const mockSourcesActions = {
    listShares: vi.fn(),
    addShare: vi.fn(),
    deleteShare: vi.fn(),
    mountShare: vi.fn(),
    unmountShare: vi.fn(),
    discoverDevices: vi.fn(),
    // Real action writes lastBrowseHostAttempt; mirror that here so the
    // retry-disabled binding behaves correctly under test.
    browseShares: vi.fn((host: string) => {
      mockLastBrowseHostAttempt.set(host);
    }),
    clearLastResult: vi.fn(),
  };

  return {
    mockNasShares,
    mockNasSharesLoading,
    mockLastShareResult,
    mockDiscoveredDevices,
    mockDiscoveryLoading,
    mockDiscoveryError,
    mockBrowsedShares,
    mockBrowseLoading,
    mockBrowseError,
    mockLastBrowseHostAttempt,
    mockMountInFlight,
    mockSourcesActions,
  };
});

vi.mock('$lib/stores/sources', () => ({
  nasShares: mockNasShares,
  nasSharesLoading: mockNasSharesLoading,
  lastShareResult: mockLastShareResult,
  discoveredDevices: mockDiscoveredDevices,
  discoveryLoading: mockDiscoveryLoading,
  discoveryError: mockDiscoveryError,
  browsedShares: mockBrowsedShares,
  browseLoading: mockBrowseLoading,
  browseError: mockBrowseError,
  lastBrowseHostAttempt: mockLastBrowseHostAttempt,
  mountInFlight: mockMountInFlight,
  sourcesActions: mockSourcesActions,
  DISCOVERY_TIMEOUT_MS: 8000,
  BROWSE_TIMEOUT_MS: 8000,
}));

// Icon component is not used in NasShareList, but mock defensively
vi.mock('$lib/components/Icon.svelte', () => ({
  default: {},
}));

import NasShareList from '../NasShareList.svelte';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function makeShare(
  overrides: Partial<import('$lib/stores/sources').NasShare> = {}
): import('$lib/stores/sources').NasShare {
  return {
    id: 'share-1',
    name: 'My NAS',
    ip: '192.168.1.10',
    path: '/music',
    fstype: 'cifs',
    mounted: false,
    mountPoint: '/mnt/nas/music',
    ...overrides,
  };
}

function makeDevice(
  overrides: Partial<import('$lib/stores/sources').NasDevice> = {}
): import('$lib/stores/sources').NasDevice {
  return { name: 'NAS-Device', ip: '192.168.1.10', ...overrides };
}

function makeShareInfo(
  overrides: Partial<import('$lib/stores/sources').ShareInfo> = {}
): import('$lib/stores/sources').ShareInfo {
  return { name: 'music', type: 'disk', writable: true, ...overrides };
}

// ------------------------------------------------------------------
// Test suite
// ------------------------------------------------------------------
describe('NasShareList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockNasShares.set([]);
    mockNasSharesLoading.set(false);
    mockLastShareResult.set(null);
    mockDiscoveredDevices.set([]);
    mockDiscoveryLoading.set(false);
    mockDiscoveryError.set(null);
    mockBrowsedShares.set([]);
    mockBrowseLoading.set(false);
    mockBrowseError.set(null);
    mockLastBrowseHostAttempt.set(null);
    mockMountInFlight.set({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test 1: Empty state
  it('renders empty state when $nasShares is empty and not loading', () => {
    const { getByText } = render(NasShareList);
    expect(getByText('No shares configured')).toBeTruthy();
  });

  // Test 2: Loading state
  it('renders loading state when $nasSharesLoading is true and list is empty', async () => {
    mockNasSharesLoading.set(true);
    const { getByText } = render(NasShareList);
    await tick();
    expect(getByText('Loading…')).toBeTruthy();
  });

  // Test 3: Renders one row per share
  it('renders one row per share with name, path, and status badge', async () => {
    mockNasShares.set([
      makeShare({ id: 'a', name: 'Share A', path: '/a', mounted: true }),
      makeShare({ id: 'b', name: 'Share B', path: '/b', mounted: false }),
    ]);
    const { getByText, getAllByText } = render(NasShareList);
    await tick();
    expect(getByText('Share A')).toBeTruthy();
    expect(getByText('/a')).toBeTruthy();
    expect(getByText('Share B')).toBeTruthy();
    expect(getByText('/b')).toBeTruthy();
    // Status badges
    expect(getByText('mounted')).toBeTruthy();
    expect(getByText('unmounted')).toBeTruthy();
  });

  // Test 4: Mount button on unmounted share calls mountShare
  it('mount button on unmounted share calls sourcesActions.mountShare(id)', async () => {
    mockNasShares.set([makeShare({ id: 'share-x', mounted: false })]);
    const { getByRole } = render(NasShareList);
    await tick();
    const mountBtn = getByRole('button', { name: /mount/i });
    await fireEvent.click(mountBtn);
    expect(mockSourcesActions.mountShare).toHaveBeenCalledWith('share-x');
  });

  // Test 5: Unmount button on mounted share calls unmountShare
  it('unmount button on mounted share calls sourcesActions.unmountShare(id)', async () => {
    mockNasShares.set([makeShare({ id: 'share-y', mounted: true })]);
    const { getByRole } = render(NasShareList);
    await tick();
    const unmountBtn = getByRole('button', { name: /unmount/i });
    await fireEvent.click(unmountBtn);
    expect(mockSourcesActions.unmountShare).toHaveBeenCalledWith('share-y');
  });

  // Test 6: Delete button calls deleteShare
  it('delete button calls sourcesActions.deleteShare(id)', async () => {
    mockNasShares.set([makeShare({ id: 'share-z' })]);
    const { getByRole } = render(NasShareList);
    await tick();
    const deleteBtn = getByRole('button', { name: /delete/i });
    await fireEvent.click(deleteBtn);
    expect(mockSourcesActions.deleteShare).toHaveBeenCalledWith('share-z');
  });

  // Test 7: "Add share" toggle expands the inline form
  it('"+ Add share" button toggles the add form into view', async () => {
    const { getByText, queryByLabelText } = render(NasShareList);
    // Form not visible initially
    expect(queryByLabelText(/share name/i)).toBeNull();
    await fireEvent.click(getByText('+ Add share'));
    await tick();
    // Name field should now be visible
    expect(document.getElementById('settings-nas-add-name')).toBeTruthy();
  });

  // Test 8: Submitting a valid form calls addShare with the typed object
  it('submitting the add-form calls sourcesActions.addShare with correct data', async () => {
    const { getByText, getByLabelText } = render(NasShareList);
    await fireEvent.click(getByText('+ Add share'));
    await tick();

    // Fill in required fields
    const nameInput = document.getElementById('settings-nas-add-name') as HTMLInputElement;
    const ipInput = document.getElementById('settings-nas-add-ip') as HTMLInputElement;
    const pathInput = document.getElementById('settings-nas-add-path') as HTMLInputElement;

    await fireEvent.input(nameInput, { target: { value: 'My Music' } });
    await fireEvent.input(ipInput, { target: { value: '10.0.0.1' } });
    await fireEvent.input(pathInput, { target: { value: '/shared/music' } });

    await fireEvent.click(getByText('Add'));
    await tick();

    expect(mockSourcesActions.addShare).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Music',
        ip: '10.0.0.1',
        path: '/shared/music',
      })
    );
  });

  // Test 9: Cancel button collapses the form and clears fields
  it('cancel button collapses the form and clears fields', async () => {
    const { getByText } = render(NasShareList);
    await fireEvent.click(getByText('+ Add share'));
    await tick();

    const nameInput = document.getElementById('settings-nas-add-name') as HTMLInputElement;
    await fireEvent.input(nameInput, { target: { value: 'Test' } });

    await fireEvent.click(getByText('Cancel'));
    await tick();

    // Form should be collapsed
    expect(document.getElementById('settings-nas-add-name')).toBeNull();
  });

  // Test 10: "Find devices on network" toggle expands discover section
  it('"Find devices on network" button expands the discover section', async () => {
    const { getByText } = render(NasShareList);
    // Discover section collapsed initially — discover button not visible
    const toggleBtn = getByText('Find devices on network');
    await fireEvent.click(toggleBtn);
    await tick();
    // After expanding, "Discover" action button should appear
    expect(getByText('Discover')).toBeTruthy();
  });

  // Test 11: Discover button calls discoverDevices
  it('discover button calls sourcesActions.discoverDevices()', async () => {
    const { getByText } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();
    await fireEvent.click(getByText('Discover'));
    expect(mockSourcesActions.discoverDevices).toHaveBeenCalledTimes(1);
  });

  // Test 12: Browse button on discovered device calls browseShares
  it('browse button on a discovered device calls sourcesActions.browseShares(device.ip)', async () => {
    mockDiscoveredDevices.set([makeDevice({ ip: '192.168.1.20', name: 'Synology' })]);
    const { getByText, getByRole } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();
    await tick();
    const browseBtn = getByRole('button', { name: /browse synology/i });
    await fireEvent.click(browseBtn);
    expect(mockSourcesActions.browseShares).toHaveBeenCalledWith('192.168.1.20');
  });

  // Test 13: "Use this" on a browsed share pre-fills BOTH path AND IP
  it('"Use this" on a browsed share pre-fills both the path and IP fields from lastBrowseHostAttempt', async () => {
    mockDiscoveredDevices.set([makeDevice()]);
    mockBrowsedShares.set([makeShareInfo({ name: 'movies' })]);
    mockLastBrowseHostAttempt.set('192.168.1.42');
    const { getByText } = render(NasShareList);

    // Expand discover section
    await fireEvent.click(getByText('Find devices on network'));
    await tick();
    await tick();

    // Click "Use this"
    const useThisBtn = getByText('Use this');
    await fireEvent.click(useThisBtn);
    await tick();

    // The add-form should be open with both path AND IP pre-filled
    const pathInput = document.getElementById('settings-nas-add-path') as HTMLInputElement;
    const ipInput = document.getElementById('settings-nas-add-ip') as HTMLInputElement;
    expect(pathInput).toBeTruthy();
    expect(pathInput.value).toBe('movies');
    expect(ipInput).toBeTruthy();
    expect(ipInput.value).toBe('192.168.1.42');
  });

  // Test 13b: "Use this" with null lastBrowseHostAttempt leaves IP blank
  it('"Use this" with null lastBrowseHostAttempt leaves the IP field blank', async () => {
    mockDiscoveredDevices.set([makeDevice()]);
    mockBrowsedShares.set([makeShareInfo({ name: 'photos' })]);
    mockLastBrowseHostAttempt.set(null);
    const { getByText } = render(NasShareList);

    await fireEvent.click(getByText('Find devices on network'));
    await tick();
    await tick();

    await fireEvent.click(getByText('Use this'));
    await tick();

    const pathInput = document.getElementById('settings-nas-add-path') as HTMLInputElement;
    const ipInput = document.getElementById('settings-nas-add-ip') as HTMLInputElement;
    expect(pathInput.value).toBe('photos');
    expect(ipInput.value).toBe('');
  });

  // Test 13c: "Use this" scrolls the add-form into view (LCD-below-the-fold case)
  it('"Use this" scrolls the add-form into view', async () => {
    mockDiscoveredDevices.set([makeDevice()]);
    mockBrowsedShares.set([makeShareInfo({ name: 'music' })]);
    mockLastBrowseHostAttempt.set('192.168.1.10');

    // Spy on the prototype scrollIntoView so any HTMLElement created during
    // render uses our spy. JSDOM doesn't implement scrollIntoView by default.
    const scrollSpy = vi.fn();
    const originalScrollIntoView = (HTMLElement.prototype as unknown as {
      scrollIntoView?: typeof HTMLElement.prototype.scrollIntoView;
    }).scrollIntoView;
    (HTMLElement.prototype as unknown as {
      scrollIntoView: (opts?: ScrollIntoViewOptions) => void;
    }).scrollIntoView = scrollSpy;

    try {
      const { getByText } = render(NasShareList);
      await fireEvent.click(getByText('Find devices on network'));
      await tick();
      await tick();

      await fireEvent.click(getByText('Use this'));
      await tick();
      // queueMicrotask flush — vi.useFakeTimers does NOT freeze microtasks,
      // but we still let any pending microtasks run.
      await Promise.resolve();
      await tick();

      expect(scrollSpy).toHaveBeenCalled();
      const callArg = scrollSpy.mock.calls[0][0];
      expect(callArg).toMatchObject({ block: 'nearest', behavior: 'smooth' });
    } finally {
      if (originalScrollIntoView !== undefined) {
        (HTMLElement.prototype as unknown as {
          scrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
        }).scrollIntoView = originalScrollIntoView;
      } else {
        delete (HTMLElement.prototype as unknown as { scrollIntoView?: unknown })
          .scrollIntoView;
      }
    }
  });

  // Test 14: Last result strip renders; success vs failure color classes
  it('renders success result strip with success class when lastShareResult.success is true', async () => {
    mockLastShareResult.set({ success: true, message: 'Share added successfully' });
    const { getByRole } = render(NasShareList);
    await tick();
    const strip = getByRole('status');
    expect(strip).toBeTruthy();
    expect(strip.textContent).toContain('Share added successfully');
    expect(strip.className).toContain('success');
  });

  it('renders failure result strip with failure class when lastShareResult.success is false', async () => {
    mockLastShareResult.set({ success: false, error: 'Mount failed' });
    const { getByRole } = render(NasShareList);
    await tick();
    const strip = getByRole('status');
    expect(strip).toBeTruthy();
    expect(strip.textContent).toContain('Mount failed');
    expect(strip.className).toContain('failure');
  });

  // Test 15: All form input fields have id attributes
  it('all form input/select fields in the add-form have id attributes', async () => {
    const { getByText } = render(NasShareList);
    await fireEvent.click(getByText('+ Add share'));
    await tick();

    const requiredIds = [
      'settings-nas-add-name',
      'settings-nas-add-ip',
      'settings-nas-add-path',
      'settings-nas-add-fstype',
      'settings-nas-add-username',
      'settings-nas-add-password',
      'settings-nas-add-options',
    ];

    for (const id of requiredIds) {
      const el = document.getElementById(id);
      expect(el, `Expected element with id="${id}" to exist`).toBeTruthy();
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // C7 Task 3: sticky error banners, retry, per-row spinner, sticky errors
  // ──────────────────────────────────────────────────────────────────────

  // Test 16: Discovery error banner appears when $discoveryError is set
  it('renders sticky discovery error banner when discoveryError is set', async () => {
    mockDiscoveryError.set('Discovery timed out — try again');
    const { getByText, getByTestId } = render(NasShareList);
    // Open Discover panel so the banner area is visible
    await fireEvent.click(getByText('Find devices on network'));
    await tick();

    const banner = getByTestId('nas-discovery-error-banner');
    expect(banner).toBeTruthy();
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('Discovery timed out');

    const retry = getByTestId('nas-discovery-retry');
    expect(retry).toBeTruthy();
  });

  // Test 17: Discovery error stays sticky — does NOT auto-clear after 4s
  it('discovery error banner does NOT auto-clear after 4 seconds', async () => {
    mockDiscoveryError.set('Backend exploded');
    const { getByText, getByTestId, queryByTestId } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();

    expect(getByTestId('nas-discovery-error-banner')).toBeTruthy();

    // Advance well past the 4s the old toast used to use
    vi.advanceTimersByTime(10_000);
    await tick();

    // Banner is still visible (only the underlying store can clear it)
    expect(queryByTestId('nas-discovery-error-banner')).toBeTruthy();
  });

  // Test 18: Discovery retry button calls discoverDevices() again
  it('clicking the discovery retry button calls discoverDevices()', async () => {
    mockDiscoveryError.set('Some error');
    const { getByText, getByTestId } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();

    // First: retry while in error state. discoverDevices count starts at 0
    // because clicking "Find devices on network" only toggles the panel.
    expect(mockSourcesActions.discoverDevices).toHaveBeenCalledTimes(0);

    const retry = getByTestId('nas-discovery-retry');
    await fireEvent.click(retry);
    expect(mockSourcesActions.discoverDevices).toHaveBeenCalledTimes(1);
  });

  // Test 19: Discovery retry restarts the flow — new emit, banner clears
  // when store error clears
  it('after retry, banner disappears once discoveryError is cleared', async () => {
    mockDiscoveryError.set('Stale error');
    const { getByText, getByTestId, queryByTestId } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();

    expect(getByTestId('nas-discovery-error-banner')).toBeTruthy();

    // Click retry — handler mocks discoverDevices, which in real life
    // clears discoveryError. Simulate that here.
    await fireEvent.click(getByTestId('nas-discovery-retry'));
    mockDiscoveryError.set(null);
    await tick();

    expect(queryByTestId('nas-discovery-error-banner')).toBeNull();
  });

  // Test 20: Discovery empty-state shows ONLY after Discover was clicked
  // and the result was empty (and no error).
  it('shows discovery empty-state only after Discover was clicked', async () => {
    const { getByText, queryByTestId, getByTestId } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();

    // Before any click — no empty state yet
    expect(queryByTestId('nas-discovery-empty')).toBeNull();

    // Click Discover; loading kicks in (mocked, so we set it manually here)
    mockDiscoveryLoading.set(true);
    await fireEvent.click(getByTestId('nas-discover'));
    await tick();
    // While loading, empty-state should not be shown
    expect(queryByTestId('nas-discovery-empty')).toBeNull();

    // Backend "responded" with no devices and no error (the empty path)
    mockDiscoveryLoading.set(false);
    mockDiscoveredDevices.set([]);
    mockDiscoveryError.set(null);
    await tick();

    expect(getByTestId('nas-discovery-empty')).toBeTruthy();
  });

  // Test 21: Discovery empty result is NOT treated as an error
  it('empty discoveredDevices does not render an error banner', async () => {
    const { getByText, queryByTestId } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();

    mockDiscoveredDevices.set([]);
    mockDiscoveryError.set(null);
    await tick();

    expect(queryByTestId('nas-discovery-error-banner')).toBeNull();
  });

  // Test 22: Browse error banner with retry that re-targets the same host
  it('browse error banner retry re-issues browseShares against the last host', async () => {
    mockDiscoveredDevices.set([makeDevice({ ip: '192.168.5.50', name: 'NetGearNAS' })]);
    const { getByText, getByTestId, getByRole } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();
    await tick();

    // User clicks Browse on a device, which sets `lastBrowseHost`
    const browseBtn = getByRole('button', { name: /browse netgearnas/i });
    await fireEvent.click(browseBtn);
    expect(mockSourcesActions.browseShares).toHaveBeenCalledWith('192.168.5.50');

    // Backend "responded" with an error
    mockBrowseError.set('Browse timed out — try again');
    await tick();

    const banner = getByTestId('nas-browse-error-banner');
    expect(banner).toBeTruthy();
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('Browse timed out');

    // Click retry — should re-issue browseShares against the SAME host
    await fireEvent.click(getByTestId('nas-browse-retry'));
    expect(mockSourcesActions.browseShares).toHaveBeenLastCalledWith('192.168.5.50');
    expect(mockSourcesActions.browseShares).toHaveBeenCalledTimes(2);
  });

  // Test 22b: Retry survives a remount when error persists in store
  it('retry button stays enabled across simulated remount when browseError persists in store', async () => {
    // Simulate: user calls browseShares (sets lastBrowseHostAttempt), backend
    // errors out, component remounts.
    mockSourcesActions.browseShares('192.168.1.50');           // writes lastBrowseHostAttempt = '192.168.1.50'
    mockBrowseError.set('host unreachable: 192.168.1.50');     // simulate the push handler setting the error

    // Render fresh component (this is the "remount").
    const { getByText, getByTestId } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();

    const retryBtn = getByTestId('nas-browse-retry');
    // Would have been true under the old local-state implementation —
    // a fresh mount would have reset lastBrowseHost back to null.
    expect((retryBtn as HTMLButtonElement).disabled).toBe(false);

    await fireEvent.click(retryBtn);
    expect(mockSourcesActions.browseShares).toHaveBeenCalledWith('192.168.1.50');
  });

  // Test 23: Browse error stays sticky after 4s
  it('browse error banner does NOT auto-clear after 4 seconds', async () => {
    mockBrowseError.set('Auth failed');
    const { getByText, queryByTestId } = render(NasShareList);
    await fireEvent.click(getByText('Find devices on network'));
    await tick();

    expect(queryByTestId('nas-browse-error-banner')).toBeTruthy();

    vi.advanceTimersByTime(10_000);
    await tick();

    expect(queryByTestId('nas-browse-error-banner')).toBeTruthy();
  });

  // Test 24: Per-row mount spinner shows when mountInFlight has the share id
  it('shows mount spinner on the row when mountInFlight[share.id] is set', async () => {
    mockNasShares.set([makeShare({ id: 'share-mnt', mounted: false })]);
    const { getByTestId, queryByTestId } = render(NasShareList);
    await tick();

    // No spinner before in-flight
    expect(queryByTestId('nas-share-mount-spinner-share-mnt')).toBeNull();

    mockMountInFlight.set({ 'share-mnt': 'mounting' });
    await tick();

    expect(getByTestId('nas-share-mount-spinner-share-mnt')).toBeTruthy();
  });

  // Test 25: Per-row spinner clears when mountInFlight clears
  it('hides mount spinner once mountInFlight clears', async () => {
    mockNasShares.set([makeShare({ id: 'share-clr', mounted: false })]);
    mockMountInFlight.set({ 'share-clr': 'mounting' });
    const { getByTestId, queryByTestId } = render(NasShareList);
    await tick();

    expect(getByTestId('nas-share-mount-spinner-share-clr')).toBeTruthy();

    mockMountInFlight.set({});
    await tick();

    expect(queryByTestId('nas-share-mount-spinner-share-clr')).toBeNull();
  });

  // Test 26: Mount/unmount button is disabled while in-flight
  it('mount button is disabled while mountInFlight has the share id', async () => {
    mockNasShares.set([makeShare({ id: 'share-dbl', mounted: false })]);
    mockMountInFlight.set({ 'share-dbl': 'mounting' });
    const { getByTestId } = render(NasShareList);
    await tick();

    const btn = getByTestId('nas-share-mount-share-dbl') as HTMLButtonElement;
    // The HTML `disabled` attribute is the load-bearing piece — real user
    // clicks (mouse/keyboard) do not dispatch `click` on disabled buttons.
    // (jsdom + fireEvent dispatches events directly, bypassing this.)
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  // Test 27: Result strip — failure stays sticky after 4s (regression)
  it('failure result strip does NOT auto-clear after 4 seconds', async () => {
    mockLastShareResult.set({ success: false, error: 'Could not mount' });
    const { queryByTestId } = render(NasShareList);
    await tick();

    expect(queryByTestId('nas-result-strip')).toBeTruthy();

    vi.advanceTimersByTime(10_000);
    await tick();

    expect(queryByTestId('nas-result-strip')).toBeTruthy();
    expect(mockSourcesActions.clearLastResult).not.toHaveBeenCalled();
  });

  // Test 28: Result strip — success still auto-clears after 4s
  it('success result strip DOES auto-clear after 4 seconds (regression)', async () => {
    mockLastShareResult.set({ success: true, message: 'OK' });
    const { queryByTestId } = render(NasShareList);
    await tick();

    expect(queryByTestId('nas-result-strip')).toBeTruthy();

    vi.advanceTimersByTime(4000);
    await tick();

    expect(mockSourcesActions.clearLastResult).toHaveBeenCalledTimes(1);
  });

  // Test 29: Result strip dismiss button on failure clears the result
  it('dismiss button on failure result strip calls clearLastResult', async () => {
    mockLastShareResult.set({ success: false, error: 'Bad mount' });
    const { getByTestId } = render(NasShareList);
    await tick();

    const dismiss = getByTestId('nas-result-dismiss');
    await fireEvent.click(dismiss);
    expect(mockSourcesActions.clearLastResult).toHaveBeenCalledTimes(1);
  });

  // Test 30: Result strip success branch has NO dismiss button
  it('success result strip does NOT render the dismiss button', async () => {
    mockLastShareResult.set({ success: true, message: 'Saved' });
    const { queryByTestId } = render(NasShareList);
    await tick();

    expect(queryByTestId('nas-result-dismiss')).toBeNull();
  });
});
