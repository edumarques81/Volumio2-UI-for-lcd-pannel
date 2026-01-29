import { writable, derived, get } from 'svelte/store';

/**
 * Performance metrics state
 */
export interface PerformanceMetrics {
	fps: number;
	frameTime: number; // ms per frame
	frameTimeVariance: number; // Standard deviation
	droppedFrames: number;
	jankCount: number;
	isJanky: boolean;
}

/**
 * Frame timing data for analysis
 */
interface FrameData {
	timestamp: DOMHighResTimeStamp;
	deltaTime: number;
}

// Configuration
const FPS_SAMPLE_WINDOW = 60; // Rolling window size
const JANK_THRESHOLD_MULTIPLIER = 2; // Frame time > 2x average = jank
const BIG_JANK_THRESHOLD_MS = 50; // > 50ms is always jank (Long Task threshold)
const DROPPED_FRAME_THRESHOLD = 1.5; // Frame time > 1.5x expected = dropped frames
const EXPECTED_FRAME_TIME = 1000 / 60; // Target 60fps = 16.67ms

// Default metrics state
const defaultMetrics: PerformanceMetrics = {
	fps: 0,
	frameTime: 0,
	frameTimeVariance: 0,
	droppedFrames: 0,
	jankCount: 0,
	isJanky: false
};

// Stores
export const performanceMetrics = writable<PerformanceMetrics>({ ...defaultMetrics });
export const fpsEnabled = writable<boolean>(false);

// Internal state
let frameDataBuffer: FrameData[] = [];
let lastTimestamp: DOMHighResTimeStamp = 0;
let animationFrameId: number | null = null;
let totalJankCount = 0;
let totalDroppedFrames = 0;

/**
 * Calculate standard deviation of frame times
 */
function calculateVariance(times: number[]): number {
	if (times.length < 2) return 0;
	const mean = times.reduce((a, b) => a + b, 0) / times.length;
	const squaredDiffs = times.map((t) => Math.pow(t - mean, 2));
	return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / times.length);
}

/**
 * Detect if current frame is janky
 */
function detectJank(currentDeltaTime: number, recentTimes: number[]): boolean {
	// Always jank if over Long Task threshold
	if (currentDeltaTime > BIG_JANK_THRESHOLD_MS) {
		return true;
	}

	// Check against recent average (need at least 3 samples)
	if (recentTimes.length >= 3) {
		const recentAverage = recentTimes.slice(-3).reduce((a, b) => a + b, 0) / 3;
		if (currentDeltaTime > recentAverage * JANK_THRESHOLD_MULTIPLIER) {
			return true;
		}
	}

	return false;
}

/**
 * Calculate dropped frames for a given delta time
 */
function calculateDroppedFrames(deltaTime: number): number {
	if (deltaTime > EXPECTED_FRAME_TIME * DROPPED_FRAME_THRESHOLD) {
		// Calculate how many frames should have rendered in this time
		const expectedFrames = Math.floor(deltaTime / EXPECTED_FRAME_TIME);
		// Subtract 1 for the frame that did render
		return Math.max(0, expectedFrames - 1);
	}
	return 0;
}

/**
 * Main measurement loop
 */
function measureFrame(timestamp: DOMHighResTimeStamp): void {
	if (lastTimestamp === 0) {
		lastTimestamp = timestamp;
		animationFrameId = requestAnimationFrame(measureFrame);
		return;
	}

	const deltaTime = timestamp - lastTimestamp;
	lastTimestamp = timestamp;

	// Add to buffer
	frameDataBuffer.push({ timestamp, deltaTime });

	// Keep buffer at window size
	while (frameDataBuffer.length > FPS_SAMPLE_WINDOW) {
		frameDataBuffer.shift();
	}

	// Calculate metrics
	const deltaTimes = frameDataBuffer.map((f) => f.deltaTime);
	const avgFrameTime = deltaTimes.reduce((a, b) => a + b, 0) / deltaTimes.length;
	const fps = 1000 / avgFrameTime;
	const variance = calculateVariance(deltaTimes);

	// Detect jank - compare against previous frames (excluding current)
	const previousFrameTimes = deltaTimes.slice(0, -1);
	const isJanky = detectJank(deltaTime, previousFrameTimes);
	if (isJanky) {
		totalJankCount++;
	}

	// Estimate dropped frames
	const droppedThisFrame = calculateDroppedFrames(deltaTime);
	totalDroppedFrames += droppedThisFrame;

	// Update store
	performanceMetrics.set({
		fps: Math.round(fps * 10) / 10,
		frameTime: Math.round(avgFrameTime * 100) / 100,
		frameTimeVariance: Math.round(variance * 100) / 100,
		droppedFrames: totalDroppedFrames,
		jankCount: totalJankCount,
		isJanky
	});

	animationFrameId = requestAnimationFrame(measureFrame);
}

/**
 * FPS monitoring actions
 */
export const performanceActions = {
	/**
	 * Start FPS monitoring
	 */
	start(): void {
		if (animationFrameId !== null) return; // Already running

		console.log('[Performance] Starting FPS monitor');
		frameDataBuffer = [];
		lastTimestamp = 0;
		fpsEnabled.set(true);
		animationFrameId = requestAnimationFrame(measureFrame);
	},

	/**
	 * Stop FPS monitoring
	 */
	stop(): void {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
		fpsEnabled.set(false);
		lastTimestamp = 0;
		console.log('[Performance] FPS monitor stopped');
	},

	/**
	 * Toggle FPS monitoring
	 */
	toggle(): void {
		if (get(fpsEnabled)) {
			this.stop();
		} else {
			this.start();
		}
	},

	/**
	 * Reset counters
	 */
	reset(): void {
		frameDataBuffer = [];
		totalJankCount = 0;
		totalDroppedFrames = 0;
		lastTimestamp = 0;
		performanceMetrics.set({ ...defaultMetrics });
	}
};

// Derived stores for convenience
export const currentFps = derived(performanceMetrics, ($m) => $m.fps);
export const isPerformanceGood = derived(performanceMetrics, ($m) => $m.fps >= 55 && !$m.isJanky);
