import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';

// Phase 4: 17.5% of this library is DSD and another slice sits above the
// 192 kHz ceiling. With a device selected, those albums must say so before
// the tap, not refuse after it.
const mocks = await vi.hoisted(async () => {
  const { writable, derived } = await import('svelte/store');
  const castState = writable({
    active: false, deviceId: '', deviceName: '', status: 'stop' as const,
    title: '', artist: '', album: '', albumart: '', uri: '',
    seek: 0, duration: 0, volume: 0, mute: false, queueIndex: 0, queueLength: 0,
  });
  return {
    castState,
    castActive: derived(castState, ($s) => $s.active),
    libraryAlbumTotalDuration: writable(2048),
  };
});

vi.mock('$lib/stores/cast', () => ({ castState: mocks.castState, castActive: mocks.castActive }));
vi.mock('$lib/stores/library', () => ({ libraryAlbumTotalDuration: mocks.libraryAlbumTotalDuration }));

import AlbumPage from '../AlbumPage.svelte';

const FLAC = {
  id: '1', uri: 'USB/Clockwork', title: '...Like Clockwork', artist: 'Queens of the Stone Age',
  albumArt: '/a', trackCount: 10, source: 'local' as const, trackType: 'flac', sampleRate: 96000,
};
const DSD = { ...FLAC, id: '2', title: 'Time Out', trackType: 'dsf', sampleRate: 2822400 };
const HIGH_RATE = { ...FLAC, id: '3', title: 'Cannonball and Coltrane', sampleRate: 352800 };

function play(album: any) {
  return render(AlbumPage, { props: { album, tracks: [], onPlayAlbum: () => {} } });
}

describe('AlbumPage — cast availability marker', () => {
  beforeEach(() => {
    mocks.castState.update((s) => ({ ...s, active: false, deviceName: '' }));
  });

  it('leaves Play Album alone when the DAC is the output, whatever the format', () => {
    const { container } = play(DSD);
    const button = container.querySelector('[data-testid="play-album-button"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(container.querySelector('[data-testid="play-album-blocked-reason"]')).toBeNull();
  });

  it('disables Play Album for DSD once a device is selected', async () => {
    const { container } = play(DSD);
    mocks.castState.update((s) => ({ ...s, active: true, deviceName: 'Living Room Display' }));
    await tick();

    const button = container.querySelector('[data-testid="play-album-button"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-label')).toContain('no DSD decoder');
    expect(container.querySelector('[data-testid="play-album-blocked-reason"]')!.textContent)
      .toBe('Living Room Display has no DSD decoder, so this album cannot be cast.');
  });

  it('quotes the rate for an album above the ceiling', async () => {
    const { container } = play(HIGH_RATE);
    mocks.castState.update((s) => ({ ...s, active: true, deviceName: 'Living Room Display' }));
    await tick();

    expect((container.querySelector('[data-testid="play-album-button"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-testid="play-album-blocked-reason"]')!.textContent)
      .toBe('352.8 kHz is above the 192 kHz Living Room Display accepts.');
  });

  it('leaves a castable album playable while casting', async () => {
    const { container } = play(FLAC);
    mocks.castState.update((s) => ({ ...s, active: true, deviceName: 'Living Room Display' }));
    await tick();

    expect((container.querySelector('[data-testid="play-album-button"]') as HTMLButtonElement).disabled).toBe(false);
    expect(container.querySelector('[data-testid="play-album-blocked-reason"]')).toBeNull();
  });

  it('clears the marker when the session ends', async () => {
    const { container } = play(DSD);
    mocks.castState.update((s) => ({ ...s, active: true, deviceName: 'Living Room Display' }));
    await tick();
    expect(container.querySelector('[data-testid="play-album-blocked-reason"]')).toBeTruthy();

    mocks.castState.update((s) => ({ ...s, active: false, deviceName: '' }));
    await tick();
    expect(container.querySelector('[data-testid="play-album-blocked-reason"]')).toBeNull();
    expect((container.querySelector('[data-testid="play-album-button"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not block an album the cache has no format for', async () => {
    const { container } = play({ ...FLAC, trackType: undefined, sampleRate: undefined });
    mocks.castState.update((s) => ({ ...s, active: true, deviceName: 'Living Room Display' }));
    await tick();
    expect((container.querySelector('[data-testid="play-album-button"]') as HTMLButtonElement).disabled).toBe(false);
  });
});
