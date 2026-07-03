declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface Window {
  /**
   * Epoch-ms timestamp bumped every animation frame by the kiosk heartbeat
   * (see src/lib/kioskHeartbeat.ts). Read by stellar-kiosk-watchdog over
   * Chromium CDP to detect a frozen renderer and trigger Page.reload.
   */
  __stellarHeartbeat?: number;
}
