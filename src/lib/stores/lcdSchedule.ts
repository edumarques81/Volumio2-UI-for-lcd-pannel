import { writable, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * The overnight display schedules, mirrored from the backend.
 *
 * The backend owns these: it holds them in `data/display.json`, evaluates them
 * on a 30s tick, and is the only party that knows whether music is playing.
 * This store is a view of that state plus the patch call — it deliberately
 * runs no timers of its own, so two clients can never disagree about when the
 * panel goes dark.
 *
 * The rules themselves (from the spec):
 *   auto-off     — after `autoOffAt`, if nothing has played for
 *                  `autoOffIdleMinutes`, the output is cut.
 *   auto-restore — at `autoRestoreAt` the panel comes back to *standby*, i.e.
 *                  the clock face, not the live UI. The first touch after that
 *                  is what returns the UI.
 */
export interface LcdSchedule {
  autoOffEnabled: boolean;
  /** "HH:MM", 24h. */
  autoOffAt: string;
  /** 1–1440. Minutes of silence required before the night window can fire. */
  autoOffIdleMinutes: number;
  autoRestoreEnabled: boolean;
  /** "HH:MM", 24h. */
  autoRestoreAt: string;
}

/** Must match `display.DefaultSettings()` on the backend. */
export const LCD_SCHEDULE_DEFAULTS: LcdSchedule = {
  autoOffEnabled: true,
  autoOffAt: '22:00',
  autoOffIdleMinutes: 60,
  autoRestoreEnabled: true,
  autoRestoreAt: '05:00'
};

/** "HH:MM" on a 24-hour clock, which is the only shape the backend parses. */
export function isClockTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/** Pad "9:05" to "09:05" so the value always matches a select option. */
export function normalizeClockTime(value: string): string {
  const [hours, minutes] = value.trim().split(':');
  return `${hours.padStart(2, '0')}:${minutes}`;
}

/**
 * Coerce whatever arrived into a usable schedule, field by field.
 *
 * A partial or malformed push falls back per field rather than wholesale: the
 * backend normalizes the same way, and dropping the whole payload because one
 * field is wrong would show the user defaults that are not what is running.
 */
export function normalizeSchedule(raw: unknown, base: LcdSchedule = LCD_SCHEDULE_DEFAULTS): LcdSchedule {
  const src = (raw ?? {}) as Partial<Record<keyof LcdSchedule, unknown>>;
  const idle = Number(src.autoOffIdleMinutes);

  return {
    autoOffEnabled:
      typeof src.autoOffEnabled === 'boolean' ? src.autoOffEnabled : base.autoOffEnabled,
    autoOffAt: isClockTime(src.autoOffAt) ? normalizeClockTime(src.autoOffAt) : base.autoOffAt,
    autoOffIdleMinutes:
      Number.isFinite(idle) && idle >= 1 && idle <= 1440
        ? Math.round(idle)
        : base.autoOffIdleMinutes,
    autoRestoreEnabled:
      typeof src.autoRestoreEnabled === 'boolean' ? src.autoRestoreEnabled : base.autoRestoreEnabled,
    autoRestoreAt: isClockTime(src.autoRestoreAt)
      ? normalizeClockTime(src.autoRestoreAt)
      : base.autoRestoreAt
  };
}

export const lcdSchedule = writable<LcdSchedule>(LCD_SCHEDULE_DEFAULTS);

export const lcdScheduleActions = {
  refresh(): void {
    socketService.emit('getLcdSettings');
  },

  /**
   * Send one or more fields. `setLcdSettings` is a patch on the backend, so
   * only what changed goes over the wire; the local store is updated
   * optimistically and then corrected by the `pushLcdSettings` that follows.
   */
  update(patch: Partial<LcdSchedule>): void {
    lcdSchedule.set(normalizeSchedule({ ...get(lcdSchedule), ...patch }));
    socketService.emit('setLcdSettings', patch);
  }
};

let initialized = false;

export function initLcdScheduleStore(): void {
  if (initialized) return;
  initialized = true;

  socketService.on<unknown>('pushLcdSettings', (payload) => {
    lcdSchedule.set(normalizeSchedule(payload));
  });
}

export function cleanupLcdScheduleStore(): void {
  initialized = false;
}
