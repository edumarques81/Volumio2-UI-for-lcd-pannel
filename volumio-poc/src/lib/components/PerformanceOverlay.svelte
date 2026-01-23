<script lang="ts">
	import { performanceMetrics, fpsEnabled, performanceActions } from '$lib/stores/performance';
	import { onMount, onDestroy } from 'svelte';

	// Props for customization
	interface Props {
		position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
		showGraph?: boolean;
		graphWidth?: number;
		graphHeight?: number;
	}

	let {
		position = 'top-right',
		showGraph = true,
		graphWidth = 120,
		graphHeight = 40
	}: Props = $props();

	// Graph data (last N frame times) - managed imperatively for test compatibility
	let graphData: number[] = [];
	const MAX_GRAPH_POINTS = 60;
	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		// Subscribe to store changes to update graph data
		unsubscribe = performanceMetrics.subscribe((metrics) => {
			if ($fpsEnabled && metrics.frameTime > 0) {
				graphData = [...graphData, metrics.frameTime].slice(-MAX_GRAPH_POINTS);
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});

	// Calculate graph path
	function getGraphPath(data: number[], width: number, height: number): string {
		if (data.length < 2) return '';

		const maxValue = Math.max(...data, 33.33); // At least show up to 30fps
		const minValue = 0;
		const range = maxValue - minValue;

		const points = data.map((value, index) => {
			const x = (index / (MAX_GRAPH_POINTS - 1)) * width;
			const y = height - ((value - minValue) / range) * height;
			return `${x},${y}`;
		});

		return `M ${points.join(' L ')}`;
	}

	// Get color based on FPS
	function getFpsColor(fps: number): string {
		if (fps >= 55) return '#4ade80'; // Green
		if (fps >= 30) return '#fbbf24'; // Yellow
		return '#ef4444'; // Red
	}

	// Position styles
	const positionStyles: Record<string, string> = {
		'top-left': 'top: 8px; left: 8px;',
		'top-right': 'top: 8px; right: 8px;',
		'bottom-left': 'bottom: 8px; left: 8px;',
		'bottom-right': 'bottom: 8px; right: 8px;'
	};

	function handleReset() {
		performanceActions.reset();
		graphData = [];
	}

	function handleClose() {
		performanceActions.stop();
		graphData = [];
	}
</script>

{#if $fpsEnabled}
	<div class="performance-overlay" style={positionStyles[position]}>
		<!-- FPS Display -->
		<div class="fps-display">
			<span class="fps-value" style="color: {getFpsColor($performanceMetrics.fps)}">
				{Math.round($performanceMetrics.fps)}
			</span>
			<span class="fps-label">FPS</span>
		</div>

		<!-- Frame Time -->
		<div class="metric-row">
			<span class="metric-label">Frame:</span>
			<span class="metric-value">{$performanceMetrics.frameTime}ms</span>
		</div>

		<!-- Variance -->
		<div class="metric-row">
			<span class="metric-label">Var:</span>
			<span class="metric-value">{$performanceMetrics.frameTimeVariance}ms</span>
		</div>

		<!-- Jank indicator -->
		{#if $performanceMetrics.jankCount > 0}
			<div class="metric-row jank">
				<span class="metric-label">Jank:</span>
				<span class="metric-value">{$performanceMetrics.jankCount}</span>
			</div>
		{/if}

		<!-- Dropped frames -->
		{#if $performanceMetrics.droppedFrames > 0}
			<div class="metric-row dropped">
				<span class="metric-label">Dropped:</span>
				<span class="metric-value">{$performanceMetrics.droppedFrames}</span>
			</div>
		{/if}

		<!-- Frame time graph -->
		{#if showGraph && graphData.length > 1}
			<svg
				class="frame-graph"
				width={graphWidth}
				height={graphHeight}
				viewBox="0 0 {graphWidth} {graphHeight}"
			>
				<!-- Target 60fps line (16.67ms) -->
				<line
					x1="0"
					y1={graphHeight - (16.67 / 33.33) * graphHeight}
					x2={graphWidth}
					y2={graphHeight - (16.67 / 33.33) * graphHeight}
					stroke="#4ade80"
					stroke-width="1"
					stroke-dasharray="4,2"
					opacity="0.5"
				/>
				<!-- Target 30fps line (33.33ms) -->
				<line
					x1="0"
					y1={graphHeight - (33.33 / 33.33) * graphHeight}
					x2={graphWidth}
					y2={graphHeight - (33.33 / 33.33) * graphHeight}
					stroke="#fbbf24"
					stroke-width="1"
					stroke-dasharray="4,2"
					opacity="0.5"
				/>
				<!-- Frame time line -->
				<path
					d={getGraphPath(graphData, graphWidth, graphHeight)}
					fill="none"
					stroke={getFpsColor($performanceMetrics.fps)}
					stroke-width="1.5"
				/>
			</svg>
		{/if}

		<!-- Controls -->
		<div class="controls">
			<button onclick={handleReset}>Reset</button>
			<button onclick={handleClose}>Close</button>
		</div>
	</div>
{/if}

<style>
	.performance-overlay {
		position: fixed;
		z-index: 9999;
		background: rgba(0, 0, 0, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		padding: 8px 12px;
		font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
		font-size: 11px;
		color: #e5e5e5;
		min-width: 100px;
		backdrop-filter: blur(8px);
		user-select: none;
		pointer-events: auto;
	}

	.fps-display {
		display: flex;
		align-items: baseline;
		gap: 4px;
		margin-bottom: 4px;
	}

	.fps-value {
		font-size: 24px;
		font-weight: bold;
		line-height: 1;
	}

	.fps-label {
		font-size: 10px;
		color: #a3a3a3;
		text-transform: uppercase;
	}

	.metric-row {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin: 2px 0;
	}

	.metric-label {
		color: #a3a3a3;
	}

	.metric-value {
		color: #e5e5e5;
		font-weight: 500;
	}

	.metric-row.jank .metric-value {
		color: #fbbf24;
	}

	.metric-row.dropped .metric-value {
		color: #ef4444;
	}

	.frame-graph {
		display: block;
		margin: 8px 0 4px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}

	.controls {
		display: flex;
		gap: 4px;
		margin-top: 8px;
	}

	.controls button {
		flex: 1;
		padding: 4px 8px;
		font-size: 10px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		color: #e5e5e5;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.controls button:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
