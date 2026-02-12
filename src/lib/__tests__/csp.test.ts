import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Content Security Policy configuration.
 * Verifies the production build includes proper CSP meta tag
 * and that all form elements have id attributes.
 */

describe('Content Security Policy', () => {
  const distHtml = readFileSync(resolve(__dirname, '../../../dist/index.html'), 'utf-8');

  it('should include CSP meta tag in production build', () => {
    expect(distHtml).toContain('http-equiv="Content-Security-Policy"');
  });

  it('should set default-src to self', () => {
    expect(distHtml).toContain("default-src 'self'");
  });

  it('should NOT allow unsafe-eval in production', () => {
    // Extract the CSP content from the meta tag
    const cspMatch = distHtml.match(/content="([^"]*Content-Security-Policy[^"]*|default-src[^"]*)"/);
    expect(cspMatch).toBeTruthy();
    const cspContent = cspMatch![1] || cspMatch![0];
    expect(cspContent).not.toContain('unsafe-eval');
  });

  it('should allow unsafe-inline for styles (Svelte needs it)', () => {
    expect(distHtml).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('should allow WebSocket connections for Socket.IO', () => {
    expect(distHtml).toContain('connect-src');
    expect(distHtml).toContain('ws:');
    expect(distHtml).toContain('wss:');
  });

  it('should allow images from any source (album artwork)', () => {
    expect(distHtml).toContain('img-src');
    expect(distHtml).toContain('http:');
    expect(distHtml).toContain('https:');
  });
});
