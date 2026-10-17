import { writable, get } from 'svelte/store';
import { isPlaying } from './player';
import { deviceType } from './device';
import { lcdActions, lcdMode } from './lcd';

/**
 * Standby — the LCD's "virtual off".
 *
 * This panel has no backlight control of any kind. Verified on the Pi:
 * `/sys/class/backlight/` is empty, `vcgencmd display_power` is not
 * registered under Pi 5 KMS, DDC/CI fails after a good EDID read, the panel
 * implements no CEC, the HID descriptor carries no monitor-control page, the
 * DRM connector's `dpms` sysfs node is read-only, and wlroots refuses gamma
 * control on vc4. Dark pixels are the only dimmer available.
 *
 * Worse, a real hardware off is a one-way trip: `wlr-randr --off` stops the
 * TMDS signal and the panel answers by holding its own touch controller in
 * reset — dmesg shows a genuine USB disconnect and re-enumeration. The ILITEK
 * digitizer is bus-powered at 200 mA from the Pi's own root hub, so VBUS never
 * drops; the panel does this to itself and nothing host-side can prevent it.
 *
 * So there are two distinct destinations, not one toggle:
 *
 *   standby  — panel stays powered, touch stays alive, the screen paints the
 *              clock face at a low brightness. This module owns it.
 *   off      — `wlr-randr --off`, genuinely dark, touch dead until the output
 *              comes back. That is `lcdActions.turnOff()` in ./lcd.ts.
 *
 * The backend owns the mode. Entering or leaving standby here is reported to
 * it, and a mode it decided on its own (the night schedule, another client,
 * the iOS app) arrives back through `lcdMode` and is applied. Everything goes
 * through that one store so the two can never drift apart.
 */

export const STANDBY_DEFAULT_BRIGHTNESS = 55;
export const STANDBY_DEFAULT_IDLE_MINUTES = 30;

const BRIGHTNESS_KEY = 'stellar-standby-brightness';
const IDLE_MINUTES_KEY = 'stellar-standby-idle-minutes';

/** Clamp to the range the settings slider offers. 8% is still legible in a dark room. */
export function clampStandbyBrightness(value: number): number {
  if (!Number.isFinite(value)) return STANDBY_DEFAULT_BRIGHTNESS;
  return Math.max(8, Math.min(100, Math.round(value)));
}

/** 0 disables the idle trigger entirely; otherwise 1–240 minutes. */
export function clampIdleMinutes(value: number): number {
  if (!Number.isFinite(value)) return STANDBY_DEFAULT_IDLE_MINUTES;
  return Math.max(0, Math.min(240, Math.round(value)));
}

function loadNumber(key: string, fallback: number, clamp: (n: number) => number): number {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clamp(parsed) : fallback;
}

function saveNumber(key: string, value: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Private-mode / quota. The in-memory store is still correct for this session.
  }
}

/** True while the clock face is covering the UI. */
export const standbyActive = writable<boolean>(false);

/** Brightness the clock face is painted at, 8–100. */
export const standbyBrightness = writable<number>(
  loadNumber(BRIGHTNESS_KEY, STANDBY_DEFAULT_BRIGHTNESS, clampStandbyBrightness)
);

/** Minutes of no touch AND no playback before standby engages. 0 = never. */
export const standbyIdleMinutes = writable<number>(
  loadNumber(IDLE_MINUTES_KEY, STANDBY_DEFAULT_IDLE_MINUTES, clampIdleMinutes)
);

/**
 * The idle decision, split out as a pure function so the rule is testable
 * without faking timers, pointer events or a player connection.
 *
 * `elapsedMs` is time since the last *activity*, where playback counts as
 * activity for as long as it lasts — that is what makes this read as the
 * spec does: standby engages 30 minutes after both the music stopped and
 * the last touch, whichever was later.
 */
export function shouldEnterStandby(o: {
  active: boolean;
  playing: boolean;
  elapsedMs: number;
  idleMs: number;
}): boolean {
  if (o.active) return false;
  if (o.idleMs <= 0) return false;
  if (o.playing) return false;
  return o.elapsedMs >= o.idleMs;
}

let lastActivityAt = Date.now();

/** Exposed for tests and for the idle tick; not a user-facing action. */
export function markStandbyActivity(): void {
  lastActivityAt = Date.now();
}

export function standbyLastActivityAt(): number {
  return lastActivityAt;
}

/** Only the kiosk paints anything; every other client just drives the mode. */
function isKiosk(): boolean {
  return get(deviceType) === 'lcd-panel';
}

export const standbyActions = {
  /**
   * Paint the clock face, and tell the backend. The emit is unconditional so
   * that "Standby now" works from a phone, which has no overlay of its own to
   * flip and would otherwise do nothing at all.
   */
  enter(): void {
    lcdActions.setMode('standby');
    if (!isKiosk()) return;
    standbyActive.set(true);
  },

  /** Return to the live UI and restart the idle countdown. */
  exit(): void {
    markStandbyActivity();
    lcdActions.setMode('live');
    if (!isKiosk()) return;
    standbyActive.set(false);
  },

  setBrightness(value: number): void {
    const clamped = clampStandbyBrightness(value);
    standbyBrightness.set(clamped);
    saveNumber(BRIGHTNESS_KEY, clamped);
  },

  setIdleMinutes(value: number): void {
    const clamped = clampIdleMinutes(value);
    standbyIdleMinutes.set(clamped);
    saveNumber(IDLE_MINUTES_KEY, clamped);
    markStandbyActivity();
  }
};

/** How often the idle rule is re-evaluated. Cheap: one comparison. */
export const STANDBY_TICK_MS = 10_000;

const ACTIVITY_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const;

/**
 * Floor between activity reports to the backend. A touch stream fires dozens
 * of events a second and the backend only needs to know the minute; the night
 * schedule's resolution is a 30s tick.
 */
export const ACTIVITY_PING_MS = 60_000;

let lastActivityPing = 0;

function pingBackendActivity(): void {
  const now = Date.now();
  if (now - lastActivityPing < ACTIVITY_PING_MS) return;
  lastActivityPing = now;
  lcdActions.reportActivity();
}

let initialized = false;

/**
 * Register the idle watcher. Only the LCD kiosk gets it — a desktop or phone
 * browser blacking itself out after half an hour would be a bug, not a feature.
 * Idempotent, so a re-mount does not double-register.
 */
export function initStandbyStore(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  if (get(deviceType) !== 'lcd-panel') return;
  initialized = true;

  markStandbyActivity();

  const onActivity = () => {
    markStandbyActivity();
    pingBackendActivity();
  };
  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, onActivity, { passive: true, capture: true });
  }

  // The backend is the authority on the mode: it decides the night schedule
  // and it relays what other clients asked for. Applied directly rather than
  // through enter()/exit() so acting on a push cannot echo back as a command.
  const unsubscribeMode = lcdMode.subscribe((mode) => {
    if (mode === 'standby') {
      standbyActive.set(true);
    } else if (mode === 'live') {
      markStandbyActivity();
      standbyActive.set(false);
    }
    // 'off' and 'unknown' leave the overlay as it is. The output is dark in
    // the first case and undetermined in the second; in both, the next status
    // push says which mode the panel actually came back to.
  });

  const tick = setInterval(() => {
    // Playback keeps the countdown pinned at zero rather than suppressing the
    // check, so stopping the music starts a fresh full interval.
    if (get(isPlaying)) {
      markStandbyActivity();
      return;
    }
    const decision = shouldEnterStandby({
      active: get(standbyActive),
      playing: false,
      elapsedMs: Date.now() - lastActivityAt,
      idleMs: get(standbyIdleMinutes) * 60_000
    });
    if (decision) standbyActions.enter();
  }, STANDBY_TICK_MS);

  standbyTeardown = () => {
    clearInterval(tick);
    unsubscribeMode();
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, onActivity, { capture: true });
    }
    initialized = false;
  };
}

let standbyTeardown: (() => void) | null = null;

export function cleanupStandbyStore(): void {
  standbyTeardown?.();
  standbyTeardown = null;
  standbyActive.set(false);
  lastActivityPing = 0;
}
