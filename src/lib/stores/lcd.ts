import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * The display's power state, as the backend models it.
 *
 * There are three destinations, not two. The panel has no backlight control
 * (see ./standby.ts for the full list of levers that were tried and are
 * closed), so "dark but awake" and "really off" are different things:
 *
 *   live    — the UI is on screen.
 *   standby — the output is still driven and touch still works; the kiosk
 *             paints the clock face. Owned by ./standby.ts.
 *   off     — `wlr-randr --off`. Genuinely dark, and one-way from the panel's
 *             side: it resets its own touch controller when the signal stops,
 *             so only another client or a schedule can bring it back.
 *
 * `isOn` stays in the payload for older clients and is true for both live and
 * standby — it answers "is the output lit", not "is the UI showing".
 */
export type LcdState = 'on' | 'off' | 'unknown';

export type LcdMode = 'live' | 'standby' | 'off';

export interface LCDStatus {
  isOn: boolean;
  mode?: LcdMode;
}

export const lcdState = writable<LcdState>('unknown');

/** The backend's mode. 'unknown' until the first `pushLcdStatus` arrives. */
export const lcdMode = writable<LcdMode | 'unknown'>('unknown');

export const lcdLoading = writable<boolean>(false);

/** True for live *and* standby: the output is lit either way. */
export const isLcdOn = derived(lcdState, ($state) => $state === 'on');

function isLcdMode(value: unknown): value is LcdMode {
  return value === 'live' || value === 'standby' || value === 'off';
}

/**
 * LCD control actions (Socket.IO based)
 */
export const lcdActions = {
  /** Request current LCD status from the backend. */
  getStatus(): void {
    socketService.emit('getLcdStatus');
  },

  /**
   * Move the display to a mode. Optimistic, then corrected by the
   * `pushLcdStatus` the backend broadcasts to every client.
   */
  setMode(mode: LcdMode): void {
    lcdLoading.set(true);
    lcdMode.set(mode);
    lcdState.set(mode === 'off' ? 'off' : 'on');
    // The payload is an object, not a bare string: a handler that cannot parse
    // its argument returns silently, which looks exactly like a hung backend.
    socketService.emit('lcdSetMode', { mode });
  },

  /** Cut the display signal. Touch dies with it until something turns it back on. */
  turnOff(): void {
    this.setMode('off');
  },

  /** Bring the live UI back. */
  turnOn(): void {
    this.setMode('live');
  },

  toggle(): void {
    if (get(lcdState) === 'off') {
      this.turnOn();
    } else {
      this.turnOff();
    }
  },

  /**
   * Tell the backend someone touched the panel. The night schedule measures
   * idleness from playback *and* this; without it a kiosk that is being used
   * at 22:00 would still turn itself off.
   */
  reportActivity(): void {
    socketService.emit('lcdActivity');
  }
};

let initialized = false;

/**
 * Initialize LCD state monitoring via Socket.IO.
 * The backend pushes the initial state on connect, so nothing is requested here.
 */
export function initLcdStore() {
  if (initialized) return;
  initialized = true;

  socketService.on<LCDStatus>('pushLcdStatus', (status) => {
    const isOn = status?.isOn === true;
    lcdState.set(isOn ? 'on' : 'off');
    // Older backends send only `isOn`; derive a mode so nothing downstream has
    // to special-case the missing field.
    lcdMode.set(isLcdMode(status?.mode) ? status.mode : isOn ? 'live' : 'off');
    lcdLoading.set(false);
  });
}

export function cleanupLcdStore() {
  // No cleanup needed - Socket.IO handlers are managed by the socket service
  initialized = false;
}
