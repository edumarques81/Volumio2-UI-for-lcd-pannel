import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Create mock stores using vi.hoisted
const { mockBrightness, mockIsDimmedStandby } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockBrightness: writable(100),
    mockIsDimmedStandby: writable(false)
  };
});

// Mock stores
vi.mock('$lib/stores/lcd', () => ({
  brightness: mockBrightness,
  isDimmedStandby: mockIsDimmedStandby,
  lcdActions: {
    wake: vi.fn()
  }
}));

vi.mock('$lib/stores/navigation', () => ({
  navigationActions: {
    goHome: vi.fn()
  }
}));

import StandbyOverlay from '../StandbyOverlay.svelte';
import { brightness, isDimmedStandby, lcdActions } from '$lib/stores/lcd';
import { navigationActions } from '$lib/stores/navigation';

// Helper to mock URL parameter for LCD detection
function mockUrlLayout(layout: string | null) {
  const search = layout ? `?layout=${layout}` : '';
  Object.defineProperty(window, 'location', {
    value: { search },
    writable: true
  });
}

describe('StandbyOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to LCD panel for most tests (Pi uses ?layout=lcd)
    mockUrlLayout('lcd');
    // Reset store values
    mockBrightness.set(100);
    mockIsDimmedStandby.set(false);
  });

  afterEach(() => {
    cleanup();
  });

  describe('visibility', () => {
    it('should be visible when in standby mode on LCD panel', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.classList.contains('active')).toBe(true);
    });

    it('should be hidden when not in standby mode', async () => {
      mockIsDimmedStandby.set(false);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.classList.contains('active')).toBe(false);
    });
  });

  describe('brightness dimming', () => {
    it('should apply dimming overlay when brightness < 100', async () => {
      mockBrightness.set(30);

      const { container } = render(StandbyOverlay);
      const dimmer = container.querySelector('.brightness-dimmer');
      expect(dimmer).toBeTruthy();
    });

    it('should not show dimmer at full brightness', async () => {
      mockBrightness.set(100);

      const { container } = render(StandbyOverlay);
      const dimmer = container.querySelector('.brightness-dimmer');
      expect(dimmer?.getAttribute('style')).toContain('opacity: 0');
    });

    it('should show full black at brightness 0', async () => {
      mockBrightness.set(0);

      const { container } = render(StandbyOverlay);
      const dimmer = container.querySelector('.brightness-dimmer') as HTMLElement;
      expect(dimmer.getAttribute('style')).toContain('opacity: 1');
    });
  });

  describe('touch wake behavior', () => {
    it('should wake display on touch when in standby', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');

      await fireEvent.touchStart(overlay!);

      expect(lcdActions.wake).toHaveBeenCalled();
    });

    it('should navigate to home on wake', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');

      await fireEvent.touchStart(overlay!);

      expect(navigationActions.goHome).toHaveBeenCalled();
    });

    it('should prevent event propagation (click-through)', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');

      const event = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true
      });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      overlay?.dispatchEvent(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should NOT wake when not in standby mode', async () => {
      mockIsDimmedStandby.set(false);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');

      await fireEvent.touchStart(overlay!);

      expect(lcdActions.wake).not.toHaveBeenCalled();
      expect(navigationActions.goHome).not.toHaveBeenCalled();
    });

    it('should debounce rapid successive touches', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');

      await fireEvent.touchStart(overlay!);
      await fireEvent.touchStart(overlay!);
      await fireEvent.touchStart(overlay!);

      expect(lcdActions.wake).toHaveBeenCalledTimes(1);
    });

    it('should wake on mousedown when in standby', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');

      await fireEvent.mouseDown(overlay!);

      expect(lcdActions.wake).toHaveBeenCalled();
      expect(navigationActions.goHome).toHaveBeenCalled();
    });
  });

  describe('CSS properties for touch handling', () => {
    it('should have active class when in standby (enables touch-action: none)', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay') as HTMLElement;
      expect(overlay.classList.contains('active')).toBe(true);
    });

    it('should have active class when in standby (enables pointer-events: all)', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay') as HTMLElement;
      expect(overlay.classList.contains('active')).toBe(true);
    });

    it('should not have active class when not in standby (pointer-events: none)', async () => {
      mockIsDimmedStandby.set(false);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay') as HTMLElement;
      expect(overlay.classList.contains('active')).toBe(false);
    });
  });

  describe('z-index ordering', () => {
    it('should have both overlay elements present', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');
      const dimmer = container.querySelector('.brightness-dimmer');

      expect(overlay).toBeTruthy();
      expect(dimmer).toBeTruthy();
    });

    it('should have brightness dimmer with opacity based on brightness', async () => {
      mockBrightness.set(50);

      const { container } = render(StandbyOverlay);
      const dimmer = container.querySelector('.brightness-dimmer') as HTMLElement;

      expect(dimmer.getAttribute('style')).toContain('opacity: 0.5');
    });
  });

  describe('non-LCD device behavior (remote browsers)', () => {
    beforeEach(() => {
      mockUrlLayout(null);
    });

    it('should NOT show standby overlay on non-LCD devices', async () => {
      mockIsDimmedStandby.set(true);

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');
      expect(overlay).toBeFalsy();
    });

    it('should NOT show brightness dimmer on non-LCD devices', async () => {
      mockBrightness.set(50);

      const { container } = render(StandbyOverlay);
      const dimmer = container.querySelector('.brightness-dimmer');
      expect(dimmer).toBeFalsy();
    });

    it('should NOT wake on touch when on non-LCD device', async () => {
      mockIsDimmedStandby.set(true);

      render(StandbyOverlay);

      const event = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(event);

      expect(lcdActions.wake).not.toHaveBeenCalled();
      expect(navigationActions.goHome).not.toHaveBeenCalled();
    });
  });
});
