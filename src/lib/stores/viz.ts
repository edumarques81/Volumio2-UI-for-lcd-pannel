import { writable } from 'svelte/store';

/** Whether the gallery is in full-viz mode (art shrinks, viz goes bright). */
export const vizMode = writable<boolean>(false);

/** Active visualisation style. */
export const vizStyle = writable<'spectrum' | 'waveform' | 'radial'>('spectrum');

/** Toggle viz mode on/off. */
export function toggleVizMode(): void {
	vizMode.update(v => !v);
}
