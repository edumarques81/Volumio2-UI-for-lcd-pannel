/**
 * DisplaySettings.test.ts
 *
 * The Display column: panel power, the overnight schedules, and standby.
 * Split out of SystemSettings on 2026-10-18 -- the single System column ran
 * 1448px of content into a 440px panel, so everything below the LCD toggle
 * was undiscoverable at rest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { derived, get } from 'svelte/store';
import {
  standbyActive,
  standbyBrightness,
  standbyIdleMinutes,
  standbyActions
} from '$lib/stores/standby';

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

vi.mock('$lib/services/socket', () => ({
  socketService: { on: vi.fn(() => () => {}), emit: vi.fn() },
}));

// Stub Toggle -- renders a button[id][aria-pressed] that fires onchange
vi.mock('$lib/components/redesign/controls/Toggle.svelte', async () => {
  const { default: StubToggle } = await import('./stubs/StubToggle.svelte');
  return { default: StubToggle };
});

// Import the component AFTER mocks are registered
import DisplaySettings from '../DisplaySettings.svelte';

describe('DisplaySettings panel power', () => {
  beforeEach(() => {
    mockLcdState.set('on');
    mockLcdLoading.set(false);
    vi.clearAllMocks();
  });

  it('renders column title "Display"', () => {
    const { getByRole } = render(DisplaySettings);
    expect(getByRole('heading', { level: 2 }).textContent).toBe('Display');
  });

  // 15. Toggle reflects $isLcdOn (on state)
  it('Toggle reflects $isLcdOn as true when lcdState is "on"', () => {
    mockLcdState.set('on');
    const { container } = render(DisplaySettings);
    const toggle = container.querySelector('#settings-system-lcd-power');
    expect(toggle).toBeTruthy();
    expect(toggle!.getAttribute('aria-pressed')).toBe('true');
  });

  // 16. Toggle reflects $isLcdOn as false when lcdState is "off"
  it('Toggle reflects $isLcdOn as false when lcdState is "off"', () => {
    mockLcdState.set('off');
    const { container } = render(DisplaySettings);
    const toggle = container.querySelector('#settings-system-lcd-power');
    expect(toggle).toBeTruthy();
    expect(toggle!.getAttribute('aria-pressed')).toBe('false');
  });

  // 17. Toggling Toggle ON calls lcdActions.turnOn()
  it('toggling Toggle from off to on calls lcdActions.turnOn()', async () => {
    mockLcdState.set('off');
    const { container } = render(DisplaySettings);
    const toggle = container.querySelector('#settings-system-lcd-power') as HTMLElement;
    await fireEvent.click(toggle);
    expect(mockTurnOn).toHaveBeenCalledOnce();
    expect(mockTurnOff).not.toHaveBeenCalled();
  });

  // 18. Toggling Toggle OFF calls lcdActions.turnOff()
  it('toggling Toggle from on to off calls lcdActions.turnOff()', async () => {
    mockLcdState.set('on');
    const { container } = render(DisplaySettings);
    const toggle = container.querySelector('#settings-system-lcd-power') as HTMLElement;
    await fireEvent.click(toggle);
    expect(mockTurnOff).toHaveBeenCalledOnce();
    expect(mockTurnOn).not.toHaveBeenCalled();
  });

  // 19. Toggle shows loading when $lcdLoading is true
  it('Toggle has loading state when $lcdLoading is true', () => {
    mockLcdLoading.set(true);
    const { container } = render(DisplaySettings);
    const toggle = container.querySelector('#settings-system-lcd-power');
    expect(toggle!.getAttribute('data-loading')).toBe('true');
  });

  // 20. Toggle has id="settings-system-lcd-power"
  it('Toggle has id="settings-system-lcd-power"', () => {
    const { container } = render(DisplaySettings);
    expect(container.querySelector('#settings-system-lcd-power')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Standby controls
//
// Standby and "LCD on" are two different hardware states on this panel, so the
// column offers both. These assert the settings surface drives the real store,
// not that the overlay renders (StandbyOverlay.test.ts covers that).
// ---------------------------------------------------------------------------

describe('DisplaySettings standby controls', () => {
  beforeEach(() => {
    standbyActive.set(false);
    standbyActions.setBrightness(55);
    standbyActions.setIdleMinutes(30);
  });

  it('"Standby now" puts the screen into standby', async () => {
    const { getByTestId } = render(DisplaySettings);
    await fireEvent.click(getByTestId('system-standby-now'));
    expect(get(standbyActive)).toBe(true);
  });

  it('the brightness slider shows and writes the stored value', async () => {
    const { getByTestId, getByText } = render(DisplaySettings);
    const slider = getByTestId('system-standby-brightness') as HTMLInputElement;
    expect(slider.value).toBe('55');
    expect(getByText('55%')).toBeTruthy();

    await fireEvent.input(slider, { target: { value: '20' } });
    expect(get(standbyBrightness)).toBe(20);
  });

  it('the brightness slider floor keeps the clock legible rather than black', () => {
    const { getByTestId } = render(DisplaySettings);
    const slider = getByTestId('system-standby-brightness') as HTMLInputElement;
    expect(slider.min).toBe('8');
    expect(slider.max).toBe('100');
  });

  it('the idle selector writes the chosen interval', async () => {
    const { container } = render(DisplaySettings);
    const select = container.querySelector(
      '#settings-system-standby-idle'
    ) as HTMLSelectElement;
    expect(select.value).toBe('30');

    await fireEvent.change(select, { target: { value: '60' } });
    expect(get(standbyIdleMinutes)).toBe(60);
  });

  it('offers "Never" so the idle rule can be switched off entirely', async () => {
    const { container } = render(DisplaySettings);
    const select = container.querySelector(
      '#settings-system-standby-idle'
    ) as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: '0' } });
    expect(get(standbyIdleMinutes)).toBe(0);
  });
});

describe('DisplaySettings — overnight schedules', () => {
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
    const { container } = render(DisplaySettings);
    const at = container.querySelector('#settings-system-lcd-autooff-at') as HTMLSelectElement;
    const idle = container.querySelector('#settings-system-lcd-autooff-idle') as HTMLSelectElement;
    expect(at.value).toBe('22:00');
    expect(idle.value).toBe('60');
  });

  it('sends only the field that changed', async () => {
    const { container } = render(DisplaySettings);
    const at = container.querySelector('#settings-system-lcd-autooff-at') as HTMLSelectElement;
    await fireEvent.change(at, { target: { value: '23:30' } });
    expect(mockScheduleUpdate).toHaveBeenCalledWith({ autoOffAt: '23:30' });
  });

  it('sends the idle threshold as a number, which is what the backend parses', async () => {
    const { container } = render(DisplaySettings);
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
    const { container } = render(DisplaySettings);
    expect(container.querySelector('#settings-system-lcd-autooff-at')).toBeNull();
    expect(container.querySelector('#settings-system-lcd-autooff-idle')).toBeNull();
  });

  it('toggles the auto-off schedule', async () => {
    const { container } = render(DisplaySettings);
    await fireEvent.click(container.querySelector('#settings-system-lcd-autooff')!);
    expect(mockScheduleUpdate).toHaveBeenCalledWith({ autoOffEnabled: false });
  });

  it('shows and sets the morning restore time', async () => {
    const { container } = render(DisplaySettings);
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
    const { container } = render(DisplaySettings);
    expect(container.querySelector('#settings-system-lcd-autorestore-at')).toBeNull();
  });

  // The restore brings the clock face back, not the player. Saying so is the
  // only way a user can tell the schedule worked at all from across the room.
  it('says the morning restore lands on the clock, not the UI', () => {
    const { getByText } = render(DisplaySettings);
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
    const { container } = render(DisplaySettings);
    const idle = container.querySelector('#settings-system-lcd-autooff-idle') as HTMLSelectElement;
    expect(idle.value).toBe('90');
  });
});
