<script lang="ts">
  import { tick } from 'svelte';
  import {
    ingestStatus,
    ingestPreview,
    ingestResult,
    ingestError,
    ingestPhase,
    ingestAvailable,
    ingestBusy,
    ingestCanCommit,
    ingestActions,
    type IngestItem,
  } from '$lib/stores/ingest';

  // The drop-box trigger. Two taps by design: the first runs the dry run and
  // shows what would land, the second commits it. Neither the plan nor the
  // result is local to this screen — the backend broadcasts both, so a run
  // started on the phone shows up here and vice versa.

  let cancelButton: HTMLButtonElement | undefined = $state();

  const count = $derived($ingestStatus?.count ?? 0);
  const items = $derived($ingestPreview?.items ?? []);
  const summary = $derived($ingestPreview?.summary);
  const result = $derived($ingestResult);

  const statusLine = $derived.by(() => {
    if ($ingestPhase === 'previewing') return 'Checking the inbox…';
    if ($ingestPhase === 'committing') return 'Importing — this can take a few minutes.';
    if ($ingestStatus?.busy) return 'An import is already running.';
    if (count === 0) return 'Nothing waiting. Drop albums into the Inbox share.';
    return `${count} ${count === 1 ? 'folder' : 'folders'} waiting in the inbox.`;
  });

  $effect(() => {
    if ($ingestPreview) {
      tick().then(() => cancelButton?.focus());
    }
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if ($ingestPreview) {
      e.preventDefault();
      ingestActions.cancel();
    } else if (result) {
      e.preventDefault();
      ingestActions.dismiss();
    }
  }

  /** Items are shown worst-first: a refusal is the thing worth reading. */
  const ORDER: Record<string, number> = {
    refused: 0,
    skipped: 1,
    'would-ingest': 2,
    ingested: 3,
  };

  function sorted(list: IngestItem[]): IngestItem[] {
    return [...list].sort(
      (a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)
    );
  }

  /** One line of detail under the folder name, or '' when there is nothing to add. */
  function detail(item: IngestItem): string {
    const bits: string[] = [];
    if (item.reason) bits.push(item.reason);
    if (item.audioFiles) {
      bits.push(`${item.audioFiles} ${item.audioFiles === 1 ? 'track' : 'tracks'}`);
    }
    if (item.tagged.length) bits.push(`tagged from ${item.mbRelease || 'MusicBrainz'}`);
    if (item.art) bits.push(`art: ${item.art}`);
    if (item.tagFailures.length) bits.push(`${item.tagFailures.length} tag(s) did not stick`);
    if (item.md5Mismatches.length) {
      bits.push(`${item.md5Mismatches.length} audio checksum mismatch`);
    }
    return bits.join(' · ');
  }

  // The backend's `reason` often spells the destination out ("would land at …"),
  // so only add the arrow line when it would say something new.
  function showTarget(item: IngestItem): boolean {
    return !!item.target && !detail(item).includes(item.target);
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if $ingestAvailable}
  <div class="block" data-testid="ingest-panel">
    <p class="block-label">Add music</p>

    <p class="status-line" data-testid="ingest-status">{statusLine}</p>

    <button
      type="button"
      class="maintenance-btn"
      data-testid="ingest-preview"
      disabled={$ingestBusy || count === 0}
      onclick={ingestActions.preview}
    >
      {$ingestPhase === 'previewing' ? 'Checking…' : 'Review import'}
    </button>

    <button
      type="button"
      class="link-btn"
      data-testid="ingest-refresh"
      disabled={$ingestBusy}
      onclick={ingestActions.requestStatus}
    >
      Check inbox again
    </button>

    {#if $ingestError}
      <p class="error" data-testid="ingest-error" role="alert">
        {$ingestError.error}
      </p>
    {/if}
  </div>
{/if}

<!-- Preview: the plan, awaiting confirmation. -->
{#if $ingestPreview}
  <div class="backdrop" role="presentation" onclick={ingestActions.cancel} onkeydown={undefined}></div>
  <div class="positioner">
    <div
      class="panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingest-dialog-title"
      tabindex="-1"
      data-testid="ingest-preview-dialog"
      onclick={(e) => e.stopPropagation()}
      onkeydown={undefined}
    >
      <h2 id="ingest-dialog-title" class="panel-title">Import from inbox</h2>
      <p class="panel-sub">
        {summary?.wouldIngest ?? 0} of {summary?.total ?? 0} will be imported.
        Nothing is copied until you confirm.
      </p>

      <ul class="item-list" data-testid="ingest-item-list">
        {#each sorted(items) as item (item.name)}
          <li class="item item-{item.status}">
            <span class="item-name">{item.name}</span>
            <span class="item-status">{item.status}</span>
            {#if detail(item)}
              <span class="item-detail">{detail(item)}</span>
            {/if}
            {#if showTarget(item)}
              <span class="item-target">→ {item.target}</span>
            {/if}
          </li>
        {/each}
      </ul>

      <div class="actions">
        <button
          bind:this={cancelButton}
          type="button"
          class="cancel"
          data-testid="ingest-cancel"
          onclick={ingestActions.cancel}
        >
          Cancel
        </button>
        <button
          type="button"
          class="confirm"
          data-testid="ingest-confirm"
          disabled={!$ingestCanCommit}
          onclick={ingestActions.commit}
        >
          {$ingestPhase === 'committing' ? 'Importing…' : 'Import'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Result: what actually happened. -->
{#if result}
  <div class="backdrop" role="presentation" onclick={ingestActions.dismiss} onkeydown={undefined}></div>
  <div class="positioner">
    <div
      class="panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingest-result-title"
      tabindex="-1"
      data-testid="ingest-result-dialog"
      onclick={(e) => e.stopPropagation()}
      onkeydown={undefined}
    >
      <h2 id="ingest-result-title" class="panel-title">
        {result.error ? 'Import failed' : 'Import finished'}
      </h2>
      <p class="panel-sub">
        {#if result.error}
          {result.error}
        {:else}
          {result.summary.ingested} imported · {result.summary.refused} refused ·
          {result.summary.skipped} skipped
          {#if result.summary.tagFailures}
            · {result.summary.tagFailures} tag failure(s)
          {/if}
        {/if}
      </p>

      {#if result.summary.audioAltered}
        <p class="error" role="alert">
          {result.summary.audioAltered} file(s) changed audio checksum — check before playing.
        </p>
      {/if}

      <ul class="item-list" data-testid="ingest-result-list">
        {#each sorted(result.items) as item (item.name)}
          <li class="item item-{item.status}">
            <span class="item-name">{item.name}</span>
            <span class="item-status">{item.status}</span>
            {#if detail(item)}
              <span class="item-detail">{detail(item)}</span>
            {/if}
          </li>
        {/each}
      </ul>

      <div class="actions">
        <button
          type="button"
          class="confirm"
          data-testid="ingest-dismiss"
          onclick={ingestActions.dismiss}
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .block {
    margin-bottom: 24px;
  }

  .block-label {
    color: var(--color-text-secondary);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 8px;
  }

  .status-line {
    color: var(--color-text-secondary);
    font-size: 14px;
    margin: 0 0 8px;
  }

  .maintenance-btn {
    width: 100%;
    min-height: var(--hit-target-min);
    border: 1px solid var(--color-text-secondary);
    background: transparent;
    color: var(--color-text-primary);
    border-radius: var(--radius-card);
    padding: 0 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    transition: background 150ms ease;
  }

  .maintenance-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.04);
  }

  .maintenance-btn:disabled,
  .link-btn:disabled,
  .confirm:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .link-btn {
    margin-top: 8px;
    min-height: var(--hit-target-min);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 13px;
    font-family: inherit;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
  }

  .error {
    color: #f06060;
    font-size: 13px;
    margin: 8px 0 0;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 999;
  }

  .positioner {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    z-index: 1000;
    pointer-events: none;
  }

  /* The LCD is only 440px tall, so the dialog caps its height and the item
     list is what scrolls — the title and the buttons must never leave. */
  .panel {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-base);
    border: 1px solid var(--color-text-secondary);
    border-radius: var(--radius-card);
    padding: 20px 24px;
    min-width: 420px;
    max-width: 720px;
    max-height: 88vh;
  }

  .panel-title {
    color: var(--color-text-primary);
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 4px;
  }

  .panel-sub {
    color: var(--color-text-secondary);
    font-size: 14px;
    margin: 0 0 12px;
  }

  .item-list {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    overflow-y: auto;
    min-height: 0;
  }

  .item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 12px;
    padding: 8px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .item-name {
    color: var(--color-text-primary);
    font-size: 14px;
    word-break: break-word;
  }

  .item-status {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    align-self: start;
    white-space: nowrap;
  }

  .item-refused .item-status,
  .item-skipped .item-status {
    color: #f06060;
  }

  .item-ingested .item-status,
  .item-would-ingest .item-status {
    color: var(--color-accent-bright);
  }

  .item-detail,
  .item-target {
    grid-column: 1 / -1;
    color: var(--color-text-secondary);
    font-size: 12px;
    word-break: break-word;
  }

  .actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .cancel,
  .confirm {
    border-radius: var(--radius-card);
    min-height: var(--hit-target-min);
    padding: 0 20px;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }

  .cancel:focus-visible,
  .confirm:focus-visible {
    outline: 2px solid var(--color-accent-bright);
    outline-offset: 2px;
  }

  .cancel {
    background: transparent;
    color: var(--color-text-primary);
    border: 1px solid var(--color-text-secondary);
  }

  .confirm {
    background: var(--color-accent);
    color: var(--color-bg-base);
    border: 1px solid var(--color-accent-bright);
  }
</style>
