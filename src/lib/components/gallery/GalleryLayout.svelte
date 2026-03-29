<script lang="ts">
	/**
	 * GalleryLayout — Master layout for the Living Gallery LCD redesign.
	 *
	 * Three-zone layout matching Study 2 mockup:
	 *   LEFT:   ArtHero     (~22%, 380px fixed)
	 *   CENTER: NowPlayingPanel (~35%, flex 0 0 35%)
	 *   RIGHT:  UtilityPanel    (~43%, flex 1)
	 *
	 * VIZ mode: Art shrinks to 80×80, panels collapse to compact bar,
	 * VizBackground opacity ramps 0.18 → 0.85.
	 *
	 * Navigation: currentView store maps to UtilityPanel tab states
	 * via galleryNav helper. Stores are initialized by App.svelte (parent).
	 */
	import { vizMode } from '$lib/stores/viz';
	import { currentView } from '$lib/stores/navigation';
	import { viewToGalleryState, type GalleryTab } from '$lib/utils/galleryNav';

	import VizBackground from './VizBackground.svelte';
	import ArtHero from './ArtHero.svelte';
	import NowPlayingPanel from './NowPlayingPanel.svelte';
	import GlobalSeekBar from './GlobalSeekBar.svelte';
	import UtilityPanel from '../utility/UtilityPanel.svelte';
	import StandbyOverlay from '../StandbyOverlay.svelte';

	$: isViz = $vizMode;

	// ── Navigation → UtilityPanel tab mapping ──
	// Derive the active tab from the navigation store so external
	// navigation actions (goToQueue, goToSettings, etc.) are reflected.
	let galleryTab: GalleryTab = 'library';

	$: {
		const state = viewToGalleryState($currentView);
		// Only switch tab when nav explicitly targets a different one.
		// 'player' view keeps the current tab (gallery IS the player).
		if ($currentView !== 'player') {
			galleryTab = state.tab;
		}
	}
</script>

<!-- Standby/Brightness overlay (same as LCDLayout) -->
<StandbyOverlay />

<div class="gallery-root">
	<!-- Background visualisation canvas -->
	<VizBackground opacity={isViz ? 0.85 : 0.18} />

	<!-- Main content grid — all three zones always in DOM, CSS handles VIZ transitions -->
	<div class="main-layout" class:viz={isViz}>
		<ArtHero />
		<NowPlayingPanel />
		<div class="utility-zone">
			<UtilityPanel bind:activeTab={galleryTab} />
		</div>
	</div>

	<!-- Global seek bar at bottom -->
	<GlobalSeekBar />
</div>

<style>
	.gallery-root {
		position: relative;
		width: 1920px;
		height: 440px;
		overflow: hidden;
		background: var(--md-surface, #1A1114);
		font-family: 'Plus Jakarta Sans', 'Roboto', sans-serif;
		color: var(--md-on-surface, #F0DEE2);
		user-select: none;
		-webkit-user-select: none;
	}

	/* ── Main Layout (matches mockup .main-layout) ── */
	.main-layout {
		position: absolute;
		inset: 0;
		bottom: 24px;
		z-index: 10;
		display: flex;
		gap: 12px;
		padding: 14px 18px;
		transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* ── Utility zone (right panel — ~43% of width) ── */
	.utility-zone {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		transition: opacity 400ms cubic-bezier(0.4, 0, 0.2, 1),
		            background 400ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* ── VIZ mode: right panel darkened glass ── */
	.main-layout.viz .utility-zone {
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.04);
	}
</style>
