<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { socketService } from '$lib/services/socket';
  import { issueActions } from '$lib/stores/issues';
  import { toasts, toastActions, type ToastMessage, type ToastType } from '$lib/stores/toast';
  import Icon from './Icon.svelte';

  // Socket listener for backend toast messages.
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    unsubscribe = socketService.on<any>('pushToastMessage', (data) => {
      if (!data) return;
      const type = mapVolumioType(data.type);
      const title = data.title || '';
      const message = data.message || data.body;

      // For errors, also create an issue. The issue store decides whether the
      // toast should still be shown (it has its own dedupe). Behavior matches
      // the previous in-component implementation 1:1.
      if (type === 'error') {
        const showToast = issueActions.upsertIssue({
          id: `toast:${data.title?.replace(/\s+/g, '_').toLowerCase() || Date.now()}`,
          domain: 'system',
          severity: 'error',
          title: data.title || 'Error',
          detail: message,
          ts: Date.now(),
          persistent: false,
          source: 'volumio-toast',
        });

        if (showToast) {
          toastActions.error(title, message, 5000);
        }
      } else if (type === 'warning') {
        toastActions.warning(title, message, 4000);
      } else if (type === 'success') {
        toastActions.success(title, message, 4000);
      } else {
        toastActions.info(title, message, 4000);
      }
    });
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  /** Map Volumio toast type strings to our union type. */
  function mapVolumioType(type: string): ToastType {
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

  /** Pick the icon name for a given toast type. */
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

<div class="toast-container" data-testid="toast-container" role="status" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast--{toast.type}" data-testid="toast" role="alert">
      <div class="toast-icon">
        <Icon name={getIcon(toast.type)} size={18} />
      </div>
      <div class="toast-content">
        <div class="toast-title">{toast.title}</div>
        {#if toast.message}
          <div class="toast-message">{toast.message}</div>
        {/if}
      </div>
      <button class="toast-close" on:click={() => toastActions.dismiss(toast.id)} aria-label="Dismiss">
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
