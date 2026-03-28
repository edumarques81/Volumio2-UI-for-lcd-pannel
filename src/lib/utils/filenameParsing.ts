/**
 * Parse metadata from raw filenames when proper metadata is absent.
 *
 * Handles common patterns:
 * - macOS resource fork prefix: `._filename.flac`
 * - Track number + Artist + Title: `06 - Skeewiff - Mah Na Mah Na.flac`
 * - Track number + Title: `06 Mah Na Mah Na.flac`
 * - Plain filename with extension: `My Song.flac`
 */

const AUDIO_EXTENSIONS = /\.(flac|dsf|dff|wav|aiff?|mp3|m4a|ogg|opus|wma|ape|wv|alac)$/i;
const MACOS_RESOURCE_PREFIX = /^\._/;

export interface ParsedFilename {
  title: string;
  artist: string | null;
}

/**
 * Extract a clean title and optional artist from a raw filename.
 */
export function parseFilename(raw: string): ParsedFilename {
  if (!raw) return { title: '', artist: null };

  let name = raw;

  // Strip path — only keep the filename
  const slashIdx = name.lastIndexOf('/');
  if (slashIdx >= 0) name = name.substring(slashIdx + 1);

  // Strip macOS resource fork prefix
  name = name.replace(MACOS_RESOURCE_PREFIX, '');

  // Strip audio file extension
  name = name.replace(AUDIO_EXTENSIONS, '');

  // Trim whitespace
  name = name.trim();

  if (!name) return { title: raw, artist: null };

  // Pattern 1: "NN - Artist - Title" (track number + two dashes)
  const threePartMatch = name.match(/^\d{1,3}\s*-\s*(.+?)\s*-\s*(.+)$/);
  if (threePartMatch) {
    return { title: threePartMatch[2].trim(), artist: threePartMatch[1].trim() };
  }

  // Pattern 2: "Artist - Title" (no track number, single dash)
  const twoPartMatch = name.match(/^(.+?)\s*-\s*(.+)$/);
  if (twoPartMatch) {
    // Check if first part looks like a track number only
    if (/^\d{1,3}$/.test(twoPartMatch[1].trim())) {
      // "NN - Title" format
      return { title: twoPartMatch[2].trim(), artist: null };
    }
    return { title: twoPartMatch[2].trim(), artist: twoPartMatch[1].trim() };
  }

  // Pattern 3: "NN Title" (track number prefix, no dash)
  const trackNumMatch = name.match(/^\d{1,3}\s+(.+)$/);
  if (trackNumMatch) {
    return { title: trackNumMatch[1].trim(), artist: null };
  }

  // Fallback: use the cleaned name as title
  return { title: name, artist: null };
}

/**
 * Check if a string looks like a raw filename rather than proper metadata.
 */
export function looksLikeFilename(value: string): boolean {
  if (!value) return false;
  // Has audio extension
  if (AUDIO_EXTENSIONS.test(value)) return true;
  // Has macOS resource fork prefix
  if (MACOS_RESOURCE_PREFIX.test(value)) return true;
  // Contains path separators
  if (value.includes('/')) return true;
  return false;
}
