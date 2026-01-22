import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock socket service
vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(() => () => {})
  }
}));

// Import store after mock is defined
import {
  audioStatus,
  isDeviceLocked,
  audioFormat,
  isBitPerfect,
  formattedSampleRate,
  formattedBitDepth,
  formatBadge,
  audioActions,
  initAudioStore,
  cleanupAudioStore,
  bitPerfectConfig,
  isBitPerfectConfigOk,
  type AudioStatus,
  type AudioFormat,
  type BitPerfectConfig
} from '../audio';
import { socketService } from '$lib/services/socket';

describe('Audio store', () => {
  const defaultStatus: AudioStatus = {
    locked: false,
    format: null
  };

  const pcmFormat: AudioFormat = {
    sampleRate: 192000,
    bitDepth: 24,
    channels: 2,
    format: 'PCM',
    isBitPerfect: true
  };

  const dsdFormat: AudioFormat = {
    sampleRate: 5644800,
    bitDepth: 1,
    channels: 2,
    format: 'DSD128',
    isBitPerfect: true
  };

  beforeEach(() => {
    // Reset stores and mocks
    audioStatus.set(defaultStatus);
    vi.clearAllMocks();
    cleanupAudioStore();
  });

  afterEach(() => {
    cleanupAudioStore();
  });

  describe('initial state', () => {
    it('should not be locked initially', () => {
      expect(get(audioStatus).locked).toBe(false);
    });

    it('should have null format initially', () => {
      expect(get(audioStatus).format).toBeNull();
    });

    it('should derive isDeviceLocked as false initially', () => {
      expect(get(isDeviceLocked)).toBe(false);
    });

    it('should derive audioFormat as null initially', () => {
      expect(get(audioFormat)).toBeNull();
    });

    it('should derive isBitPerfect as false initially (no format)', () => {
      expect(get(isBitPerfect)).toBe(false);
    });

    it('should derive formattedSampleRate as null initially', () => {
      expect(get(formattedSampleRate)).toBeNull();
    });

    it('should derive formattedBitDepth as null initially', () => {
      expect(get(formattedBitDepth)).toBeNull();
    });

    it('should derive formatBadge as null initially', () => {
      expect(get(formatBadge)).toBeNull();
    });
  });

  describe('isDeviceLocked derived store', () => {
    it('should be true when locked', () => {
      audioStatus.set({ locked: true, format: pcmFormat });
      expect(get(isDeviceLocked)).toBe(true);
    });

    it('should be false when unlocked', () => {
      audioStatus.set({ locked: false, format: pcmFormat });
      expect(get(isDeviceLocked)).toBe(false);
    });
  });

  describe('audioFormat derived store', () => {
    it('should return format when set', () => {
      audioStatus.set({ locked: true, format: pcmFormat });
      expect(get(audioFormat)).toEqual(pcmFormat);
    });

    it('should return null when format is not set', () => {
      audioStatus.set({ locked: true, format: null });
      expect(get(audioFormat)).toBeNull();
    });
  });

  describe('isBitPerfect derived store', () => {
    it('should be true when format isBitPerfect is true', () => {
      audioStatus.set({ locked: true, format: pcmFormat });
      expect(get(isBitPerfect)).toBe(true);
    });

    it('should be false when format isBitPerfect is false', () => {
      audioStatus.set({
        locked: true,
        format: { ...pcmFormat, isBitPerfect: false }
      });
      expect(get(isBitPerfect)).toBe(false);
    });

    it('should be false when format is null', () => {
      audioStatus.set({ locked: true, format: null });
      expect(get(isBitPerfect)).toBe(false);
    });
  });

  describe('formattedSampleRate derived store', () => {
    it('should format 44100 as 44.1kHz', () => {
      audioStatus.set({
        locked: true,
        format: { ...pcmFormat, sampleRate: 44100 }
      });
      expect(get(formattedSampleRate)).toBe('44.1kHz');
    });

    it('should format 48000 as 48kHz', () => {
      audioStatus.set({
        locked: true,
        format: { ...pcmFormat, sampleRate: 48000 }
      });
      expect(get(formattedSampleRate)).toBe('48kHz');
    });

    it('should format 96000 as 96kHz', () => {
      audioStatus.set({
        locked: true,
        format: { ...pcmFormat, sampleRate: 96000 }
      });
      expect(get(formattedSampleRate)).toBe('96kHz');
    });

    it('should format 192000 as 192kHz', () => {
      audioStatus.set({
        locked: true,
        format: { ...pcmFormat, sampleRate: 192000 }
      });
      expect(get(formattedSampleRate)).toBe('192kHz');
    });

    it('should return DSD format string for DSD rates', () => {
      audioStatus.set({ locked: true, format: dsdFormat });
      expect(get(formattedSampleRate)).toBe('DSD128');
    });

    it('should return null when format is null', () => {
      audioStatus.set({ locked: true, format: null });
      expect(get(formattedSampleRate)).toBeNull();
    });
  });

  describe('formattedBitDepth derived store', () => {
    it('should format 16 as 16-bit', () => {
      audioStatus.set({
        locked: true,
        format: { ...pcmFormat, bitDepth: 16 }
      });
      expect(get(formattedBitDepth)).toBe('16-bit');
    });

    it('should format 24 as 24-bit', () => {
      audioStatus.set({
        locked: true,
        format: { ...pcmFormat, bitDepth: 24 }
      });
      expect(get(formattedBitDepth)).toBe('24-bit');
    });

    it('should format 32 as 32-bit', () => {
      audioStatus.set({
        locked: true,
        format: { ...pcmFormat, bitDepth: 32 }
      });
      expect(get(formattedBitDepth)).toBe('32-bit');
    });

    it('should return null when format is null', () => {
      audioStatus.set({ locked: true, format: null });
      expect(get(formattedBitDepth)).toBeNull();
    });
  });

  describe('formatBadge derived store', () => {
    it('should return sample rate and bit depth for PCM', () => {
      audioStatus.set({
        locked: true,
        format: { ...pcmFormat, sampleRate: 192000, bitDepth: 24 }
      });
      expect(get(formatBadge)).toBe('192kHz/24-bit');
    });

    it('should return DSD format for DSD files', () => {
      audioStatus.set({ locked: true, format: dsdFormat });
      expect(get(formatBadge)).toBe('DSD128');
    });

    it('should return null when format is null', () => {
      audioStatus.set({ locked: true, format: null });
      expect(get(formatBadge)).toBeNull();
    });
  });

  describe('audioActions', () => {
    it('should emit getAudioStatus', () => {
      audioActions.getStatus();
      expect(socketService.emit).toHaveBeenCalledWith('getAudioStatus');
    });
  });

  describe('initAudioStore', () => {
    it('should register pushAudioStatus event handler', () => {
      initAudioStore();
      expect(socketService.on).toHaveBeenCalledWith('pushAudioStatus', expect.any(Function));
    });

    it('should not register multiple handlers on repeated init calls', () => {
      initAudioStore();
      initAudioStore();
      initAudioStore();

      // Should only register once due to initialized flag (3 handlers: pushAudioStatus + pushBitPerfect + pushDsdMode)
      expect(socketService.on).toHaveBeenCalledTimes(3);
    });
  });

  describe('pushAudioStatus handler', () => {
    it('should update audioStatus when locked with PCM format', () => {
      initAudioStore();

      // Get the handler that was registered
      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushAudioStatus')?.[1] as ((status: AudioStatus) => void) | undefined;
      expect(handler).toBeDefined();

      const newStatus: AudioStatus = {
        locked: true,
        format: pcmFormat
      };
      handler!(newStatus);

      expect(get(audioStatus)).toEqual(newStatus);
      expect(get(isDeviceLocked)).toBe(true);
      expect(get(formatBadge)).toBe('192kHz/24-bit');
    });

    it('should update audioStatus when locked with DSD format', () => {
      initAudioStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushAudioStatus')?.[1] as ((status: AudioStatus) => void) | undefined;

      const newStatus: AudioStatus = {
        locked: true,
        format: dsdFormat
      };
      handler!(newStatus);

      expect(get(audioStatus)).toEqual(newStatus);
      expect(get(formatBadge)).toBe('DSD128');
    });

    it('should handle unlocked state', () => {
      // Start with locked state
      audioStatus.set({ locked: true, format: pcmFormat });

      initAudioStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushAudioStatus')?.[1] as ((status: AudioStatus) => void) | undefined;

      // Simulate unlocking
      handler!({
        locked: false,
        format: null
      });

      expect(get(isDeviceLocked)).toBe(false);
      expect(get(formatBadge)).toBeNull();
    });
  });

  describe('cleanupAudioStore', () => {
    it('should reset to default state', () => {
      audioStatus.set({ locked: true, format: pcmFormat });

      cleanupAudioStore();

      expect(get(audioStatus)).toEqual(defaultStatus);
    });

    it('should allow re-initialization after cleanup', () => {
      initAudioStore();
      expect(socketService.on).toHaveBeenCalledTimes(3); // pushAudioStatus + pushBitPerfect + pushDsdMode

      cleanupAudioStore();

      vi.clearAllMocks();
      initAudioStore();

      // Should register again after cleanup
      expect(socketService.on).toHaveBeenCalledTimes(3);
    });
  });

  describe('bitPerfectConfig store', () => {
    const okConfig: BitPerfectConfig = {
      status: 'ok',
      issues: [],
      warnings: [],
      config: ['output: hw:SU6,0', 'mixer_type: none']
    };

    const warningConfig: BitPerfectConfig = {
      status: 'warning',
      issues: [],
      warnings: ['Volume normalization detected'],
      config: ['output: hw:SU6,0']
    };

    const errorConfig: BitPerfectConfig = {
      status: 'error',
      issues: ['Resampler enabled'],
      warnings: [],
      config: []
    };

    it('should have null status initially', () => {
      expect(get(bitPerfectConfig)).toBeNull();
    });

    it('should derive isBitPerfectConfigOk as false when null', () => {
      expect(get(isBitPerfectConfigOk)).toBe(false);
    });

    it('should derive isBitPerfectConfigOk as true when status is ok', () => {
      bitPerfectConfig.set(okConfig);
      expect(get(isBitPerfectConfigOk)).toBe(true);
    });

    it('should derive isBitPerfectConfigOk as false when status is warning', () => {
      bitPerfectConfig.set(warningConfig);
      expect(get(isBitPerfectConfigOk)).toBe(false);
    });

    it('should derive isBitPerfectConfigOk as false when status is error', () => {
      bitPerfectConfig.set(errorConfig);
      expect(get(isBitPerfectConfigOk)).toBe(false);
    });
  });

  describe('audioActions.getBitPerfectConfig', () => {
    it('should emit getBitPerfect', () => {
      audioActions.getBitPerfectConfig();
      expect(socketService.emit).toHaveBeenCalledWith('getBitPerfect');
    });
  });

  describe('pushBitPerfect handler', () => {
    it('should register pushBitPerfect event handler on init', () => {
      initAudioStore();
      expect(socketService.on).toHaveBeenCalledWith('pushBitPerfect', expect.any(Function));
    });

    it('should update bitPerfectConfig when receiving pushBitPerfect', () => {
      initAudioStore();

      const onMock = vi.mocked(socketService.on);
      const handler = onMock.mock.calls.find(call => call[0] === 'pushBitPerfect')?.[1] as ((config: BitPerfectConfig) => void) | undefined;
      expect(handler).toBeDefined();

      const config: BitPerfectConfig = {
        status: 'ok',
        issues: [],
        warnings: [],
        config: ['output: hw:SU6,0']
      };
      handler!(config);

      expect(get(bitPerfectConfig)).toEqual(config);
    });
  });
});
