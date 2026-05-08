import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

// Mock the three section views to keep this test focused on SettingsView's
// own composition (3-column layout, separators, init wiring) rather than
// the section views' internals.
vi.mock('../settings/LibrarySettings.svelte', async () => {
  const stub = await import('./stubs/StubColumn.svelte');
  return { default: stub.default };
});
vi.mock('../settings/AudioSettings.svelte', async () => {
  const stub = await import('./stubs/StubColumn.svelte');
  return { default: stub.default };
});
vi.mock('../settings/SystemSettings.svelte', async () => {
  const stub = await import('./stubs/StubColumn.svelte');
  return { default: stub.default };
});

// Mock store init functions so we can assert SettingsView calls them onMount
// without spinning up real Socket.IO listeners.
const { initSourcesStore, initVersionStore, audioDevicesInit } = vi.hoisted(() => ({
  initSourcesStore: vi.fn(),
  initVersionStore: vi.fn(),
  audioDevicesInit: vi.fn(() => () => {}),
}));

vi.mock('$lib/stores/sources', () => ({ initSourcesStore }));
vi.mock('$lib/stores/version', () => ({ initVersionStore }));
vi.mock('$lib/stores/audioDevices', () => ({
  audioDevicesActions: { init: audioDevicesInit },
}));

import SettingsView from '../SettingsView.svelte';

describe('SettingsView', () => {
  beforeEach(() => {
    cleanup();
    initSourcesStore.mockClear();
    initVersionStore.mockClear();
    audioDevicesInit.mockClear();
  });

  it('renders the settings-view container with aria-label', () => {
    const { getByTestId } = render(SettingsView);
    const root = getByTestId('settings-view');
    expect(root).toBeTruthy();
    expect(root.getAttribute('aria-label')).toBe('Settings');
  });

  it('renders three columns (Library, Audio, System) side by side', () => {
    const { getByTestId } = render(SettingsView);
    expect(getByTestId('settings-column-library')).toBeTruthy();
    expect(getByTestId('settings-column-audio')).toBeTruthy();
    expect(getByTestId('settings-column-system')).toBeTruthy();
  });

  it('initializes sources, version, and audioDevices stores onMount', () => {
    render(SettingsView);
    expect(initSourcesStore).toHaveBeenCalledTimes(1);
    expect(initVersionStore).toHaveBeenCalledTimes(1);
    expect(audioDevicesInit).toHaveBeenCalledTimes(1);
  });

  it('renders 2 vertical gradient separators between the 3 columns', () => {
    const { container } = render(SettingsView);
    const separators = container.querySelectorAll('.separator');
    expect(separators.length).toBe(2);
    for (const sep of separators) {
      expect(sep.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('renders 5 direct children (3 columns + 2 separators) in column-sep-column-sep-column order', () => {
    const { getByTestId } = render(SettingsView);
    const root = getByTestId('settings-view') as HTMLElement;
    expect(root.classList.contains('settings-view')).toBe(true);
    expect(root.children.length).toBe(5);
    // Order: column / separator / column / separator / column
    expect(root.children[0].getAttribute('data-testid')).toBe('settings-column-library');
    expect(root.children[1].classList.contains('separator')).toBe(true);
    expect(root.children[2].getAttribute('data-testid')).toBe('settings-column-audio');
    expect(root.children[3].classList.contains('separator')).toBe(true);
    expect(root.children[4].getAttribute('data-testid')).toBe('settings-column-system');
  });
});
