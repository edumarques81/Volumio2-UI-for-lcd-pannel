import { writable } from 'svelte/store';
import { getVolumioHost } from '$lib/config';

// Use global io from CDN (loaded in index.html)
declare const io: any;

export type ConnectionState = 'connected' | 'disconnected' | 'connecting';

export const connectionState = writable<ConnectionState>('disconnected');
export const loadingState = writable<boolean>(false);

class SocketService {
  private socket: any = null;
  private host: string;
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private loadingBarRequestEvents: string[] = [
    'browseLibrary',
    'search',
    'goTo',
    'GetTrackInfo',
    // Playlist events
    'createPlaylist',
    'listPlaylist',
    'addToPlaylist',
    'removeFromPlaylist',
    'deletePlaylist',
    'playPlaylist',
    'enqueue',
    // Favorites events
    'addToFavourites',
    'removeFromFavourites',
    'playFavourites',
  ];

  constructor(host: string) {
    this.host = host;
  }

  connect(): void {
    console.log(`Connecting to ${this.host}...`);
    connectionState.set('connecting');

    // Socket.io v2 connection - simple options like the working test
    this.socket = io(this.host, {
      transports: ['polling', 'websocket']
    });

    console.log('Socket instance created, waiting for events...');

    this.socket.on('connect', () => {
      console.log(`✓ Socket connected to ${this.host}`);
      connectionState.set('connected');

      // Request initial state
      this.emit('getState');
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected, reason:', reason);
      connectionState.set('disconnected');
    });

    this.socket.on('connect_error', (error: any) => {
      console.error(`Socket connect_error:`, error);
      connectionState.set('disconnected');
    });

    this.socket.on('connect_timeout', () => {
      console.error('Socket connect_timeout');
      connectionState.set('disconnected');
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log('Reconnect attempt:', attemptNumber);
    });
  }

  emit(eventName: string, data?: any, callback?: (response: any) => void): void {
    if (!this.socket) {
      console.warn('Socket not initialized');
      return;
    }

    if (this.loadingBarRequestEvents.includes(eventName)) {
      loadingState.set(true);
    }

    console.log(`→ emit: ${eventName}`, data);

    this.socket.emit(eventName, data, (response) => {
      loadingState.set(false);
      callback?.(response);
    });
  }

  on<T = any>(eventName: string, callback: (data: T) => void): () => void {
    if (!this.socket) {
      console.warn('Socket not initialized');
      return () => {};
    }

    const handler = (data: T) => {
      console.log(`← ${eventName}:`, data);
      loadingState.set(false);
      callback(data);
    };

    this.socket.on(eventName, handler);

    // Track handler for simulation
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.socket?.off(eventName, handler);
      this.eventHandlers.get(eventName)?.delete(handler);
    };
  }

  off(eventName: string, handler?: Function): void {
    this.socket?.off(eventName, handler as any);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    connectionState.set('disconnected');
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Simulate receiving an event (for testing purposes)
   */
  simulateEvent(eventName: string, data: any): void {
    console.log(`[TEST] Simulating event: ${eventName}`, data);
    const handlers = this.eventHandlers.get(eventName);
    if (handlers && handlers.size > 0) {
      handlers.forEach((handler) => handler(data));
    } else {
      console.warn(`[TEST] No handlers registered for event: ${eventName}`);
    }
  }
}

// Singleton instance - uses config to determine the correct host
export const socketService = new SocketService(getVolumioHost());
