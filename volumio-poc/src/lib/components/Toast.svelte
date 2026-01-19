<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { socketService } from '$lib/services/socket';
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

  /**
   * Add a toast message
   */
  function addToast(
    type: ToastMessage['type'],
    title: string,
    message?: string,
    duration = 3000
  ) {
    const id = nextId++;
    const toast: ToastMessage = { id, type, title, message, duration };

    toasts.update((t) => [...t, toast]);

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
      if (data) {
        const type = mapVolumioType(data.type);
        addToast(type, data.title || '', data.message || data.body, 4000);
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
        <Icon name={getIcon(toast.type)} size={20} />
      </div>
      <div class="toast-content">
        <div class="toast-title">{toast.title}</div>
        {#if toast.message}
          <div class="toast-message">{toast.message}</div>
        {/if}
      </div>
      <button class="toast-close" on:click={() => removeToast(toast.id)} aria-label="Dismiss">
        <Icon name="x" size={16} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    max-width: 400px;
    width: 90%;
  }

  .toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    border: 1px solid rgba(255, 255, 255, 0.1);
    animation: slideIn 0.3s ease-out;
    pointer-events: auto;
  }

  @keyframes slideIn {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .toast--success .toast-icon {
    color: var(--color-success, #34c759);
  }

  .toast--error .toast-icon {
    color: var(--color-error, #ff3b30);
  }

  .toast--warning .toast-icon {
    color: #ffcc00;
  }

  .toast--info .toast-icon {
    color: var(--color-accent);
  }

  .toast-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-title {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .toast-message {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    margin-top: 2px;
  }

  .toast-close {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .toast-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  /* LCD mode - position at top */
  @media (max-height: 500px) {
    .toast-container {
      bottom: auto;
      top: 60px;
    }
  }
</style>
