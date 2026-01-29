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

export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';

export const connectionState = writable<ConnectionState>('disconnected');
export const loadingState = writable<boolean>(false);

// Grace period for brief disconnections - prevents UI flicker
// When disconnected, we wait this long before showing the disconnect UI
const DISCONNECT_GRACE_PERIOD_MS = 3000; // 3 seconds

// Whether we're in the grace period (raw=disconnected, but UI still shows as connected)
export const isReconnecting = writable<boolean>(false);

// Grace period timer reference
let disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;

// Track if we've ever been connected (to distinguish initial connection from reconnection)
let hasEverConnected = false;

// Track last successful data received time for connection health monitoring
let lastDataReceivedTime = 0;

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
    // Check if we think we're connected globally
    if (typeof window !== 'undefined' && window.__stellarSocketConnected) {
      // Verify the socket is actually connected and healthy
      if (this.socket?.connected && this.isConnectionHealthy(30000)) {
        console.log('Socket already connected and healthy, skipping connect()');
        return;
      } else {
        // Global flag says connected, but socket is dead - clear flag and reconnect
        console.log('Socket marked as connected but appears dead, clearing flag and reconnecting');
        window.__stellarSocketConnected = false;
      }
    }

    // Prevent duplicate connections only if socket is truly connected
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

      // Cancel any pending grace period timer - we're back online!
      if (disconnectGraceTimer) {
        clearTimeout(disconnectGraceTimer);
        disconnectGraceTimer = null;
        console.log('[Connect] Cancelled disconnect grace period timer');
      }

      // Immediately show connected state (no delay)
      connectionState.set('connected');
      isReconnecting.set(false);
      hasEverConnected = true;

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

      // Mobile connection verification: if we don't receive data within 10s,
      // the connection might be a zombie - force reconnect
      setTimeout(() => {
        if (lastDataReceivedTime === 0 && this.socket?.connected) {
          console.log('[Connect] No data received within 10s after connect - connection may be zombie');
          // Try requesting state again
          this.emit('getState');

          // If still no data after another 5 seconds, force reconnect
          setTimeout(() => {
            if (lastDataReceivedTime === 0) {
              console.log('[Connect] Still no data after 15s - forcing reconnect');
              this.forceReconnect();
            }
          }, 5000);
        }
      }, 10000);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected, reason:', reason);

      // Clear global connected flag
      if (typeof window !== 'undefined') {
        window.__stellarSocketConnected = false;
      }

      // If we've been connected before, use grace period to prevent UI flicker
      // For brief disconnections (< 3 seconds), the UI stays stable
      if (hasEverConnected) {
        // Start grace period - show reconnecting indicator but keep UI visible
        if (!disconnectGraceTimer) {
          console.log(`[Disconnect] Starting ${DISCONNECT_GRACE_PERIOD_MS}ms grace period`);
          isReconnecting.set(true);

          disconnectGraceTimer = setTimeout(() => {
            // Grace period expired - show full disconnect UI
            console.log('[Disconnect] Grace period expired, showing disconnect UI');
            connectionState.set('disconnected');
            isReconnecting.set(false);
            disconnectGraceTimer = null;
          }, DISCONNECT_GRACE_PERIOD_MS);
        }
      } else {
        // First connection attempt failed - show disconnect immediately
        connectionState.set('disconnected');
      }
    });

    this.socket.on('connect_error', (error: any) => {
      console.error(`Socket connect_error:`, error);
      // Only set disconnected if this is an initial connection failure
      // For reconnection failures, the grace period handles this
      if (!hasEverConnected && !disconnectGraceTimer) {
        connectionState.set('disconnected');
      }
    });

    this.socket.on('connect_timeout', () => {
      console.error('Socket connect_timeout');
      // Only set disconnected if this is an initial connection failure
      if (!hasEverConnected && !disconnectGraceTimer) {
        connectionState.set('disconnected');
      }
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnect_failed - all attempts exhausted');
      // All reconnection attempts failed - clear grace period and show disconnect
      if (disconnectGraceTimer) {
        clearTimeout(disconnectGraceTimer);
        disconnectGraceTimer = null;
      }
      connectionState.set('disconnected');
      isReconnecting.set(false);
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
      // Update last data received time for connection health monitoring
      this.updateLastDataTime();

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
    // Clear any pending grace period timer
    if (disconnectGraceTimer) {
      clearTimeout(disconnectGraceTimer);
      disconnectGraceTimer = null;
    }

    this.socket?.disconnect();
    this.socket = null;
    connectionState.set('disconnected');
    isReconnecting.set(false);
    if (typeof window !== 'undefined') {
      window.__stellarSocketConnected = false;
    }
  }

  /**
   * Force an immediate reconnection - useful when returning from background
   * This bypasses Socket.IO's exponential backoff
   */
  forceReconnect(): void {
    console.log('Force reconnecting socket...');

    // Clear any pending grace period timer
    if (disconnectGraceTimer) {
      clearTimeout(disconnectGraceTimer);
      disconnectGraceTimer = null;
    }

    // Show reconnecting state
    isReconnecting.set(true);

    // Clear global flag to allow reconnection
    if (typeof window !== 'undefined') {
      window.__stellarSocketConnected = false;
    }

    // Disconnect existing socket completely
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Reconnect immediately
    this.connect();
  }

  /**
   * Check if connection appears healthy (received data recently)
   * @param maxAgeMs Maximum age of last received data in milliseconds
   */
  isConnectionHealthy(maxAgeMs: number = 30000): boolean {
    // If socket object says disconnected, definitely unhealthy
    if (!this.socket?.connected) {
      return false;
    }

    // If we've never received data and connection is "fresh" (< 5 seconds), give it a chance
    if (lastDataReceivedTime === 0) {
      // Check how long ago we "connected" - if socket.connected is true but
      // we've never received data for a while, it's likely dead
      return true; // Trust initial connection briefly
    }

    // Check if we've received data within the timeout window
    const dataAge = Date.now() - lastDataReceivedTime;
    const isHealthy = dataAge < maxAgeMs;

    if (!isHealthy) {
      console.log(`[HealthCheck] Last data received ${Math.round(dataAge / 1000)}s ago (max: ${maxAgeMs / 1000}s) - UNHEALTHY`);
    }

    return isHealthy;
  }

  /**
   * Update last data received timestamp
   */
  private updateLastDataTime(): void {
    lastDataReceivedTime = Date.now();
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
