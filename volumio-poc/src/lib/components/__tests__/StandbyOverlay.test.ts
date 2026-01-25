import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Mock stores
vi.mock('$lib/stores/lcd', () => ({
  lcdState: {
    subscribe: vi.fn(),
    set: vi.fn()
  },
  brightness: {
    subscribe: vi.fn(),
    set: vi.fn()
  },
  isStandby: {
    subscribe: vi.fn()
  },
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
import { lcdState, brightness, isStandby, lcdActions } from '$lib/stores/lcd';
import { navigationActions } from '$lib/stores/navigation';

describe('StandbyOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('should be visible when in standby mode', async () => {
      // Mock isStandby as true
      vi.mocked(isStandby.subscribe).mockImplementation((callback) => {
        callback(true);
        return () => {};
      });
      vi.mocked(brightness.subscribe).mockImplementation((callback) => {
        callback(100);
        return () => {};
      });

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.classList.contains('active')).toBe(true);
    });

    it('should be hidden when not in standby mode', async () => {
      vi.mocked(isStandby.subscribe).mockImplementation((callback) => {
        callback(false);
        return () => {};
      });
      vi.mocked(brightness.subscribe).mockImplementation((callback) => {
        callback(100);
        return () => {};
      });

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.classList.contains('active')).toBe(false);
    });
  });

  describe('brightness dimming', () => {
    it('should apply dimming overlay when brightness < 100', async () => {
      vi.mocked(isStandby.subscribe).mockImplementation((callback) => {
        callback(false);
        return () => {};
      });
      vi.mocked(brightness.subscribe).mockImplementation((callback) => {
        callback(30); // 30% brightness = 70% opacity dimmer
        return () => {};
      });

      const { container } = render(StandbyOverlay);
      const dimmer = container.querySelector('.brightness-dimmer');
      expect(dimmer).toBeTruthy();
    });

    it('should not show dimmer at full brightness', async () => {
      vi.mocked(isStandby.subscribe).mockImplementation((callback) => {
        callback(false);
        return () => {};
      });
      vi.mocked(brightness.subscribe).mockImplementation((callback) => {
        callback(100);
        return () => {};
      });

      const { container } = render(StandbyOverlay);
      const dimmer = container.querySelector('.brightness-dimmer');
      // Dimmer should have 0 opacity at 100% brightness
      expect(dimmer?.getAttribute('style')).toContain('opacity: 0');
    });
  });

  describe('touch wake behavior', () => {
    it('should wake display on touch when in standby', async () => {
      vi.mocked(isStandby.subscribe).mockImplementation((callback) => {
        callback(true);
        return () => {};
      });
      vi.mocked(brightness.subscribe).mockImplementation((callback) => {
        callback(100);
        return () => {};
      });

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');

      await fireEvent.touchStart(overlay!);

      expect(lcdActions.wake).toHaveBeenCalled();
    });

    it('should navigate to home on wake', async () => {
      vi.mocked(isStandby.subscribe).mockImplementation((callback) => {
        callback(true);
        return () => {};
      });
      vi.mocked(brightness.subscribe).mockImplementation((callback) => {
        callback(100);
        return () => {};
      });

      const { container } = render(StandbyOverlay);
      const overlay = container.querySelector('.standby-overlay');

      await fireEvent.touchStart(overlay!);

      expect(navigationActions.goHome).toHaveBeenCalled();
    });

    it('should prevent event propagation (click-through)', async () => {
      vi.mocked(isStandby.subscribe).mockImplementation((callback) => {
        callback(true);
        return () => {};
      });
      vi.mocked(brightness.subscribe).mockImplementation((callback) => {
        callback(100);
        return () => {};
      });

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
  });
});
