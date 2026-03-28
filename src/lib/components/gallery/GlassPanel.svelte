<script lang="ts">
	/**
	 * GlassPanel — Reusable glassmorphism container matching Study 2 mockup.
	 *
	 * Glass values from mockup:
	 *   background: rgba(26,17,20,0.5)   [--glass-bg]
	 *   border: rgba(81,67,71,0.55)       [--glass-border]
	 *   backdrop-filter: blur(24px) saturate(1.3)
	 *   border-radius: 16px               [--shape-lg]
	 */
	import { slide } from 'svelte/transition';

	export let title: string = '';
	export let collapsible: boolean = false;
	export let expanded: boolean = true;

	function toggle() {
		if (collapsible) {
			expanded = !expanded;
		}
	}
</script>

<div class="glass-panel">
	{#if title}
		<button
			class="glass-header"
			class:collapsible
			on:click={toggle}
			type="button"
			aria-expanded={expanded}
		>
			<span class="glass-title">{title}</span>
			{#if collapsible}
				<svg
					class="chevron"
					class:collapsed={!expanded}
					width="20"
					height="20"
					viewBox="0 0 20 20"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M5 8L10 13L15 8"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{/if}
		</button>
	{/if}
	{#if expanded}
		<div
			class="glass-content"
			transition:slide={{ duration: 300, easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }}
		>
			<slot />
		</div>
	{/if}
</div>

<style>
	.glass-panel {
		backdrop-filter: blur(24px) saturate(1.3);
		-webkit-backdrop-filter: blur(24px) saturate(1.3);
		background: rgba(26, 17, 20, 0.5);
		border: 1px solid rgba(81, 67, 71, 0.55);
		border-radius: 16px;
		overflow: hidden;
	}

	.glass-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 12px 16px;
		background: none;
		border: none;
		color: var(--md-on-surface, #F0DEE2);
		font: inherit;
		cursor: default;
		min-height: 44px;
		user-select: none;
	}

	.glass-header.collapsible {
		cursor: pointer;
	}

	.glass-header.collapsible:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.glass-title {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 1.5px;
		text-transform: uppercase;
		color: var(--md-outline, #9E8C91);
	}

	.chevron {
		color: var(--md-on-surface-variant, #D5BFC4);
		transition: transform 300ms ease-out;
		flex-shrink: 0;
	}

	.chevron.collapsed {
		transform: rotate(-90deg);
	}

	.glass-content {
		padding: 12px 16px;
	}
</style>
