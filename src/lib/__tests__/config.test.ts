import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initConfig, getVolumioHost, getVolumioAssetHost, _resetConfigForTest } from '../config';

describe('initConfig', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    _resetConfigForTest();
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', port: '5173', protocol: 'http:' },
      writable: true,
    });
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses /config.json backendUrl when present', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ backendUrl: 'http://10.0.0.5:3000' }),
    } as unknown as Response);
    await initConfig();
    expect(getVolumioHost()).toBe('http://10.0.0.5:3000');
    expect(getVolumioAssetHost()).toBe('http://10.0.0.5:3000');
  });

  it('falls back to window.location logic when /config.json is 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    await initConfig();
    expect(getVolumioHost()).toMatch(/^http:\/\/192\.168\.86\.25:3000$/);
  });

  it('falls back when JSON is malformed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('bad json'); },
    } as unknown as Response);
    await initConfig();
    expect(getVolumioHost()).toMatch(/^http:\/\/192\.168\.86\.25:3000$/);
  });

  it('falls back when fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'));
    await initConfig();
    expect(getVolumioHost()).toMatch(/^http:\/\/192\.168\.86\.25:3000$/);
  });

  it('is idempotent (second call is a no-op)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ backendUrl: 'http://10.0.0.5:3000' }),
    } as unknown as Response);
    await initConfig();
    await initConfig();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('same-origin resolution (Pi-hosted backend serves the bundle)', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function initWith(location: Partial<Location>, configJson?: unknown) {
    _resetConfigForTest();
    Object.defineProperty(window, 'location', { value: location, writable: true });
    globalThis.fetch = vi.fn().mockResolvedValue(
      configJson === undefined
        ? ({ ok: false, status: 404 } as unknown as Response)
        : ({ ok: true, json: async () => configJson } as unknown as Response),
    );
    await initConfig();
  }

  it('kiosk on localhost:3000 resolves to the same origin', async () => {
    await initWith({ hostname: 'localhost', host: 'localhost:3000', port: '3000', protocol: 'http:' });
    expect(getVolumioHost()).toBe('http://localhost:3000');
    expect(getVolumioAssetHost()).toBe('http://localhost:3000');
  });

  it('access via stellar.local:3000 resolves to the same origin (no hardcoded IP)', async () => {
    await initWith({ hostname: 'stellar.local', host: 'stellar.local:3000', port: '3000', protocol: 'http:' });
    expect(getVolumioHost()).toBe('http://stellar.local:3000');
  });

  it('access via a raw IP:3000 resolves to that same origin', async () => {
    await initWith({ hostname: '192.168.86.25', host: '192.168.86.25:3000', port: '3000', protocol: 'http:' });
    expect(getVolumioHost()).toBe('http://192.168.86.25:3000');
  });

  it('an empty config.json (no backendUrl) uses same-origin detection', async () => {
    await initWith(
      { hostname: 'stellar.local', host: 'stellar.local:3000', port: '3000', protocol: 'http:' },
      { _comment: 'no backendUrl' },
    );
    expect(getVolumioHost()).toBe('http://stellar.local:3000');
  });
});
