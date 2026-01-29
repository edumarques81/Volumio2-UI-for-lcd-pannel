/**
 * Source Classifier Utility
 *
 * Maps track URIs to human-readable source labels for display in the mini player.
 * The source indicates where the audio content is coming from (NAS, USB, streaming, etc.)
 */

export type SourceType =
  | 'NAS'
  | 'USB'
  | 'LOCAL'
  | 'QOBUZ'
  | 'TIDAL'
  | 'SPOTIFY'
  | 'WEBRADIO'
  | 'AUDIRVANA'
  | 'BLUETOOTH'
  | 'AIRPLAY'
  | 'STREAMING'
  | null; // null = hide label (unknown source)

/**
 * Source pattern definitions
 * Order matters - first match wins
 */
const SOURCE_PATTERNS: [RegExp, SourceType][] = [
  // Network storage
  [/^(music-library\/)?NAS\//i, 'NAS'],

  // USB storage
  [/^(music-library\/)?USB\//i, 'USB'],

  // Internal/local storage
  [/^(music-library\/)?INTERNAL\//i, 'LOCAL'],

  // Streaming services
  [/^qobuz:\/\//i, 'QOBUZ'],
  [/^tidal:\/\//i, 'TIDAL'],
  [/^spotify:\/\//i, 'SPOTIFY'],

  // Web radio
  [/^webradio\//i, 'WEBRADIO'],
  [/^http(s)?:\/\//i, 'WEBRADIO'], // HTTP streams are typically web radio

  // Audirvana integration
  [/^audirvana:/i, 'AUDIRVANA'],

  // Bluetooth/AirPlay (typically from service field, not URI)
  [/^bluetooth:/i, 'BLUETOOTH'],
  [/^airplay:/i, 'AIRPLAY'],
];

/**
 * Service field to source type mapping
 * Used when URI pattern doesn't match but service field is available
 */
const SERVICE_MAP: Record<string, SourceType> = {
  'mpd': null, // MPD is generic, need to check URI
  'qobuz': 'QOBUZ',
  'tidal': 'TIDAL',
  'spotify': 'SPOTIFY',
  'webradio': 'WEBRADIO',
  'audirvana': 'AUDIRVANA',
  'bluetooth': 'BLUETOOTH',
  'airplay': 'AIRPLAY',
  'volspotconnect2': 'SPOTIFY',
  'spop': 'SPOTIFY',
};

/**
 * Classify the source of a track based on its URI and optional service field
 *
 * @param uri - The track URI (e.g., "NAS/Music/album/track.flac")
 * @param service - Optional service identifier (e.g., "mpd", "qobuz")
 * @returns The source type or null if unknown (hide label)
 */
export function classifySource(uri: string | undefined, service?: string): SourceType {
  // If no URI, try service field
  if (!uri) {
    if (service && SERVICE_MAP[service.toLowerCase()]) {
      return SERVICE_MAP[service.toLowerCase()];
    }
    return null;
  }

  // Check URI patterns first
  for (const [pattern, sourceType] of SOURCE_PATTERNS) {
    if (pattern.test(uri)) {
      return sourceType;
    }
  }

  // Fallback to service field mapping
  if (service && SERVICE_MAP[service.toLowerCase()]) {
    const serviceSource = SERVICE_MAP[service.toLowerCase()];
    // Only use service mapping if it's not null
    if (serviceSource !== null) {
      return serviceSource;
    }
  }

  // Unknown source - return null to hide label
  return null;
}

/**
 * Get display label for a source type
 * Returns empty string for null (hide label case)
 */
export function getSourceLabel(sourceType: SourceType): string {
  return sourceType ?? '';
}

/**
 * Get CSS class for source type styling
 */
export function getSourceClass(sourceType: SourceType): string {
  if (!sourceType) return '';
  return `source-${sourceType.toLowerCase()}`;
}

/**
 * Check if source should be displayed
 */
export function shouldShowSource(sourceType: SourceType): boolean {
  return sourceType !== null;
}
