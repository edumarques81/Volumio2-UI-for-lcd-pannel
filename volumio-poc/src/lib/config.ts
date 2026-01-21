/**
 * Volumio POC Configuration
 *
 * This file determines the Volumio backend URL based on the environment.
 *
 * When running on the Raspberry Pi (kiosk mode):
 *   - The page is served from localhost:8080
 *   - Volumio backend is at localhost:3000
 *
 * When running in development (Mac browser):
 *   - The page is served from localhost:5173 (Vite dev server)
 *   - Volumio backend is at the Pi's IP:3000
 *
 * When accessing the Pi's POC remotely (from another device):
 *   - The page is served from PI_IP:8080
 *   - Volumio backend is at PI_IP:3000 (same host, different port)
 */

// Development IP - change this to your Volumio device IP
const DEV_VOLUMIO_IP = '192.168.86.34';

// Stellar backend port (Go backend on port 3002, Volumio on 3000)
const STELLAR_PORT = 3002;

/**
 * Get the Volumio backend URL based on current environment
 */
export function getVolumioHost(): string {
  const hostname = window.location.hostname;
  const isViteDev = window.location.port === '5173';

  // Case 1: Vite dev server on Mac - connect to Pi's IP
  if (isViteDev) {
    console.log('[Config] Dev mode detected, connecting to:', `http://${DEV_VOLUMIO_IP}:${STELLAR_PORT}`);
    return `http://${DEV_VOLUMIO_IP}:${STELLAR_PORT}`;
  }

  // Case 2: Running on localhost (Pi kiosk) - connect to localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('[Config] Localhost detected, connecting to:', `http://localhost:${STELLAR_PORT}`);
    return `http://localhost:${STELLAR_PORT}`;
  }

  // Case 3: Accessing remotely via IP - connect to same host on Stellar port
  console.log('[Config] Remote access detected, connecting to:', `http://${hostname}:${STELLAR_PORT}`);
  return `http://${hostname}:${STELLAR_PORT}`;
}

/**
 * Check if we're running on the same origin as Stellar backend
 * Returns true when we're the main UI (port 3002 or default port)
 */
export function isVolumioOrigin(): boolean {
  const port = window.location.port;
  // On port 3002 (or no port = default), we ARE the main UI
  return port === String(STELLAR_PORT) || port === '';
}

/**
 * Get Volumio host for assets (album art, etc.)
 * Volumio still serves these on port 3000
 */
export function getVolumioAssetHost(): string {
  const hostname = window.location.hostname;
  const isViteDev = window.location.port === '5173';

  if (isViteDev) {
    return `http://${DEV_VOLUMIO_IP}:3000`;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  return `http://${hostname}:3000`;
}

/**
 * Fix asset URL (albumart, etc) to point to Volumio backend
 *
 * Assets like album art are still served by Volumio on port 3000,
 * even though we connect to Stellar on port 3002 for the socket API.
 */
export function fixVolumioAssetUrl(url: string | undefined): string | undefined {
  if (!url) return url;

  // If it's already an absolute URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Always prefix with Volumio asset host (port 3000) for assets
  const assetHost = getVolumioAssetHost();
  return `${assetHost}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Configuration object for easy access
 */
export const config = {
  get volumioHost() {
    return getVolumioHost();
  },

  // POC settings
  display: {
    width: 1920,
    height: 440,
  },

  // Development settings
  dev: {
    volumioIp: DEV_VOLUMIO_IP,
  }
};
