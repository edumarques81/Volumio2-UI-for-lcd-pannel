<script lang="ts">
	/**
	 * WasmVisualiser — Canvas-based visualisation powered by stellar-viz WASM.
	 *
	 * Dynamically imports the WASM module and falls back to a pure JS
	 * implementation if WASM fails to load. Renders spectrum bars,
	 * waveform lines, or radial spectrum to a 1920×440 canvas.
	 */

	import { onMount, onDestroy } from 'svelte';

	// --- Props ---
	export let mode: 'spectrum' | 'waveform' | 'radial' = 'spectrum';
	export let seedColour: string = '#e63946';
	export let isPlaying: boolean = true;

	// --- Internal state ---
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let animationId: number = 0;
	let wasmModule: any = null;
	let physicsState: any = null;
	let usingWasm = false;
	let startTime = 0;

	const WIDTH = 1920;
	const HEIGHT = 440;
	const NUM_BARS = 64;
	const NUM_POINTS = 200;

	// --- Pure JS Fallback ---

	/** Simple hash noise (mirrors Rust implementation). */
	function jsHashNoise(x: number): number {
		let n = Math.imul(x, 374761393);
		n = Math.imul(n ^ (n >> 13), 1103515245);
		n = n ^ (n >> 16);
		return n / 2147483647;
	}

	function jsSmoothstep(t: number): number {
		return t * t * (3 - 2 * t);
	}

	function jsValueNoise1D(x: number): number {
		const x0 = Math.floor(x);
		const t = jsSmoothstep(x - x0);
		return jsHashNoise(x0) + (jsHashNoise(x0 + 1) - jsHashNoise(x0)) * t;
	}

	function jsLayeredNoise(x: number, octaves: number): number {
		let value = 0, amplitude = 1, frequency = 1, maxAmp = 0;
		for (let i = 0; i < octaves; i++) {
			value += jsValueNoise1D(x * frequency) * amplitude;
			maxAmp += amplitude;
			amplitude *= 0.5;
			frequency *= 2;
		}
		return value / maxAmp;
	}

	function jsGenerateFakeAudio(time: number, numSamples: number): Float32Array {
		const result = new Float32Array(numSamples);
		for (let i = 0; i < numSamples; i++) {
			const x = i / numSamples;
			const base = jsLayeredNoise(x * 4 + time * 0.8, 4);
			const mid = jsLayeredNoise(x * 8 + time * 1.5, 3) * 0.5;
			const detail = jsLayeredNoise(x * 16 + time * 3, 2) * 0.25;
			const bassBoost = Math.pow(1 - x, 2) * 0.3;
			result[i] = Math.max(0, Math.min(1, (base + mid + detail + bassBoost + 1) / 3));
		}
		return result;
	}

	function jsComputeSpectrumBars(audio: Float32Array, numBars: number, w: number, h: number): Float32Array {
		const totalBarW = w / numBars;
		const barW = totalBarW * 0.8;
		const gap = totalBarW * 0.2;
		const samplesPerBar = audio.length / numBars;
		const result = new Float32Array(numBars * 4);

		for (let i = 0; i < numBars; i++) {
			const start = Math.floor(i * samplesPerBar);
			const end = Math.min(Math.floor((i + 1) * samplesPerBar), audio.length);
			let sum = 0;
			for (let j = start; j < end; j++) sum += audio[j];
			const mag = Math.max(0, Math.min(1, sum / (end - start)));
			const scaled = mag > 0 ? Math.max(0, Math.min(1, (Math.log(mag) + 4) / 4)) : 0;
			const barH = scaled * h * 0.9;
			result[i * 4] = i * totalBarW + gap / 2;
			result[i * 4 + 1] = h - barH;
			result[i * 4 + 2] = barW;
			result[i * 4 + 3] = barH;
		}
		return result;
	}

	function jsComputeWaveformPoints(audio: Float32Array, numPts: number, w: number, h: number): Float32Array {
		const centerY = h / 2;
		const amp = h * 0.4;
		const samplesPerPt = audio.length / numPts;
		const result = new Float32Array(numPts * 2);

		for (let i = 0; i < numPts; i++) {
			const x = (i / Math.max(1, numPts - 1)) * w;
			const start = Math.floor(i * samplesPerPt);
			const end = Math.min(Math.floor((i + 1) * samplesPerPt), audio.length);
			let sum = 0;
			for (let j = start; j < end; j++) sum += audio[j];
			const val = sum / (end - start);
			result[i * 2] = x;
			result[i * 2 + 1] = Math.max(0, Math.min(h, centerY + (val - 0.5) * 2 * amp));
		}
		return result;
	}

	function jsComputeRadialSpectrum(audio: Float32Array, numBars: number, cx: number, cy: number, r: number): Float32Array {
		const maxExt = r * 0.8;
		const samplesPerBar = audio.length / numBars;
		const result = new Float32Array(numBars * 4);

		for (let i = 0; i < numBars; i++) {
			const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
			const start = Math.floor(i * samplesPerBar);
			const end = Math.min(Math.floor((i + 1) * samplesPerBar), audio.length);
			let sum = 0;
			for (let j = start; j < end; j++) sum += audio[j];
			const mag = Math.max(0, Math.min(1, sum / (end - start)));
			const barLen = mag * maxExt;
			const cos = Math.cos(angle), sin = Math.sin(angle);
			result[i * 4] = cx + r * cos;
			result[i * 4 + 1] = cy + r * sin;
			result[i * 4 + 2] = cx + (r + barLen) * cos;
			result[i * 4 + 3] = cy + (r + barLen) * sin;
		}
		return result;
	}

	// Simple physics fallback
	let jsHeights: Float32Array;
	let jsVelocities: Float32Array;

	function jsPhysicsUpdate(targets: Float32Array, dt: number): Float32Array {
		if (!jsHeights || jsHeights.length !== targets.length) {
			jsHeights = new Float32Array(targets.length);
			jsVelocities = new Float32Array(targets.length);
		}
		const stiffness = 180, damping = 12;
		dt = Math.min(dt, 0.1);
		for (let i = 0; i < jsHeights.length; i++) {
			const spring = -stiffness * (jsHeights[i] - (targets[i] || 0));
			const damp = -damping * jsVelocities[i];
			jsVelocities[i] += (spring + damp) * dt;
			jsHeights[i] += jsVelocities[i] * dt;
			if (jsHeights[i] < 0) { jsHeights[i] = 0; jsVelocities[i] = Math.max(0, jsVelocities[i]); }
		}
		return jsHeights;
	}

	// Colour palette (simple JS version)
	function jsGeneratePalette(seedHex: string, n: number): string[] {
		// Parse seed or default
		const hex = seedHex.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16) || 128;
		const g = parseInt(hex.substring(2, 4), 16) || 128;
		const b = parseInt(hex.substring(4, 6), 16) || 128;

		const palette: string[] = [];
		for (let i = 0; i < n; i++) {
			const t = i / n;
			const nr = Math.round((r * (1 - t) + (255 - r) * t) * 0.8 + 50) & 255;
			const ng = Math.round((g * (1 - t) + (255 - g) * t) * 0.8 + 30) & 255;
			const nb = Math.round((b * (1 - t) + (255 - b) * t) * 0.8 + 40) & 255;
			palette.push(`rgb(${nr},${ng},${nb})`);
		}
		return palette;
	}

	// --- Render functions ---

	function renderSpectrum(audio: Float32Array, palette: string[], dt: number) {
		if (!ctx) return;

		let bars: Float32Array;
		if (usingWasm && wasmModule) {
			bars = wasmModule.computeSpectrumBars(audio, NUM_BARS, WIDTH, HEIGHT);
		} else {
			bars = jsComputeSpectrumBars(audio, NUM_BARS, WIDTH, HEIGHT);
		}

		// Extract heights as physics targets
		const targets = new Float32Array(NUM_BARS);
		for (let i = 0; i < NUM_BARS; i++) targets[i] = bars[i * 4 + 3];

		let heights: Float32Array;
		if (usingWasm && physicsState) {
			heights = physicsState.update(targets, dt);
		} else {
			heights = jsPhysicsUpdate(targets, dt);
		}

		ctx.clearRect(0, 0, WIDTH, HEIGHT);
		for (let i = 0; i < NUM_BARS; i++) {
			const x = bars[i * 4];
			const w = bars[i * 4 + 2];
			const h = heights[i] || bars[i * 4 + 3];
			const y = HEIGHT - h;
			const colIdx = Math.floor((i / NUM_BARS) * (palette.length - 1));
			ctx.fillStyle = palette[colIdx] || palette[0];
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, 4);
			ctx.fill();
		}
	}

	function renderWaveform(audio: Float32Array, palette: string[]) {
		if (!ctx) return;

		let points: Float32Array;
		if (usingWasm && wasmModule) {
			points = wasmModule.computeWaveformPoints(audio, NUM_POINTS, WIDTH, HEIGHT);
		} else {
			points = jsComputeWaveformPoints(audio, NUM_POINTS, WIDTH, HEIGHT);
		}

		ctx.clearRect(0, 0, WIDTH, HEIGHT);

		const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
		palette.forEach((c, i) => gradient.addColorStop(i / Math.max(1, palette.length - 1), c));

		ctx.strokeStyle = gradient;
		ctx.lineWidth = 3;
		ctx.lineJoin = 'round';
		ctx.beginPath();
		for (let i = 0; i < NUM_POINTS; i++) {
			const x = points[i * 2];
			const y = points[i * 2 + 1];
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	}

	function renderRadial(audio: Float32Array, palette: string[]) {
		if (!ctx) return;

		const cx = WIDTH / 2;
		const cy = HEIGHT / 2;
		const radius = HEIGHT * 0.3;

		let lines: Float32Array;
		if (usingWasm && wasmModule) {
			lines = wasmModule.computeRadialSpectrum(audio, NUM_BARS, cx, cy, radius);
		} else {
			lines = jsComputeRadialSpectrum(audio, NUM_BARS, cx, cy, radius);
		}

		ctx.clearRect(0, 0, WIDTH, HEIGHT);
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';

		for (let i = 0; i < NUM_BARS; i++) {
			const colIdx = Math.floor((i / NUM_BARS) * (palette.length - 1));
			ctx.strokeStyle = palette[colIdx] || palette[0];
			ctx.beginPath();
			ctx.moveTo(lines[i * 4], lines[i * 4 + 1]);
			ctx.lineTo(lines[i * 4 + 2], lines[i * 4 + 3]);
			ctx.stroke();
		}
	}

	// --- Animation loop ---

	let lastFrameTime = 0;

	function animate(timestamp: number) {
		if (!isPlaying) {
			animationId = requestAnimationFrame(animate);
			return;
		}

		const dt = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 1 / 60;
		lastFrameTime = timestamp;
		const time = (timestamp - startTime) / 1000;

		let audio: Float32Array;
		if (usingWasm && wasmModule) {
			audio = wasmModule.generateFakeAudioFrame(time, 256);
		} else {
			audio = jsGenerateFakeAudio(time, 256);
		}

		const palette = jsGeneratePalette(seedColour, 8);

		switch (mode) {
			case 'spectrum':
				renderSpectrum(audio, palette, dt);
				break;
			case 'waveform':
				renderWaveform(audio, palette);
				break;
			case 'radial':
				renderRadial(audio, palette);
				break;
		}

		animationId = requestAnimationFrame(animate);
	}

	// --- Lifecycle ---

	onMount(async () => {
		ctx = canvas.getContext('2d');
		startTime = performance.now();

		// Try loading WASM
		try {
			const wasm = await import('$lib/wasm/stellar-viz/pkg/stellar_viz.js');
			await wasm.default();
			wasmModule = wasm;
			physicsState = new wasm.WasmPhysicsState(NUM_BARS);
			usingWasm = true;
			console.log('[WasmVisualiser] WASM module loaded');
		} catch (err) {
			console.warn('[WasmVisualiser] WASM failed to load, using JS fallback:', err);
			usingWasm = false;
		}

		animationId = requestAnimationFrame(animate);
	});

	onDestroy(() => {
		if (animationId) cancelAnimationFrame(animationId);
	});
</script>

<canvas
	bind:this={canvas}
	width={WIDTH}
	height={HEIGHT}
	class="wasm-visualiser"
	style="width: 100%; height: 100%; background: #0a0a0a;"
/>

<style>
	.wasm-visualiser {
		display: block;
		image-rendering: auto;
		border-radius: 12px;
	}
</style>
