import { writable } from 'svelte/store';
import { getVolumioHost } from '$lib/config';
import io from 'socket.io-client';

// Global singleton check - prevents multiple instances if module is loaded multiple times
declare global {
  interface Window {
    __stellarSocketInstance?: SocketService;
    __stellarSocketConnected?: boolean;
  }
}

export type ConnectionState = 'connected' | 'disconnected' | 'connecting';

export const connectionState = writable<ConnectionState>('disconnected');
export const loadingState = writable<boolean>(false);

// Latency metrics store - records recent latency measurements
export interface LatencyMetric {
  event: string;
  latencyMs: number;
  timestamp: number;
}

const MAX_LATENCY_SAMPLES = 50;
export const latencyMetrics = writable<LatencyMetric[]>([]);

class SocketService {
  private socket: any = null;
  private host: string;
  private eventHandlers: Map<string, Set<Function>> = new Map();

  // Latency instrumentation - tracks pending requests and their start times
  private pendingLatencyTimers: Map<string, number> = new Map();

  // Map of request events to their expected response events for latency tracking
  private latencyEventPairs: Map<string, string> = new Map([
    ['getState', 'pushState'],
    ['play', 'pushState'],
    ['pause', 'pushState'],
    ['stop', 'pushState'],
    ['next', 'pushState'],
    ['prev', 'pushState'],
    ['seek', 'pushState'],
    ['volume', 'pushState'],
    ['getQueue', 'pushQueue'],
    ['getNetworkStatus', 'pushNetworkStatus'],
    ['getLcdStatus', 'pushLcdStatus'],
    ['lcdStandby', 'pushLcdStatus'],
    ['lcdWake', 'pushLcdStatus'],
    ['browseLibrary', 'pushBrowseLibrary'],
    ['GetTrackInfo', 'pushTrackInfo'],
  ]);

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
    // Global singleton check - prevents connection if already connected globally
    if (typeof window !== 'undefined' && window.__stellarSocketConnected) {
      console.log('Socket already connected globally, skipping connect()');
      return;
    }

    // Prevent duplicate connections
    if (this.socket?.connected) {
      console.log('Socket already connected, skipping connect()');
      return;
    }

    // Disconnect existing socket if any (orphaned connection)
    if (this.socket) {
      console.log('Disconnecting existing socket before reconnecting');
      this.socket.disconnect();
      this.socket = null;
    }

    console.log(`Connecting to ${this.host}...`);
    connectionState.set('connecting');

    // Socket.io v4 connection
    // WebSocket only - no polling to ensure single stable connection
    this.socket = io(this.host, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      forceNew: false
    });

    console.log('Socket instance created, waiting for events...');

    this.socket.on('connect', () => {
      console.log(`✓ Socket connected to ${this.host}`);
      connectionState.set('connected');

      // Set global connected flag
      if (typeof window !== 'undefined') {
        window.__stellarSocketConnected = true;
      }

      // Register any handlers that were added before socket was connected
      for (const [eventName, handlers] of this.eventHandlers.entries()) {
        for (const handler of handlers) {
          this.socket.on(eventName, handler);
        }
      }

      // Request initial state
      this.emit('getState');
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected, reason:', reason);
      connectionState.set('disconnected');

      // Clear global connected flag
      if (typeof window !== 'undefined') {
        window.__stellarSocketConnected = false;
      }
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

    // Start latency timer if this event has a paired response
    const responseEvent = this.latencyEventPairs.get(eventName);
    if (responseEvent) {
      this.pendingLatencyTimers.set(responseEvent, performance.now());
    }

    console.log(`→ emit: ${eventName}`, data);

    this.socket.emit(eventName, data, (response) => {
      loadingState.set(false);
      callback?.(response);
    });
  }

  on<T = any>(eventName: string, callback: (data: T) => void): () => void {
    const handler = (data: T) => {
      // Check for pending latency timer
      const startTime = this.pendingLatencyTimers.get(eventName);
      if (startTime !== undefined) {
        const latencyMs = performance.now() - startTime;
        this.pendingLatencyTimers.delete(eventName);
        this.recordLatency(eventName, latencyMs);
      }

      console.log(`← ${eventName}:`, data);
      loadingState.set(false);
      callback(data);
    };

    // Track handler for simulation (do this even if socket not connected)
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName)!.add(handler);

    // Register with socket if connected
    if (this.socket) {
      this.socket.on(eventName, handler);
    } else {
      // Socket not ready - will be registered when connect() is called
      console.log(`Socket not initialized, handler for ${eventName} will be registered on connect`);
    }

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

  /**
   * Record a latency measurement
   */
  private recordLatency(event: string, latencyMs: number): void {
    const metric: LatencyMetric = {
      event,
      latencyMs: Math.round(latencyMs * 100) / 100, // Round to 2 decimal places
      timestamp: Date.now()
    };

    console.log(`[Perf] ${event}: ${metric.latencyMs.toFixed(2)}ms`);

    latencyMetrics.update((metrics) => {
      const updated = [...metrics, metric];
      // Keep only the last MAX_LATENCY_SAMPLES
      if (updated.length > MAX_LATENCY_SAMPLES) {
        return updated.slice(-MAX_LATENCY_SAMPLES);
      }
      return updated;
    });
  }

  /**
   * Get latency statistics for a specific event or all events
   */
  getLatencyStats(eventName?: string): { avg: number; min: number; max: number; count: number } | null {
    let metrics: LatencyMetric[] = [];
    const unsubscribe = latencyMetrics.subscribe((m) => { metrics = m; });
    unsubscribe();

    const filtered = eventName
      ? metrics.filter((m) => m.event === eventName)
      : metrics;

    if (filtered.length === 0) {
      return null;
    }

    const latencies = filtered.map((m) => m.latencyMs);
    return {
      avg: Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100,
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      count: latencies.length
    };
  }

  /**
   * Clear all latency metrics
   */
  clearLatencyMetrics(): void {
    latencyMetrics.set([]);
  }

  /**
   * Get the underlying socket instance (for E2E testing)
   */
  getSocket(): any {
    return this.socket;
  }
}

// Singleton instance - uses global window check to prevent duplicate instances
function getSocketService(): SocketService {
  if (typeof window !== 'undefined' && window.__stellarSocketInstance) {
    return window.__stellarSocketInstance;
  }
  const instance = new SocketService(getVolumioHost());
  if (typeof window !== 'undefined') {
    window.__stellarSocketInstance = instance;
  }
  return instance;
}

export const socketService = getSocketService();
