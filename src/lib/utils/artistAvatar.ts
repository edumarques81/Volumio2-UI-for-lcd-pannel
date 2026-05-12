/**
 * Returns the first non-whitespace character of `name`, uppercased.
 * Falls back to `'?'` for empty / whitespace-only input.
 *
 * No article-stripping ("The Beatles" → "T", not "B") — locale-sensitive
 * behaviour deferred until UX feedback justifies it.
 */
export function artistInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  return trimmed.charAt(0).toUpperCase();
}

/**
 * Deterministic name-hashed HSL colour for letter-avatar fallbacks.
 * Saturation 45% + lightness 35% — dark enough for white text to pass
 * contrast against, varied enough to feel distinct per artist.
 */
export function artistHashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 45%, 35%)`;
}
