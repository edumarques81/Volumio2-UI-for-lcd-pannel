<script lang="ts">
  // ── Props ────────────────────────────────────────────────────────────────
  // Sticky error banner shared by the discovery and browse error blocks.
  // Both call sites use the same visual + role="alert" markup, just with
  // different test ids, error strings, and retry callbacks.
  interface Props {
    message: string;
    onRetry: () => void;
    bannerTestId: string;
    retryTestId: string;
    /** Disable the retry button — used by browse-retry when no host has been attempted. */
    retryDisabled?: boolean;
  }

  let {
    message,
    onRetry,
    bannerTestId,
    retryTestId,
    retryDisabled = false,
  }: Props = $props();
</script>

<div role="alert" class="error-banner" data-testid={bannerTestId}>
  <span class="error-message">{message}</span>
  <button
    type="button"
    class="btn-retry"
    data-testid={retryTestId}
    disabled={retryDisabled}
    onclick={onRetry}
  >
    Retry
  </button>
</div>

<style>
  .error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--radius-card);
    background: rgba(208, 69, 69, 0.18);
    color: #ff8080;
    font-size: 14px;
  }

  .error-message {
    flex: 1;
    min-width: 0;
  }

  .btn-retry {
    min-height: var(--hit-target-min);
    padding: 0 16px;
    background: transparent;
    border: 1px solid #ff8080;
    border-radius: var(--radius-card);
    color: #ff8080;
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-retry:hover {
    background: rgba(208, 69, 69, 0.12);
  }

  .btn-retry[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
