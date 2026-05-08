/**
 * Shared helpers for the FormatStrip / HiResAudioStrip component family.
 *
 * Extracted (logically) from `FormatStrip.svelte` so the new
 * `HiResAudioStrip.svelte` can reuse the same badge-decision and
 * sample-rate-formatting rules without duplicating them. `FormatStrip`
 * itself is intentionally NOT modified on this branch (PlayerView still
 * mounts it; the Library redesign sits on a separate branch and the
 * cross-component refactor is deferred to Wave 2A). When that lands, the
 * inline copies in `FormatStrip.svelte` should be replaced with imports
 * from this module — the logic must stay byte-for-byte equivalent.
 *
 * Tests for this logic live alongside `FormatStrip.test.ts` and
 * `HiResAudioStrip.test.ts` (component-level coverage is sufficient — no
 * separate unit-test file needed for these pure helpers).
 */

/**
 * Render a sample rate (Hz) in human-readable form. DSD-rate territory
 * (≥ 1 MHz) is rendered as MHz with one decimal (a trailing ".0" is
 * dropped — "5.0MHz" → "5MHz"). Sub-MHz values render as kHz with the
 * same trailing-".0" stripping ("96.0kHz" → "96kHz").
 *
 * Mirrors the `formatRate` function inside `FormatStrip.svelte`.
 */
export function formatRate(hz: number): string {
  if (hz >= 1_000_000) {
    return `${(hz / 1_000_000).toFixed(1).replace(/\.0$/, '')}MHz`;
  }
  return `${(hz / 1000).toString().replace(/\.0$/, '')}kHz`;
}

const LOSSLESS_CODECS = new Set(['FLAC', 'ALAC', 'WAV', 'AIFF', 'APE']);

/**
 * Decide which (if any) audiophile-format badge applies to a track:
 *  - `'DSD'` for any DSD/DSF/DFF stream;
 *  - `'MQA'` for explicitly-tagged MQA;
 *  - `'HI-RES'` for lossless codecs that exceed CD quality (24-bit OR
 *    sample rate ≥ 88.2 kHz, the JAS Hi-Res threshold);
 *  - `null` otherwise (CD-quality lossless, lossy, or unknown).
 *
 * Mirrors the `pickBadgeKind` function inside `FormatStrip.svelte`.
 */
export function pickBadgeKind(
  codec: string | null,
  bitDepth: number | null,
  sampleRate: number | null,
): 'HI-RES' | 'DSD' | 'MQA' | null {
  if (codec === 'DSD' || codec === 'DSF' || codec === 'DFF') return 'DSD';
  if (codec === 'MQA') return 'MQA';
  if (codec != null && LOSSLESS_CODECS.has(codec) && (((bitDepth ?? 0) >= 24) || ((sampleRate ?? 0) >= 88200))) {
    return 'HI-RES';
  }
  return null;
}
