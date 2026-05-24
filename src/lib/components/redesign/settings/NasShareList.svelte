<script lang="ts">
  import { tick } from 'svelte';
  import {
    nasShares,
    nasSharesLoading,
    lastShareResult,
    discoveredDevices,
    discoveryLoading,
    discoveryError,
    browsedShares,
    browseLoading,
    browseError,
    lastBrowseHostAttempt,
    mountInFlight,
    shareOperationInProgress,
    sourcesActions,
    type NasShare,
    type AddNasShareRequest,
  } from '$lib/stores/sources';
  import NasShareRow from './NasShareRow.svelte';
  import NasResultStrip from './NasResultStrip.svelte';
  import NasDiscoverPanel from './NasDiscoverPanel.svelte';

  /**
   * Respect the user's OS-level reduced-motion preference. Used by
   * handleUseShare() to pick scroll behavior. Defensive against
   * non-browser environments and tests where matchMedia may be stubbed.
   */
  function getReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  // ── UI state ──────────────────────────────────────────────────────────────
  let showAddForm = $state(false);
  let showDiscover = $state(false);

  // DOM handle for the add-form card. Used by handleUseShare() to scroll the
  // form into view after opening it — on the 1920x440 LCD the form may be
  // below the fold and the user otherwise sees nothing happen.
  let addFormEl = $state<HTMLDivElement | null>(null);

  // Tracks whether the user has clicked "Discover" at least once. Used to
  // gate the "no devices found" empty-state so it doesn't appear before the
  // user has actually attempted a scan.
  let discoverAttempted = $state(false);

  // ── Add-form fields ───────────────────────────────────────────────────────
  let addName = $state('');
  let addIp = $state('');
  let addPath = $state('');
  let addFstype = $state<'cifs' | 'nfs'>('cifs');
  let addUsername = $state('');
  let addPassword = $state('');
  let addOptions = $state('');

  // ── Auto-clear last result after 4 s — successes only ────────────────────
  // Errors are sticky and require an explicit dismiss (per C7 spec).
  $effect(() => {
    if ($lastShareResult !== null && $lastShareResult.success === true) {
      const id = setTimeout(() => {
        sourcesActions.clearLastResult();
      }, 4000);
      return () => clearTimeout(id);
    }
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggleAddForm() {
    showAddForm = !showAddForm;
    if (!showAddForm) clearAddForm();
  }

  function clearAddForm() {
    addName = '';
    addIp = '';
    addPath = '';
    addFstype = 'cifs';
    addUsername = '';
    addPassword = '';
    addOptions = '';
  }

  function cancelAdd() {
    showAddForm = false;
    clearAddForm();
  }

  function handleAdd() {
    const req: AddNasShareRequest = {
      name: addName,
      ip: addIp,
      path: addPath,
      fstype: addFstype,
      username: addUsername || undefined,
      password: addPassword || undefined,
      options: addOptions || undefined,
    };
    sourcesActions.addShare(req);
    showAddForm = false;
    clearAddForm();
  }

  function handleMount(share: NasShare) {
    if (share.mounted) {
      sourcesActions.unmountShare(share.id);
    } else {
      sourcesActions.mountShare(share.id);
    }
  }

  function handleDelete(id: string) {
    sourcesActions.deleteShare(id);
  }

  function handleDiscover() {
    discoverAttempted = true;
    sourcesActions.discoverDevices();
  }

  function handleBrowse(ip: string) {
    sourcesActions.browseShares(ip);
  }

  function handleBrowseRetry() {
    const host = $lastBrowseHostAttempt;
    if (host !== null) {
      sourcesActions.browseShares(host);
    }
  }

  async function handleUseShare(shareName: string) {
    addPath = shareName;
    // The share was browsed from a specific host (lastBrowseHostAttempt), so
    // the IP is known — pre-fill it too. Defensive nullish-coalesce: if
    // Use-this is clickable but lastBrowseHostAttempt is somehow null,
    // leave the field as it was.
    addIp = $lastBrowseHostAttempt ?? addIp;
    showAddForm = true;
    // Wait for Svelte to flush the {#if showAddForm} block so addFormEl is
    // bound, then move focus to the first input AND scroll the card into
    // view. Focus first so the browser's auto-scroll-to-focused-element
    // doesn't clobber our explicit scrollIntoView call.
    await tick();
    addFormEl?.querySelector<HTMLInputElement>('input')?.focus();
    addFormEl?.scrollIntoView?.({
      block: 'nearest',
      behavior: getReducedMotion() ? 'auto' : 'smooth',
    });
  }

  function handleDismissResult() {
    sourcesActions.clearLastResult();
  }
</script>

<!-- ── Section ──────────────────────────────────────────────────────────── -->
<div class="nas-share-list">
  <h3 class="section-title">NAS shares</h3>

  <!-- Share rows -->
  <ul class="share-list" role="list">
    {#if $nasSharesLoading && $nasShares.length === 0}
      <li class="share-row state-msg">Loading…</li>
    {:else if $nasShares.length === 0}
      <li class="share-row state-msg">No shares configured</li>
    {:else}
      {#each $nasShares as share (share.id)}
        <NasShareRow
          {share}
          inFlight={$mountInFlight[share.id] !== undefined}
          gated={$shareOperationInProgress !== null}
          onMount={handleMount}
          onDelete={handleDelete}
        />
      {/each}
    {/if}
  </ul>

  <!-- Add-share toggle + form -->
  <button
    type="button"
    class="toggle-btn"
    class:gated={$shareOperationInProgress !== null}
    disabled={$shareOperationInProgress !== null}
    onclick={toggleAddForm}
  >
    + Add share
  </button>

  {#if showAddForm}
    <div class="add-form-card" bind:this={addFormEl}>
      <div class="field-row">
        <label for="settings-nas-add-name">Share name</label>
        <input
          id="settings-nas-add-name"
          type="text"
          class="field-input"
          data-testid="nas-add-name"
          placeholder="e.g. My NAS"
          bind:value={addName}
        />
      </div>

      <div class="field-row">
        <label for="settings-nas-add-ip">IP address</label>
        <input
          id="settings-nas-add-ip"
          type="text"
          class="field-input"
          data-testid="nas-add-ip"
          placeholder="e.g. 192.168.1.10"
          bind:value={addIp}
        />
      </div>

      <div class="field-row">
        <label for="settings-nas-add-path">Path</label>
        <input
          id="settings-nas-add-path"
          type="text"
          class="field-input"
          data-testid="nas-add-path"
          placeholder="e.g. /music"
          bind:value={addPath}
        />
      </div>

      <div class="field-row">
        <label for="settings-nas-add-fstype">File system</label>
        <select
          id="settings-nas-add-fstype"
          class="field-input"
          data-testid="nas-add-fstype"
          bind:value={addFstype}
        >
          <option value="cifs">CIFS (Samba)</option>
          <option value="nfs">NFS</option>
        </select>
      </div>

      <div class="field-row">
        <label for="settings-nas-add-username">Username (optional)</label>
        <input
          id="settings-nas-add-username"
          type="text"
          class="field-input"
          data-testid="nas-add-username"
          placeholder="Leave blank if not required"
          bind:value={addUsername}
        />
      </div>

      <div class="field-row">
        <label for="settings-nas-add-password">Password (optional)</label>
        <input
          id="settings-nas-add-password"
          type="password"
          class="field-input"
          data-testid="nas-add-password"
          placeholder="Leave blank if not required"
          bind:value={addPassword}
        />
      </div>

      <div class="field-row">
        <label for="settings-nas-add-options">Mount options (optional)</label>
        <input
          id="settings-nas-add-options"
          type="text"
          class="field-input"
          data-testid="nas-add-options"
          placeholder="e.g. vers=2.0,uid=1000"
          bind:value={addOptions}
        />
      </div>

      <div class="form-actions">
        <button type="button" class="btn-cancel" onclick={cancelAdd}>Cancel</button>
        <button
          type="button"
          class="btn-add"
          class:gated={$shareOperationInProgress !== null}
          disabled={$shareOperationInProgress !== null}
          onclick={handleAdd}
        >
          Add
        </button>
      </div>
    </div>
  {/if}

  <!-- Discover section -->
  <button type="button" class="toggle-btn" onclick={() => (showDiscover = !showDiscover)}>
    Find devices on network
  </button>

  {#if showDiscover}
    <NasDiscoverPanel
      discoveryLoading={$discoveryLoading}
      discoveryError={$discoveryError}
      discoveredDevices={$discoveredDevices}
      {discoverAttempted}
      browseLoading={$browseLoading}
      browseError={$browseError}
      browsedShares={$browsedShares}
      lastBrowseHostAttempt={$lastBrowseHostAttempt}
      onDiscover={handleDiscover}
      onBrowse={handleBrowse}
      onBrowseRetry={handleBrowseRetry}
      onUseShare={handleUseShare}
    />
  {/if}

  <!--
    Bottom strip: in-progress takes precedence over result. Sub-component
    owns the precedence logic + rendering; parent still owns the auto-clear
    timer above (which calls clearLastResult on success after 4s) and the
    dismiss callback.
  -->
  <NasResultStrip
    inProgress={$shareOperationInProgress}
    result={$lastShareResult}
    onDismiss={handleDismissResult}
  />
</div>

<style>
  .nas-share-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .section-title {
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  /* Share list */
  .share-list {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
  }

  /*
   * Empty/loading states are rendered as <li> elements that share the row
   * padding/borders, so we keep just enough of the share-row layout here for
   * those state messages. Per-row markup now lives in NasShareRow.svelte.
   */
  .share-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .state-msg {
    color: var(--color-text-secondary);
    font-size: 14px;
    justify-content: center;
  }

  /* Toggle buttons */
  .toggle-btn {
    display: inline-flex;
    align-items: center;
    min-height: var(--hit-target-min);
    padding: 0 16px;
    background: transparent;
    border: 1px solid var(--color-text-secondary);
    border-radius: var(--radius-card);
    color: var(--color-text-primary);
    font-size: 14px;
    cursor: pointer;
    margin-top: 8px;
    margin-bottom: 4px;
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  /* Add form card */
  .add-form-card {
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-card);
    padding: 16px;
    margin: 12px 0;
  }

  .field-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .field-row label {
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .field-input {
    background: var(--color-bg-base);
    color: var(--color-text-primary);
    border: 1px solid var(--color-text-secondary);
    border-radius: var(--radius-card);
    min-height: var(--hit-target-min);
    padding: 0 12px;
    font-size: 16px;
    width: 100%;
    box-sizing: border-box;
  }

  .field-input:focus {
    outline: 2px solid var(--color-accent-bright);
    outline-offset: 2px;
  }

  .form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .btn-cancel {
    min-height: var(--hit-target-min);
    padding: 0 20px;
    background: transparent;
    border: 1px solid var(--color-text-secondary);
    border-radius: var(--radius-card);
    color: var(--color-text-primary);
    font-size: 14px;
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .btn-add {
    min-height: var(--hit-target-min);
    padding: 0 20px;
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-card);
    color: var(--color-bg-base);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-add:hover {
    opacity: 0.88;
  }

  /*
   * Globally-gated state — applied to every mutation trigger while a
   * NAS mutation is in flight. Visually distinct from the in-flight
   * per-row spinner state so the user understands the difference between
   * "this row is working" and "all triggers temporarily paused".
   */
  .gated,
  .toggle-btn.gated,
  .btn-add.gated {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
