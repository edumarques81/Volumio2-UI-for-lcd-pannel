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
 * Parse a bit-depth string like `"24"`, `"24 bit"`, or `"16-bit"` into an
 * integer. Returns `null` for nullish/empty/unparsable input, and for input
 * that carries no bit-depth information at all.
 *
 * Two input shapes reach this parser, and they must not be conflated:
 *   - `playerState.bitdepth` — a dedicated field ("24 bit", "16").
 *   - `album.quality` — the backend's COMPOSITE label ("44.1kHz/16bit FLAC"),
 *     passed in whole by AlbumPage.
 *
 * Matching the first run of digits reads the sample rate out of the second
 * shape (44), so the strip printed "44-bit" and `pickBadgeKind` saw
 * 44 >= 24 and badged CD-quality audio as HI-RES. Requiring an explicit
 * `bit`/`bits` token — or an otherwise bare number — keeps the two apart.
 * A DSD label ("DSD64") deliberately yields `null`: 1-bit DSD has no PCM
 * bit depth to report, and 64 is a rate multiplier.
 */
export function parseBitDepth(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Explicit "<n>bit" / "<n> bit" / "<n>-bits" token anywhere in the string.
  const explicit = s.match(/(\d+)\s*-?\s*bits?\b/i);
  if (explicit) return Number(explicit[1]);

  // Otherwise accept only a standalone number, never one embedded in a
  // composite label.
  const bare = s.match(/^(\d+)$/);
  return bare ? Number(bare[1]) : null;
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

  // A DSD quality label is a MULTIPLIER against the 44.1 kHz base, not a
  // rate: "DSD64" means 64 x 44100 = 2.8224 MHz. Falling through to the
  // generic numeric branch below read it as a bare 64 -> 64 kHz, which
  // dsdRate() then rendered back as "DSD1" on the badge.
  const dsdMultiplier = s.match(/dsd\s*(\d+)/);
  if (dsdMultiplier) return Math.round(Number(dsdMultiplier[1]) * 44_100);
  // Bare "DSD" (MPD reports no Format for some DSD files) carries no rate.
  // Both strips guard on `sampleRate != null`, so the badge is suppressed
  // rather than rendered as "DSD0".
  if (/dsd/.test(s)) return null;

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
