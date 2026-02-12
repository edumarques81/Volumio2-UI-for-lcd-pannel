import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import { fixVolumioAssetUrl } from '$lib/config';
import type { PlayerState } from '$lib/types';

/**
 * Extended track info response from Volumio
 */
export interface TrackInfo {
  uri: string;
  service: string;
  name: string;
  artist?: string;
  album?: string;
  albumart?: string;
  duration?: number;
  type?: string;
  trackType?: string;
  samplerate?: string;
  bitdepth?: string;
  bitrate?: string;
  channels?: number;
  year?: string;
  genre?: string;
  tracknumber?: number;
  composer?: string;
  filesize?: number;
  path?: string;
  [key: string]: any; // Allow additional metadata fields
}

// State stores
export const playerState = writable<PlayerState | null>(null);
export const volume = writable<number>(80);
export const mute = writable<boolean>(false);
export const shuffle = writable<boolean>(false);
export const repeat = writable<'off' | 'all' | 'one'>('off');
export const seek = writable<number>(0); // In SECONDS (converted from Volumio's milliseconds)
export const duration = writable<number>(0); // In SECONDS
export const trackInfo = writable<TrackInfo | null>(null);
export const trackInfoLoading = writable<boolean>(false);

// Seek interpolation timer
let seekIntervalId: ReturnType<typeof setInterval> | null = null;
let lastSeekUpdate = 0;

// Derived stores
export const isPlaying = derived(playerState, $state => $state?.status === 'play');
export const isPaused = derived(playerState, $state => $state?.status === 'pause');
export const currentTrack = derived(playerState, $state => ({
  title: $state?.title || 'No track playing',
  artist: $state?.artist || 'Unknown artist',
  album: $state?.album || '',
  albumart: $state?.albumart || '/default-album.svg'
}));

export const trackQuality = derived(playerState, $state => {
  const parts: string[] = [];
  if ($state?.samplerate) parts.push($state.samplerate);
  if ($state?.bitdepth) parts.push($state.bitdepth);
  if ($state?.trackType) parts.push($state.trackType);
  return parts.join(' • ');
});

export const progress = derived([seek, duration], ([$seek, $duration]) => {
  return $duration > 0 ? ($seek / $duration) * 100 : 0;
});

// Actions
export const playerActions = {
  play: (index?: number) => {
    const state = get(playerState);
    const currentStatus = state?.status;
    const currentPosition = state?.position ?? 0;

    // If index provided, play that specific track
    if (index !== undefined) {
      socketService.emit('play', { value: index });
      return;
    }

    // If paused, resume without index
    if (currentStatus === 'pause') {
      socketService.emit('play');
      return;
    }

    // For stop, undefined, or any other state - send with position
    socketService.emit('play', { value: currentPosition });
  },

  // Request current state from backend
  getState: () => {
    socketService.emit('getState');
  },

  pause: () => socketService.emit('pause'),
  stop: () => socketService.emit('stop'),
  prev: () => socketService.emit('prev'),
  next: () => socketService.emit('next'),

  setVolume: (vol: number) => {
    volume.set(vol);
    socketService.emit('volume', vol);
  },

  toggleMute: () => {
    const currentMute = get(mute);
    const newMute = !currentMute;
    mute.set(newMute);
    socketService.emit('mute', newMute ? 'mute' : 'unmute');
  },

  toggleShuffle: () => {
    const currentShuffle = get(shuffle);
    const newShuffle = !currentShuffle;
    shuffle.set(newShuffle);
    socketService.emit('setRandom', { value: newShuffle });
  },

  setRepeat: (mode: 'off' | 'all' | 'one') => {
    repeat.set(mode);
    const repeatSingle = mode === 'one';
    socketService.emit('setRepeat', {
      value: mode !== 'off',
      repeatSingle
    });
  },

  seekTo: (position: number) => {
    seek.set(position);
    socketService.emit('seek', position);
  },

  getTrackInfo: (uri?: string, service?: string) => {
    trackInfoLoading.set(true);
    trackInfo.set(null);
    socketService.emit('GetTrackInfo', { uri, service });
  },

  clearTrackInfo: () => {
    trackInfo.set(null);
  }
};

// Helper to format time
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Start client-side seek interpolation (updates every second while playing)
function startSeekInterpolation() {
  if (seekIntervalId) return; // Already running

  seekIntervalId = setInterval(() => {
    const state = get(playerState);
    const currentSeek = get(seek);
    const currentDuration = get(duration);

    // Only interpolate if playing and not at end
    if (state?.status === 'play' && currentSeek < currentDuration) {
      seek.update(s => Math.min(s + 1, currentDuration));
    }
  }, 1000);
}

// Stop seek interpolation
function stopSeekInterpolation() {
  if (seekIntervalId) {
    clearInterval(seekIntervalId);
    seekIntervalId = null;
  }
}

// Initialize listeners
let initialized = false;

export function initPlayerStore() {
  if (initialized) return;
  initialized = true;

  // Listen for state updates from backend
  socketService.on<PlayerState>('pushState', (state) => {
    // Fix albumart URL to point to Volumio backend
    if (state.albumart) {
      state.albumart = fixVolumioAssetUrl(state.albumart) ?? state.albumart;
    }
    playerState.set(state);

    // Change-gated updates: only set stores whose values actually changed
    if (state.volume !== undefined && state.volume !== get(volume)) volume.set(state.volume);
    if (state.mute !== undefined && state.mute !== get(mute)) mute.set(state.mute);
    if (state.random !== undefined && state.random !== get(shuffle)) shuffle.set(state.random);

    if (state.repeat !== undefined) {
      const newRepeat = state.repeat ? (state.repeatSingle ? 'one' : 'all') : 'off';
      if (newRepeat !== get(repeat)) repeat.set(newRepeat);
    }

    // Convert seek from milliseconds to seconds
    if (state.seek !== undefined) {
      const seekSeconds = Math.floor(state.seek / 1000);
      if (seekSeconds !== get(seek)) {
        seek.set(seekSeconds);
      }
      lastSeekUpdate = Date.now();
    }
    if (state.duration !== undefined && state.duration !== get(duration)) duration.set(state.duration);

    // Manage seek interpolation based on playback state
    if (state.status === 'play') {
      startSeekInterpolation();
    } else {
      stopSeekInterpolation();
    }
  });

  // Listen for track info response
  socketService.on<TrackInfo>('pushTrackInfo', (info) => {
    trackInfo.set(info);
    trackInfoLoading.set(false);
  });

  // Backend pushes state on connect (server.go:169), socket.ts connect handler
  // also requests it (line 165) - no need for an additional delayed request.
}
