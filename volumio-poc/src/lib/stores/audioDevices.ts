import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';

export interface AudioDevice {
  id: string;
  name: string;
  type: 'usb' | 'hdmi' | 'i2s' | 'other';
  connected: boolean;
}

export interface AudioDevicesByCategory {
  usb: AudioDevice[];
  hdmi: AudioDevice[];
  i2s: AudioDevice[];
  other: AudioDevice[];
}

interface PlaybackOption {
  value: string;
  name: string;
}

interface PlaybackAttribute {
  name: string;
  type: string;
  value: string;
  options?: PlaybackOption[];
}

interface PlaybackOptionsSection {
  id: string;
  name?: string;
  attributes: PlaybackAttribute[];
}

interface PlaybackOptionsResponse {
  options?: PlaybackOptionsSection[];
  systemCards?: string[];
}

// Stores
export const audioDevices = writable<AudioDevice[]>([]);
export const audioDevicesLoading = writable<boolean>(false);
export const selectedAudioOutput = writable<string | null>(null);

// Derived store for categorized devices
export const audioDevicesByCategory = derived(audioDevices, ($devices): AudioDevicesByCategory => {
  return {
    usb: $devices.filter(d => d.type === 'usb'),
    hdmi: $devices.filter(d => d.type === 'hdmi'),
    i2s: $devices.filter(d => d.type === 'i2s'),
    other: $devices.filter(d => d.type === 'other')
  };
});

/**
 * Detect device type from its name or ID
 */
function detectDeviceType(id: string, name: string): AudioDevice['type'] {
  const idLower = id.toLowerCase();
  const nameLower = name.toLowerCase();

  if (nameLower.includes('usb') || idLower.includes('usb') || idLower.startsWith('u20')) {
    return 'usb';
  }
  if (nameLower.includes('hdmi') || idLower.includes('hdmi') || idLower.includes('vc4hdmi')) {
    return 'hdmi';
  }
  if (nameLower.includes('i2s') || idLower.includes('i2s') || nameLower.includes('dac')) {
    return 'i2s';
  }
  return 'other';
}

/**
 * Process playback options response from Volumio
 */
function processPlaybackOptions(response: PlaybackOptionsResponse): void {
  audioDevicesLoading.set(false);

  if (!response?.options) {
    console.warn('[AudioDevices] No options in response');
    return;
  }

  // Find the output section
  const outputSection = response.options.find(
    section => section.id === 'output' || section.attributes?.some(attr => attr.name === 'output_device')
  );

  if (!outputSection) {
    console.warn('[AudioDevices] No output section found');
    return;
  }

  // Find the output_device attribute
  const outputAttr = outputSection.attributes?.find(attr => attr.name === 'output_device');

  if (!outputAttr?.options) {
    console.warn('[AudioDevices] No output options found');
    return;
  }

  // Get system cards if available (to determine connected status)
  const systemCards = response.systemCards || [];

  // Parse devices
  const devices: AudioDevice[] = outputAttr.options.map(opt => {
    const type = detectDeviceType(opt.value, opt.name);
    // If systemCards is provided, use it to determine connection status
    // Otherwise, assume all devices are connected if they appear in the list
    const connected = systemCards.length > 0
      ? systemCards.includes(opt.value)
      : true;

    return {
      id: opt.value,
      name: opt.name,
      type,
      connected
    };
  });

  audioDevices.set(devices);

  // Set selected output
  if (outputAttr.value) {
    selectedAudioOutput.set(outputAttr.value);
  }

  console.log('[AudioDevices] Processed devices:', devices);
  console.log('[AudioDevices] Selected output:', outputAttr.value);
}

// Actions
export const audioDevicesActions = {
  /**
   * Fetch available audio devices from Volumio
   */
  fetchDevices(): void {
    audioDevicesLoading.set(true);
    socketService.emit('getPlaybackOptions');
  },

  /**
   * Process the playback options response
   */
  processPlaybackOptions,

  /**
   * Set the audio output device
   */
  async setOutput(deviceId: string): Promise<boolean> {
    const devices = get(audioDevices);
    const device = devices.find(d => d.id === deviceId);

    // Don't allow selecting disconnected devices
    if (device && !device.connected) {
      console.warn('[AudioDevices] Cannot select disconnected device:', deviceId);
      return false;
    }

    return new Promise((resolve) => {
      socketService.emit('setPlaybackSettings', { output_device: deviceId }, (response: any) => {
        if (response?.success !== false) {
          selectedAudioOutput.set(deviceId);
          console.log('[AudioDevices] Output changed to:', deviceId);
          resolve(true);
        } else {
          console.error('[AudioDevices] Failed to change output:', response);
          resolve(false);
        }
      });
    });
  },

  /**
   * Initialize the store - register socket listeners
   */
  init(): () => void {
    const unsubscribe = socketService.on<PlaybackOptionsResponse>('pushPlaybackOptions', (data) => {
      processPlaybackOptions(data);
    });

    // Fetch initial data
    audioDevicesActions.fetchDevices();

    return unsubscribe;
  }
};
