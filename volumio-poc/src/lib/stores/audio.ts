import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * Audio format information from the backend.
 */
export interface AudioFormat {
  sampleRate: number;    // Sample rate in Hz (44100, 96000, 192000, etc.)
  bitDepth: number;      // Bit depth (16, 24, 32)
  channels: number;      // Number of channels (usually 2)
  format: string;        // Format string ("PCM", "DSD64", "DSD128", etc.)
  isBitPerfect: boolean; // True if bit-perfect output (no resampling)
}

/**
 * Audio status from the backend.
 */
export interface AudioStatus {
  locked: boolean;       // True if device is locked for exclusive playback
  format: AudioFormat | null; // Current audio format (null if not playing)
}

/**
 * Bit-perfect configuration status from the backend.
 * This represents the system configuration (MPD, ALSA), not the real-time audio format.
 */
export interface BitPerfectConfig {
  status: 'ok' | 'warning' | 'error'; // Configuration status
  issues: string[];      // Critical issues preventing bit-perfect output
  warnings: string[];    // Non-critical warnings
  config: string[];      // Current configuration details
}

// Default state
const defaultStatus: AudioStatus = {
  locked: false,
  format: null
};

// Main stores
export const audioStatus = writable<AudioStatus>(defaultStatus);
export const bitPerfectConfig = writable<BitPerfectConfig | null>(null);

// Derived stores for convenient access
export const isDeviceLocked = derived(audioStatus, $status => $status.locked);

export const audioFormat = derived(audioStatus, $status => $status.format);

export const isBitPerfect = derived(audioStatus, $status => $status.format?.isBitPerfect ?? false);

// Derived store for bit-perfect configuration status
export const isBitPerfectConfigOk = derived(bitPerfectConfig, $config => $config?.status === 'ok');

/**
 * Format sample rate for display (e.g., "192kHz", "DSD128")
 */
export const formattedSampleRate = derived(audioStatus, $status => {
  const format = $status.format;
  if (!format) return null;

  const sampleRate = format.sampleRate;

  // DSD detection based on sample rate
  if (sampleRate >= 1000000) {
    // DSD rates - return format string (DSD64, DSD128, etc.)
    return format.format;
  }

  // PCM format - convert to kHz
  if (sampleRate >= 1000) {
    const kHz = sampleRate / 1000;
    return kHz % 1 === 0 ? `${kHz}kHz` : `${kHz.toFixed(1)}kHz`;
  }

  return `${sampleRate}Hz`;
});

/**
 * Format bit depth for display (e.g., "24-bit")
 */
export const formattedBitDepth = derived(audioStatus, $status => {
  const format = $status.format;
  if (!format) return null;
  return `${format.bitDepth}-bit`;
});

/**
 * Combined format badge text (e.g., "192kHz/24-bit" or "DSD128")
 */
export const formatBadge = derived(
  [formattedSampleRate, formattedBitDepth, audioStatus],
  ([$sampleRate, $bitDepth, $status]) => {
    if (!$status.format) return null;

    // For DSD, just show the DSD format
    if ($status.format.format.startsWith('DSD')) {
      return $status.format.format;
    }

    // For PCM, show sample rate and bit depth
    if ($sampleRate && $bitDepth) {
      return `${$sampleRate}/${$bitDepth}`;
    }

    return $sampleRate || $bitDepth || null;
  }
);

// Actions
export const audioActions = {
  /**
   * Request current audio status from backend
   */
  getStatus: () => {
    socketService.emit('getAudioStatus');
  },

  /**
   * Request bit-perfect configuration status from backend
   */
  getBitPerfectConfig: () => {
    socketService.emit('getBitPerfect');
  }
};

// Initialize listeners
let initialized = false;

export function initAudioStore() {
  if (initialized) return;
  initialized = true;

  console.log('🔊 Initializing audio store...');

  // Listen for audio status updates from backend
  socketService.on<AudioStatus>('pushAudioStatus', (status) => {
    console.log('🔊 pushAudioStatus received:', status);
    audioStatus.set(status);
  });

  // Listen for bit-perfect configuration updates from backend
  socketService.on<BitPerfectConfig>('pushBitPerfect', (config) => {
    console.log('🔊 pushBitPerfect received:', config);
    bitPerfectConfig.set(config);
  });

  console.log('✅ Audio store initialized');

  // Request initial status after a short delay
  setTimeout(() => {
    console.log('📡 Requesting initial audio status...');
    socketService.emit('getAudioStatus');
  }, 600);
}

export function cleanupAudioStore() {
  // Reset to default state
  audioStatus.set(defaultStatus);
  bitPerfectConfig.set(null);
  // Allow re-initialization
  initialized = false;
}
