import { describe, it, expect, vi } from 'vitest';
import { startKioskHeartbeat } from '$lib/kioskHeartbeat';

function makeFakeWindow() {
  let nextId = 1;
  const scheduled = new Map<number, FrameRequestCallback>();
  const win = {
    __stellarHeartbeat: undefined as number | undefined,
    requestAnimationFrame(cb: FrameRequestCallback): number {
      const id = nextId++;
      scheduled.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id: number): void {
      scheduled.delete(id);
    },
    // test helper: run one pending frame
    flushFrame() {
      const entries = [...scheduled.entries()];
      scheduled.clear();
      for (const [, cb] of entries) cb(performance.now());
    },
    pendingCount(): number {
      return scheduled.size;
    },
  };
  return win as unknown as Window & {
    __stellarHeartbeat?: number;
    flushFrame(): void;
    pendingCount(): number;
  };
}

describe('startKioskHeartbeat', () => {
  it('seeds the heartbeat immediately (before any frame runs)', () => {
    const win = makeFakeWindow();
    startKioskHeartbeat(win);
    expect(typeof win.__stellarHeartbeat).toBe('number');
  });

  it('updates the timestamp on each animation frame', () => {
    const win = makeFakeWindow();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1000);
    startKioskHeartbeat(win);
    expect(win.__stellarHeartbeat).toBe(1000);

    now.mockReturnValue(2000);
    win.flushFrame();
    expect(win.__stellarHeartbeat).toBe(2000);

    now.mockReturnValue(3000);
    win.flushFrame();
    expect(win.__stellarHeartbeat).toBe(3000);
    now.mockRestore();
  });

  it('keeps rescheduling frames (loop is continuous)', () => {
    const win = makeFakeWindow();
    startKioskHeartbeat(win);
    expect(win.pendingCount()).toBe(1);
    win.flushFrame();
    expect(win.pendingCount()).toBe(1); // rescheduled itself
  });

  it('stop() cancels the loop so no further frames run', () => {
    const win = makeFakeWindow();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(5000);
    const stop = startKioskHeartbeat(win);
    stop();
    expect(win.pendingCount()).toBe(0);

    now.mockReturnValue(6000);
    win.flushFrame(); // nothing scheduled → no-op
    expect(win.__stellarHeartbeat).toBe(5000); // unchanged after stop
    now.mockRestore();
  });
});
