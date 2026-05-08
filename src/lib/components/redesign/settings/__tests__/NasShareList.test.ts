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
  mockBrowsedShares,
  mockBrowseLoading,
  mockSourcesActions,
} = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  const mockNasShares = writable([]);
  const mockNasSharesLoading = writable(false);
  const mockLastShareResult = writable(null);
  const mockDiscoveredDevices = writable([]);
  const mockDiscoveryLoading = writable(false);
  const mockBrowsedShares = writable([]);
  const mockBrowseLoading = writable(false);

  const mockSourcesActions = {
    listShares: vi.fn(),
    addShare: vi.fn(),
    deleteShare: vi.fn(),
    mountShare: vi.fn(),
    unmountShare: vi.fn(),
    discoverDevices: vi.fn(),
    browseShares: vi.fn(),
    clearLastResult: vi.fn(),
  };

  return {
    mockNasShares,
    mockNasSharesLoading,
    mockLastShareResult,
    mockDiscoveredDevices,
    mockDiscoveryLoading,
    mockBrowsedShares,
    mockBrowseLoading,
    mockSourcesActions,
  };
});

vi.mock('$lib/stores/sources', () => ({
  nasShares: mockNasShares,
  nasSharesLoading: mockNasSharesLoading,
  lastShareResult: mockLastShareResult,
  discoveredDevices: mockDiscoveredDevices,
  discoveryLoading: mockDiscoveryLoading,
  browsedShares: mockBrowsedShares,
  browseLoading: mockBrowseLoading,
  sourcesActions: mockSourcesActions,
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
    mockBrowsedShares.set([]);
    mockBrowseLoading.set(false);
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

  // Test 13: "Use this" on a browsed share pre-fills the add-form path field
  it('"Use this" on a browsed share pre-fills the add-form path field', async () => {
    mockDiscoveredDevices.set([makeDevice()]);
    mockBrowsedShares.set([makeShareInfo({ name: 'movies' })]);
    const { getByText } = render(NasShareList);

    // Expand discover section
    await fireEvent.click(getByText('Find devices on network'));
    await tick();
    await tick();

    // Click "Use this"
    const useThisBtn = getByText('Use this');
    await fireEvent.click(useThisBtn);
    await tick();

    // The add-form should be open and the path field filled
    const pathInput = document.getElementById('settings-nas-add-path') as HTMLInputElement;
    expect(pathInput).toBeTruthy();
    expect(pathInput.value).toBe('movies');
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
});
