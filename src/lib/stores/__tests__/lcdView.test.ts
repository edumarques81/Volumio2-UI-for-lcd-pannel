import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

type Handler = (payload: unknown) => void;
const handlers = new Map<string, Handler>();

vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    })
  }
}));

import { socketService } from '$lib/services/socket';
import { currentView } from '../navigation';
import { deviceType } from '../device';
import { initLcdViewStore, cleanupLcdViewStore, type LcdViewPayload } from '../lcdView';

/** Deliver a `pushLcdView` frame as the backend would. */
function pushLcdView(payload: LcdViewPayload) {
  const handler = handlers.get('pushLcdView');
  if (!handler) throw new Error('pushLcdView handler was never registered');
  handler(payload);
}

const emitted = () => (socketService.emit as ReturnType<typeof vi.fn>).mock.calls;

describe('LCD view store', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    cleanupLcdViewStore();
    currentView.set('player');
    deviceType.set('lcd-panel');
  });

  afterEach(() => {
    cleanupLcdViewStore();
  });

  describe('on the LCD panel', () => {
    beforeEach(() => initLcdViewStore());

    it('applies a remote-driven view change to currentView', () => {
      pushLcdView({ view: 'vu-meter', previousView: 'player' });
      expect(get(currentView)).toBe('vu-meter');
    });

    it('returns to the previous view when the remote sends it back', () => {
      pushLcdView({ view: 'vu-meter', previousView: 'player' });
      pushLcdView({ view: 'player', previousView: 'vu-meter' });
      expect(get(currentView)).toBe('player');
    });

    it('reports local navigation to the backend', () => {
      currentView.set('vu-meter');
      expect(emitted()).toContainEqual(['lcdSetView', 'vu-meter']);
    });

    // The critical one: without a guard, applying a remote frame writes
    // currentView, the subscription sees it, and the kiosk reports the change
    // straight back to the backend that just sent it.
    it('does NOT report a view it was told to apply', () => {
      pushLcdView({ view: 'vu-meter', previousView: 'player' });
      const setViewEmits = emitted().filter(([event]) => event === 'lcdSetView');
      expect(setViewEmits).toHaveLength(0);
    });

    it('still reports local navigation that happens after a remote change', () => {
      pushLcdView({ view: 'vu-meter', previousView: 'player' });
      currentView.set('library');
      expect(emitted()).toContainEqual(['lcdSetView', 'library']);
    });

    it('ignores a frame for the view already showing', () => {
      currentView.set('vu-meter');
      vi.clearAllMocks();
      pushLcdView({ view: 'vu-meter', previousView: 'player' });
      expect(get(currentView)).toBe('vu-meter');
      expect(emitted().filter(([e]) => e === 'lcdSetView')).toHaveLength(0);
    });

    it('asks the backend which view it should be on at init', () => {
      expect(emitted()).toContainEqual(['getLcdView']);
    });

    it('ignores an unknown view name rather than blanking the screen', () => {
      pushLcdView({ view: 'spectrum' as never, previousView: 'player' });
      expect(get(currentView)).toBe('player');
    });

    it('is idempotent — a second init does not double-register', () => {
      initLcdViewStore();
      vi.clearAllMocks();
      currentView.set('queue');
      expect(emitted().filter(([e]) => e === 'lcdSetView')).toHaveLength(1);
    });
  });

  describe('on a non-LCD client', () => {
    // A desktop browser shares this frontend bundle. It must never drive or
    // follow the Pi's panel, or opening the site on a laptop would yank the
    // kiosk's screen around.
    beforeEach(() => {
      deviceType.set('desktop');
      initLcdViewStore();
    });

    it('does not report its own navigation', () => {
      currentView.set('vu-meter');
      expect(emitted().filter(([e]) => e === 'lcdSetView')).toHaveLength(0);
    });

    it('does not follow a remote view change', () => {
      pushLcdView({ view: 'vu-meter', previousView: 'player' });
      expect(get(currentView)).toBe('player');
    });
  });
});
