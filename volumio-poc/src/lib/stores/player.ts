import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';
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
export const seek = writable<number>(0);
export const duration = writable<number>(0);
export const trackInfo = writable<TrackInfo | null>(null);
export const trackInfoLoading = writable<boolean>(false);

// Derived stores
export const isPlaying = derived(playerState, $state => $state?.status === 'play');
export const isPaused = derived(playerState, $state => $state?.status === 'pause');
export const currentTrack = derived(playerState, $state => ({
  title: $state?.title || 'No track playing',
  artist: $state?.artist || 'Unknown artist',
  album: $state?.album || '',
  albumart: $state?.albumart || '/default-album.png'
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
  play: () => {
    console.log('▶ Play');
    socketService.emit('play');
  },

  pause: () => {
    console.log('⏸ Pause');
    socketService.emit('pause');
  },

  stop: () => {
    console.log('⏹ Stop');
    socketService.emit('stop');
  },

  prev: () => {
    console.log('⏮ Previous');
    socketService.emit('prev');
  },

  next: () => {
    console.log('⏭ Next');
    socketService.emit('next');
  },

  setVolume: (vol: number) => {
    console.log(`🔊 Volume: ${vol}`);
    volume.set(vol);
    socketService.emit('volume', vol);
  },

  toggleMute: () => {
    const currentMute = get(mute);
    const newMute = !currentMute;
    console.log(`🔇 Mute: ${newMute}`);
    mute.set(newMute);
    socketService.emit('mute', newMute ? 'mute' : 'unmute');
  },

  toggleShuffle: () => {
    const currentShuffle = get(shuffle);
    const newShuffle = !currentShuffle;
    console.log(`🔀 Shuffle: ${newShuffle}`);
    shuffle.set(newShuffle);
    socketService.emit('setRandom', { value: newShuffle });
  },

  setRepeat: (mode: 'off' | 'all' | 'one') => {
    console.log(`🔁 Repeat: ${mode}`);
    repeat.set(mode);
    const repeatSingle = mode === 'one';
    socketService.emit('setRepeat', {
      value: mode !== 'off',
      repeatSingle
    });
  },

  seekTo: (position: number) => {
    console.log(`⏩ Seek to: ${position}s`);
    seek.set(position);
    socketService.emit('seek', position);
  },

  getTrackInfo: (uri?: string, service?: string) => {
    console.log('ℹ️ Getting track info');
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

// Initialize listeners
let initialized = false;

export function initPlayerStore() {
  if (initialized) return;
  initialized = true;

  console.log('Initializing player store...');

  // Listen for state updates from backend
  socketService.on<PlayerState>('pushState', (state) => {
    console.log('📊 State update:', state);
    playerState.set(state);

    // Update derived values
    if (state.volume !== undefined) volume.set(state.volume);
    if (state.mute !== undefined) mute.set(state.mute);
    if (state.random !== undefined) shuffle.set(state.random);

    if (state.repeat !== undefined) {
      repeat.set(state.repeat ? (state.repeatSingle ? 'one' : 'all') : 'off');
    }

    if (state.seek !== undefined) seek.set(state.seek);
    if (state.duration !== undefined) duration.set(state.duration);
  });

  // Listen for queue updates
  socketService.on('pushQueue', (queue) => {
    console.log('📋 Queue update:', queue);
  });

  // Listen for toast messages
  socketService.on('pushToastMessage', (message) => {
    console.log('💬 Toast:', message);
  });

  // Listen for track info response
  socketService.on<TrackInfo>('pushTrackInfo', (info) => {
    console.log('ℹ️ Track info:', info);
    trackInfo.set(info);
    trackInfoLoading.set(false);
  });
}
