/**
 * SystemSettings.test.ts
 * TDD: tests written BEFORE the component. All must fail initially.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { writable, readable, derived, get } from 'svelte/store';
import {
  standbyActive,
  standbyBrightness,
  standbyIdleMinutes,
  standbyActions
} from '$lib/stores/standby';

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

const { mockLcdState, mockLcdMode, mockLcdLoading, mockTurnOn, mockTurnOff, mockSetMode } =
  await vi.hoisted(async () => {
    const { writable } = await import('svelte/store');
    const mockTurnOn = vi.fn();
    const mockTurnOff = vi.fn();
    const mockSetMode = vi.fn();
    const mockLcdState = writable<'on' | 'off' | 'unknown'>('on');
    const mockLcdMode = writable<'live' | 'standby' | 'off' | 'unknown'>('live');
    const mockLcdLoading = writable<boolean>(false);
    return { mockLcdState, mockLcdMode, mockLcdLoading, mockTurnOn, mockTurnOff, mockSetMode };
  });

const { mockSchedule, mockScheduleUpdate, mockScheduleRefresh } = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return {
    mockSchedule: writable({
      autoOffEnabled: true,
      autoOffAt: '22:00',
      autoOffIdleMinutes: 60,
      autoRestoreEnabled: true,
      autoRestoreAt: '05:00'
    }),
    mockScheduleUpdate: vi.fn(),
    mockScheduleRefresh: vi.fn()
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

vi.mock('$lib/stores/lcd', () => {
  // isLcdOn is derived from lcdState
  const isLcdOn = derived(mockLcdState, ($s) => $s === 'on');
  return {
    lcdState: mockLcdState,
    isLcdOn,
    lcdLoading: mockLcdLoading,
    lcdMode: mockLcdMode,
    lcdActions: {
      turnOn: mockTurnOn,
      turnOff: mockTurnOff,
      setMode: mockSetMode,
      reportActivity: vi.fn(),
    },
  };
});

vi.mock('$lib/stores/lcdSchedule', () => ({
  lcdSchedule: mockSchedule,
  lcdScheduleActions: {
    update: mockScheduleUpdate,
    refresh: mockScheduleRefresh,
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

// Stub Toggle — renders a button[id][aria-pressed] that fires onchange
vi.mock('$lib/components/redesign/controls/Toggle.svelte', async () => {
  const { default: StubToggle } = await import('./stubs/StubToggle.svelte');
  return { default: StubToggle };
});

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
    mockLcdState.set('on');
    mockLcdLoading.set(false);
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

  // 15. Toggle reflects $isLcdOn (on state)
  it('Toggle reflects $isLcdOn as true when lcdState is "on"', () => {
    mockLcdState.set('on');
    const { container } = render(SystemSettings);
    const toggle = container.querySelector('#settings-system-lcd-power');
    expect(toggle).toBeTruthy();
    expect(toggle!.getAttribute('aria-pressed')).toBe('true');
  });

  // 16. Toggle reflects $isLcdOn as false when lcdState is "off"
  it('Toggle reflects $isLcdOn as false when lcdState is "off"', () => {
    mockLcdState.set('off');
    const { container } = render(SystemSettings);
    const toggle = container.querySelector('#settings-system-lcd-power');
    expect(toggle).toBeTruthy();
    expect(toggle!.getAttribute('aria-pressed')).toBe('false');
  });

  // 17. Toggling Toggle ON calls lcdActions.turnOn()
  it('toggling Toggle from off to on calls lcdActions.turnOn()', async () => {
    mockLcdState.set('off');
    const { container } = render(SystemSettings);
    const toggle = container.querySelector('#settings-system-lcd-power') as HTMLElement;
    await fireEvent.click(toggle);
    expect(mockTurnOn).toHaveBeenCalledOnce();
    expect(mockTurnOff).not.toHaveBeenCalled();
  });

  // 18. Toggling Toggle OFF calls lcdActions.turnOff()
  it('toggling Toggle from on to off calls lcdActions.turnOff()', async () => {
    mockLcdState.set('on');
    const { container } = render(SystemSettings);
    const toggle = container.querySelector('#settings-system-lcd-power') as HTMLElement;
    await fireEvent.click(toggle);
    expect(mockTurnOff).toHaveBeenCalledOnce();
    expect(mockTurnOn).not.toHaveBeenCalled();
  });

  // 19. Toggle shows loading when $lcdLoading is true
  it('Toggle has loading state when $lcdLoading is true', () => {
    mockLcdLoading.set(true);
    const { container } = render(SystemSettings);
    const toggle = container.querySelector('#settings-system-lcd-power');
    expect(toggle!.getAttribute('data-loading')).toBe('true');
  });

  // 20. Toggle has id="settings-system-lcd-power"
  it('Toggle has id="settings-system-lcd-power"', () => {
    const { container } = render(SystemSettings);
    expect(container.querySelector('#settings-system-lcd-power')).toBeTruthy();
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
    mockLcdState.set('on');
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

// ---------------------------------------------------------------------------
// Standby controls
//
// Standby and "LCD on" are two different hardware states on this panel, so the
// column offers both. These assert the settings surface drives the real store,
// not that the overlay renders (StandbyOverlay.test.ts covers that).
// ---------------------------------------------------------------------------

describe('SystemSettings standby controls', () => {
  beforeEach(() => {
    standbyActive.set(false);
    standbyActions.setBrightness(55);
    standbyActions.setIdleMinutes(30);
  });

  it('"Standby now" puts the screen into standby', async () => {
    const { getByTestId } = render(SystemSettings);
    await fireEvent.click(getByTestId('system-standby-now'));
    expect(get(standbyActive)).toBe(true);
  });

  it('the brightness slider shows and writes the stored value', async () => {
    const { getByTestId, getByText } = render(SystemSettings);
    const slider = getByTestId('system-standby-brightness') as HTMLInputElement;
    expect(slider.value).toBe('55');
    expect(getByText('55%')).toBeTruthy();

    await fireEvent.input(slider, { target: { value: '20' } });
    expect(get(standbyBrightness)).toBe(20);
  });

  it('the brightness slider floor keeps the clock legible rather than black', () => {
    const { getByTestId } = render(SystemSettings);
    const slider = getByTestId('system-standby-brightness') as HTMLInputElement;
    expect(slider.min).toBe('8');
    expect(slider.max).toBe('100');
  });

  it('the idle selector writes the chosen interval', async () => {
    const { container } = render(SystemSettings);
    const select = container.querySelector(
      '#settings-system-standby-idle'
    ) as HTMLSelectElement;
    expect(select.value).toBe('30');

    await fireEvent.change(select, { target: { value: '60' } });
    expect(get(standbyIdleMinutes)).toBe(60);
  });

  it('offers "Never" so the idle rule can be switched off entirely', async () => {
    const { container } = render(SystemSettings);
    const select = container.querySelector(
      '#settings-system-standby-idle'
    ) as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: '0' } });
    expect(get(standbyIdleMinutes)).toBe(0);
  });
});

describe('SystemSettings — overnight schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchedule.set({
      autoOffEnabled: true,
      autoOffAt: '22:00',
      autoOffIdleMinutes: 60,
      autoRestoreEnabled: true,
      autoRestoreAt: '05:00'
    });
  });

  it('shows the auto-off schedule the backend reported', () => {
    const { container } = render(SystemSettings);
    const at = container.querySelector('#settings-system-lcd-autooff-at') as HTMLSelectElement;
    const idle = container.querySelector('#settings-system-lcd-autooff-idle') as HTMLSelectElement;
    expect(at.value).toBe('22:00');
    expect(idle.value).toBe('60');
  });

  it('sends only the field that changed', async () => {
    const { container } = render(SystemSettings);
    const at = container.querySelector('#settings-system-lcd-autooff-at') as HTMLSelectElement;
    await fireEvent.change(at, { target: { value: '23:30' } });
    expect(mockScheduleUpdate).toHaveBeenCalledWith({ autoOffAt: '23:30' });
  });

  it('sends the idle threshold as a number, which is what the backend parses', async () => {
    const { container } = render(SystemSettings);
    const idle = container.querySelector('#settings-system-lcd-autooff-idle') as HTMLSelectElement;
    await fireEvent.change(idle, { target: { value: '120' } });
    expect(mockScheduleUpdate).toHaveBeenCalledWith({ autoOffIdleMinutes: 120 });
  });

  it('hides the auto-off detail when the schedule is off', () => {
    mockSchedule.set({
      autoOffEnabled: false,
      autoOffAt: '22:00',
      autoOffIdleMinutes: 60,
      autoRestoreEnabled: true,
      autoRestoreAt: '05:00'
    });
    const { container } = render(SystemSettings);
    expect(container.querySelector('#settings-system-lcd-autooff-at')).toBeNull();
    expect(container.querySelector('#settings-system-lcd-autooff-idle')).toBeNull();
  });

  it('toggles the auto-off schedule', async () => {
    const { container } = render(SystemSettings);
    await fireEvent.click(container.querySelector('#settings-system-lcd-autooff')!);
    expect(mockScheduleUpdate).toHaveBeenCalledWith({ autoOffEnabled: false });
  });

  it('shows and sets the morning restore time', async () => {
    const { container } = render(SystemSettings);
    const at = container.querySelector('#settings-system-lcd-autorestore-at') as HTMLSelectElement;
    expect(at.value).toBe('05:00');
    await fireEvent.change(at, { target: { value: '06:30' } });
    expect(mockScheduleUpdate).toHaveBeenCalledWith({ autoRestoreAt: '06:30' });
  });

  it('hides the restore time when restore is off', () => {
    mockSchedule.set({
      autoOffEnabled: true,
      autoOffAt: '22:00',
      autoOffIdleMinutes: 60,
      autoRestoreEnabled: false,
      autoRestoreAt: '05:00'
    });
    const { container } = render(SystemSettings);
    expect(container.querySelector('#settings-system-lcd-autorestore-at')).toBeNull();
  });

  // The restore brings the clock face back, not the player. Saying so is the
  // only way a user can tell the schedule worked at all from across the room.
  it('says the morning restore lands on the clock, not the UI', () => {
    const { getByText } = render(SystemSettings);
    expect(getByText(/comes back to the clock/i)).toBeTruthy();
  });

  // A value set from another client (or an older default) is not in the list;
  // selectedIndex -1 would render a blank control that invites an overwrite.
  it('keeps an off-list idle value visible instead of blanking the select', () => {
    mockSchedule.set({
      autoOffEnabled: true,
      autoOffAt: '22:00',
      autoOffIdleMinutes: 90,
      autoRestoreEnabled: true,
      autoRestoreAt: '05:00'
    });
    const { container } = render(SystemSettings);
    const idle = container.querySelector('#settings-system-lcd-autooff-idle') as HTMLSelectElement;
    expect(idle.value).toBe('90');
  });
});
