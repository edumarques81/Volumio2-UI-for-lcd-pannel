import { writable, get } from 'svelte/store';

/** Whether the gallery is in full-viz mode (art shrinks, viz goes bright). */
export const vizMode = writable<boolean>(false);

/** Active visualisation style. */
export const vizStyle = writable<'spectrum' | 'waveform' | 'radial'>('spectrum');

/** Toggle viz mode on/off. */
export function toggleVizMode(): void {
	vizMode.update(v => !v);
}

/** Fullscreen viz modes. */
export const VIZ_MODES = ['bars', 'vu-digital', 'vu-analog', 'waveform'] as const;
export type FullscreenVizMode = typeof VIZ_MODES[number];

export const VIZ_MODE_LABELS: Record<FullscreenVizMode, string> = {
	'bars': 'Frequency Bars',
	'vu-digital': 'Digital VU Meter',
	'vu-analog': 'Analog VU Meter',
	'waveform': 'Waveform'
};

const VIZ_DEFAULT_KEY = 'stellar-volumio-default-viz-mode';

function loadDefaultVizMode(): FullscreenVizMode {
	if (typeof localStorage !== 'undefined') {
		const stored = localStorage.getItem(VIZ_DEFAULT_KEY);
		if (stored && VIZ_MODES.includes(stored as FullscreenVizMode)) {
			return stored as FullscreenVizMode;
		}
	}
	return 'bars';
}

/** User's preferred default fullscreen viz mode, persisted to localStorage. */
export const defaultVizMode = writable<FullscreenVizMode>(loadDefaultVizMode());

/** Set and persist the default viz mode. */
export function setDefaultVizMode(mode: FullscreenVizMode): void {
	defaultVizMode.set(mode);
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(VIZ_DEFAULT_KEY, mode);
	}
}
