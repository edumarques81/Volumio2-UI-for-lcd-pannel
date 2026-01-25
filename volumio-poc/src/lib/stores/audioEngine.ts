/**
 * Audio Engine Store
 *
 * Manages mutual exclusion between MPD and Audirvana audio engines.
 * Only one engine can be active at a time for bit-perfect playback.
 */

import { writable, derived, get } from 'svelte/store';
import { socketService } from '../services/socket';
import { audirvanaService, audirvanaAvailable } from './audirvana';

// ============================================================================
// Types
// ============================================================================

export type AudioEngineType = 'mpd' | 'audirvana';

export interface AudioEngineState {
  active: AudioEngineType;
  switching: boolean;
  error: string | null;
}

// ============================================================================
// State
// ============================================================================

const initialState: AudioEngineState = {
  active: 'mpd', // Default to MPD
  switching: false,
  error: null
};

export const audioEngineState = writable<AudioEngineState>(initialState);

// ============================================================================
// Derived Stores
// ============================================================================

/** Currently active audio engine */
export const activeEngine = derived(audioEngineState, ($state) => $state.active);

/** Whether we're switching engines */
export const engineSwitching = derived(audioEngineState, ($state) => $state.switching);

/** Whether Audirvana can be used (installed and service available) */
export const canUseAudirvana = derived(
  [audirvanaAvailable],
  ([$available]) => $available
);

// ============================================================================
// Actions
// ============================================================================

export const audioEngineActions = {
  /**
   * Switch to a different audio engine
   * Handles stopping the current engine and starting the new one
   */
  async switchTo(engine: AudioEngineType): Promise<boolean> {
    const currentState = get(audioEngineState);

    // Already on this engine
    if (currentState.active === engine) {
      return true;
    }

    // Already switching
    if (currentState.switching) {
      console.warn('[AudioEngine] Already switching, ignoring request');
      return false;
    }

    // Check if Audirvana is available before switching to it
    if (engine === 'audirvana' && !get(canUseAudirvana)) {
      audioEngineState.update((s) => ({
        ...s,
        error: 'Audirvana is not available. Make sure it is installed and the service is running.'
      }));
      return false;
    }

    console.log(`[AudioEngine] Switching from ${currentState.active} to ${engine}`);

    audioEngineState.update((s) => ({
      ...s,
      switching: true,
      error: null
    }));

    try {
      // Stop current engine
      if (currentState.active === 'mpd') {
        await stopMpd();
      } else if (currentState.active === 'audirvana') {
        await stopAudirvana();
      }

      // Start new engine
      if (engine === 'mpd') {
        await startMpd();
      } else if (engine === 'audirvana') {
        await startAudirvana();
      }

      audioEngineState.update((s) => ({
        ...s,
        active: engine,
        switching: false,
        error: null
      }));

      console.log(`[AudioEngine] Successfully switched to ${engine}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AudioEngine] Switch failed:`, error);

      audioEngineState.update((s) => ({
        ...s,
        switching: false,
        error: `Failed to switch to ${engine}: ${message}`
      }));

      return false;
    }
  },

  /**
   * Clear any error state
   */
  clearError(): void {
    audioEngineState.update((s) => ({
      ...s,
      error: null
    }));
  },

  /**
   * Reset to initial state
   */
  reset(): void {
    audioEngineState.set(initialState);
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

function stopMpd(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[AudioEngine] Stopping MPD...');

    // MPD stop is handled via systemctl on the backend
    // For now, we just stop playback - the backend should handle service management
    socketService.emit('stop');

    // Give it a moment to stop
    setTimeout(resolve, 500);
  });
}

function startMpd(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[AudioEngine] Starting MPD...');

    // MPD should already be running, just ensure it's ready
    // Request state to confirm it's responsive
    socketService.emit('getState');

    setTimeout(resolve, 500);
  });
}

function stopAudirvana(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[AudioEngine] Stopping Audirvana...');

    socketService.emit('audirvanaStopService');

    // Wait for service to stop
    setTimeout(resolve, 2000);
  });
}

function startAudirvana(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[AudioEngine] Starting Audirvana...');

    socketService.emit('audirvanaStartService');

    // Wait for service to start
    setTimeout(resolve, 3000);
  });
}

// ============================================================================
// Initialization
// ============================================================================

let initialized = false;

/**
 * Initialize the audio engine store
 * Determines initial state based on what's currently running
 */
export function initAudioEngineStore(): void {
  if (initialized) {
    return;
  }

  // Listen for Audirvana status to determine if it should be the active engine
  const $audirvanaService = get(audirvanaService);

  if ($audirvanaService.running) {
    // Audirvana is running, it's likely the active engine
    audioEngineState.update((s) => ({
      ...s,
      active: 'audirvana'
    }));
  }

  initialized = true;
  console.log('[AudioEngine] Store initialized, active:', get(activeEngine));
}

/**
 * Cleanup the audio engine store
 */
export function cleanupAudioEngineStore(): void {
  audioEngineState.set(initialState);
  initialized = false;
}
