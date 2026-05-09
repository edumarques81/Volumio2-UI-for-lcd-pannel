/**
 * Single source of truth for the Socket.IO event names referenced by the
 * Settings v2, audio-output v2, and NAS share E2E specs.
 *
 * These names track the live `src/lib/stores/*` strings, NOT the original
 * C4 plan names — see `E2E-TEST-ISSUES.md` Cycle 4 reconciliations for the
 * deltas (e.g. plan said `system:action:reboot` / `pushDiscoveredNasDevices`,
 * code uses bare `reboot` / `pushNasDevices`).
 *
 * Cycle 5 follow-up: re-export these from `src/lib/stores/*` so the spec
 * constants are physically the same string literal as production. Doing
 * that requires touching `src/`, which is out of T2 scope.
 */

export const SOCKET_EVENTS = {
  // ── client → server ───────────────────────────────────────────────────────
  REBOOT: 'reboot',
  SHUTDOWN: 'shutdown',
  SET_PLAYBACK_SETTINGS: 'setPlaybackSettings',
  ADD_NAS_SHARE: 'addNasShare',
  MOUNT_NAS_SHARE: 'mountNasShare',
  DISCOVER_NAS_DEVICES: 'discoverNasDevices',
  BROWSE_NAS_SHARES: 'browseNasShares',

  // ── server → client ───────────────────────────────────────────────────────
  PUSH_PLAYBACK_OPTIONS: 'pushPlaybackOptions',
  PUSH_NAS_DEVICES: 'pushNasDevices',
  PUSH_BROWSE_NAS_SHARES: 'pushBrowseNasShares',
  PUSH_NAS_SHARE_RESULT: 'pushNasShareResult',
  PUSH_LIST_NAS_SHARES: 'pushListNasShares',
} as const;
