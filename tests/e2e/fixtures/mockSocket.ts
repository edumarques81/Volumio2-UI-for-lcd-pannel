/**
 * Socket.IO mock harness for Playwright specs.
 *
 * Boots a real `socket.io` server on an ephemeral port on 127.0.0.1, routes
 * the page's `/config.json` to point the frontend at it, and exposes helpers
 * for sending canned events to the client and capturing client emits (with
 * support for ack callbacks).
 *
 * Why a real socket.io server (rather than route-mocking the WebSocket frames):
 * - The frontend ships socket.io-client@4 with `transports: ['websocket']`.
 * - The backend on the Pi runs socket.io-server@v3 with EIO3 compat enabled,
 *   and a real-server harness exercises the same handshake/encoding path,
 *   meaning bugs that only show up over the wire still surface here.
 *
 * Compatibility note: socket.io@4 server defaults to EIO4. We enable EIO3
 * because that's what the production backend uses; the v4 client speaks both.
 *
 * Usage:
 *
 * ```ts
 * import { test, expect } from './fixtures/mockSocket';
 *
 * test('something', async ({ page, mockSocket }) => {
 *   await page.goto('/');
 *   await mockSocket.waitForClient();
 *   await mockSocket.send('pushState', { ... });
 *   const emit = await mockSocket.waitForEmit('reboot');
 *   expect(emit.payload).toBeUndefined();
 * });
 * ```
 */

import { test as base, expect, type Page } from '@playwright/test';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as IOServer, type Socket as IOSocket } from 'socket.io';

/** A single emit captured from a connected client. */
export interface CapturedEmit {
  event: string;
  payload: unknown;
  /** Resolve the client's ack callback (if any was passed). */
  ack: ((response: unknown) => void) | null;
  /** When the emit was received (Date.now()). */
  at: number;
}

export interface WaitForEmitOptions {
  /** Skip the first N matching emits (lets you wait for the 2nd, 3rd, …). */
  skip?: number;
  /** Timeout in ms (default 5000). */
  timeout?: number;
}

/** Public mock-server API exposed to specs. */
export interface MockSocket {
  /** The base URL the frontend connects to (`http://127.0.0.1:<port>`). */
  readonly url: string;
  /** Wait until at least one client has connected. */
  waitForClient(timeoutMs?: number): Promise<void>;
  /** Push a server→client event to every connected socket. */
  send(event: string, payload?: unknown): void;
  /**
   * Resolve when a client emit matching `event` is received.
   * Returns the captured emit (so the spec can drive the ack if any).
   */
  waitForEmit(event: string, opts?: WaitForEmitOptions): Promise<CapturedEmit>;
  /** Synchronous read of all emits captured for `event` so far. */
  getEmits(event: string): CapturedEmit[];
  /** Synchronous read of all emits across all events (most recent last). */
  getAllEmits(): CapturedEmit[];
  /** Forget all captured emits without disconnecting. */
  clearEmits(): void;
}

/**
 * Internal helper: routes `/config.json` for the given page so the frontend's
 * `initConfig()` resolves to our mock backend URL.
 */
async function routeConfigJson(page: Page, backendUrl: string): Promise<void> {
  await page.route('**/config.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ backendUrl }),
    }),
  );
}

interface InternalState {
  http: HttpServer;
  io: IOServer;
  url: string;
  emits: CapturedEmit[];
  /** Subscribers waiting for a specific event, in insertion order. */
  pending: Array<{
    event: string;
    skip: number;
    seen: number;
    resolve: (e: CapturedEmit) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>;
  connected: IOSocket[];
  connectedResolvers: Array<() => void>;
}

async function startServer(): Promise<InternalState> {
  const http = createServer();
  // EIO3 matches the production Pi backend (socket.io v3 server).
  const io = new IOServer(http, {
    allowEIO3: true,
    cors: { origin: '*' },
    // No transport restriction — the v4 client opts into websocket itself.
  });

  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const addr = http.address() as AddressInfo;
  const url = `http://127.0.0.1:${addr.port}`;

  const state: InternalState = {
    http,
    io,
    url,
    emits: [],
    pending: [],
    connected: [],
    connectedResolvers: [],
  };

  io.on('connection', (socket: IOSocket) => {
    state.connected.push(socket);
    for (const r of state.connectedResolvers) r();
    state.connectedResolvers = [];

    // Capture every event the client emits, including ack callbacks.
    socket.onAny((event: string, ...args: unknown[]) => {
      // socket.io v4 puts the ack callback at the tail when the emitter passed
      // one; otherwise args is just the payload list.
      let ack: CapturedEmit['ack'] = null;
      let payload: unknown = undefined;

      if (args.length > 0 && typeof args[args.length - 1] === 'function') {
        ack = args[args.length - 1] as CapturedEmit['ack'];
        const rest = args.slice(0, -1);
        payload = rest.length === 0 ? undefined : rest.length === 1 ? rest[0] : rest;
      } else if (args.length === 1) {
        payload = args[0];
      } else if (args.length > 1) {
        payload = args;
      }

      const captured: CapturedEmit = { event, payload, ack, at: Date.now() };
      state.emits.push(captured);

      // Wake any matching subscriber.
      for (let i = 0; i < state.pending.length; i++) {
        const p = state.pending[i];
        if (p.event !== event) continue;
        if (p.seen < p.skip) {
          p.seen += 1;
          continue;
        }
        clearTimeout(p.timer);
        state.pending.splice(i, 1);
        p.resolve(captured);
        break;
      }
    });

    socket.on('disconnect', () => {
      state.connected = state.connected.filter((s) => s !== socket);
    });
  });

  return state;
}

async function stopServer(state: InternalState): Promise<void> {
  // Reject any still-pending waiters so tests don't hang on teardown.
  for (const p of state.pending) {
    clearTimeout(p.timer);
    p.reject(new Error(`mockSocket teardown while waiting for emit '${p.event}'`));
  }
  state.pending = [];

  // Disconnect existing clients aggressively so they don't try to reconnect.
  for (const s of state.connected) s.disconnect(true);

  // socket.io@4's Server.close() also closes the underlying http server it was
  // attached to, so calling http.close() afterwards throws ERR_SERVER_NOT_RUNNING.
  // Just await io.close() — that does both.
  await new Promise<void>((resolve) => state.io.close(() => resolve()));
}

function buildPublicApi(state: InternalState): MockSocket {
  return {
    get url() {
      return state.url;
    },

    async waitForClient(timeoutMs = 5000): Promise<void> {
      if (state.connected.length > 0) return;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`mockSocket: no client connected within ${timeoutMs}ms`)),
          timeoutMs,
        );
        state.connectedResolvers.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    },

    send(event, payload) {
      // Use the namespace broadcast so new listeners that joined a room miss
      // nothing — the frontend only ever uses the default namespace.
      if (payload === undefined) state.io.emit(event);
      else state.io.emit(event, payload);
    },

    waitForEmit(event, opts = {}) {
      const skip = opts.skip ?? 0;
      const timeoutMs = opts.timeout ?? 5000;

      // Fast path: if enough matching emits already happened, resolve from the buffer.
      const already = state.emits.filter((e) => e.event === event);
      if (already.length > skip) return Promise.resolve(already[skip]);

      return new Promise<CapturedEmit>((resolve, reject) => {
        const timer = setTimeout(() => {
          // Remove this pending entry on timeout.
          const idx = state.pending.findIndex((p) => p.timer === timer);
          if (idx >= 0) state.pending.splice(idx, 1);
          reject(
            new Error(
              `mockSocket: timeout waiting for emit '${event}' (skip=${skip}, timeout=${timeoutMs}ms)`,
            ),
          );
        }, timeoutMs);

        state.pending.push({
          event,
          skip,
          // Treat already-seen matching emits as "consumed by previous skips" so
          // a 2nd-call waitForEmit still skips correctly.
          seen: Math.min(already.length, skip),
          resolve,
          reject,
          timer,
        });
      });
    },

    getEmits(event) {
      return state.emits.filter((e) => e.event === event);
    },

    getAllEmits() {
      return [...state.emits];
    },

    clearEmits() {
      state.emits = [];
    },
  };
}

/**
 * Playwright fixture extension. Each test gets a fresh server and a routed
 * `/config.json`. The fixture must be set up BEFORE `page.goto(...)` because
 * the frontend's `initConfig()` runs at boot.
 */
export const test = base.extend<{ mockSocket: MockSocket }>({
  mockSocket: async ({ page }, use) => {
    const state = await startServer();
    await routeConfigJson(page, state.url);
    const api = buildPublicApi(state);
    try {
      await use(api);
    } finally {
      await stopServer(state);
    }
  },
});

export { expect };
