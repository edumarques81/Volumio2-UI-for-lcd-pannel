<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { socketService } from '$lib/services/socket';
  import { issueActions } from '$lib/stores/issues';
  import Icon from './Icon.svelte';

  /**
   * Toast message interface
   */
  interface ToastMessage {
    id: number;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message?: string;
    duration: number;
  }

  // Toast store
  const toasts = writable<ToastMessage[]>([]);
  let nextId = 0;

  // Dedupe tracking
  const recentToasts = new Map<string, number>(); // key -> timestamp
  const DEDUPE_WINDOW_MS = 60000; // 60 seconds

  // Throttle tracking
  let lastToastTime = 0;
  const THROTTLE_MS = 3000; // 3 seconds between toasts

  // Max toasts visible
  const MAX_TOASTS = 3;

  /**
   * Generate dedupe key from toast
   */
  function getDedupeKey(type: string, title: string): string {
    return `${type}:${title.toLowerCase().replace(/\s+/g, '_')}`;
  }

  /**
   * Check if toast should be shown (dedupe + throttle)
   */
  function shouldShowToast(type: string, title: string): boolean {
    const now = Date.now();
    const key = getDedupeKey(type, title);

    // Check dedupe
    const lastShown = recentToasts.get(key);
    if (lastShown && now - lastShown < DEDUPE_WINDOW_MS) {
      console.log(`Toast deduped: ${key}`);
      return false;
    }

    // Check throttle (only for non-success toasts)
    if (type !== 'success' && now - lastToastTime < THROTTLE_MS) {
      console.log(`Toast throttled: ${key}`);
      return false;
    }

    return true;
  }

  /**
   * Record that we showed a toast
   */
  function recordToast(type: string, title: string) {
    const now = Date.now();
    const key = getDedupeKey(type, title);
    recentToasts.set(key, now);
    lastToastTime = now;

    // Clean old entries
    for (const [k, ts] of recentToasts.entries()) {
      if (now - ts > DEDUPE_WINDOW_MS) {
        recentToasts.delete(k);
      }
    }
  }

  /**
   * Add a toast message
   */
  function addToast(
    type: ToastMessage['type'],
    title: string,
    message?: string,
    duration = 4000
  ) {
    console.log('[Toast] addToast called:', { type, title, message, duration });

    // Apply dedupe/throttle for errors and warnings
    if ((type === 'error' || type === 'warning') && !shouldShowToast(type, title)) {
      console.log('[Toast] Toast blocked by dedupe/throttle');
      return;
    }

    const id = nextId++;
    console.log('[Toast] Creating toast with id:', id);
    const toast: ToastMessage = { id, type, title, message, duration };

    toasts.update((t) => {
      const updated = [...t, toast];
      // Keep only the most recent MAX_TOASTS
      return updated.slice(-MAX_TOASTS);
    });

    recordToast(type, title);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }

  /**
   * Remove a toast message
   */
  function removeToast(id: number) {
    toasts.update((t) => t.filter((toast) => toast.id !== id));
  }

  // Socket listener for backend toast messages
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    // Listen for toast messages from Volumio backend
    unsubscribe = socketService.on<any>('pushToastMessage', (data) => {
      console.log('[Toast] Received pushToastMessage:', data);
      if (data) {
        const type = mapVolumioType(data.type);
        console.log('[Toast] Mapped type:', type);

        // For errors, also create an issue
        if (type === 'error') {
          const showToast = issueActions.upsertIssue({
            id: `toast:${data.title?.replace(/\s+/g, '_').toLowerCase() || Date.now()}`,
            domain: 'system',
            severity: 'error',
            title: data.title || 'Error',
            detail: data.message || data.body,
            ts: Date.now(),
            persistent: false,
            source: 'volumio-toast',
          });

          // Only show toast if issue store says we should (it also handles dedupe)
          if (showToast) {
            addToast(type, data.title || '', data.message || data.body, 5000);
          }
        } else {
          // For non-errors, just show toast normally
          addToast(type, data.title || '', data.message || data.body, 4000);
        }
      }
    });
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  /**
   * Map Volumio toast types to our types
   */
  function mapVolumioType(type: string): ToastMessage['type'] {
    switch (type) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Get icon for toast type
   */
  function getIcon(type: ToastMessage['type']): string {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'x-circle';
      case 'warning':
        return 'alert-triangle';
      default:
        return 'info';
    }
  }
</script>

<div class="toast-container" role="status" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast--{toast.type}" role="alert">
      <div class="toast-icon">
        <Icon name={getIcon(toast.type)} size={18} />
      </div>
      <div class="toast-content">
        <div class="toast-title">{toast.title}</div>
        {#if toast.message}
          <div class="toast-message">{toast.message}</div>
        {/if}
      </div>
      <button class="toast-close" on:click={() => removeToast(toast.id)} aria-label="Dismiss">
        <Icon name="x" size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 60px;
    right: 20px;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    max-width: 360px;
    width: calc(100% - 40px);
  }

  .toast {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(30, 30, 35, 0.9);
    backdrop-filter: blur(16px) saturate(150%);
    -webkit-backdrop-filter: blur(16px) saturate(150%);
    border-radius: 14px;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.08);
    animation: slideIn 0.25s ease-out;
    pointer-events: auto;
  }

  @keyframes slideIn {
    from {
      transform: translateX(20px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  /* Severity accent border */
  .toast--success {
    border-left: 3px solid #34c759;
  }

  .toast--error {
    border-left: 3px solid #ff3b30;
  }

  .toast--warning {
    border-left: 3px solid #ffcc00;
  }

  .toast--info {
    border-left: 3px solid #007aff;
  }

  .toast--success .toast-icon {
    color: #34c759;
  }

  .toast--error .toast-icon {
    color: #ff3b30;
  }

  .toast--warning .toast-icon {
    color: #ffcc00;
  }

  .toast--info .toast-icon {
    color: #007aff;
  }

  .toast-icon {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    line-height: 1.3;
  }

  .toast-message {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-top: 2px;
    line-height: 1.4;
  }

  .toast-close {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all 0.2s;
    margin: -4px -4px -4px 0;
  }

  .toast-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  /* LCD mode - smaller toasts */
  @media (max-height: 500px) {
    .toast-container {
      top: 50px;
      max-width: 300px;
    }

    .toast {
      padding: 10px 12px;
      gap: 8px;
    }

    .toast-title {
      font-size: 12px;
    }

    .toast-message {
      font-size: 11px;
    }
  }
</style>
