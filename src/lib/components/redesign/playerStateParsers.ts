/**
 * Pure parsers that translate the loose, string-shaped fields on Volumio's
 * `playerState` payload (samplerate: "96 kHz", bitdepth: "24 bit",
 * trackType: "flac") into typed values the redesign components consume.
 *
 * Extracted from PlayerView.svelte (parseSampleRate, parseBitDepth,
 * normalizeCodec) and FormatStrip.svelte (dsdRate) so each branch can be
 * unit-tested without mounting a Svelte component.
 */

/**
 * Parse a bit-depth string like `"24"`, `"24 bit"`, or `"16-bit"` into the
 * leading integer. Returns `null` for nullish/empty/unparsable input.
 */
export function parseBitDepth(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Parse a sample-rate string into Hz. Handles units (`"96 kHz"`,
 * `"2.8 MHz"`, `"44.1 khz"`) and bare numbers — bare values < 1000 are
 * heuristically treated as kHz, larger as Hz. Returns `null` for
 * nullish/empty/unparsable input.
 */
export function parseSampleRate(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  // Match "96 kHz", "96000", "2.8 mhz", "44.1 khz"
  const num = s.match(/([\d.]+)/);
  if (!num) return null;
  const value = parseFloat(num[1]);
  if (!Number.isFinite(value)) return null;
  if (s.includes('mhz')) return Math.round(value * 1_000_000);
  if (s.includes('khz')) return Math.round(value * 1_000);
  // Bare number — assume kHz when small, Hz when large
  if (value < 1000) return Math.round(value * 1_000);
  return Math.round(value);
}

/**
 * Normalize a codec/track-type string. DSD variants collapse to `"DSD"`,
 * MQA to `"MQA"`, everything else returns the raw value uppercased.
 * Returns `null` for nullish/empty input.
 */
export function normalizeCodec(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s === 'dsd' || s.startsWith('dsd')) return 'DSD';
  if (s === 'mqa') return 'MQA';
  return s.toUpperCase();
}

/**
 * Convert a DSD sample rate (Hz) into a `DSD<n>` label where `<n>` is the
 * standard DSD multiplier (DSD64 = 2.8224 MHz, DSD128 = 5.6448 MHz, ...).
 * The ratio is computed against the 44.1 kHz base.
 */
export function dsdRate(hz: number): string {
  // 2822400 → DSD64, 5644800 → DSD128, etc.
  const ratio = Math.round(hz / 44100);
  return `DSD${ratio}`;
}
