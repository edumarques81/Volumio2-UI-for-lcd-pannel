<script lang="ts">
  import type { NasShare } from '$lib/stores/sources';

  // ── Props ────────────────────────────────────────────────────────────────
  // Stateless row: parent owns the store wiring (mountInFlight,
  // shareOperationInProgress) and passes the resolved booleans + callbacks.
  interface Props {
    share: NasShare;
    inFlight: boolean;
    gated: boolean;
    onMount: (share: NasShare) => void;
    onDelete: (id: string) => void;
  }

  let { share, inFlight, gated, onMount, onDelete }: Props = $props();
</script>

<li class="share-row" data-testid="nas-share-{share.id}">
  <div class="share-info">
    <span class="share-name">{share.name}</span>
    <span class="share-path">{share.path}</span>
  </div>
  <span class="status-badge" class:mounted={share.mounted} class:unmounted={!share.mounted}>
    {share.mounted ? 'mounted' : 'unmounted'}
  </span>
  <div class="share-actions">
    <button
      type="button"
      class="icon-btn"
      class:gated={gated && !inFlight}
      aria-label={share.mounted ? 'Unmount' : 'Mount'}
      aria-busy={inFlight}
      disabled={inFlight || gated}
      data-testid={share.mounted ? `nas-share-unmount-${share.id}` : `nas-share-mount-${share.id}`}
      onclick={() => onMount(share)}
    >
      {#if inFlight}
        <span
          class="spinner"
          aria-hidden="true"
          data-testid={`nas-share-mount-spinner-${share.id}`}
        ></span>
      {:else}
        {share.mounted ? '⏏' : '⏩'}
      {/if}
    </button>
    <button
      type="button"
      class="icon-btn delete-btn"
      class:gated
      aria-label="Delete"
      disabled={gated}
      data-testid="nas-share-delete-{share.id}"
      onclick={() => onDelete(share.id)}
    >
      ✕
    </button>
  </div>
</li>

<style>
  .share-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .share-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .share-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .share-name {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .share-path {
    color: var(--color-text-secondary);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Status badge */
  .status-badge {
    flex-shrink: 0;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
  }

  .status-badge.mounted {
    background: rgba(34, 166, 109, 0.18);
    color: #4ade80;
  }

  .status-badge.unmounted {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-secondary);
  }

  /* Action buttons */
  .share-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-card);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: 16px;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .icon-btn[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .delete-btn {
    color: #ff8080;
    border-color: rgba(208, 69, 69, 0.3);
  }

  .delete-btn:hover {
    background: rgba(208, 69, 69, 0.12);
  }

  /* Globally-gated state */
  .gated,
  .icon-btn.gated {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.18);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: nas-spin 800ms linear infinite;
  }

  @keyframes nas-spin {
    to { transform: rotate(360deg); }
  }
</style>
