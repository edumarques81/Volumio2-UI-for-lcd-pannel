import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(() => () => {})
  }
}));

import {
  LCD_SCHEDULE_DEFAULTS,
  isClockTime,
  normalizeClockTime,
  normalizeSchedule,
  lcdSchedule,
  lcdScheduleActions,
  initLcdScheduleStore,
  cleanupLcdScheduleStore,
  type LcdSchedule
} from '../lcdSchedule';
import { socketService } from '$lib/services/socket';

function pushHandler(): (payload: unknown) => void {
  const calls = vi.mocked(socketService.on).mock.calls;
  const found = calls.find((call) => call[0] === 'pushLcdSettings')?.[1];
  expect(found).toBeDefined();
  return found as unknown as (payload: unknown) => void;
}

describe('isClockTime', () => {
  const cases: Array<[string, unknown, boolean]> = [
    ['midnight', '00:00', true],
    ['last minute of the day', '23:59', true],
    ['single-digit hour', '9:05', true],
    ['hour out of range', '24:00', false],
    ['minute out of range', '12:60', false],
    ['no minutes', '12', false],
    ['not a string', 1200, false],
    ['empty', '', false]
  ];
  for (const [name, input, want] of cases) {
    it(name, () => expect(isClockTime(input)).toBe(want));
  }
});

describe('normalizeClockTime', () => {
  it('pads a single-digit hour so it matches a select option', () => {
    expect(normalizeClockTime('9:05')).toBe('09:05');
  });

  it('leaves an already padded time alone', () => {
    expect(normalizeClockTime('22:00')).toBe('22:00');
  });
});

describe('normalizeSchedule', () => {
  it('returns the defaults for an empty payload', () => {
    expect(normalizeSchedule({})).toEqual(LCD_SCHEDULE_DEFAULTS);
  });

  it('returns the defaults for a null payload', () => {
    expect(normalizeSchedule(null)).toEqual(LCD_SCHEDULE_DEFAULTS);
  });

  it('keeps a complete payload', () => {
    const payload: LcdSchedule = {
      autoOffEnabled: false,
      autoOffAt: '23:30',
      autoOffIdleMinutes: 120,
      autoRestoreEnabled: false,
      autoRestoreAt: '06:15'
    };
    expect(normalizeSchedule(payload)).toEqual(payload);
  });

  // One bad field must not discard the rest: the other values are what the
  // backend is actually running, and showing defaults instead would be a lie.
  it('falls back per field, not wholesale', () => {
    const result = normalizeSchedule({
      autoOffEnabled: false,
      autoOffAt: 'nonsense',
      autoOffIdleMinutes: 90,
      autoRestoreEnabled: true,
      autoRestoreAt: '06:00'
    });
    expect(result.autoOffAt).toBe(LCD_SCHEDULE_DEFAULTS.autoOffAt);
    expect(result.autoOffEnabled).toBe(false);
    expect(result.autoOffIdleMinutes).toBe(90);
    expect(result.autoRestoreAt).toBe('06:00');
  });

  it('rejects an idle interval outside the backend range', () => {
    expect(normalizeSchedule({ autoOffIdleMinutes: 0 }).autoOffIdleMinutes).toBe(
      LCD_SCHEDULE_DEFAULTS.autoOffIdleMinutes
    );
    expect(normalizeSchedule({ autoOffIdleMinutes: 2000 }).autoOffIdleMinutes).toBe(
      LCD_SCHEDULE_DEFAULTS.autoOffIdleMinutes
    );
    expect(normalizeSchedule({ autoOffIdleMinutes: '45' }).autoOffIdleMinutes).toBe(45);
  });

  it('pads times so a select can match them', () => {
    expect(normalizeSchedule({ autoRestoreAt: '5:00' }).autoRestoreAt).toBe('05:00');
  });

  it('merges onto a supplied base rather than the defaults', () => {
    const base: LcdSchedule = { ...LCD_SCHEDULE_DEFAULTS, autoOffAt: '21:00' };
    expect(normalizeSchedule({ autoOffEnabled: false }, base).autoOffAt).toBe('21:00');
  });
});

describe('lcdScheduleActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupLcdScheduleStore();
    lcdSchedule.set(LCD_SCHEDULE_DEFAULTS);
  });

  it('refresh asks the backend for the current schedule', () => {
    lcdScheduleActions.refresh();
    expect(socketService.emit).toHaveBeenCalledWith('getLcdSettings');
  });

  it('update sends only the changed fields', () => {
    lcdScheduleActions.update({ autoOffAt: '23:00' });
    expect(socketService.emit).toHaveBeenCalledWith('setLcdSettings', { autoOffAt: '23:00' });
  });

  it('update applies optimistically on top of the current value', () => {
    lcdSchedule.set({ ...LCD_SCHEDULE_DEFAULTS, autoOffIdleMinutes: 120 });
    lcdScheduleActions.update({ autoOffEnabled: false });
    expect(get(lcdSchedule)).toEqual({
      ...LCD_SCHEDULE_DEFAULTS,
      autoOffIdleMinutes: 120,
      autoOffEnabled: false
    });
  });
});

describe('initLcdScheduleStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupLcdScheduleStore();
    lcdSchedule.set(LCD_SCHEDULE_DEFAULTS);
  });

  it('registers the push handler', () => {
    initLcdScheduleStore();
    expect(socketService.on).toHaveBeenCalledWith('pushLcdSettings', expect.any(Function));
  });

  it('is idempotent', () => {
    initLcdScheduleStore();
    initLcdScheduleStore();
    expect(vi.mocked(socketService.on).mock.calls.length).toBe(1);
  });

  it('applies a pushed schedule', () => {
    initLcdScheduleStore();
    pushHandler()({
      autoOffEnabled: false,
      autoOffAt: '01:00',
      autoOffIdleMinutes: 30,
      autoRestoreEnabled: true,
      autoRestoreAt: '07:00'
    });
    expect(get(lcdSchedule)).toEqual({
      autoOffEnabled: false,
      autoOffAt: '01:00',
      autoOffIdleMinutes: 30,
      autoRestoreEnabled: true,
      autoRestoreAt: '07:00'
    });
  });

  it('does not emit a request of its own (the backend pushes on connect)', () => {
    initLcdScheduleStore();
    expect(socketService.emit).not.toHaveBeenCalled();
  });
});
