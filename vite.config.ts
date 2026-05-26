import { defineConfig, loadEnv, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import pkg from './package.json' with { type: 'json' };

/**
 * Content Security Policy directives for the application.
 * - script-src: Only allow scripts from same origin (no eval/inline in prod)
 * - style-src: Allow inline styles (Svelte component styles)
 * - img-src: Allow images from any source (album artwork, external services)
 * - connect-src: Allow WebSocket and HTTP connections (Socket.IO backend)
 * - font-src: Only local fonts
 * - media-src: Allow media from any source (audio streams)
 */
const cspDirectives: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'http:', 'https:'],
  'connect-src': ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
  'font-src': ["'self'"],
  'media-src': ["'self'", 'http:', 'https:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/** Directives only valid via HTTP headers, not <meta> tags (per CSP spec) */
const headerOnlyDirectives: Record<string, string[]> = {
  'frame-ancestors': ["'none'"],
};

/** Build a CSP string from directives, optionally adding dev-mode permissions */
function buildCspString(isDev: boolean): string {
  const directives = { ...cspDirectives };
  if (isDev) {
    // Vite HMR uses new Function() and inline scripts for hot module replacement
    directives['script-src'] = [...directives['script-src'], "'unsafe-eval'", "'unsafe-inline'"];
    // Header-only directives (e.g. frame-ancestors) are valid in HTTP headers but
    // ignored in <meta> tags per CSP spec, so only include them for dev server headers
    Object.assign(directives, headerOnlyDirectives);
  }
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Vite plugin that injects a CSP meta tag into the production HTML build.
 * In dev mode, CSP is handled via server.headers instead.
 */
function cspMetaTagPlugin(): Plugin {
  return {
    name: 'csp-meta-tag',
    apply: 'build',
    transformIndexHtml(html) {
      const csp = buildCspString(false);
      return html.replace(
        '<meta charset="UTF-8">',
        `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  // Proxy `/artistart` and `/albumart` to the stellar backend. Without
  // this, relative URLs like ArtistTile's `/artistart?name=...` resolve
  // to Vite's SPA fallback (200 HTML) and the browser errors out on the
  // <img>.
  //
  // Resolution order:
  //   1. STELLAR_BACKEND_HOST  — explicit override (set in .env when the
  //                              backend runs on a different machine than
  //                              this dev server).
  //   2. localhost             — default; matches the post-M1.C topology
  //                              where stellar-backend runs on the same
  //                              Mac that serves this dev server.
  // Pre-M1.C the proxy fell back to RASPBERRY_PI_API_ADDRESS — that var is
  // now stale (Pi backend is permanently disabled) so we ignore it here
  // and the user must opt in via STELLAR_BACKEND_HOST if they actually
  // want to hit a remote backend.
  const env = loadEnv(mode, process.cwd(), '');
  const backendHost = env.STELLAR_BACKEND_HOST || 'localhost';
  const backendURL = `http://${backendHost}:3000`;

  return {
    plugins: [svelte(), cspMetaTagPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    resolve: {
      alias: {
        '$lib': path.resolve('./src/lib'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      // Allow LAN clients to load the dev server via the Mac's mDNS hostname
      // (e.g. `Eduardos-Laptop.local`). Without this, Vite 5+ returns 403 for
      // any Host: header that isn't localhost / 127.0.0.1 / the bound IP.
      // The Pi kiosk loads the LCD via this hostname so DHCP-shifted Mac IPs
      // don't break the URL — see stellar-kiosk.sh and the project CLAUDE.md.
      // `true` accepts ALL Host: headers: this is a dev-only server bound to
      // the LAN, never exposed to the public internet, so the host-header
      // security check is not load-bearing here.
      allowedHosts: true,
      proxy: {
        '/artistart': { target: backendURL, changeOrigin: true },
        '/albumart':  { target: backendURL, changeOrigin: true },
      },
      headers: {
        // Dev-mode CSP with unsafe-eval for Vite HMR
        'Content-Security-Policy': buildCspString(true),
      },
    },
  };
});
