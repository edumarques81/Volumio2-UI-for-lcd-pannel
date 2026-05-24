<script lang="ts">
  import type { SourceResult } from '$lib/stores/sources';

  // ── Props ────────────────────────────────────────────────────────────────
  // The bottom strip: in-progress takes precedence over result. While a
  // mutation is in flight (normal 3-7s case), we show the working-state strip;
  // only once the operation finishes (success / failure / 8s timeout fallback)
  // does the result strip take over.
  //
  // The success auto-clear timer lives in the parent (it touches store
  // actions). This component is pure render + dismiss-callback.
  type InProgressAction = 'add' | 'mount' | 'unmount' | 'delete';

  interface Props {
    inProgress: { action: InProgressAction; startedAt: number } | null;
    result: SourceResult | null;
    onDismiss: () => void;
  }

  let { inProgress, result, onDismiss }: Props = $props();

  // User-facing copy for each in-progress action. Matches the existing
  // single-character ellipsis convention used elsewhere in this file
  // ("Loading…", "Discovering…"). Kept generic — no share name in v1.
  function progressLabel(action: InProgressAction): string {
    switch (action) {
      case 'add':
        return 'Adding NAS share…';
      case 'mount':
        return 'Mounting share…';
      case 'unmount':
        return 'Unmounting share…';
      case 'delete':
        return 'Removing share…';
    }
  }
</script>

{#if inProgress !== null}
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    class="result-strip in-progress"
    data-testid="nas-operation-in-progress"
  >
    <span class="strip-spinner" aria-hidden="true"></span>
    <span class="result-text">
      {progressLabel(inProgress.action)}
    </span>
  </div>
{:else if result !== null}
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    class="result-strip"
    class:success={result.success}
    class:failure={!result.success}
    data-testid="nas-result-strip"
  >
    <span class="result-text">
      {result.success
        ? (result.message ?? 'Done')
        : (result.error ?? 'Something went wrong')}
    </span>
    {#if !result.success}
      <button
        type="button"
        class="btn-dismiss"
        aria-label="Dismiss"
        data-testid="nas-result-dismiss"
        onclick={onDismiss}
      >
        ×
      </button>
    {/if}
  </div>
{/if}

<style>
  .result-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--radius-card);
    margin-top: 8px;
    font-size: 14px;
  }

  .result-text {
    flex: 1;
    min-width: 0;
  }

  .result-strip.success {
    background: rgba(34, 166, 109, 0.18);
    color: #4ade80;
  }

  .result-strip.failure {
    background: rgba(208, 69, 69, 0.18);
    color: #ff8080;
  }

  /*
   * In-progress variant — neutral "working" tone, distinct from the
   * success-green / failure-red palette. Reuses the existing .result-strip
   * box model so vertical rhythm matches.
   */
  .result-strip.in-progress {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-primary);
  }

  .strip-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border: 2px solid rgba(255, 255, 255, 0.18);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: nas-spin 800ms linear infinite;
  }

  @keyframes nas-spin {
    to { transform: rotate(360deg); }
  }

  .btn-dismiss {
    width: 44px;
    height: 44px;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    border-radius: var(--radius-card);
    flex-shrink: 0;
  }

  .btn-dismiss:hover {
    background: rgba(255, 255, 255, 0.08);
  }
</style>
