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
    } as Response);
    await initConfig();
    expect(getVolumioHost()).toBe('http://10.0.0.5:3000');
    expect(getVolumioAssetHost()).toBe('http://10.0.0.5:3000');
  });

  it('falls back to window.location logic when /config.json is 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    await initConfig();
    expect(getVolumioHost()).toMatch(/^http:\/\/192\.168\.86\.25:3000$/);
  });

  it('falls back when JSON is malformed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('bad json'); },
    } as Response);
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
    } as Response);
    await initConfig();
    await initConfig();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
