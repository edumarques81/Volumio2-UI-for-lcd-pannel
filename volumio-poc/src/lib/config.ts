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
const DEV_VOLUMIO_IP = '192.168.86.22';

/**
 * Get the Volumio backend URL based on current environment
 */
export function getVolumioHost(): string {
  const hostname = window.location.hostname;
  const isViteDev = window.location.port === '5173';

  // Case 1: Vite dev server on Mac - connect to Pi's IP
  if (isViteDev) {
    console.log('[Config] Dev mode detected, connecting to:', `http://${DEV_VOLUMIO_IP}:3000`);
    return `http://${DEV_VOLUMIO_IP}:3000`;
  }

  // Case 2: Running on localhost (Pi kiosk) - connect to localhost:3000
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('[Config] Localhost detected, connecting to: http://localhost:3000');
    return 'http://localhost:3000';
  }

  // Case 3: Accessing remotely via IP - connect to same host on port 3000
  console.log('[Config] Remote access detected, connecting to:', `http://${hostname}:3000`);
  return `http://${hostname}:3000`;
}

/**
 * Check if we're running on the same origin as Volumio backend
 * Returns true when we're the main UI (port 3000 or default port)
 */
export function isVolumioOrigin(): boolean {
  const port = window.location.port;
  // On port 3000 (or no port = default), we ARE Volumio's main UI
  return port === '3000' || port === '';
}

/**
 * Fix asset URL (albumart, etc) to point to Volumio backend
 *
 * When running standalone (port 8080), prefixes relative URLs with Volumio host.
 * When running as main UI (port 3000), returns URL unchanged (relative URLs work).
 *
 * This makes the transition seamless when we become the main Volumio frontend.
 */
export function fixVolumioAssetUrl(url: string | undefined): string | undefined {
  if (!url) return url;

  // If it's already an absolute URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If we're on the same origin as Volumio, relative URLs work fine
  if (isVolumioOrigin()) {
    return url;
  }

  // Running standalone - prefix with Volumio host
  const volumioHost = getVolumioHost();
  return `${volumioHost}${url.startsWith('/') ? '' : '/'}${url}`;
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
