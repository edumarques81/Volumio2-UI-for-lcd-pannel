import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Mock socket service - must be before imports that use it
vi.mock('$lib/services/socket', () => {
  return {
    socketService: {
      emit: vi.fn(),
      on: vi.fn(() => () => {}),
      simulateEvent: vi.fn()
    }
  };
});

import {
  audioDevices,
  audioDevicesLoading,
  selectedAudioOutput,
  audioDevicesByCategory,
  audioDevicesActions
} from '../audioDevices';
import { socketService } from '$lib/services/socket';

// Get mocked functions
const mockEmit = vi.mocked(socketService.emit);
const mockOn = vi.mocked(socketService.on);

describe('audioDevices store', () => {
  beforeEach(() => {
    // Reset stores
    audioDevices.set([]);
    audioDevicesLoading.set(false);
    selectedAudioOutput.set(null);
    mockEmit.mockReset();
    mockOn.mockReset();
  });

  describe('initial state', () => {
    it('should have empty devices array initially', () => {
      expect(get(audioDevices)).toEqual([]);
    });

    it('should not be loading initially', () => {
      expect(get(audioDevicesLoading)).toBe(false);
    });

    it('should have no selected output initially', () => {
      expect(get(selectedAudioOutput)).toBeNull();
    });
  });

  describe('audioDevicesActions.fetchDevices', () => {
    it('should emit getPlaybackOptions event', () => {
      audioDevicesActions.fetchDevices();

      expect(mockEmit).toHaveBeenCalledWith('getPlaybackOptions');
    });

    it('should set loading state while fetching', () => {
      audioDevicesActions.fetchDevices();

      expect(get(audioDevicesLoading)).toBe(true);
    });
  });

  describe('processing pushPlaybackOptions response', () => {
    it('should parse and store audio devices from response', () => {
      const mockResponse = {
        options: [
          {
            id: 'output',
            name: 'Audio Output',
            attributes: [
              {
                name: 'output_device',
                type: 'select',
                value: 'U20SU6',
                options: [
                  { value: 'vc4hdmi0', name: 'HDMI 0 Out' },
                  { value: 'vc4hdmi1', name: 'HDMI 1 Out' },
                  { value: 'U20SU6', name: 'USB Audio 2.0(SU-6)' }
                ]
              }
            ]
          }
        ]
      };

      // Simulate receiving the response
      audioDevicesActions.processPlaybackOptions(mockResponse);

      const devices = get(audioDevices);
      expect(devices).toHaveLength(3);
      expect(devices[0].id).toBe('vc4hdmi0');
      expect(devices[0].name).toBe('HDMI 0 Out');
      expect(devices[2].id).toBe('U20SU6');
      expect(devices[2].name).toBe('USB Audio 2.0(SU-6)');
    });

    it('should identify the selected output', () => {
      const mockResponse = {
        options: [
          {
            id: 'output',
            attributes: [
              {
                name: 'output_device',
                type: 'select',
                value: 'U20SU6',
                options: [
                  { value: 'vc4hdmi0', name: 'HDMI 0 Out' },
                  { value: 'U20SU6', name: 'USB Audio 2.0(SU-6)' }
                ]
              }
            ]
          }
        ]
      };

      audioDevicesActions.processPlaybackOptions(mockResponse);

      expect(get(selectedAudioOutput)).toBe('U20SU6');
    });

    it('should set loading to false after processing', () => {
      audioDevicesLoading.set(true);

      audioDevicesActions.processPlaybackOptions({ options: [] });

      expect(get(audioDevicesLoading)).toBe(false);
    });
  });

  describe('audioDevicesByCategory derived store', () => {
    it('should categorize devices by type', () => {
      audioDevices.set([
        { id: 'vc4hdmi0', name: 'HDMI 0 Out', type: 'hdmi', connected: true },
        { id: 'vc4hdmi1', name: 'HDMI 1 Out', type: 'hdmi', connected: false },
        { id: 'U20SU6', name: 'USB Audio 2.0(SU-6)', type: 'usb', connected: true }
      ]);

      const categorized = get(audioDevicesByCategory);

      expect(categorized.usb).toHaveLength(1);
      expect(categorized.usb[0].id).toBe('U20SU6');
      expect(categorized.hdmi).toHaveLength(2);
    });

    it('should return empty arrays when no devices', () => {
      audioDevices.set([]);

      const categorized = get(audioDevicesByCategory);

      expect(categorized.usb).toEqual([]);
      expect(categorized.hdmi).toEqual([]);
    });
  });

  describe('audioDevicesActions.setOutput', () => {
    it('should emit setPlaybackSettings with the selected device', async () => {
      // Mock emit to call callback immediately
      mockEmit.mockImplementationOnce((event, data, callback) => {
        callback?.({ success: true });
      });

      await audioDevicesActions.setOutput('U20SU6');

      expect(mockEmit).toHaveBeenCalledWith(
        'setPlaybackSettings',
        expect.objectContaining({
          output_device: 'U20SU6'
        }),
        expect.any(Function)
      );
    });

    it('should update selectedAudioOutput on success', async () => {
      // Mock successful response
      mockEmit.mockImplementationOnce((event, data, callback) => {
        callback?.({ success: true });
      });

      await audioDevicesActions.setOutput('U20SU6');

      expect(get(selectedAudioOutput)).toBe('U20SU6');
    });

    it('should not change selection if device is disabled', async () => {
      audioDevices.set([
        { id: 'vc4hdmi0', name: 'HDMI 0 Out', type: 'hdmi', connected: false }
      ]);
      selectedAudioOutput.set('U20SU6');

      await audioDevicesActions.setOutput('vc4hdmi0');

      // Should not have emitted because device is not connected
      expect(mockEmit).not.toHaveBeenCalledWith(
        'setPlaybackSettings',
        expect.anything(),
        expect.any(Function)
      );
      expect(get(selectedAudioOutput)).toBe('U20SU6');
    });
  });

  describe('device type detection', () => {
    it('should detect USB devices from name', () => {
      const mockResponse = {
        options: [
          {
            id: 'output',
            attributes: [
              {
                name: 'output_device',
                type: 'select',
                value: 'U20SU6',
                options: [
                  { value: 'U20SU6', name: 'USB Audio 2.0(SU-6)' }
                ]
              }
            ]
          }
        ]
      };

      audioDevicesActions.processPlaybackOptions(mockResponse);

      const devices = get(audioDevices);
      expect(devices[0].type).toBe('usb');
    });

    it('should detect HDMI devices from name or id', () => {
      const mockResponse = {
        options: [
          {
            id: 'output',
            attributes: [
              {
                name: 'output_device',
                type: 'select',
                value: 'vc4hdmi0',
                options: [
                  { value: 'vc4hdmi0', name: 'HDMI 0 Out' }
                ]
              }
            ]
          }
        ]
      };

      audioDevicesActions.processPlaybackOptions(mockResponse);

      const devices = get(audioDevices);
      expect(devices[0].type).toBe('hdmi');
    });
  });

  describe('device connection status', () => {
    it('should mark devices as connected when present in system', () => {
      const mockResponse = {
        options: [
          {
            id: 'output',
            attributes: [
              {
                name: 'output_device',
                type: 'select',
                value: 'U20SU6',
                options: [
                  { value: 'vc4hdmi0', name: 'HDMI 0 Out' },
                  { value: 'U20SU6', name: 'USB Audio 2.0(SU-6)' }
                ]
              }
            ]
          }
        ],
        systemCards: ['vc4hdmi0', 'vc4hdmi1', 'U20SU6']
      };

      audioDevicesActions.processPlaybackOptions(mockResponse);

      const devices = get(audioDevices);
      expect(devices.find(d => d.id === 'U20SU6')?.connected).toBe(true);
      expect(devices.find(d => d.id === 'vc4hdmi0')?.connected).toBe(true);
    });
  });
});
