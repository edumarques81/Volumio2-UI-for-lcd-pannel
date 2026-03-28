<script lang="ts">
	/**
	 * ArtHero — Album art hero display matching Study 2 mockup.
	 *
	 * Default: 380×380, border-radius 16px, glow effect
	 * VIZ mode: 80×80, border-radius 12px, no glow
	 * Transition: 400ms cubic-bezier(0.4,0,0.2,1)
	 *
	 * Tap toggles viz mode via the viz store.
	 */
	import { currentTrack } from '$lib/stores/player';
	import { vizMode, toggleVizMode } from '$lib/stores/viz';
	import { activeEngine } from '$lib/stores/audioEngine';
	import { IconAudirvana } from '$lib/components/icons';

	$: isViz = $vizMode;
	$: isAudirvana = $activeEngine === 'audirvana';
	$: albumart = $currentTrack.albumart;
	$: hasArt = albumart && albumart !== '/default-album.svg';
</script>

<button
	class="art-hero"
	class:viz={isViz}
	on:click={toggleVizMode}
	type="button"
	title="Tap to toggle VIZ mode"
>
	{#if hasArt}
		<img class="art-image" src={albumart} alt="Album artwork" />
	{:else if isAudirvana}
		<!-- Audirvana branding when active with no album art -->
		<div class="art-placeholder audirvana-placeholder">
			<IconAudirvana size={isViz ? 36 : 96} />
		</div>
	{:else}
		<!-- Stellar placeholder gradient (matches mockup) -->
		<div class="art-placeholder"></div>
	{/if}
	<div class="art-gradient-overlay"></div>
	{#if !isViz}
		<div class="art-glow"></div>
	{/if}
</button>

<style>
	.art-hero {
		width: 380px;
		height: 380px;
		flex-shrink: 0;
		border-radius: 16px;
		position: relative;
		overflow: hidden;
		cursor: pointer;
		border: none;
		padding: 0;
		background: linear-gradient(135deg, #0a0a2e 0%, #1a0533 30%, #2d1b69 50%, #0a0a2e 70%, #000 100%);
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 80px rgba(123, 41, 73, 0.15);
		transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.art-hero.viz {
		width: 80px;
		height: 80px;
		border-radius: 12px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
	}

	.art-image {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.art-placeholder {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, #0a0a2e 0%, #1a0533 30%, #2d1b69 50%, #0a0a2e 70%, #000 100%);
	}

	.art-placeholder.audirvana-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(201, 179, 232, 0.5);
	}

	.art-gradient-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.25));
		pointer-events: none;
		transition: opacity 400ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.art-glow {
		position: absolute;
		inset: -20px;
		z-index: -1;
		border-radius: 28px;
		background: radial-gradient(ellipse at center, rgba(123, 41, 73, 0.25) 0%, transparent 70%);
		filter: blur(30px);
		transition: opacity 400ms cubic-bezier(0.4, 0, 0.2, 1);
		pointer-events: none;
	}

	.art-hero:active {
		transform: scale(0.97);
	}
</style>
