import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectDeviceType } from '../deviceDetection';

describe('detectDeviceType (collapsed 2-type)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { innerWidth: 0, innerHeight: 0 });
  });

  it('returns "lcd-panel" for 1920x440 (Pi LCD)', () => {
    vi.stubGlobal('window', { innerWidth: 1920, innerHeight: 440 });
    expect(detectDeviceType()).toBe('lcd-panel');
  });

  it('returns "lcd-panel" for any aspect >= 2.5 with height <= 600', () => {
    vi.stubGlobal('window', { innerWidth: 1500, innerHeight: 500 });
    expect(detectDeviceType()).toBe('lcd-panel');
  });

  it('returns "desktop" for 1920x1080 (regular monitor)', () => {
    vi.stubGlobal('window', { innerWidth: 1920, innerHeight: 1080 });
    expect(detectDeviceType()).toBe('desktop');
  });

  it('returns "desktop" for phone-sized viewports (no special phone type anymore)', () => {
    vi.stubGlobal('window', { innerWidth: 375, innerHeight: 812 });
    expect(detectDeviceType()).toBe('desktop');
  });

  it('returns "desktop" for tablet-sized viewports (no special tablet type)', () => {
    vi.stubGlobal('window', { innerWidth: 1024, innerHeight: 768 });
    expect(detectDeviceType()).toBe('desktop');
  });
});
