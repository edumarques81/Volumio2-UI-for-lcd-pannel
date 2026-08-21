import { get } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import { currentView, type ViewType } from './navigation';
import { isLcdPanel } from './device';

/**
 * `pushLcdView` payload. `previousView` is the backend's memory of the screen
 * the kiosk was on before the current one — it is what lets a remote with no
 * history of its own flip to the VU meter and back again.
 */
export interface LcdViewPayload {
  view: ViewType;
  previousView: ViewType;
}

/** Views the backend is allowed to drive us to. Anything else is ignored. */
const KNOWN_VIEWS: ReadonlySet<string> = new Set<ViewType>([
  'player',
  'library',
  'queue',
  'settings',
  'vu-meter'
]);

let initialized = false;
let unsubscribeView: (() => void) | null = null;

/**
 * Svelte stores call a new subscriber synchronously with the current value.
 * That first call is not navigation — nobody went anywhere — so reporting it
 * would have the kiosk announce `player` on every page load, including the
 * watchdog's periodic reloads, silently knocking the panel off the VU meter.
 * The backend is authoritative here: we stay quiet and ask instead.
 */
let reportedFirstValue = false;

/**
 * Set while we are writing `currentView` on the backend's instruction.
 *
 * Load-bearing. Without it, applying a remote frame writes `currentView`, our
 * own subscription sees the write, and we report the change straight back to
 * the backend that just sent it — the kiosk would echo every remote command.
 */
let applyingRemoteView = false;

/**
 * Mirrors the LCD kiosk's current screen to and from the backend.
 *
 * Two directions, both gated on this client actually *being* the panel:
 *  - inbound  — `pushLcdView` drives `currentView`, so the iPhone can put the
 *    panel on the VU meter and take it back off again;
 *  - outbound — local navigation (a user tapping NavColumn on the panel) is
 *    reported via `lcdSetView`, so remotes don't strand on a stale view.
 *
 * The gate is re-checked on every event rather than captured at init, so a
 * desktop browser sharing this bundle never drives or follows the Pi's panel
 * even if it is resized across the LCD breakpoint.
 */
export function initLcdViewStore() {
  if (initialized) return;
  initialized = true;

  socketService.on<LcdViewPayload>('pushLcdView', (payload) => {
    if (!get(isLcdPanel)) return;
    if (!payload || !KNOWN_VIEWS.has(payload.view)) {
      console.warn('📺 Ignoring pushLcdView for unknown view:', payload?.view);
      return;
    }
    if (get(currentView) === payload.view) return;

    applyingRemoteView = true;
    try {
      currentView.set(payload.view);
    } finally {
      applyingRemoteView = false;
    }
  });

  unsubscribeView = currentView.subscribe((view) => {
    if (!reportedFirstValue) {
      reportedFirstValue = true;
      return;
    }
    if (applyingRemoteView) return;
    if (!get(isLcdPanel)) return;
    socketService.emit('lcdSetView', view);
  });

  // Ask what we *should* be showing and let the inbound path settle it.
  if (get(isLcdPanel)) {
    socketService.emit('getLcdView');
  }
}

export function cleanupLcdViewStore() {
  unsubscribeView?.();
  unsubscribeView = null;
  applyingRemoteView = false;
  reportedFirstValue = false;
  initialized = false;
}
