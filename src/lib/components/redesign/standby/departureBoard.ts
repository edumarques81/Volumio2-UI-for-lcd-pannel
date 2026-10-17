import type { LastPlayedAlbum } from '$lib/stores/player';

/**
 * Pure helpers for the Departure Board standby face. Kept out of the component
 * so the rail's text rules can be tested without mounting anything — the same
 * split as playerStateParsers.ts / formatStripHelpers.ts.
 */

/** Cells in the bottom rail. Fixed: the flaps are laid out, not reflowed. */
export const RAIL_CELLS = 24;

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
] as const;

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

/**
 * Fit one message to the rail: upper-case, whitespace collapsed, then hard
 * truncated and padded to exactly RAIL_CELLS. A split-flap board has a fixed
 * number of physical cells, so every message is the same length by
 * construction — padding is the mechanism, not a cosmetic choice.
 */
export function railLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim().toUpperCase();
  return flat.slice(0, RAIL_CELLS).padEnd(RAIL_CELLS, ' ');
}

/** "FLAC 24/192" from the loose strings the backend sends, or '' if unusable. */
export function qualityLabel(album: LastPlayedAlbum | null): string {
  if (!album) return '';
  const kind = (album.trackType ?? '').trim().toUpperCase();
  const bits = String(album.bitDepth ?? '').match(/\d+/)?.[0] ?? '';
  const rate = String(album.sampleRate ?? '').match(/\d+(\.\d+)?/)?.[0] ?? '';
  const spec = bits && rate ? `${bits}/${rate}` : bits || rate;
  return [kind, spec].filter(Boolean).join(' ');
}

/**
 * What the rail cycles through. Always at least the wake prompt — a standby
 * screen that says nothing about how to leave it is a dead end for anyone who
 * did not set it up.
 */
export function railMessages(album: LastPlayedAlbum | null): string[] {
  const out: string[] = [];
  if (album?.album) out.push(`LAST PLAYED ${album.album}`);
  out.push('TOUCH ANYWHERE TO WAKE');
  if (album?.artist) {
    const quality = qualityLabel(album);
    out.push(quality ? `${album.artist} ${quality}` : album.artist);
  }
  return out.map(railLine);
}

/** "SAT 18 OCT" — the meta line next to the wordmark. */
export function formatLongDate(date: Date): string {
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export interface ClockParts {
  hh: string;
  mm: string;
  ss: string;
}

/** Zero-padded clock parts. `hour12` folds 0 → 12 rather than showing 00. */
export function clockParts(date: Date, hour12 = false): ClockParts {
  const raw = date.getHours();
  const hours = hour12 ? raw % 12 || 12 : raw;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { hh: pad(hours), mm: pad(date.getMinutes()), ss: pad(date.getSeconds()) };
}
