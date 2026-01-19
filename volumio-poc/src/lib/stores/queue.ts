import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

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
    console.log('[Queue] Playing index:', index);
    socketService.emit('play', { value: index });
  },

  /**
   * Remove item from queue
   */
  remove(index: number) {
    console.log('[Queue] Removing index:', index);
    socketService.emit('removeFromQueue', { value: index });
  },

  /**
   * Move item in queue
   */
  move(from: number, to: number) {
    console.log('[Queue] Moving:', from, '->', to);
    socketService.emit('moveQueue', { from, to });
  },

  /**
   * Clear the entire queue
   */
  clear() {
    console.log('[Queue] Clearing');
    socketService.emit('clearQueue');
  },

  /**
   * Save queue as playlist
   */
  saveAsPlaylist(name: string) {
    console.log('[Queue] Saving as playlist:', name);
    socketService.emit('saveQueueToPlaylist', { name });
  },

  /**
   * Shuffle the queue
   */
  shuffle() {
    console.log('[Queue] Shuffling');
    // Note: Volumio doesn't have a direct shuffle queue command
    // This would need custom implementation
  }
};

/**
 * Initialize queue store - set up socket listeners
 */
export function initQueueStore() {
  // Listen for queue updates
  socketService.on<QueueItem[]>('pushQueue', (data) => {
    console.log('[Queue] Received:', data?.length, 'items');
    queue.set(data || []);
    queueLoading.set(false);
  });

  // Fetch queue on init
  queueActions.getQueue();
}
