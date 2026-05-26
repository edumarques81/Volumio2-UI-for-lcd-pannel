/**
 * AirPlay session store.
 *
 * Listens to two backend Socket.IO events:
 *   - `pushAirplayState`   — full snapshot of the current AirPlay session.
 *   - `pushAirplayEnded`   — canonical end-of-session signal (NOT keyed off
 *                            `isActive: false`; the backend may keep sending
 *                            `pushAirplayState` with stale `isActive: true`
 *                            on transient drops).
 *
 * Session-ID dance — the backend tags every state push with a `sessionID`
 * that is stable for the lifetime of a single AirPlay session. A
 * `pushAirplayEnded` event MUST quote the sessionID it intends to end; we
 * only clear the store when the quoted sessionID matches the currently
 * active one. This protects against a delayed "session 1 ended" event
 * arriving AFTER "session 2 started" and silently wiping the new session.
 *
 * Transport commands emit `airplay:command` (with a `cmd` field) — never
 * the bare MPD events `play` / `pause` / `next` / `prev`. The Mac backend
 * proxies them through DACP to the iPhone sender.
 *
 * Volume is intentionally absent: the user policy is "AirPlay always full
 * scale" (`general.ignore_volume_control = "yes"` in shairport-sync.conf)
 * — the iPhone slider is inert and the LCD slider becomes read-only in
 * AirPlay mode (handled in PlayerView, not here).
 */

import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * AirPlay session snapshot pushed by the backend.
 *
 * Locked contract — matches the iOS + backend agents bit-for-bit. Do not
 * diverge unilaterally; flag drift to the cross-team coordination channel.
 */
export interface AirplayState {
  isActive: boolean;
  /** Current play/pause state from the iPhone sender. Distinct from
   *  `isActive`: the session can remain alive while the user hits pause
   *  on the iPhone. Defaults to `true` on the first emit of a session
   *  (pbeg implies playing) and flips on `paus`/`prsm` metadata frames. */
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  sender: string;
  /** `data:image/jpeg;base64,...` data URL inlined by the backend. */
  coverDataURL: string;
  seekSeconds: number;
  durationSeconds: number;
  /** False while the Mac backend has not yet captured an Active-Remote
   *  token from shairport-sync; transport buttons should disable. */
  canControl: boolean;
  /** Stable for the lifetime of the AirPlay session. */
  sessionID: string;
  /** PCM Hz (e.g. 44100). 0/undefined when unknown. */
  sampleRate: number;
  /** Bits per sample (e.g. 16). 0/undefined when unknown. */
  bitDepth: number;
}

export type AirplayCommand = 'play' | 'pause' | 'toggle' | 'next' | 'prev';

/** End-of-session payload. The backend echoes back the sessionID that just
 *  ended so the client can ignore stale events targeting prior sessions. */
export interface AirplayEnded {
  sessionID?: string;
}

const EMPTY_STATE: AirplayState = {
  isActive: false,
  isPlaying: false,
  title: '',
  artist: '',
  album: '',
  sender: '',
  coverDataURL: '',
  seekSeconds: 0,
  durationSeconds: 0,
  canControl: false,
  sessionID: '',
  sampleRate: 0,
  bitDepth: 0,
};

export const airplayState = writable<AirplayState>({ ...EMPTY_STATE });

/** Convenience derived store — true when an AirPlay session is currently
 *  visible to the user. Components branching layout (PlayerView swap)
 *  should subscribe to this rather than `airplayState.isActive` directly
 *  so future "active but unrendered" states don't break consumers. */
export const airplayActive = derived(airplayState, ($s) => $s.isActive);

/** Optional 1Hz seek interpolator — advances `seekSeconds` between
 *  authoritative `pushAirplayState` snapshots so the LCD's progress bar
 *  ticks smoothly. The backend posts a fresh state on every shairport
 *  metadata frame (every ~1s while playing) AND a heartbeat every 2s,
 *  so the interpolator never drifts more than ~2s before correction. */
let seekIntervalId: ReturnType<typeof setInterval> | null = null;

function startSeekInterpolation(): void {
  if (seekIntervalId !== null) return;
  seekIntervalId = setInterval(() => {
    airplayState.update((s) => {
      if (!s.isActive) return s;
      // Freeze the counter while the iPhone is paused mid-session.
      // Authoritative `pushAirplayState` events will resync seek when
      // playback resumes.
      if (!s.isPlaying) return s;
      if (s.durationSeconds > 0 && s.seekSeconds >= s.durationSeconds) return s;
      return { ...s, seekSeconds: s.seekSeconds + 1 };
    });
  }, 1000);
}

function stopSeekInterpolation(): void {
  if (seekIntervalId !== null) {
    clearInterval(seekIntervalId);
    seekIntervalId = null;
  }
}

export const airplayActions = {
  play(): void {
    socketService.emit('airplay:command', { cmd: 'play' });
  },
  pause(): void {
    socketService.emit('airplay:command', { cmd: 'pause' });
  },
  toggle(): void {
    socketService.emit('airplay:command', { cmd: 'toggle' });
  },
  next(): void {
    socketService.emit('airplay:command', { cmd: 'next' });
  },
  prev(): void {
    socketService.emit('airplay:command', { cmd: 'prev' });
  },
};

let initialized = false;

export function initAirplayStore(): void {
  if (initialized) return;
  initialized = true;

  socketService.on<AirplayState>('pushAirplayState', (incoming) => {
    // The backend posts a complete snapshot every time. Replace (don't
    // merge) so stale fields can't survive — e.g. if a track ends and
    // the cover briefly clears, we want the cleared cover, not the
    // previous one ghosted under the new title.
    //
    // Defensive normalisation: fall back to EMPTY_STATE values for any
    // field the backend forgets to include. The locked contract requires
    // every field, but defensive coding keeps the LCD readable rather
    // than crashing on a half-baked payload.
    const next: AirplayState = {
      isActive: incoming.isActive ?? false,
      // Default true when missing: a session's first state event implies
      // playing (pbeg fires before any paus). Older backends predating
      // this field also intended "playing" for any active session.
      isPlaying: incoming.isPlaying ?? true,
      title: incoming.title ?? '',
      artist: incoming.artist ?? '',
      album: incoming.album ?? '',
      sender: incoming.sender ?? '',
      coverDataURL: incoming.coverDataURL ?? '',
      seekSeconds: incoming.seekSeconds ?? 0,
      durationSeconds: incoming.durationSeconds ?? 0,
      canControl: incoming.canControl ?? false,
      sessionID: incoming.sessionID ?? '',
      sampleRate: incoming.sampleRate ?? 0,
      bitDepth: incoming.bitDepth ?? 0,
    };
    airplayState.set(next);

    if (next.isActive) {
      startSeekInterpolation();
    } else {
      stopSeekInterpolation();
    }
  });

  socketService.on<AirplayEnded>('pushAirplayEnded', (payload) => {
    const endedSessionID = payload?.sessionID ?? '';
    if (!endedSessionID) {
      // No sessionID quoted — refuse to clear. Defensive: a malformed
      // event must not silently kill a live session.
      return;
    }
    airplayState.update((current) => {
      if (current.sessionID !== endedSessionID) {
        // Stale end-of-session — different (or already-cleared) session.
        // Leave the current state alone.
        return current;
      }
      stopSeekInterpolation();
      return { ...EMPTY_STATE };
    });
  });
}

/**
 * Test-only escape hatch. Resets the singleton-init guard AND the store
 * back to its empty baseline so each test starts from a clean slate.
 * Production code does not (and must not) call this.
 */
export function resetAirplayStoreForTests(): void {
  initialized = false;
  stopSeekInterpolation();
  airplayState.set({ ...EMPTY_STATE });
}
