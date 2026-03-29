<script lang="ts">
	/**
	 * VizBackground — Full-screen canvas visualisation behind the gallery layout.
	 *
	 * Matches the Study 2 mockup canvas exactly:
	 * - Layered sine waves with pink→deep-rose gradient
	 * - Frequency bars along bottom
	 * - Floating particles
	 * - opacity: 0.18 default, 0.85 in viz mode
	 *
	 * Uses requestAnimationFrame. Performant with will-change: transform.
	 * Falls back to pure JS (no WASM dependency for the background layer).
	 */
	import { onMount, onDestroy } from 'svelte';
	import { isPlaying } from '$lib/stores/player';

	export let opacity: number = 0.18;
	/** Visualisation style (reserved for future use). */
	export const mode: 'spectrum' | 'waveform' | 'radial' = 'spectrum';
	export let active: boolean = true;

	const WIDTH = 1920;
	const HEIGHT = 440;

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let animationId: number = 0;
	let phase = 0;

	/** Render matching the mockup's canvas visualisation exactly. */
	function render() {
		if (!ctx || !active) {
			animationId = requestAnimationFrame(render);
			return;
		}

		ctx.clearRect(0, 0, WIDTH, HEIGHT);

		// Only animate when playing; static low-amplitude otherwise
		const speed = $isPlaying ? 0.015 : 0.002;
		phase += speed;

		// ── Layered sine waves (4 layers, mockup-matched) ──
		for (let layer = 0; layer < 4; layer++) {
			ctx.beginPath();
			const amp = (HEIGHT * 0.15) - layer * 12;
			const freq = 0.003 + layer * 0.001;
			const waveSpeed = 1.2 + layer * 0.4;
			const yBase = HEIGHT * 0.5 + layer * 15;
			const alpha = 0.35 - layer * 0.07;

			for (let x = 0; x <= WIDTH; x += 2) {
				const noise = Math.sin(x * 0.01 + phase * 0.7) * 15;
				const y = yBase
					+ Math.sin(x * freq + phase * waveSpeed) * amp
					+ Math.sin(x * freq * 2.3 + phase * waveSpeed * 0.6) * (amp * 0.3)
					+ noise;
				if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
			}

			const grad = ctx.createLinearGradient(0, yBase - amp, 0, yBase + amp);
			grad.addColorStop(0, `rgba(255,177,200,${alpha})`);
			grad.addColorStop(0.5, `rgba(123,41,73,${alpha * 0.7})`);
			grad.addColorStop(1, `rgba(93,17,51,${alpha * 0.3})`);
			ctx.strokeStyle = grad;
			ctx.lineWidth = 2.5 - layer * 0.4;
			ctx.stroke();
		}

		// ── Frequency bars along bottom (64 bars, mockup-matched) ──
		const barCount = 64;
		const barW = WIDTH / barCount;
		for (let i = 0; i < barCount; i++) {
			const freqT = i / barCount;
			const envelope = Math.sin(freqT * Math.PI);
			const wave = Math.sin(phase * 1.8 + i * 0.18) * 0.3
				+ Math.cos(phase * 0.9 + i * 0.1) * 0.2;
			const h = Math.max(2, (0.25 + wave) * envelope * HEIGHT * 0.35);
			const x = i * barW;

			const grad = ctx.createLinearGradient(x, HEIGHT, x, HEIGHT - h);
			grad.addColorStop(0, 'rgba(255,177,200,0.25)');
			grad.addColorStop(0.5, 'rgba(123,41,73,0.12)');
			grad.addColorStop(1, 'rgba(93,17,51,0.02)');
			ctx.fillStyle = grad;
			ctx.beginPath();
			if (ctx.roundRect) {
				ctx.roundRect(x + 1.5, HEIGHT - h, barW - 3, h, [2, 2, 0, 0]);
			} else {
				ctx.rect(x + 1.5, HEIGHT - h, barW - 3, h);
			}
			ctx.fill();
		}

		// ── Floating particles (30 particles, mockup-matched) ──
		const t = phase * 0.5;
		for (let i = 0; i < 30; i++) {
			const px = (Math.sin(t + i * 2.1) * 0.5 + 0.5) * WIDTH;
			const py = (Math.cos(t * 0.7 + i * 1.7) * 0.5 + 0.5) * HEIGHT;
			const r = 1 + Math.sin(t + i) * 0.8;
			const a = 0.15 + Math.sin(t * 0.5 + i * 0.9) * 0.1;
			ctx.beginPath();
			ctx.arc(px, py, r, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255,177,200,${a})`;
			ctx.fill();
		}

		animationId = requestAnimationFrame(render);
	}

	onMount(() => {
		ctx = canvas.getContext('2d');
		animationId = requestAnimationFrame(render);
	});

	onDestroy(() => {
		if (animationId) cancelAnimationFrame(animationId);
	});
</script>

<canvas
	bind:this={canvas}
	width={WIDTH}
	height={HEIGHT}
	class="viz-background"
	style="opacity: {opacity};"
></canvas>

<style>
	.viz-background {
		position: absolute;
		inset: 0;
		width: 1920px;
		height: 440px;
		z-index: 0;
		pointer-events: none;
		will-change: transform;
		transition: opacity 0.6s ease-out;
	}
</style>
