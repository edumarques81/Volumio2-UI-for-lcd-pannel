import { writable } from 'svelte/store';
import type { DynamicPalette } from '$lib/utils/md3Palette';

export type StellarTheme = 'rose' | 'darkForest' | 'sageGreen' | 'violetExpressive' | 'amethyst' | 'lavender' | 'lime' | 'dynamic';

/**
 * Full MD3 dark-scheme color palette per theme.
 * Every token changes — background, surfaces, containers, text — not just accent.
 * Palettes are hand-tuned HCT tonal ramps derived from each seed color.
 */
export interface ThemeConfig {
  id: StellarTheme;
  name: string;
  emoji: string;
  /** CSS font-family stack for this theme */
  fontFamily: string;
  /** Google Fonts URL to inject — null for system fonts */
  fontUrl: string | null;
  // Primary tonal palette
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  // Secondary tonal palette
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  // Surface / Background
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  // Outline
  outline: string;
  outlineVariant: string;
}

export const THEMES: ThemeConfig[] = [
  {
    // ── Rose Crimson ──────────────────────────────────────────────────────
    // Seed: #B5264C  Hue ~349°  Warm dark rose surfaces
    id: 'rose',
    name: 'Rose Crimson',
    emoji: '🌹',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
    fontUrl: null,
    primary:                 '#B5264C',
    onPrimary:               '#FFFFFF',
    primaryContainer:        '#FFD9DE',
    onPrimaryContainer:      '#3F0019',
    secondary:               '#75565B',
    onSecondary:             '#FFFFFF',
    secondaryContainer:      '#FFD9DE',
    onSecondaryContainer:    '#2C1519',
    background:              '#1C1112',
    onBackground:            '#EFE0E1',
    surface:                 '#1C1112',
    onSurface:               '#EFE0E1',
    surfaceVariant:          '#524344',
    onSurfaceVariant:        '#D7C1C3',
    surfaceContainerLowest:  '#160C0D',
    surfaceContainerLow:     '#241A1B',
    surfaceContainer:        '#281E1F',
    surfaceContainerHigh:    '#332829',
    surfaceContainerHighest: '#3E3233',
    outline:                 '#A08C8E',
    outlineVariant:          '#524344',
  },
  {
    // ── Dark Forest ───────────────────────────────────────────────────────
    // Seed: #1B5E3B  Hue ~152°  Cool dark forest-green surfaces
    id: 'darkForest',
    name: 'Dark Forest',
    emoji: '🌿',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
    fontUrl: null,
    primary:                 '#4DBB7A',
    onPrimary:               '#00391C',
    primaryContainer:        '#005229',
    onPrimaryContainer:      '#72E5A0',
    secondary:               '#87BF9A',
    onSecondary:             '#0B3320',
    secondaryContainer:      '#234A31',
    onSecondaryContainer:    '#A3D9B5',
    background:              '#0B1610',
    onBackground:            '#D8E8DA',
    surface:                 '#0B1610',
    onSurface:               '#D8E8DA',
    surfaceVariant:          '#3A4B3D',
    onSurfaceVariant:        '#B8CCB9',
    surfaceContainerLowest:  '#071009',
    surfaceContainerLow:     '#131E15',
    surfaceContainer:        '#17231A',
    surfaceContainerHigh:    '#212E23',
    surfaceContainerHighest: '#2C392E',
    outline:                 '#85988A',
    outlineVariant:          '#3A4B3D',
  },
  {
    // ── Sage Green ────────────────────────────────────────────────────────
    // Seed: #4E7A58  Hue ~137°  Muted sage-green surfaces, more desaturated
    id: 'sageGreen',
    name: 'Sage Green',
    emoji: '✨',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
    fontUrl: null,
    primary:                 '#78BE8E',
    onPrimary:               '#003918',
    primaryContainer:        '#005225',
    onPrimaryContainer:      '#94EBAC',
    secondary:               '#91BAA0',
    onSecondary:             '#1C3827',
    secondaryContainer:      '#344E3C',
    onSecondaryContainer:    '#ACD5BC',
    background:              '#101510',
    onBackground:            '#DEE4DB',
    surface:                 '#101510',
    onSurface:               '#DEE4DB',
    surfaceVariant:          '#3C4A3D',
    onSurfaceVariant:        '#BBCABC',
    surfaceContainerLowest:  '#0B100B',
    surfaceContainerLow:     '#181D18',
    surfaceContainer:        '#1C221C',
    surfaceContainerHigh:    '#272C27',
    surfaceContainerHighest: '#323832',
    outline:                 '#889A89',
    outlineVariant:          '#3C4A3D',
  },
  {
    // ── Violet Expressive ─────────────────────────────────────────────────
    // Seed: #7C3AED  Hue ~270°  Deep violet surfaces, M3 Expressive energy
    // Font: Plus Jakarta Sans — modern, geometric, expressive variable font
    id: 'violetExpressive',
    name: 'Violet Expressive',
    emoji: '💜',
    fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap',
    primary:                 '#C084FC',
    onPrimary:               '#3B006E',
    primaryContainer:        '#55008A',
    onPrimaryContainer:      '#E9BBFF',
    secondary:               '#8B9AEA',
    onSecondary:             '#1A1F65',
    secondaryContainer:      '#313690',
    onSecondaryContainer:    '#DDE0FF',
    background:              '#120D1E',
    onBackground:            '#EAE0FF',
    surface:                 '#120D1E',
    onSurface:               '#EAE0FF',
    surfaceVariant:          '#4A3568',
    onSurfaceVariant:        '#CAB9E8',
    surfaceContainerLowest:  '#0D0817',
    surfaceContainerLow:     '#1A1228',
    surfaceContainer:        '#1F162F',
    surfaceContainerHigh:    '#2A1F3D',
    surfaceContainerHighest: '#36294C',
    outline:                 '#9880B8',
    outlineVariant:          '#4A3568',
  },
  {
    // ── Amethyst ──────────────────────────────────────────────────────────
    // Seed: #9B30D9  Hue ~285° (red-violet amethyst) — warmer than Violet Expressive
    // Inspired by the vivid amethyst lavender of the "Elena" poster (~#A855F7).
    // Font: Plus Jakarta Sans — bold, geometric, expressive sans-serif. Clean and strong.
    id: 'amethyst',
    name: 'Amethyst',
    emoji: '💎',
    fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap',
    primary:                 '#D080FF',
    onPrimary:               '#45007E',
    primaryContainer:        '#5F009E',
    onPrimaryContainer:      '#EDCCFF',
    secondary:               '#D09CF5',
    onSecondary:             '#400070',
    secondaryContainer:      '#5C008E',
    onSecondaryContainer:    '#F0CCFF',
    background:              '#130720',
    onBackground:            '#F0E5FF',
    surface:                 '#130720',
    onSurface:               '#F0E5FF',
    surfaceVariant:          '#4E2E6A',
    onSurfaceVariant:        '#D4B8F0',
    surfaceContainerLowest:  '#0C0518',
    surfaceContainerLow:     '#1C0E30',
    surfaceContainer:        '#211338',
    surfaceContainerHigh:    '#2C1B46',
    surfaceContainerHighest: '#382555',
    outline:                 '#A080C5',
    outlineVariant:          '#4E2E6A',
  },
  {
    // ── Lavender ──────────────────────────────────────────────────────────
    // Seed: #BF80FF  Hue ~275° — vivid bright lavender AS the background.
    // Bold inversion: bright surface + deep aubergine accents + dark text.
    // Feels like neon daylight. Editorial sans-serif to stay clean at high contrast.
    id: 'lavender',
    name: 'Lavender',
    emoji: '🪻',
    fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap',
    // Primary: deep aubergine for buttons/accents — high contrast on bright bg
    primary:                 '#3A0078',
    onPrimary:               '#F0D0FF',
    primaryContainer:        '#520095',
    onPrimaryContainer:      '#EBBEFF',
    // Secondary: slightly warmer aubergine
    secondary:               '#4A0085',
    onSecondary:             '#EDD5FF',
    secondaryContainer:      '#620099',
    onSecondaryContainer:    '#F2D0FF',
    // Background & Surface: THE vivid lavender from the image
    background:              '#BF80FF',
    onBackground:            '#15003A',
    surface:                 '#BF80FF',
    onSurface:               '#15003A',
    surfaceVariant:          '#CA90FF',
    onSurfaceVariant:        '#2D005A',
    // Surface containers: darker purples create depth under the bright bg
    surfaceContainerLowest:  '#CB92FF',
    surfaceContainerLow:     '#C488FF',
    surfaceContainer:        '#B878F8',
    surfaceContainerHigh:    '#AC68EE',
    surfaceContainerHighest: '#9E58DE',
    // Outline
    outline:                 '#5500AA',
    outlineVariant:          '#9055D0',
  },
  {
    // ── Lime ──────────────────────────────────────────────────────────────
    // Electric lime (#BFEF3C) IS the background — Lavender's bold-inversion
    // concept applied to vivid yellow-green. Deep forest green accents + dark text.
    id: 'lime',
    name: 'Lime',
    emoji: '🍋‍🟩',
    fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap',
    // Primary: deep forest green — high contrast on electric lime bg
    primary:                 '#174400',
    onPrimary:               '#DEFF8A',
    primaryContainer:        '#255D00',
    onPrimaryContainer:      '#EEFFA8',
    // Secondary: slightly different deep green
    secondary:               '#204800',
    onSecondary:             '#E8FF90',
    secondaryContainer:      '#2E6000',
    onSecondaryContainer:    '#F0FFC0',
    // Background & Surface: THE vivid electric lime
    background:              '#BFEF3C',
    onBackground:            '#0A1800',
    surface:                 '#BFEF3C',
    onSurface:               '#0A1800',
    surfaceVariant:          '#CAEF50',
    onSurfaceVariant:        '#182500',
    // Surface containers: deeper greens for depth and elevation
    surfaceContainerLowest:  '#CBF248',
    surfaceContainerLow:     '#C2EA3C',
    surfaceContainer:        '#B5DE2E',
    surfaceContainerHigh:    '#A6CE20',
    surfaceContainerHighest: '#96BC14',
    // Outline
    outline:                 '#2A5200',
    outlineVariant:          '#6A9800',
  },
];

const STORAGE_KEY = 'stellar-theme';

function createThemeStore() {
  const stored = (typeof localStorage !== 'undefined'
    ? localStorage.getItem(STORAGE_KEY)
    : null) as StellarTheme | null;
  const initial: StellarTheme =
    stored && THEMES.find(t => t.id === stored) ? (stored as StellarTheme) : 'rose';

  const { subscribe, set } = writable<StellarTheme>(initial);

  return {
    subscribe,
    setTheme(theme: StellarTheme) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, theme);
      }
      applyThemeCssVars(theme);
      set(theme);
    },
  };
}

export function getThemeConfig(id: StellarTheme): ThemeConfig {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

/** Apply a dynamically-generated palette (from album art) to :root CSS variables. */
export function applyDynamicPalette(palette: DynamicPalette): void {
  if (typeof document === 'undefined') return;
  const r = document.documentElement;
  r.style.setProperty('--md-primary',                    palette.primary);
  r.style.setProperty('--md-on-primary',                 palette.onPrimary);
  r.style.setProperty('--md-primary-container',          palette.primaryContainer);
  r.style.setProperty('--md-on-primary-container',       palette.onPrimaryContainer);
  r.style.setProperty('--md-secondary',                  palette.secondary);
  r.style.setProperty('--md-on-secondary',               palette.onSecondary);
  r.style.setProperty('--md-secondary-container',        palette.secondaryContainer);
  r.style.setProperty('--md-on-secondary-container',     palette.onSecondaryContainer);
  r.style.setProperty('--md-background',                 palette.background);
  r.style.setProperty('--md-on-background',              palette.onBackground);
  r.style.setProperty('--md-surface',                    palette.surface);
  r.style.setProperty('--md-on-surface',                 palette.onSurface);
  r.style.setProperty('--md-surface-variant',            palette.surfaceVariant);
  r.style.setProperty('--md-on-surface-variant',         palette.onSurfaceVariant);
  r.style.setProperty('--md-surface-container-lowest',   palette.surfaceContainerLowest);
  r.style.setProperty('--md-surface-container-low',      palette.surfaceContainerLow);
  r.style.setProperty('--md-surface-container',          palette.surfaceContainer);
  r.style.setProperty('--md-surface-container-high',     palette.surfaceContainerHigh);
  r.style.setProperty('--md-surface-container-highest',  palette.surfaceContainerHighest);
  r.style.setProperty('--md-outline',                    palette.outline);
  r.style.setProperty('--md-outline-variant',            palette.outlineVariant);
  r.style.setProperty('--md-font-family',                palette.fontFamily);
  r.style.setProperty('--md-overlay-bg',                 palette.overlayBg);
  injectFontLink('dynamic',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
}

/** Apply the full MD3 color palette + font for a theme to :root CSS variables. */
export function applyThemeCssVars(theme: StellarTheme): void {
  if (typeof document === 'undefined') return;
  // Dynamic theme: palette is applied separately via applyDynamicPalette when album art changes
  if (theme === 'dynamic') return;
  const c = getThemeConfig(theme);
  const r = document.documentElement;

  // Primary
  r.style.setProperty('--md-primary',                    c.primary);
  r.style.setProperty('--md-on-primary',                 c.onPrimary);
  r.style.setProperty('--md-primary-container',          c.primaryContainer);
  r.style.setProperty('--md-on-primary-container',       c.onPrimaryContainer);
  // Secondary
  r.style.setProperty('--md-secondary',                  c.secondary);
  r.style.setProperty('--md-on-secondary',               c.onSecondary);
  r.style.setProperty('--md-secondary-container',        c.secondaryContainer);
  r.style.setProperty('--md-on-secondary-container',     c.onSecondaryContainer);
  // Background / Surface
  r.style.setProperty('--md-background',                 c.background);
  r.style.setProperty('--md-on-background',              c.onBackground);
  r.style.setProperty('--md-surface',                    c.surface);
  r.style.setProperty('--md-on-surface',                 c.onSurface);
  r.style.setProperty('--md-surface-variant',            c.surfaceVariant);
  r.style.setProperty('--md-on-surface-variant',         c.onSurfaceVariant);
  // Surface containers
  r.style.setProperty('--md-surface-container-lowest',   c.surfaceContainerLowest);
  r.style.setProperty('--md-surface-container-low',      c.surfaceContainerLow);
  r.style.setProperty('--md-surface-container',          c.surfaceContainer);
  r.style.setProperty('--md-surface-container-high',     c.surfaceContainerHigh);
  r.style.setProperty('--md-surface-container-highest',  c.surfaceContainerHighest);
  // Outline
  r.style.setProperty('--md-outline',                    c.outline);
  r.style.setProperty('--md-outline-variant',            c.outlineVariant);
  // Font
  r.style.setProperty('--md-font-family',                c.fontFamily);
  // Overlay (content panels, sub-screen glass — derived from background)
  // color-mix blends background with black for a theme-adaptive dark overlay
  r.style.setProperty('--md-overlay-bg',
    `color-mix(in srgb, ${c.background} 82%, black 18%)`);
  // Bridge legacy CSS variable system so every component respects the theme
  // (some older components use --color-text-* instead of --md-on-surface)
  r.style.setProperty('--color-text-primary',   c.onSurface);
  r.style.setProperty('--color-text-secondary', c.onSurfaceVariant);
  r.style.setProperty('--color-background',     c.background);
  // Inject Google Fonts link for themes that need it (deduplicate by id)
  injectFontLink(theme, c.fontUrl);
}

/** Inject a <link> for Google Fonts if not already present for this theme. */
function injectFontLink(themeId: string, url: string | null): void {
  // Remove any previously injected theme font links
  document.querySelectorAll('link[data-stellar-font]').forEach(el => {
    if ((el as HTMLLinkElement).dataset.stellarFont !== themeId) el.remove();
  });
  if (!url) return;
  if (document.querySelector(`link[data-stellar-font="${themeId}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.stellarFont = themeId;
  document.head.appendChild(link);
}

export const currentTheme = createThemeStore();
