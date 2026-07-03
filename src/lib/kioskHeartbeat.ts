// Renderer-liveness heartbeat for the Pi kiosk watchdog.
//
// Bumps `window.__stellarHeartbeat` (an epoch-ms timestamp) on every animation
// frame. `requestAnimationFrame` only fires while the document is actually
// rendering, so a crashed, hung, or white-screened renderer stops updating the
// value. The external `stellar-kiosk-watchdog` reads it over Chromium CDP
// (`Runtime.evaluate` on port 9222) and issues `Page.reload` when the timestamp
// goes stale — recovering the kiosk from failures the frontend's own socket
// reconnect logic can't see (the renderer itself is dead).
//
// Returns a stop function that cancels the loop (used on component teardown /
// HMR so we don't leak rAF callbacks).
export function startKioskHeartbeat(win: Window = window): () => void {
  const target = win as Window & { __stellarHeartbeat?: number };
  let handle = 0;

  const tick = () => {
    target.__stellarHeartbeat = Date.now();
    handle = win.requestAnimationFrame(tick);
  };

  // Seed immediately so the value exists before the first frame is scheduled.
  target.__stellarHeartbeat = Date.now();
  handle = win.requestAnimationFrame(tick);

  return () => win.cancelAnimationFrame(handle);
}
