import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import { fixVolumioAssetUrl } from '$lib/config';

/**
 * Queue item from Volumio API
 */
export interface QueueItem {
  uri: string;
  service: string;
  name: string;
  artist?: string;
  album?: string;
  albumart?: string;
  type: string;
  tracknumber?: number;
  duration?: number;
  trackType?: string;
  samplerate?: string;
  bitdepth?: string;
}

// Current queue
export const queue = writable<QueueItem[]>([]);

// Loading state
export const queueLoading = writable<boolean>(false);

// Queue length
export const queueLength = derived(queue, ($queue) => $queue.length);

// Total queue duration in seconds
export const queueDuration = derived(queue, ($queue) => {
  return $queue.reduce((total, item) => total + (item.duration || 0), 0);
});

/**
 * Format queue duration as string
 */
export function formatQueueDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Queue actions
 */
export const queueActions = {
  /**
   * Request queue from Volumio
   */
  getQueue() {
    queueLoading.set(true);
    socketService.emit('getQueue');
  },

  /**
   * Play a specific item in the queue
   */
  play(index: number) {
    socketService.emit('play', { value: index });
  },

  /**
   * Remove item from queue
   */
  remove(index: number) {
    socketService.emit('removeFromQueue', { value: index });
  },

  /**
   * Move item in queue
   */
  move(from: number, to: number) {
    socketService.emit('moveQueue', { from, to });
  },

  /**
   * Clear the entire queue
   */
  clear() {
    socketService.emit('clearQueue');
  },

  /**
   * Save queue as playlist
   */
  saveAsPlaylist(name: string) {
    socketService.emit('saveQueueToPlaylist', { name });
  },

  /**
   * Shuffle the queue
   */
  shuffle() {
    // Note: Volumio doesn't have a direct shuffle queue command
  }
};

/**
 * Initialize queue store - set up socket listeners
 */
export function initQueueStore() {
  // Listen for queue updates
  socketService.on<QueueItem[]>('pushQueue', (data) => {
    // Fix albumart URLs to point to Volumio backend
    const fixedData = (data || []).map(item => ({
      ...item,
      albumart: fixVolumioAssetUrl(item.albumart)
    }));
    queue.set(fixedData);
    queueLoading.set(false);
  });

  // Backend pushes queue on connect (server.go:170) - no need to fetch here.
}
