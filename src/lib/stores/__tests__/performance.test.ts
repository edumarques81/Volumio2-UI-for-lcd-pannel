import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get, writable } from 'svelte/store';

// Mock requestAnimationFrame and cancelAnimationFrame
let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
let rafId = 0;

vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
	const id = ++rafId;
	rafCallbacks.set(id, callback);
	return id;
});

vi.stubGlobal('cancelAnimationFrame', (id: number) => {
	rafCallbacks.delete(id);
});

// Mock performance.now()
let mockTime = 0;
vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

// Helper to simulate a frame
function simulateFrame(deltaMs: number) {
	mockTime += deltaMs;
	const callbacks = Array.from(rafCallbacks.entries());
	rafCallbacks.clear();
	for (const [id, callback] of callbacks) {
		callback(mockTime);
	}
}

// Import after mocks are set up
import {
	performanceMetrics,
	fpsEnabled,
	performanceActions,
	currentFps,
	isPerformanceGood,
	type PerformanceMetrics
} from '../performance';

describe('Performance store', () => {
	const defaultMetrics: PerformanceMetrics = {
		fps: 0,
		frameTime: 0,
		frameTimeVariance: 0,
		droppedFrames: 0,
		jankCount: 0,
		isJanky: false
	};

	beforeEach(() => {
		// Reset state
		mockTime = 0;
		rafId = 0;
		rafCallbacks.clear();
		vi.clearAllMocks();

		// Reset stores
		performanceMetrics.set(defaultMetrics);
		fpsEnabled.set(false);
		performanceActions.stop();
		performanceActions.reset();
	});

	afterEach(() => {
		performanceActions.stop();
	});

	describe('performanceMetrics store', () => {
		it('should have correct initial state', () => {
			expect(get(performanceMetrics)).toEqual(defaultMetrics);
		});

		it('should be writable', () => {
			const newMetrics: PerformanceMetrics = {
				fps: 60,
				frameTime: 16.67,
				frameTimeVariance: 1.5,
				droppedFrames: 0,
				jankCount: 0,
				isJanky: false
			};
			performanceMetrics.set(newMetrics);
			expect(get(performanceMetrics)).toEqual(newMetrics);
		});
	});

	describe('fpsEnabled store', () => {
		it('should be false initially', () => {
			expect(get(fpsEnabled)).toBe(false);
		});

		it('should be true after start()', () => {
			performanceActions.start();
			expect(get(fpsEnabled)).toBe(true);
		});

		it('should be false after stop()', () => {
			performanceActions.start();
			performanceActions.stop();
			expect(get(fpsEnabled)).toBe(false);
		});
	});

	describe('performanceActions.start()', () => {
		it('should request animation frame', () => {
			performanceActions.start();
			expect(rafCallbacks.size).toBe(1);
		});

		it('should not start multiple loops if already running', () => {
			performanceActions.start();
			performanceActions.start();
			performanceActions.start();
			// Should only have one active animation frame
			expect(rafCallbacks.size).toBe(1);
		});

		it('should set fpsEnabled to true', () => {
			performanceActions.start();
			expect(get(fpsEnabled)).toBe(true);
		});
	});

	describe('performanceActions.stop()', () => {
		it('should cancel animation frame', () => {
			performanceActions.start();
			expect(rafCallbacks.size).toBe(1);
			performanceActions.stop();
			// After stop, no new frames should be requested
			expect(get(fpsEnabled)).toBe(false);
		});

		it('should set fpsEnabled to false', () => {
			performanceActions.start();
			performanceActions.stop();
			expect(get(fpsEnabled)).toBe(false);
		});
	});

	describe('performanceActions.toggle()', () => {
		it('should start monitoring if not running', () => {
			performanceActions.toggle();
			expect(get(fpsEnabled)).toBe(true);
		});

		it('should stop monitoring if running', () => {
			performanceActions.start();
			performanceActions.toggle();
			expect(get(fpsEnabled)).toBe(false);
		});
	});

	describe('performanceActions.reset()', () => {
		it('should reset all counters to zero', () => {
			// Set some values first
			performanceMetrics.set({
				fps: 45,
				frameTime: 22.2,
				frameTimeVariance: 5.0,
				droppedFrames: 10,
				jankCount: 5,
				isJanky: true
			});

			performanceActions.reset();

			expect(get(performanceMetrics)).toEqual(defaultMetrics);
		});
	});

	describe('FPS calculation', () => {
		it('should calculate FPS after multiple frames', () => {
			performanceActions.start();

			// Simulate 60 frames at ~60fps (16.67ms each)
			for (let i = 0; i < 60; i++) {
				simulateFrame(16.67);
			}

			const metrics = get(performanceMetrics);
			// Should be approximately 60 fps (1000ms / 16.67ms)
			expect(metrics.fps).toBeGreaterThan(55);
			expect(metrics.fps).toBeLessThan(65);
		});

		it('should calculate frame time correctly', () => {
			performanceActions.start();

			// Simulate frames at 30fps (33.33ms each)
			for (let i = 0; i < 30; i++) {
				simulateFrame(33.33);
			}

			const metrics = get(performanceMetrics);
			// Frame time should be approximately 33.33ms
			expect(metrics.frameTime).toBeGreaterThan(30);
			expect(metrics.frameTime).toBeLessThan(36);
		});

		it('should update on each frame', () => {
			performanceActions.start();

			// First frame (just records timestamp)
			simulateFrame(16.67);

			// Second frame should calculate delta
			simulateFrame(16.67);

			const metrics = get(performanceMetrics);
			expect(metrics.fps).toBeGreaterThan(0);
		});
	});

	describe('Jank detection', () => {
		it('should detect jank when frame time exceeds 50ms', () => {
			performanceActions.start();

			// Build up stable baseline at 60fps
			for (let i = 0; i < 10; i++) {
				simulateFrame(16.67);
			}

			// Simulate a janky frame (> 50ms)
			simulateFrame(60);

			const metrics = get(performanceMetrics);
			expect(metrics.isJanky).toBe(true);
			expect(metrics.jankCount).toBeGreaterThan(0);
		});

		it('should detect jank when frame time is 2x average', () => {
			performanceActions.start();

			// Build up stable baseline at 60fps
			for (let i = 0; i < 10; i++) {
				simulateFrame(16.67);
			}

			// Simulate a frame that's 2x+ the average (35ms vs ~17ms avg)
			simulateFrame(40);

			const metrics = get(performanceMetrics);
			expect(metrics.isJanky).toBe(true);
		});

		it('should not detect jank for normal frames', () => {
			performanceActions.start();

			// Simulate stable 60fps
			for (let i = 0; i < 20; i++) {
				simulateFrame(16.67);
			}

			const metrics = get(performanceMetrics);
			expect(metrics.isJanky).toBe(false);
			expect(metrics.jankCount).toBe(0);
		});

		it('should accumulate jank count over time', () => {
			performanceActions.start();

			// Build baseline
			for (let i = 0; i < 10; i++) {
				simulateFrame(16.67);
			}

			// Create multiple jank events
			simulateFrame(60);
			simulateFrame(16.67);
			simulateFrame(70);
			simulateFrame(16.67);
			simulateFrame(55);

			const metrics = get(performanceMetrics);
			expect(metrics.jankCount).toBe(3);
		});
	});

	describe('Dropped frames detection', () => {
		it('should count dropped frames when frame takes too long', () => {
			performanceActions.start();

			// Build baseline
			for (let i = 0; i < 10; i++) {
				simulateFrame(16.67);
			}

			// Simulate a frame that takes 50ms (should have dropped ~2 frames at 60fps)
			// 50ms / 16.67ms = ~3 frames worth of time, so dropped = 3 - 1 = 2
			simulateFrame(50);

			const metrics = get(performanceMetrics);
			expect(metrics.droppedFrames).toBeGreaterThan(0);
		});

		it('should not count dropped frames for normal frame times', () => {
			performanceActions.start();

			// Simulate stable 60fps - no dropped frames
			for (let i = 0; i < 30; i++) {
				simulateFrame(16.67);
			}

			const metrics = get(performanceMetrics);
			expect(metrics.droppedFrames).toBe(0);
		});

		it('should accumulate dropped frames count', () => {
			performanceActions.start();

			// Build baseline
			for (let i = 0; i < 5; i++) {
				simulateFrame(16.67);
			}

			// Multiple long frames
			simulateFrame(50);
			for (let i = 0; i < 5; i++) {
				simulateFrame(16.67);
			}
			simulateFrame(50);

			const metrics = get(performanceMetrics);
			expect(metrics.droppedFrames).toBeGreaterThan(2);
		});
	});

	describe('Frame time variance calculation', () => {
		it('should have low variance for stable frame rates', () => {
			performanceActions.start();

			// Simulate very stable 60fps
			for (let i = 0; i < 30; i++) {
				simulateFrame(16.67);
			}

			const metrics = get(performanceMetrics);
			expect(metrics.frameTimeVariance).toBeLessThan(1);
		});

		it('should have higher variance for unstable frame rates', () => {
			performanceActions.start();

			// Simulate unstable frame rate (alternating between fast and slow)
			for (let i = 0; i < 15; i++) {
				simulateFrame(10); // Fast frame
				simulateFrame(30); // Slow frame
			}

			const metrics = get(performanceMetrics);
			expect(metrics.frameTimeVariance).toBeGreaterThan(5);
		});
	});

	describe('Derived stores', () => {
		describe('currentFps', () => {
			it('should derive from performanceMetrics.fps', () => {
				performanceMetrics.set({ ...defaultMetrics, fps: 59.5 });
				expect(get(currentFps)).toBe(59.5);
			});

			it('should update when performanceMetrics changes', () => {
				performanceMetrics.set({ ...defaultMetrics, fps: 30 });
				expect(get(currentFps)).toBe(30);

				performanceMetrics.set({ ...defaultMetrics, fps: 60 });
				expect(get(currentFps)).toBe(60);
			});
		});

		describe('isPerformanceGood', () => {
			it('should be true when fps >= 55 and not janky', () => {
				performanceMetrics.set({
					...defaultMetrics,
					fps: 60,
					isJanky: false
				});
				expect(get(isPerformanceGood)).toBe(true);
			});

			it('should be false when fps < 55', () => {
				performanceMetrics.set({
					...defaultMetrics,
					fps: 45,
					isJanky: false
				});
				expect(get(isPerformanceGood)).toBe(false);
			});

			it('should be false when janky even with good fps', () => {
				performanceMetrics.set({
					...defaultMetrics,
					fps: 60,
					isJanky: true
				});
				expect(get(isPerformanceGood)).toBe(false);
			});

			it('should be true at exactly 55 fps with no jank', () => {
				performanceMetrics.set({
					...defaultMetrics,
					fps: 55,
					isJanky: false
				});
				expect(get(isPerformanceGood)).toBe(true);
			});
		});
	});

	describe('Rolling window behavior', () => {
		it('should use rolling window for FPS calculation', () => {
			performanceActions.start();

			// Fill the window with slow frames (30fps)
			for (let i = 0; i < 60; i++) {
				simulateFrame(33.33);
			}

			const slowMetrics = get(performanceMetrics);
			expect(slowMetrics.fps).toBeGreaterThan(25);
			expect(slowMetrics.fps).toBeLessThan(35);

			// Now add fast frames - FPS should gradually increase
			for (let i = 0; i < 30; i++) {
				simulateFrame(16.67);
			}

			const mixedMetrics = get(performanceMetrics);
			// Should be somewhere between 30 and 60 due to rolling window
			expect(mixedMetrics.fps).toBeGreaterThan(30);
			expect(mixedMetrics.fps).toBeLessThan(60);
		});
	});

	describe('Edge cases', () => {
		it('should handle very fast frame rates (> 60fps)', () => {
			performanceActions.start();

			// Simulate 120fps (8.33ms per frame)
			for (let i = 0; i < 60; i++) {
				simulateFrame(8.33);
			}

			const metrics = get(performanceMetrics);
			expect(metrics.fps).toBeGreaterThan(100);
		});

		it('should handle very slow frame rates (< 10fps)', () => {
			performanceActions.start();

			// Simulate 10fps (100ms per frame)
			for (let i = 0; i < 10; i++) {
				simulateFrame(100);
			}

			const metrics = get(performanceMetrics);
			expect(metrics.fps).toBeGreaterThan(8);
			expect(metrics.fps).toBeLessThan(12);
		});

		it('should handle single frame', () => {
			performanceActions.start();
			simulateFrame(16.67);

			// After first frame, we don't have enough data for meaningful stats
			// but it should not crash
			const metrics = get(performanceMetrics);
			expect(metrics).toBeDefined();
		});
	});
});
