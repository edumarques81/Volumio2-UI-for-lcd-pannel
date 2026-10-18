/**
 * Google Cast session store.
 *
 * Mirrors the AirPlay store's shape because the backend contract is
 * deliberately the same split: Cast is a separate branch, not a takeover of
 * `play` / `pause` / `seek`. A client that is casting drives `cast:command`;
 * a client that is not keeps driving MPD and the DAC. See
 * docs/SOCKET-CONTRACT.md § Google Cast.
 *
 * Three device behaviours are baked into the backend and visible here:
 *   - `status` already folds BUFFERING and the post-LOAD pre-roll into
 *     'play', so the UI never flashes "stopped" on a track change.
 *   - `seek` is milliseconds (matching `pushState`), `duration` is seconds.
 *   - `pushCastState` arrives on connect EVEN WHEN INACTIVE, so a client that
 *     missed the terminal frame resyncs instead of sticking on a cast view.
 */

import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/** A Chromecast / Nest device (or speaker group) found on the LAN. */
export interface CastDevice {
  id: string;
  name: string;
  model?: string;
  isGroup?: boolean;
}

/** Snapshot of the backend's single Cast session. */
export interface CastState {
  active: boolean;
  deviceId: string;
  deviceName: string;
  status: 'play' | 'pause' | 'stop';
  title: string;
  artist: string;
  album: string;
  /** Backend-relative or absolute artwork URL. */
  albumart: string;
  uri: string;
  /** Milliseconds, matching pushState. */
  seek: number;
  /** Seconds. */
  duration: number;
  /** 0..100. */
  volume: number;
  mute: boolean;
  queueIndex: number;
  queueLength: number;
}

/** A track the format policy refused, with the reason to show the user. */
export interface CastSkippedTrack {
  title: string;
  uri: string;
  reason: string;
}

/** Ack shape shared by every `cast:*` event. */
export interface CastResponse {
  ok: boolean;
  error?: string;
  devices?: CastDevice[];
  skipped?: CastSkippedTrack[];
}

const EMPTY_STATE: CastState = {
  active: false,
  deviceId: '',
  deviceName: '',
  status: 'stop',
  title: '',
  artist: '',
  album: '',
  albumart: '',
  uri: '',
  seek: 0,
  duration: 0,
  volume: 0,
  mute: false,
  queueIndex: 0,
  queueLength: 0,
};

export const castState = writable<CastState>({ ...EMPTY_STATE });

/** Devices found by the last discovery. Empty until `listDevices` runs. */
export const castDevices = writable<CastDevice[]>([]);

/** True while a discovery is in flight, so the picker can show progress. */
export const castDiscovering = writable<boolean>(false);

/**
 * True when a Cast session owns the transport. Components branching layout
 * subscribe to this rather than reading `castState.active` directly.
 */
export const castActive = derived(castState, ($s) => $s.active);

/** The tracks the last `playAlbum` refused. Cleared on the next attempt. */
export const castSkipped = writable<CastSkippedTrack[]>([]);

/**
 * Normalises an incoming snapshot. The backend sends every field, but
 * `omitempty` drops the zero values, so each one needs a default rather than
 * an `undefined` leaking into the UI.
 */
function normalise(incoming: Partial<CastState> | null | undefined): CastState {
  const status = incoming?.status;
  return {
    active: incoming?.active ?? false,
    deviceId: incoming?.deviceId ?? '',
    deviceName: incoming?.deviceName ?? '',
    status: status === 'play' || status === 'pause' ? status : 'stop',
    title: incoming?.title ?? '',
    artist: incoming?.artist ?? '',
    album: incoming?.album ?? '',
    albumart: incoming?.albumart ?? '',
    uri: incoming?.uri ?? '',
    seek: incoming?.seek ?? 0,
    duration: incoming?.duration ?? 0,
    volume: incoming?.volume ?? 0,
    mute: incoming?.mute ?? false,
    queueIndex: incoming?.queueIndex ?? 0,
    queueLength: incoming?.queueLength ?? 0,
  };
}

/**
 * 1Hz seek interpolation between snapshots, matching the AirPlay store and
 * the dead-reckoning contract the MPD player already follows: the backend
 * emits a snapshot on every device status frame, which is roughly every
 * second while playing, and the interpolator keeps the bar smooth in between.
 */
let seekIntervalId: ReturnType<typeof setInterval> | null = null;

function startSeekInterpolation(): void {
  if (seekIntervalId !== null) return;
  seekIntervalId = setInterval(() => {
    castState.update((s) => {
      if (!s.active || s.status !== 'play') return s;
      if (s.duration > 0 && s.seek >= s.duration * 1000) return s;
      return { ...s, seek: s.seek + 1000 };
    });
  }, 1000);
}

function stopSeekInterpolation(): void {
  if (seekIntervalId !== null) {
    clearInterval(seekIntervalId);
    seekIntervalId = null;
  }
}

/** Reads the device list synchronously, for the keep-the-cache path above. */
function getCurrentDevices(): CastDevice[] {
  let current: CastDevice[] = [];
  const unsubscribe = castDevices.subscribe((d) => {
    current = d;
  });
  unsubscribe();
  return current;
}

/** Emits an event and resolves with the backend's ack. */
function request(event: string, payload?: Record<string, unknown>): Promise<CastResponse> {
  return new Promise((resolve) => {
    socketService.emit(event, payload ?? {}, (response: CastResponse) => {
      resolve(response ?? { ok: false, error: 'no response' });
    });
  });
}

export const castActions = {
  /**
   * Browses for devices. The backend falls back to its cached list when the
   * mDNS browse fails, so a transient hiccup leaves the picker slightly stale
   * rather than empty — never treat an error here as "no devices".
   */
  async listDevices(): Promise<CastDevice[]> {
    castDiscovering.set(true);
    try {
      const response = await request('cast:listDevices');
      // No `devices` array at all means the request itself failed (the
      // backend answers a failed browse with its cached list and ok:true).
      // Keep whatever the picker is already showing: a stale entry the user
      // can tap beats an empty list that looks like "nothing is out there".
      if (!Array.isArray(response.devices)) {
        return getCurrentDevices();
      }
      castDevices.set(response.devices);
      return response.devices;
    } finally {
      castDiscovering.set(false);
    }
  },

  async connect(deviceId: string): Promise<CastResponse> {
    return request('cast:connect', { deviceId });
  },

  /** Drops our connection and LEAVES THE DEVICE PLAYING. */
  async disconnect(): Promise<CastResponse> {
    return request('cast:disconnect');
  },

  /** Quits the receiver app — the explicit "be quiet". */
  async stop(): Promise<CastResponse> {
    return request('cast:stop');
  },

  /**
   * Casts an album. `sampleRate` is the Album's own value: it is album-level
   * in the backend cache, and sending it is what lets the policy refuse a
   * 352.8 kHz release before the device fails on it.
   */
  async playAlbum(args: {
    album: string;
    albumArtist?: string;
    uri?: string;
    startIndex?: number;
    sampleRate?: number;
  }): Promise<CastResponse> {
    castSkipped.set([]);
    const response = await request('cast:playAlbum', { ...args });
    castSkipped.set(response.skipped ?? []);
    return response;
  },

  play(): void {
    void request('cast:command', { cmd: 'play' });
  },
  pause(): void {
    void request('cast:command', { cmd: 'pause' });
  },
  toggle(): void {
    void request('cast:command', { cmd: 'toggle' });
  },
  next(): void {
    void request('cast:command', { cmd: 'next' });
  },
  prev(): void {
    void request('cast:command', { cmd: 'prev' });
  },
  /** Seconds, matching the backend's `seek` command. */
  seekTo(seconds: number): void {
    void request('cast:command', { cmd: 'seek', value: Math.max(0, Math.round(seconds)) });
  },
  /** 0..100. */
  setVolume(percent: number): void {
    void request('cast:command', { cmd: 'volume', value: Math.min(100, Math.max(0, Math.round(percent))) });
  },
  setMuted(muted: boolean): void {
    void request('cast:command', { cmd: 'mute', value: muted });
  },

  /** Re-pulls the snapshot without reconnecting (iOS-style foreground resync). */
  refresh(): void {
    socketService.emit('getCastState');
  },
};

let initialized = false;

export function initCastStore(): void {
  if (initialized) return;
  initialized = true;

  socketService.on<Partial<CastState>>('pushCastState', (incoming) => {
    const next = normalise(incoming);
    castState.set(next);

    if (next.active && next.status === 'play') {
      startSeekInterpolation();
    } else {
      stopSeekInterpolation();
    }
    if (!next.active) {
      castSkipped.set([]);
    }
  });

  socketService.on<CastDevice[]>('pushCastDevices', (devices) => {
    castDevices.set(Array.isArray(devices) ? devices : []);
  });
}

/**
 * Test-only escape hatch. Resets the init guard and every store back to its
 * baseline so each test starts clean. Production code does not call this.
 */
export function resetCastStoreForTests(): void {
  initialized = false;
  stopSeekInterpolation();
  castState.set({ ...EMPTY_STATE });
  castDevices.set([]);
  castDiscovering.set(false);
  castSkipped.set([]);
}
