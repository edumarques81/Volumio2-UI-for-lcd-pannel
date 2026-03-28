<script lang="ts">
	/**
	 * GlobalSeekBar — Full-width seek bar at the bottom of the gallery layout.
	 *
	 * Matches Study 2 mockup exactly:
	 *   position: absolute bottom:0, height 4px → 8px on hover
	 *   background: rgba(81,67,71,0.25)
	 *   fill: var(--primary) = #FFB1C8
	 *   thumb: 8px dot, opacity 0→1 on hover
	 *   z-index: 50
	 */
	import { seek, duration, progress, formatTime, playerActions } from '$lib/stores/player';

	let trackEl: HTMLDivElement;
	let dragging = false;
	let hovering = false;
	let hoverX = 0;

	function getSeekPosition(e: MouseEvent | TouchEvent): number {
		if (!trackEl) return 0;
		const rect = trackEl.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
	}

	function handlePointerDown(e: MouseEvent | TouchEvent) {
		dragging = true;
		const pct = getSeekPosition(e);
		const pos = Math.round(pct * $duration);
		playerActions.seekTo(pos);
	}

	function handlePointerMove(e: MouseEvent | TouchEvent) {
		const rect = trackEl.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		hoverX = clientX - rect.left;

		if (dragging) {
			const pct = getSeekPosition(e);
			const pos = Math.round(pct * $duration);
			playerActions.seekTo(pos);
		}
	}

	function handlePointerUp() {
		dragging = false;
	}

	function getHoverTime(): string {
		if (!trackEl) return '';
		const rect = trackEl.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, hoverX / rect.width));
		return formatTime(Math.round(pct * $duration));
	}
</script>

<svelte:window
	on:mousemove={handlePointerMove}
	on:mouseup={handlePointerUp}
	on:touchmove={handlePointerMove}
	on:touchend={handlePointerUp}
/>

<div
	class="global-seek"
	class:hovering
	bind:this={trackEl}
	on:mousedown={handlePointerDown}
	on:touchstart|preventDefault={handlePointerDown}
	on:mouseenter={() => (hovering = true)}
	on:mouseleave={() => (hovering = false)}
	role="slider"
	aria-label="Seek"
	aria-valuenow={$seek}
	aria-valuemin={0}
	aria-valuemax={$duration}
	tabindex="0"
>
	{#if hovering && $duration > 0}
		<div class="seek-hover-time" style="left: {hoverX}px">
			{getHoverTime()}
		</div>
	{/if}
	<div class="global-seek-fill" style="width: {$progress}%">
		<span class="global-seek-dot"></span>
	</div>
</div>

<style>
	.global-seek {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 4px;
		z-index: 50;
		cursor: pointer;
		transition: height 0.15s ease-out;
		background: rgba(81, 67, 71, 0.25);
	}

	.global-seek.hovering,
	.global-seek:hover {
		height: 8px;
	}

	.global-seek-fill {
		height: 100%;
		background: var(--md-primary, #FFB1C8);
		transition: width 0.1s;
		position: relative;
	}

	.global-seek-dot {
		position: absolute;
		right: -4px;
		top: 50%;
		transform: translateY(-50%);
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--md-primary, #FFB1C8);
		opacity: 0;
		transition: opacity 0.15s;
		pointer-events: none;
	}

	.global-seek:hover .global-seek-dot {
		opacity: 1;
	}

	.seek-hover-time {
		position: absolute;
		top: -28px;
		transform: translateX(-50%);
		font-family: 'Roboto Mono', monospace;
		font-size: 11px;
		color: var(--md-outline, #9E8C91);
		background: rgba(16, 10, 14, 0.85);
		padding: 2px 8px;
		border-radius: 4px;
		pointer-events: none;
		white-space: nowrap;
	}
</style>
