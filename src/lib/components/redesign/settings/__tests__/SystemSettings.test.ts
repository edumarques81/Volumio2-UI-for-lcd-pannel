/**
 * SystemSettings.test.ts
 * TDD: tests written BEFORE the component. All must fail initially.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// ---------------------------------------------------------------------------
// Hoist mocks — must be vi.hoisted so they are available before vi.mock calls
// ---------------------------------------------------------------------------

const {
  mockSystemInfo,
  mockNetworkStatus,
  mockRestart,
  mockShutdown,
} = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  const mockRestart = vi.fn();
  const mockShutdown = vi.fn();
  return {
    mockSystemInfo: writable<{
      host: string;
      hardware: string;
      builddate: string;
    } | null>(null),
    mockNetworkStatus: writable<{ online: boolean; ip?: string }>({
      online: true,
      ip: '192.168.1.100',
    }),
    mockRestart,
    mockShutdown,
  };
});

const { mockFrontendVersion, mockBackendVersion } = await vi.hoisted(async () => {
  const { readable, writable } = await import('svelte/store');
  return {
    mockFrontendVersion: readable({ name: 'Stellar Volumio', version: '0.1.0' }),
    mockBackendVersion: writable<{ version: string } | null>({ version: '1.2.3' }),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('$lib/stores/settings', () => ({
  systemInfo: mockSystemInfo,
  networkStatus: mockNetworkStatus,
  settingsActions: {
    restart: mockRestart,
    shutdown: mockShutdown,
  },
}));

vi.mock('$lib/stores/version', () => ({
  frontendVersion: mockFrontendVersion,
  backendVersion: mockBackendVersion,
}));

vi.mock('$lib/config', () => ({
  getVolumioHost: () => 'http://192.168.86.25:3000',
}));

// Socket stub that lets a test fire `system:action:error` the way the backend
// does when a power command is refused or its exec fails.
const { mockSocketHandlers, mockSocketOn } = await vi.hoisted(async () => {
  const mockSocketHandlers = new Map<string, (data: unknown) => void>();
  const mockSocketOn = vi.fn((event: string, cb: (data: unknown) => void) => {
    mockSocketHandlers.set(event, cb);
    return () => mockSocketHandlers.delete(event);
  });
  return { mockSocketHandlers, mockSocketOn };
});

vi.mock('$lib/services/socket', () => ({
  socketService: { on: mockSocketOn, emit: vi.fn() },
}));

// Stub ConfirmDialog — renders a div[role=dialog] when open is true
vi.mock('$lib/components/redesign/settings/ConfirmDialog.svelte', async () => {
  const { default: StubConfirmDialog } = await import('./stubs/StubConfirmDialog.svelte');
  return { default: StubConfirmDialog };
});

// Import the component AFTER mocks are registered
import SystemSettings from '../SystemSettings.svelte';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SystemSettings', () => {
  beforeEach(() => {
    mockSystemInfo.set({
      host: 'volumio.local',
      hardware: 'Raspberry Pi 5',
      builddate: '2026-01-15',
    });
    mockNetworkStatus.set({ online: true, ip: '192.168.1.100' });
    mockBackendVersion.set({ version: '1.2.3' });
    vi.clearAllMocks();
  });

  // 1. Renders column title "System"
  it('renders column title "System"', () => {
    const { getByRole } = render(SystemSettings);
    const heading = getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('System');
  });

  // 2. Renders frontend version
  it('renders frontend version name and version from $frontendVersion', () => {
    const { getByText } = render(SystemSettings);
    expect(getByText('Stellar Volumio')).toBeTruthy();
    expect(getByText('0.1.0')).toBeTruthy();
  });

  // 3. Renders backend version when available
  it('renders backend version from $backendVersion', () => {
    const { getByText } = render(SystemSettings);
    expect(getByText('1.2.3')).toBeTruthy();
  });

  // 4. Renders "unknown" when backendVersion is null
  it('renders "unknown" when $backendVersion is null', async () => {
    mockBackendVersion.set(null);
    const { getByText } = render(SystemSettings);
    expect(getByText('unknown')).toBeTruthy();
  });

  // 5. Renders backend URL from getVolumioHost()
  it('renders backend URL from getVolumioHost()', () => {
    const { getByText } = render(SystemSettings);
    expect(getByText('http://192.168.86.25:3000')).toBeTruthy();
  });

  // 6. Renders hostname from $systemInfo
  it('renders hostname from $systemInfo.host', () => {
    const { getByText } = render(SystemSettings);
    expect(getByText('volumio.local')).toBeTruthy();
  });

  // 7. Renders hardware from $systemInfo
  it('renders hardware from $systemInfo.hardware', () => {
    const { getByText } = render(SystemSettings);
    expect(getByText('Raspberry Pi 5')).toBeTruthy();
  });

  // 8. Renders builddate from $systemInfo
  it('renders build date from $systemInfo.builddate', () => {
    const { getByText } = render(SystemSettings);
    expect(getByText('2026-01-15')).toBeTruthy();
  });

  // 9. Shows em-dash placeholders when $systemInfo is null
  it('shows "—" placeholders for hostname/hardware/builddate when $systemInfo is null', () => {
    mockSystemInfo.set(null);
    const { getAllByText } = render(SystemSettings);
    // At least 3 em-dashes for host, hardware, builddate
    const dashes = getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  // 10. Network badge shows "Online" when $networkStatus.online === true
  it('network badge shows "Online" when online is true', () => {
    mockNetworkStatus.set({ online: true, ip: '192.168.1.100' });
    const { getByText } = render(SystemSettings);
    expect(getByText('Online')).toBeTruthy();
  });

  // 11. Network badge shows "Offline" when $networkStatus.online === false
  it('network badge shows "Offline" when online is false', async () => {
    mockNetworkStatus.set({ online: false });
    const { getByText } = render(SystemSettings);
    expect(getByText('Offline')).toBeTruthy();
  });

  // 12. Network badge has green styling for online
  it('network badge has online class when online is true', () => {
    mockNetworkStatus.set({ online: true, ip: '192.168.1.100' });
    const { container } = render(SystemSettings);
    const badge = container.querySelector('.network-badge');
    expect(badge).toBeTruthy();
    expect(badge!.classList.contains('online')).toBe(true);
  });

  // 13. Network badge has offline styling when offline
  it('network badge has offline class when online is false', async () => {
    mockNetworkStatus.set({ online: false });
    const { container } = render(SystemSettings);
    const badge = container.querySelector('.network-badge');
    expect(badge).toBeTruthy();
    expect(badge!.classList.contains('offline')).toBe(true);
  });

  // 14. Renders network IP when present
  it('renders network IP when $networkStatus.ip is present', () => {
    mockNetworkStatus.set({ online: true, ip: '10.0.0.42' });
    const { getByText } = render(SystemSettings);
    expect(getByText('10.0.0.42')).toBeTruthy();
  });

  // 21. Click "Reboot Stellar" opens the reboot ConfirmDialog
  it('clicking "Reboot Stellar" opens the reboot ConfirmDialog', async () => {
    const { getByText, queryByRole } = render(SystemSettings);
    expect(queryByRole('dialog')).toBeNull();
    await fireEvent.click(getByText('Reboot Stellar'));
    expect(queryByRole('dialog')).toBeTruthy();
  });

  // 22. Confirming reboot calls settingsActions.restart() and closes the dialog
  it('confirming reboot calls settingsActions.restart() and closes dialog', async () => {
    const { getByText, queryByRole } = render(SystemSettings);
    await fireEvent.click(getByText('Reboot Stellar'));
    expect(queryByRole('dialog')).toBeTruthy();
    // The stub dialog renders the confirmLabel prop as the button text ("Reboot")
    await fireEvent.click(getByText('Reboot'));
    expect(mockRestart).toHaveBeenCalledOnce();
    expect(queryByRole('dialog')).toBeNull();
  });

  // 23. Cancelling reboot does NOT call restart() and closes dialog
  it('cancelling reboot does NOT call settingsActions.restart() and closes dialog', async () => {
    const { getByText, queryByRole } = render(SystemSettings);
    await fireEvent.click(getByText('Reboot Stellar'));
    expect(queryByRole('dialog')).toBeTruthy();
    await fireEvent.click(getByText('Cancel'));
    expect(mockRestart).not.toHaveBeenCalled();
    expect(queryByRole('dialog')).toBeNull();
  });

  // 24. Click "Shutdown Stellar" opens the shutdown ConfirmDialog
  it('clicking "Shutdown Stellar" opens the shutdown ConfirmDialog', async () => {
    const { getByText, queryByRole } = render(SystemSettings);
    expect(queryByRole('dialog')).toBeNull();
    await fireEvent.click(getByText('Shutdown Stellar'));
    expect(queryByRole('dialog')).toBeTruthy();
  });

  // 25. Shutdown ConfirmDialog uses destructive variant
  it('shutdown ConfirmDialog has destructive attribute', async () => {
    const { getByText, getByRole } = render(SystemSettings);
    await fireEvent.click(getByText('Shutdown Stellar'));
    const dialog = getByRole('dialog');
    expect(dialog.getAttribute('data-destructive')).toBe('true');
  });

  // 26. Confirming shutdown calls settingsActions.shutdown() and closes dialog
  it('confirming shutdown calls settingsActions.shutdown() and closes dialog', async () => {
    const { getByText, queryByRole } = render(SystemSettings);
    await fireEvent.click(getByText('Shutdown Stellar'));
    expect(queryByRole('dialog')).toBeTruthy();
    // The stub dialog renders the confirmLabel prop as the button text ("Shutdown")
    await fireEvent.click(getByText('Shutdown'));
    expect(mockShutdown).toHaveBeenCalledOnce();
    expect(queryByRole('dialog')).toBeNull();
  });

  // 27. Cancelling shutdown does NOT call shutdown() and closes dialog
  it('cancelling shutdown does NOT call settingsActions.shutdown() and closes dialog', async () => {
    const { getByText, queryByRole } = render(SystemSettings);
    await fireEvent.click(getByText('Shutdown Stellar'));
    expect(queryByRole('dialog')).toBeTruthy();
    await fireEvent.click(getByText('Cancel'));
    expect(mockShutdown).not.toHaveBeenCalled();
    expect(queryByRole('dialog')).toBeNull();
  });
});

// A power command can fail AFTER the confirm dialog closes: the backend defers
// the exec by 3s, and a non-loopback caller is refused outright. This column
// used to render nothing in either case, so "Reboot" that could never work
// looked exactly like one that had not happened yet.
describe('SystemSettings power failure reporting', () => {
  beforeEach(() => {
    mockSystemInfo.set({ host: 'stellar', hardware: 'Raspberry Pi 5', builddate: '2026-01-15' });
    mockNetworkStatus.set({ online: true });
    mockSocketHandlers.clear();
    vi.clearAllMocks();
  });

  function fireActionError(payload: unknown): void {
    const handler = mockSocketHandlers.get('system:action:error');
    expect(handler, 'component must subscribe to system:action:error').toBeTruthy();
    handler!(payload);
  }

  it('subscribes to system:action:error on mount', () => {
    render(SystemSettings);
    expect(mockSocketOn).toHaveBeenCalledWith('system:action:error', expect.any(Function));
  });

  it('renders nothing until a failure arrives', () => {
    const { queryByTestId } = render(SystemSettings);
    expect(queryByTestId('system-power-error')).toBeNull();
  });

  it('surfaces the backend error text', async () => {
    const { findByTestId } = render(SystemSettings);
    fireActionError({ action: 'reboot', error: 'exit status 1' });
    const el = await findByTestId('system-power-error');
    expect(el.textContent).toContain('exit status 1');
  });

  it('surfaces an unauthorized refusal from a non-loopback client', async () => {
    const { findByTestId } = render(SystemSettings);
    fireActionError({ action: 'shutdown', error: 'unauthorized' });
    const el = await findByTestId('system-power-error');
    expect(el.textContent).toContain('unauthorized');
  });

  it('falls back to a generic label when the backend omits the error string', async () => {
    const { findByTestId } = render(SystemSettings);
    fireActionError({ action: 'reboot' });
    const el = await findByTestId('system-power-error');
    expect(el.textContent).toContain('unknown error');
    // The action name is not an error message; it must not be shown as one.
    expect(el.textContent).not.toContain('Power command failed: reboot');
  });

  it('clears a stale failure when a new reboot is confirmed', async () => {
    const { getByText, findByTestId, queryByTestId } = render(SystemSettings);
    fireActionError({ action: 'reboot', error: 'exit status 1' });
    await findByTestId('system-power-error');
    await fireEvent.click(getByText('Reboot Stellar'));
    await fireEvent.click(getByText('Reboot'));
    expect(queryByTestId('system-power-error')).toBeNull();
  });
});

