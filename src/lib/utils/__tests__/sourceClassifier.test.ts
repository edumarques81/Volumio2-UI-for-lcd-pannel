import { describe, it, expect } from 'vitest';
import {
  classifySource,
  getSourceLabel,
  getSourceClass,
  shouldShowSource,
  type SourceType,
} from '../sourceClassifier';

describe('sourceClassifier', () => {
  describe('classifySource', () => {
    describe('NAS sources', () => {
      it('should classify NAS/ prefix as NAS', () => {
        expect(classifySource('NAS/Music/Artist/Album/track.flac')).toBe('NAS');
      });

      it('should classify music-library/NAS/ prefix as NAS', () => {
        expect(classifySource('music-library/NAS/Music/track.flac')).toBe('NAS');
      });

      it('should be case-insensitive for NAS', () => {
        expect(classifySource('nas/Music/track.flac')).toBe('NAS');
        expect(classifySource('Nas/Music/track.flac')).toBe('NAS');
      });
    });

    describe('USB sources', () => {
      it('should classify USB/ prefix as USB', () => {
        expect(classifySource('USB/Music/track.flac')).toBe('USB');
      });

      it('should classify music-library/USB/ prefix as USB', () => {
        expect(classifySource('music-library/USB/Music/track.flac')).toBe('USB');
      });

      it('should be case-insensitive for USB', () => {
        expect(classifySource('usb/Music/track.flac')).toBe('USB');
      });
    });

    describe('LOCAL sources', () => {
      it('should classify INTERNAL/ prefix as LOCAL', () => {
        expect(classifySource('INTERNAL/Music/track.flac')).toBe('LOCAL');
      });

      it('should classify music-library/INTERNAL/ prefix as LOCAL', () => {
        expect(classifySource('music-library/INTERNAL/Music/track.flac')).toBe('LOCAL');
      });

      it('should be case-insensitive for INTERNAL', () => {
        expect(classifySource('internal/Music/track.flac')).toBe('LOCAL');
      });
    });

    describe('Streaming service URIs', () => {
      it('should classify qobuz:// as QOBUZ', () => {
        expect(classifySource('qobuz://album/12345/track/67890')).toBe('QOBUZ');
      });

      it('should classify tidal:// as TIDAL', () => {
        expect(classifySource('tidal://track/12345678')).toBe('TIDAL');
      });

      it('should classify spotify:// as SPOTIFY', () => {
        expect(classifySource('spotify://track/abc123')).toBe('SPOTIFY');
      });

      it('should be case-insensitive for streaming URIs', () => {
        expect(classifySource('QOBUZ://album/123')).toBe('QOBUZ');
        expect(classifySource('Tidal://track/123')).toBe('TIDAL');
      });
    });

    describe('Web Radio sources', () => {
      it('should classify webradio/ prefix as WEBRADIO', () => {
        expect(classifySource('webradio/BBC Radio 3')).toBe('WEBRADIO');
      });

      it('should classify http:// as WEBRADIO', () => {
        expect(classifySource('http://stream.example.com/radio.mp3')).toBe('WEBRADIO');
      });

      it('should classify https:// as WEBRADIO', () => {
        expect(classifySource('https://stream.example.com/radio.mp3')).toBe('WEBRADIO');
      });
    });

    describe('Audirvana sources', () => {
      it('should classify audirvana: prefix as AUDIRVANA', () => {
        expect(classifySource('audirvana:track/12345')).toBe('AUDIRVANA');
      });
    });

    describe('Bluetooth/AirPlay sources', () => {
      it('should classify bluetooth: prefix as BLUETOOTH', () => {
        expect(classifySource('bluetooth:device/stream')).toBe('BLUETOOTH');
      });

      it('should classify airplay: prefix as AIRPLAY', () => {
        expect(classifySource('airplay:stream')).toBe('AIRPLAY');
      });
    });

    describe('Service field fallback', () => {
      it('should use service field when URI is undefined', () => {
        expect(classifySource(undefined, 'qobuz')).toBe('QOBUZ');
        expect(classifySource(undefined, 'tidal')).toBe('TIDAL');
        expect(classifySource(undefined, 'spotify')).toBe('SPOTIFY');
      });

      it('should use service field when URI does not match patterns', () => {
        expect(classifySource('unknown/path/track.flac', 'qobuz')).toBe('QOBUZ');
      });

      it('should handle volspotconnect2 service as SPOTIFY', () => {
        expect(classifySource(undefined, 'volspotconnect2')).toBe('SPOTIFY');
      });

      it('should handle spop service as SPOTIFY', () => {
        expect(classifySource(undefined, 'spop')).toBe('SPOTIFY');
      });

      it('should be case-insensitive for service field', () => {
        expect(classifySource(undefined, 'QOBUZ')).toBe('QOBUZ');
        expect(classifySource(undefined, 'Tidal')).toBe('TIDAL');
      });
    });

    describe('Unknown sources', () => {
      it('should return null for unknown URI patterns', () => {
        expect(classifySource('unknown/path/track.flac')).toBeNull();
      });

      it('should return null for empty URI', () => {
        expect(classifySource('')).toBeNull();
      });

      it('should return null for undefined URI without service', () => {
        expect(classifySource(undefined)).toBeNull();
      });

      it('should return null for mpd service without recognizable URI', () => {
        expect(classifySource('unknown/track.flac', 'mpd')).toBeNull();
      });
    });

    describe('URI takes precedence over service', () => {
      it('should prefer URI classification over service field', () => {
        // URI says NAS, service says qobuz - URI wins
        expect(classifySource('NAS/Music/track.flac', 'qobuz')).toBe('NAS');
      });
    });
  });

  describe('getSourceLabel', () => {
    it('should return the source type string for valid sources', () => {
      expect(getSourceLabel('NAS')).toBe('NAS');
      expect(getSourceLabel('USB')).toBe('USB');
      expect(getSourceLabel('QOBUZ')).toBe('QOBUZ');
    });

    it('should return empty string for null', () => {
      expect(getSourceLabel(null)).toBe('');
    });
  });

  describe('getSourceClass', () => {
    it('should return lowercase CSS class for valid sources', () => {
      expect(getSourceClass('NAS')).toBe('source-nas');
      expect(getSourceClass('USB')).toBe('source-usb');
      expect(getSourceClass('WEBRADIO')).toBe('source-webradio');
    });

    it('should return empty string for null', () => {
      expect(getSourceClass(null)).toBe('');
    });
  });

  describe('shouldShowSource', () => {
    it('should return true for valid sources', () => {
      expect(shouldShowSource('NAS')).toBe(true);
      expect(shouldShowSource('USB')).toBe(true);
      expect(shouldShowSource('QOBUZ')).toBe(true);
    });

    it('should return false for null', () => {
      expect(shouldShowSource(null)).toBe(false);
    });
  });
});
