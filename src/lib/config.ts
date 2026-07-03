/**
 * Stellar Volumio Configuration
 *
 * This file resolves the Stellar backend URL for Socket.IO + asset (albumart)
 * requests. Production and development share the same topology because the
 * Pi-side frontend was retired: the LCD kiosk loads the frontend from the
 * Mac's Vite dev server, just like a regular dev browser session.
 *
 * Topology:
 *   - The page is served from the Mac's Vite dev server (`http://<MAC_IP>:5173`).
 *     The Pi's LCD kiosk launcher (`/usr/local/bin/stellar-kiosk.sh`) is
 *     hard-pointed at `http://192.168.86.221:5173?layout=lcd`.
 *   - All backend (Socket.IO + REST + albumart) requests go to the Pi at
 *     `http://<PI_IP>:3000`. `DEV_VOLUMIO_IP` below is the default Pi IP
 *     used when window.location does not give us one (i.e. localhost / .local
 *     hostnames).
 *
 * Override at runtime via `/config.json` (fetched once at boot — see
 * `initConfig` below). If `/config.json` is absent or malformed we fall back
 * to window.location-based detection.
 */

const DEV_VOLUMIO_IP = '192.168.86.25';

// Stellar backend port (now using Volumio standard port 3000)
const STELLAR_PORT = 3000;

interface RuntimeConfig {
  backendUrl: string;
}

let resolvedHost: string | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Fetch /config.json once at boot. If unavailable or malformed, fall back to
 * window.location-based detection. Idempotent: subsequent calls return the
 * same promise.
 */
export function initConfig(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const res = await fetch('/config.json', { cache: 'no-store' });
      if (!res.ok) {
        console.warn(`[config] /config.json returned ${res.status}; using fallback`);
        return;
      }
      const data = (await res.json()) as Partial<RuntimeConfig>;
      if (typeof data.backendUrl === 'string' && data.backendUrl.startsWith('http')) {
        resolvedHost = data.backendUrl.replace(/\/+$/, '');
      } else if (data.backendUrl !== undefined) {
        // Present but not a usable URL — worth a warning.
        console.warn('[config] /config.json has an invalid backendUrl; using fallback');
      }
      // backendUrl absent is the normal same-origin case (the backend serves
      // this bundle itself), so fall through silently to fallbackHost().
    } catch (err) {
      console.warn('[config] /config.json fetch failed; using fallback', err);
    }
  })();
  return initPromise;
}

/** Test-only: reset module state between tests. */
export function _resetConfigForTest(): void {
  resolvedHost = null;
  initPromise = null;
}

function fallbackHost(): string {
  const { hostname, host, port, protocol } = window.location;
  // Dev: the Vite dev server on :5173 targets the Pi backend on :3000.
  if (port === '5173') return `http://${DEV_VOLUMIO_IP}:3000`;
  // Production (Pi-hosted): the Go backend serves this bundle same-origin on
  // :3000, so Socket.IO + albumart should talk to wherever we were served
  // from — localhost (kiosk), stellar.local, or any IP. `host` includes the
  // port, so this is a true same-origin URL and is DHCP/hostname-proof.
  if (port === String(STELLAR_PORT)) return `${protocol}//${host}`;
  // Other access patterns (bare hostname, proxied): assume the backend is on
  // :3000 of the same host we're viewing.
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `http://localhost:${STELLAR_PORT}`;
  return `${protocol}//${hostname}:${STELLAR_PORT}`;
}

export function getVolumioHost(): string {
  return resolvedHost ?? fallbackHost();
}

export function getVolumioAssetHost(): string {
  return resolvedHost ?? fallbackHost();
}

export function isVolumioOrigin(): boolean {
  const host = getVolumioHost();
  return host === `${window.location.protocol}//${window.location.host}`;
}

/**
 * Fix asset URL (albumart, etc) to point to Stellar backend
 *
 * Album art is now served by the Stellar backend on port 3000,
 * which fetches embedded art from MPD via the /albumart endpoint.
 *
 * This function handles:
 * - Relative URLs: prefixes with current backend host
 * - Absolute URLs to our backend (port 3000): rewrites to current host
 * - External URLs (other ports/hosts): returns as-is
 *
 * Results are cached to avoid repeated URL parsing on every pushState.
 */
const URL_CACHE_MAX = 200;
const urlCache = new Map<string, string | undefined>();

export function fixVolumioAssetUrl(url: string | undefined): string | undefined {
  if (!url) return url;

  const cached = urlCache.get(url);
  if (cached !== undefined) return cached;

  const result = resolveAssetUrl(url);

  // Evict oldest entries when cache is full
  if (urlCache.size >= URL_CACHE_MAX) {
    const firstKey = urlCache.keys().next().value;
    if (firstKey !== undefined) urlCache.delete(firstKey);
  }
  urlCache.set(url, result);

  return result;
}

function resolveAssetUrl(url: string): string | undefined {
  const assetHost = getVolumioAssetHost();

  // If it's an absolute URL, check if it's pointing to our backend
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      // Check if this is a backend URL (port 3000) that needs rewriting
      // This handles cases where the cache stored URLs with an old IP address
      if (urlObj.port === String(STELLAR_PORT) || urlObj.pathname.startsWith('/albumart') || urlObj.pathname.startsWith('/artistart')) {
        // Extract the path and rebuild with current asset host
        return `${assetHost}${urlObj.pathname}${urlObj.search}`;
      }
      // External URL (different service), return as-is
      return url;
    } catch {
      // Invalid URL, return as-is
      return url;
    }
  }

  // Relative URL - prefix with asset host
  return `${assetHost}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Configuration object for easy access
 */
export const config = {
  get volumioHost() {
    return getVolumioHost();
  },

  // LCD display settings
  display: {
    width: 1920,
    height: 440,
  },

  // Development settings
  dev: {
    volumioIp: DEV_VOLUMIO_IP,
  }
};
