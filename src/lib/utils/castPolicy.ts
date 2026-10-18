/**
 * Album-level mirror of the backend's cast format policy
 * (`internal/domain/cast/policy.go`).
 *
 * The backend is the authority: it classifies every track by its own URI and
 * refuses the ones a Cast device cannot take, with a reason. This exists only
 * so the library can say so BEFORE the user taps Play Album — 17.5% of this
 * library is DSD and another 3% sits above the rate ceiling, which is far too
 * much to discover one refusal at a time.
 *
 * It deliberately errs towards "castable": the library cache records format
 * per album, so a release the cache has not measured yet has no trackType or
 * sampleRate at all. Hiding it on a guess would be worse than letting the
 * backend answer with the truth.
 */

/**
 * The highest PCM sample rate a Cast device accepts. Measured on a Nest Hub
 * (firmware 3.80.546557), not quoted: 192 kHz/24-bit FLAC and WAV play, 352.8
 * kHz fails. Keep in step with `cast.MaxCastSampleRate`.
 */
export const CAST_MAX_SAMPLE_RATE = 192_000;

/** The album fields the policy reads. */
export interface CastCandidateAlbum {
  trackType?: string;
  sampleRate?: number;
}

const DSD_TYPES = new Set(['dsf', 'dff', 'dsd']);

/**
 * Returns why this album cannot be cast, or null when it can be. The strings
 * match the backend's own reasons so the pre-tap marker and the post-tap toast
 * never contradict each other.
 */
export function castBlockReason(album: CastCandidateAlbum | null | undefined): string | null {
  if (!album) return null;

  const ext = (album.trackType ?? '').toLowerCase().replace(/^\./, '');
  if (DSD_TYPES.has(ext)) {
    return 'DSD cannot be played by a Cast device';
  }

  const rate = album.sampleRate ?? 0;
  if (rate > CAST_MAX_SAMPLE_RATE) {
    return 'above the 192 kHz a Cast device accepts';
  }

  return null;
}

/**
 * The same verdict, phrased for a person looking at one album with a known
 * device selected. `castBlockReason` is the backend-parity string used where
 * the device is not in frame (toasts quoting the backend); this is what goes
 * on the album page.
 */
export function castBlockMessage(
  album: CastCandidateAlbum | null | undefined,
  deviceName: string,
): string | null {
  const reason = castBlockReason(album);
  if (!reason) return null;

  const where = deviceName || 'this Cast device';
  const ext = (album?.trackType ?? '').toLowerCase().replace(/^\./, '');
  if (DSD_TYPES.has(ext)) {
    return `${where} has no DSD decoder, so this album cannot be cast.`;
  }
  return `${formatRate(album?.sampleRate ?? 0)} is above the 192 kHz ${where} accepts.`;
}

/** 352800 -> "352.8 kHz". Trailing ".0" is dropped. */
function formatRate(hz: number): string {
  return `${(hz / 1000).toFixed(1).replace(/\.0$/, '')} kHz`;
}
