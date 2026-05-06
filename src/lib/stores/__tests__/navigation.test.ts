import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setViewActionHandlers,
  clearViewActionHandlers,
  viewActions,
} from '../navigation';

describe('navigation handler lifecycle', () => {
  beforeEach(() => {
    // Reset module-scoped handlers between tests so cases don't bleed.
    clearViewActionHandlers();
  });

  it('viewActions.tapRefresh / tapPower default to no-op when no handlers wired', () => {
    expect(() => viewActions.tapRefresh()).not.toThrow();
    expect(() => viewActions.tapPower()).not.toThrow();
  });

  it('setViewActionHandlers wires onRefresh and onPower', () => {
    const onRefresh = vi.fn();
    const onPower = vi.fn();
    setViewActionHandlers({ onRefresh, onPower });

    viewActions.tapRefresh();
    viewActions.tapPower();

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onPower).toHaveBeenCalledTimes(1);
  });

  it('setViewActionHandlers is last-writer-wins (subsequent calls overwrite)', () => {
    const first = vi.fn();
    const second = vi.fn();
    setViewActionHandlers({ onRefresh: first });
    setViewActionHandlers({ onRefresh: second });

    viewActions.tapRefresh();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clearViewActionHandlers resets handlers to no-op so stale closures are dropped', () => {
    const stale = vi.fn();
    setViewActionHandlers({ onRefresh: stale, onPower: stale });

    clearViewActionHandlers();

    viewActions.tapRefresh();
    viewActions.tapPower();
    expect(stale).not.toHaveBeenCalled();
  });
});
