import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

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
  'frame-ancestors': ["'none'"],
};

/** Build a CSP string from directives, optionally adding dev-mode permissions */
function buildCspString(isDev: boolean): string {
  const directives = { ...cspDirectives };
  if (isDev) {
    // Vite HMR uses new Function() and inline scripts for hot module replacement
    directives['script-src'] = [...directives['script-src'], "'unsafe-eval'", "'unsafe-inline'"];
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

export default defineConfig({
  plugins: [svelte(), cspMetaTagPlugin()],
  resolve: {
    alias: {
      '$lib': path.resolve('./src/lib'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    headers: {
      // Dev-mode CSP with unsafe-eval for Vite HMR
      'Content-Security-Policy': buildCspString(true),
    },
  },
});
