import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import type { AudioDevice } from '$lib/stores/audioDevices';
import type { BitPerfectConfig } from '$lib/stores/audio';

// ---------------------------------------------------------------------------
// Store mocks — defined via vi.hoisted so they are available before imports
// ---------------------------------------------------------------------------

const {
  mockSetOutput,
  mockApplyBitPerfect,
  mockSetDsdMode,
  mockSetMixerMode,
  audioDevicesStore,
  audioDevicesLoadingStore,
  selectedAudioOutputStore,
  bitPerfectConfigStore,
  dsdModeStore,
  dsdModeLoadingStore,
  mixerEnabledStore,
  mixerLoadingStore,
  applyBitPerfectLoadingStore,
  isBitPerfectConfigOkStore,
} = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return {
    mockSetOutput: vi.fn(),
    mockApplyBitPerfect: vi.fn(),
    mockSetDsdMode: vi.fn(),
    mockSetMixerMode: vi.fn(),
    audioDevicesStore: writable<AudioDevice[]>([]),
    audioDevicesLoadingStore: writable<boolean>(false),
    selectedAudioOutputStore: writable<string | null>(null),
    bitPerfectConfigStore: writable<BitPerfectConfig | null>(null),
    dsdModeStore: writable<'native' | 'dop'>('native'),
    dsdModeLoadingStore: writable<boolean>(false),
    mixerEnabledStore: writable<boolean>(false),
    mixerLoadingStore: writable<boolean>(false),
    applyBitPerfectLoadingStore: writable<boolean>(false),
    isBitPerfectConfigOkStore: writable<boolean>(false),
  };
});

vi.mock('$lib/stores/audioDevices', () => ({
  audioDevices: audioDevicesStore,
  audioDevicesLoading: audioDevicesLoadingStore,
  selectedAudioOutput: selectedAudioOutputStore,
  audioDevicesActions: {
    setOutput: mockSetOutput,
  },
}));

vi.mock('$lib/stores/audio', () => ({
  bitPerfectConfig: bitPerfectConfigStore,
  dsdMode: dsdModeStore,
  dsdModeLoading: dsdModeLoadingStore,
  mixerEnabled: mixerEnabledStore,
  mixerLoading: mixerLoadingStore,
  applyBitPerfectLoading: applyBitPerfectLoadingStore,
  isBitPerfectConfigOk: isBitPerfectConfigOkStore,
  audioActions: {
    applyBitPerfect: mockApplyBitPerfect,
    setDsdMode: mockSetDsdMode,
    setMixerMode: mockSetMixerMode,
  },
}));

import AudioSettings from '../AudioSettings.svelte';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDevice(overrides: Partial<AudioDevice> = {}): AudioDevice {
  return {
    id: 'dev-usb',
    name: 'USB DAC',
    type: 'usb',
    connected: true,
    ...overrides,
  };
}

function makeBitPerfectConfig(overrides: Partial<BitPerfectConfig> = {}): BitPerfectConfig {
  return {
    status: 'ok',
    issues: [],
    warnings: [],
    config: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioDevicesStore.set([]);
    audioDevicesLoadingStore.set(false);
    selectedAudioOutputStore.set(null);
    bitPerfectConfigStore.set(null);
    dsdModeStore.set('native');
    dsdModeLoadingStore.set(false);
    mixerEnabledStore.set(false);
    mixerLoadingStore.set(false);
    applyBitPerfectLoadingStore.set(false);
    isBitPerfectConfigOkStore.set(false);
  });

  // Test 1
  it('renders column title "Audio"', () => {
    const { getByRole } = render(AudioSettings);
    expect(getByRole('heading', { name: 'Audio' })).toBeTruthy();
  });

  // Test 2
  it('renders SelectField with options derived from $audioDevices (each device id/name)', () => {
    audioDevicesStore.set([
      makeDevice({ id: 'usb1', name: 'USB DAC 1', connected: true }),
      makeDevice({ id: 'hdmi1', name: 'HDMI Out', connected: true }),
    ]);
    const { container } = render(AudioSettings);
    const select = container.querySelector(
      'select#settings-audio-output-device'
    ) as HTMLSelectElement;
    expect(select).toBeTruthy();
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('usb1');
    expect(options).toContain('hdmi1');
    const labels = Array.from(select.options).map(o => o.label);
    expect(labels).toContain('USB DAC 1');
    expect(labels).toContain('HDMI Out');
  });

  // Test 3
  it('disconnected devices appear with (disconnected) suffix and disabled attribute', () => {
    audioDevicesStore.set([makeDevice({ id: 'usb1', name: 'USB DAC', connected: false })]);
    const { container } = render(AudioSettings);
    const select = container.querySelector(
      'select#settings-audio-output-device'
    ) as HTMLSelectElement;
    expect(select).toBeTruthy();
    const opt = Array.from(select.options).find(o => o.value === 'usb1');
    expect(opt).toBeTruthy();
    expect(opt!.label).toContain('(disconnected)');
    expect(opt!.disabled).toBe(true);
  });

  // Test 4
  it('selecting a device calls audioDevicesActions.setOutput with the deviceId', async () => {
    audioDevicesStore.set([makeDevice({ id: 'usb1', name: 'USB DAC', connected: true })]);
    const { container } = render(AudioSettings);
    const select = container.querySelector(
      'select#settings-audio-output-device'
    ) as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: 'usb1' } });
    expect(mockSetOutput).toHaveBeenCalledWith('usb1');
  });

  // Test 5
  it('shows loading text when $audioDevicesLoading is true', () => {
    audioDevicesLoadingStore.set(true);
    const { getByText } = render(AudioSettings);
    expect(getByText('Loading…')).toBeTruthy();
  });

  // Test 6
  it('hides bit-perfect block ("Apply optimal settings" button absent) when $bitPerfectConfig is null', () => {
    bitPerfectConfigStore.set(null);
    const { queryByText } = render(AudioSettings);
    expect(queryByText('Apply optimal settings')).toBeNull();
  });

  // Test 7a
  it('bit-perfect status badge has status-ok class for "ok" status', () => {
    bitPerfectConfigStore.set(makeBitPerfectConfig({ status: 'ok' }));
    const { container } = render(AudioSettings);
    const badge = container.querySelector('.status-badge') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.classList.contains('status-ok')).toBe(true);
    expect(badge.textContent?.toLowerCase()).toContain('ok');
  });

  // Test 7b
  it('bit-perfect status badge has status-warning class for "warning" status', () => {
    bitPerfectConfigStore.set(makeBitPerfectConfig({ status: 'warning' }));
    const { container } = render(AudioSettings);
    const badge = container.querySelector('.status-badge') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.classList.contains('status-warning')).toBe(true);
  });

  // Test 7c
  it('bit-perfect status badge has status-error class for "error" status', () => {
    bitPerfectConfigStore.set(makeBitPerfectConfig({ status: 'error' }));
    const { container } = render(AudioSettings);
    const badge = container.querySelector('.status-badge') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.classList.contains('status-error')).toBe(true);
  });

  // Test 8
  it('renders one <li> per issue when issues.length > 0', () => {
    bitPerfectConfigStore.set(
      makeBitPerfectConfig({ issues: ['Issue A', 'Issue B', 'Issue C'] })
    );
    const { container } = render(AudioSettings);
    const items = container.querySelectorAll('.issues-list li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('Issue A');
    expect(items[1].textContent).toBe('Issue B');
    expect(items[2].textContent).toBe('Issue C');
  });

  // Test 9
  it('"Apply optimal settings" button click calls audioActions.applyBitPerfect()', async () => {
    bitPerfectConfigStore.set(makeBitPerfectConfig());
    applyBitPerfectLoadingStore.set(false);
    const { getByText } = render(AudioSettings);
    await fireEvent.click(getByText('Apply optimal settings'));
    expect(mockApplyBitPerfect).toHaveBeenCalledTimes(1);
  });

  // Test 10
  it('Apply button is disabled while $applyBitPerfectLoading is true', () => {
    bitPerfectConfigStore.set(makeBitPerfectConfig());
    applyBitPerfectLoadingStore.set(true);
    const { getByText } = render(AudioSettings);
    const btn = getByText('Apply optimal settings') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  // Test 11
  it('RadioGroup renders DSD options "Native" and "DoP" with descriptions', () => {
    const { container, getByText } = render(AudioSettings);
    const radioGroup = container.querySelector('[id="settings-audio-dsd"]');
    expect(radioGroup).toBeTruthy();
    expect(getByText('Native')).toBeTruthy();
    expect(getByText('DoP')).toBeTruthy();
    expect(getByText(/Direct DSD output/)).toBeTruthy();
    expect(getByText(/DSD over PCM/)).toBeTruthy();
  });

  // Test 12
  it('selecting a DSD option calls audioActions.setDsdMode with the value', async () => {
    dsdModeStore.set('native');
    const { container } = render(AudioSettings);
    // The 'dop' radio button is not selected initially (aria-checked=false)
    const radioButtons = container.querySelectorAll('[role="radio"]');
    // Find the dop button (second option)
    const dopButton = Array.from(radioButtons).find(
      btn => btn.getAttribute('aria-checked') === 'false'
    ) as HTMLElement;
    expect(dopButton).toBeTruthy();
    await fireEvent.click(dopButton);
    expect(mockSetDsdMode).toHaveBeenCalledWith('dop');
  });

  // Test 13
  it('shows "Switching…" text when $dsdModeLoading is true', () => {
    dsdModeLoadingStore.set(true);
    const { getByText } = render(AudioSettings);
    expect(getByText('Switching…')).toBeTruthy();
  });

  // Test 14
  it('Toggle reflects $mixerEnabled=true with aria-checked="true"', () => {
    mixerEnabledStore.set(true);
    const { container } = render(AudioSettings);
    const toggleBtn = container.querySelector('#settings-audio-mixer') as HTMLButtonElement;
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn.getAttribute('aria-checked')).toBe('true');
  });

  // Test 15
  it('toggling mixer calls audioActions.setMixerMode with the inverted value', async () => {
    mixerEnabledStore.set(false);
    const { container } = render(AudioSettings);
    const toggleBtn = container.querySelector('#settings-audio-mixer') as HTMLButtonElement;
    await fireEvent.click(toggleBtn);
    expect(mockSetMixerMode).toHaveBeenCalledWith(true);
  });

  // Test 16
  it('Toggle shows is-loading class when $mixerLoading is true', () => {
    mixerLoadingStore.set(true);
    const { container } = render(AudioSettings);
    const toggleBtn = container.querySelector('#settings-audio-mixer') as HTMLButtonElement;
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn.classList.contains('is-loading')).toBe(true);
  });

  // Test 17
  it('SelectField has id="settings-audio-output-device" (form-accessibility check)', () => {
    const { container } = render(AudioSettings);
    expect(container.querySelector('select#settings-audio-output-device')).toBeTruthy();
  });

  // Test 18
  it('RadioGroup container has id="settings-audio-dsd"', () => {
    const { container } = render(AudioSettings);
    expect(container.querySelector('[id="settings-audio-dsd"]')).toBeTruthy();
  });

  // Test 19
  it('Toggle button has id="settings-audio-mixer"', () => {
    const { container } = render(AudioSettings);
    expect(container.querySelector('#settings-audio-mixer')).toBeTruthy();
  });
});
