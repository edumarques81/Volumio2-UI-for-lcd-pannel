/**
 * Toast store — single source of truth for surface-level user notifications.
 *
 * Extracted from `src/lib/components/Toast.svelte` so non-UI code (stores,
 * services, action handlers) can surface toasts without reaching across
 * component boundaries. The visible component still owns the rendering and
 * the `pushToastMessage` socket listener (including the issue-upsert side
 * effect for `error` toasts) — it now subscribes to this store and routes
 * its public API through `toastActions.*`.
 *
 * Semantics preserved verbatim from the previous in-component implementation:
 *   - Same dedupe window (60 s, by `${type}:${title}` key)
 *   - Same throttle (3 s between non-success toasts)
 *   - Same MAX_TOASTS (3) truncation
 *   - Same default durations (4000 ms)
 */

import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
}

export const TOAST_DEDUPE_WINDOW_MS = 60_000;
export const TOAST_THROTTLE_MS = 3_000;
export const TOAST_MAX_VISIBLE = 3;
export const TOAST_DEFAULT_DURATION_MS = 4_000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export const toasts = writable<ToastMessage[]>([]);

let nextId = 0;
const recentToasts = new Map<string, number>();
let lastToastTime = 0;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getDedupeKey(type: ToastType, title: string): string {
  return `${type}:${title.toLowerCase().replace(/\s+/g, '_')}`;
}

function shouldShowToast(type: ToastType, title: string): boolean {
  const now = Date.now();
  const key = getDedupeKey(type, title);

  // Dedupe applies to all gated types (error/warning) — we only call this
  // for those types today, but keep the symmetric guard in case it expands.
  const lastShown = recentToasts.get(key);
  if (lastShown !== undefined && now - lastShown < TOAST_DEDUPE_WINDOW_MS) {
    return false;
  }

  // Throttle applies to non-success toasts only.
  if (type !== 'success' && now - lastToastTime < TOAST_THROTTLE_MS) {
    return false;
  }

  return true;
}

function recordToast(type: ToastType, title: string): void {
  const now = Date.now();
  const key = getDedupeKey(type, title);
  recentToasts.set(key, now);
  lastToastTime = now;

  // Garbage-collect old dedupe entries to keep the map bounded.
  for (const [k, ts] of recentToasts.entries()) {
    if (now - ts > TOAST_DEDUPE_WINDOW_MS) {
      recentToasts.delete(k);
    }
  }
}

function addToast(
  type: ToastType,
  title: string,
  message?: string,
  duration: number = TOAST_DEFAULT_DURATION_MS,
): void {
  // Apply dedupe/throttle gate to errors and warnings only.
  // Info and success toasts are not gated — preserves prior in-component
  // semantics where MAX_TOASTS truncation was the only ceiling on success.
  if ((type === 'error' || type === 'warning') && !shouldShowToast(type, title)) {
    return;
  }

  const id = nextId++;
  const toast: ToastMessage = { id, type, title, message, duration };

  toasts.update((current) => {
    const updated = [...current, toast];
    return updated.slice(-TOAST_MAX_VISIBLE);
  });

  recordToast(type, title);

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
}

function dismiss(id: number): void {
  toasts.update((current) => current.filter((t) => t.id !== id));
}

function clearAll(): void {
  toasts.set([]);
  recentToasts.clear();
  lastToastTime = 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const toastActions = {
  error(title: string, message?: string, duration: number = 5_000): void {
    addToast('error', title, message, duration);
  },
  warning(title: string, message?: string, duration: number = TOAST_DEFAULT_DURATION_MS): void {
    addToast('warning', title, message, duration);
  },
  info(title: string, message?: string, duration: number = TOAST_DEFAULT_DURATION_MS): void {
    addToast('info', title, message, duration);
  },
  success(title: string, message?: string, duration: number = TOAST_DEFAULT_DURATION_MS): void {
    addToast('success', title, message, duration);
  },
  dismiss,
  clearAll,
} as const;
