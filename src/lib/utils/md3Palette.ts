/**
 * MD3 Dark Scheme Palette Generator
 *
 * Derives a complete Material Design 3 dark colour palette from a single seed hex.
 * Uses HSL tonal stepping — a lightweight approximation of the full HCT algorithm.
 *
 * Tonal scale reference (dark scheme):
 *  Tone 6  → background / surface
 *  Tone 10 → surface-container-low
 *  Tone 12 → surface-container
 *  Tone 17 → surface-container-high
 *  Tone 22 → surface-container-highest
 *  Tone 30 → surface-variant / outline-variant
 *  Tone 60 → outline
 *  Tone 70 → primary
 *  Tone 80 → on-surface-variant
 *  Tone 90 → on-surface / on-background / on-primary-container
 */

import { hexToHsl, hslToHex } from './colorExtractor';

export interface DynamicPalette {
  background:              string;
  onBackground:            string;
  surface:                 string;
  onSurface:               string;
  surfaceVariant:          string;
  onSurfaceVariant:        string;
  surfaceContainerLowest:  string;
  surfaceContainerLow:     string;
  surfaceContainer:        string;
  surfaceContainerHigh:    string;
  surfaceContainerHighest: string;
  primary:                 string;
  onPrimary:               string;
  primaryContainer:        string;
  onPrimaryContainer:      string;
  secondary:               string;
  onSecondary:             string;
  secondaryContainer:      string;
  onSecondaryContainer:    string;
  outline:                 string;
  outlineVariant:          string;
  fontFamily:              string;
  overlayBg:               string;
}

/** Generate a full MD3 dark scheme from a seed hex colour. */
export function generateDarkPalette(seedHex: string): DynamicPalette {
  const { h, s } = hexToHsl(seedHex);

  // Surface saturation — tinted but not garish. Cap at 0.22.
  const ss = Math.min(s * 0.30, 0.22);
  // Primary saturation — vibrant. Keep high.
  const ps = Math.min(Math.max(s * 0.88, 0.55), 0.95);
  // Secondary hue (+30° triadic shift adds interest without clashing)
  const h2 = (h + 30 / 360) % 1;
  const s2 = Math.min(s * 0.50, 0.55);

  const bg  = hslToHex(h, ss, 0.07);  // tone ~6
  const pal: DynamicPalette = {
    // Backgrounds
    background:              bg,
    onBackground:            hslToHex(h, 0.07, 0.92),
    surface:                 bg,
    onSurface:               hslToHex(h, 0.07, 0.92),
    surfaceVariant:          hslToHex(h, ss * 1.3, 0.28),
    onSurfaceVariant:        hslToHex(h, 0.10, 0.80),
    // Surface containers (tone 4 → 22)
    surfaceContainerLowest:  hslToHex(h, ss, 0.05),
    surfaceContainerLow:     hslToHex(h, ss, 0.10),
    surfaceContainer:        hslToHex(h, ss, 0.13),
    surfaceContainerHigh:    hslToHex(h, ss, 0.17),
    surfaceContainerHighest: hslToHex(h, ss, 0.22),
    // Primary
    primary:                 hslToHex(h, ps, 0.72),
    onPrimary:               hslToHex(h, ps * 0.9, 0.12),
    primaryContainer:        hslToHex(h, ps * 0.65, 0.28),
    onPrimaryContainer:      hslToHex(h, 0.12, 0.91),
    // Secondary
    secondary:               hslToHex(h2, s2, 0.68),
    onSecondary:             hslToHex(h2, s2 * 0.8, 0.13),
    secondaryContainer:      hslToHex(h2, s2 * 0.55, 0.26),
    onSecondaryContainer:    hslToHex(h2, 0.10, 0.88),
    // Outline
    outline:                 hslToHex(h, ss * 0.9, 0.55),
    outlineVariant:          hslToHex(h, ss * 1.2, 0.28),
    // Font — dynamic theme uses Plus Jakarta Sans for that expressive feel
    fontFamily:              "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif",
    // Overlay panel bg (matches LCDLayout content-section)
    overlayBg:               hslToHex(h, ss, 0.10),
  };
  return pal;
}
