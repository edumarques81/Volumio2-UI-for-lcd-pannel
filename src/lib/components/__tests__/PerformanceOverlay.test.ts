import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';

// Use vi.hoisted to ensure stores are available before mocks are hoisted
const { stores, mockActions } = vi.hoisted(() => {
	const { writable } = require('svelte/store');
	return {
		stores: {
			performanceMetrics: writable({
				fps: 60,
				frameTime: 16.67,
				frameTimeVariance: 1.5,
				droppedFrames: 0,
				jankCount: 0,
				isJanky: false
			}),
			fpsEnabled: writable(true)
		},
		mockActions: {
			start: vi.fn(),
			stop: vi.fn(),
			toggle: vi.fn(),
			reset: vi.fn()
		}
	};
});

// Mock the performance store
vi.mock('$lib/stores/performance', () => ({
	performanceMetrics: stores.performanceMetrics,
	fpsEnabled: stores.fpsEnabled,
	performanceActions: mockActions
}));

// Import component after mocks
import PerformanceOverlay from '../PerformanceOverlay.svelte';

describe('PerformanceOverlay component', () => {
	const defaultMetrics = {
		fps: 60,
		frameTime: 16.67,
		frameTimeVariance: 1.5,
		droppedFrames: 0,
		jankCount: 0,
		isJanky: false
	};

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset stores to default values
		stores.performanceMetrics.set(defaultMetrics);
		stores.fpsEnabled.set(true);
	});

	afterEach(() => {
		cleanup();
	});

	describe('Visibility', () => {
		it('should render when fpsEnabled is true', () => {
			stores.fpsEnabled.set(true);
			render(PerformanceOverlay);

			expect(screen.getByText('FPS')).toBeInTheDocument();
		});

		it('should not render when fpsEnabled is false', () => {
			stores.fpsEnabled.set(false);
			render(PerformanceOverlay);

			expect(screen.queryByText('FPS')).not.toBeInTheDocument();
		});
	});

	describe('FPS Display', () => {
		it('should display current FPS value', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, fps: 59.5 });
			render(PerformanceOverlay);

			expect(screen.getByText('60')).toBeInTheDocument(); // Rounded
		});

		it('should display FPS label', () => {
			render(PerformanceOverlay);
			expect(screen.getByText('FPS')).toBeInTheDocument();
		});

		it('should update FPS display when store changes', async () => {
			render(PerformanceOverlay);

			// Initially 60
			expect(screen.getByText('60')).toBeInTheDocument();

			// Update store
			stores.performanceMetrics.set({ ...defaultMetrics, fps: 30 });

			// Wait for reactivity
			await waitFor(() => {
				expect(screen.getByText('30')).toBeInTheDocument();
			});
		});
	});

	describe('Frame Time Display', () => {
		it('should display frame time in milliseconds', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, frameTime: 16.67 });
			render(PerformanceOverlay);

			expect(screen.getByText('16.67ms')).toBeInTheDocument();
		});

		it('should display frame time label', () => {
			render(PerformanceOverlay);
			expect(screen.getByText('Frame:')).toBeInTheDocument();
		});
	});

	describe('Variance Display', () => {
		it('should display frame time variance', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, frameTimeVariance: 2.5 });
			render(PerformanceOverlay);

			expect(screen.getByText('2.5ms')).toBeInTheDocument();
		});

		it('should display variance label', () => {
			render(PerformanceOverlay);
			expect(screen.getByText('Var:')).toBeInTheDocument();
		});
	});

	describe('Jank Indicator', () => {
		it('should show jank count when jank has occurred', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, jankCount: 5 });
			render(PerformanceOverlay);

			expect(screen.getByText('Jank:')).toBeInTheDocument();
			expect(screen.getByText('5')).toBeInTheDocument();
		});

		it('should not show jank indicator when jankCount is 0', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, jankCount: 0 });
			render(PerformanceOverlay);

			expect(screen.queryByText('Jank:')).not.toBeInTheDocument();
		});
	});

	describe('Dropped Frames Indicator', () => {
		it('should show dropped frames count when frames have been dropped', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, droppedFrames: 10 });
			render(PerformanceOverlay);

			expect(screen.getByText('Dropped:')).toBeInTheDocument();
			expect(screen.getByText('10')).toBeInTheDocument();
		});

		it('should not show dropped indicator when droppedFrames is 0', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, droppedFrames: 0 });
			render(PerformanceOverlay);

			expect(screen.queryByText('Dropped:')).not.toBeInTheDocument();
		});
	});

	describe('FPS Color Coding', () => {
		it('should apply green color for good FPS (>= 55)', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, fps: 60 });
			render(PerformanceOverlay);

			const fpsValue = screen.getByText('60');
			expect(fpsValue).toHaveStyle({ color: 'rgb(74, 222, 128)' }); // #4ade80
		});

		it('should apply yellow color for moderate FPS (30-54)', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, fps: 45 });
			render(PerformanceOverlay);

			const fpsValue = screen.getByText('45');
			expect(fpsValue).toHaveStyle({ color: 'rgb(251, 191, 36)' }); // #fbbf24
		});

		it('should apply red color for low FPS (< 30)', () => {
			stores.performanceMetrics.set({ ...defaultMetrics, fps: 20 });
			render(PerformanceOverlay);

			const fpsValue = screen.getByText('20');
			expect(fpsValue).toHaveStyle({ color: 'rgb(239, 68, 68)' }); // #ef4444
		});
	});

	describe('Control Buttons', () => {
		it('should have a Reset button', () => {
			render(PerformanceOverlay);
			expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
		});

		it('should have a Close button', () => {
			render(PerformanceOverlay);
			expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
		});

		it('should call performanceActions.reset when Reset is clicked', async () => {
			render(PerformanceOverlay);

			const resetButton = screen.getByRole('button', { name: /reset/i });
			await fireEvent.click(resetButton);

			expect(mockActions.reset).toHaveBeenCalled();
		});

		it('should call performanceActions.stop when Close is clicked', async () => {
			render(PerformanceOverlay);

			const closeButton = screen.getByRole('button', { name: /close/i });
			await fireEvent.click(closeButton);

			expect(mockActions.stop).toHaveBeenCalled();
		});
	});

	describe('Position prop', () => {
		it('should position in top-right by default', () => {
			render(PerformanceOverlay);

			const overlay = document.querySelector('.performance-overlay');
			expect(overlay).toHaveStyle({ top: '8px', right: '8px' });
		});

		it('should position in top-left when specified', () => {
			render(PerformanceOverlay, { props: { position: 'top-left' } });

			const overlay = document.querySelector('.performance-overlay');
			expect(overlay).toHaveStyle({ top: '8px', left: '8px' });
		});

		it('should position in bottom-left when specified', () => {
			render(PerformanceOverlay, { props: { position: 'bottom-left' } });

			const overlay = document.querySelector('.performance-overlay');
			expect(overlay).toHaveStyle({ bottom: '8px', left: '8px' });
		});

		it('should position in bottom-right when specified', () => {
			render(PerformanceOverlay, { props: { position: 'bottom-right' } });

			const overlay = document.querySelector('.performance-overlay');
			expect(overlay).toHaveStyle({ bottom: '8px', right: '8px' });
		});
	});

	describe('Graph display', () => {
		it('should not render graph when showGraph is false', () => {
			render(PerformanceOverlay, { props: { showGraph: false } });

			const svg = document.querySelector('.frame-graph');
			expect(svg).not.toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('should have accessible button labels', () => {
			render(PerformanceOverlay);

			expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
		});
	});
});
