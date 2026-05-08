<script lang="ts">
  import {
    nasShares,
    nasSharesLoading,
    lastShareResult,
    discoveredDevices,
    discoveryLoading,
    browsedShares,
    browseLoading,
    sourcesActions,
    type NasShare,
    type AddNasShareRequest,
  } from '$lib/stores/sources';

  // ── UI state ──────────────────────────────────────────────────────────────
  let showAddForm = $state(false);
  let showDiscover = $state(false);

  // ── Add-form fields ───────────────────────────────────────────────────────
  let addName = $state('');
  let addIp = $state('');
  let addPath = $state('');
  let addFstype = $state<'cifs' | 'nfs'>('cifs');
  let addUsername = $state('');
  let addPassword = $state('');
  let addOptions = $state('');

  // ── Auto-clear last result after 4 s ─────────────────────────────────────
  $effect(() => {
    if ($lastShareResult !== null) {
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
    sourcesActions.discoverDevices();
  }

  function handleBrowse(ip: string) {
    sourcesActions.browseShares(ip);
  }

  function handleUseShare(shareName: string) {
    addPath = shareName;
    showAddForm = true;
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
        <li class="share-row">
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
              aria-label={share.mounted ? 'Unmount' : 'Mount'}
              onclick={() => handleMount(share)}
            >
              {share.mounted ? '⏏' : '⏩'}
            </button>
            <button
              type="button"
              class="icon-btn delete-btn"
              aria-label="Delete"
              onclick={() => handleDelete(share.id)}
            >
              ✕
            </button>
          </div>
        </li>
      {/each}
    {/if}
  </ul>

  <!-- Add-share toggle + form -->
  <button type="button" class="toggle-btn" onclick={toggleAddForm}>
    + Add share
  </button>

  {#if showAddForm}
    <div class="add-form-card">
      <div class="field-row">
        <label for="settings-nas-add-name">Share name</label>
        <input
          id="settings-nas-add-name"
          type="text"
          class="field-input"
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
          placeholder="e.g. /music"
          bind:value={addPath}
        />
      </div>

      <div class="field-row">
        <label for="settings-nas-add-fstype">File system</label>
        <select id="settings-nas-add-fstype" class="field-input" bind:value={addFstype}>
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
          placeholder="e.g. vers=2.0,uid=1000"
          bind:value={addOptions}
        />
      </div>

      <div class="form-actions">
        <button type="button" class="btn-cancel" onclick={cancelAdd}>Cancel</button>
        <button type="button" class="btn-add" onclick={handleAdd}>Add</button>
      </div>
    </div>
  {/if}

  <!-- Discover section -->
  <button type="button" class="toggle-btn" onclick={() => (showDiscover = !showDiscover)}>
    Find devices on network
  </button>

  {#if showDiscover}
    <div class="discover-card">
      <button type="button" class="btn-discover" onclick={handleDiscover}>
        {$discoveryLoading ? 'Discovering…' : 'Discover'}
      </button>

      {#if $discoveredDevices.length > 0}
        <ul class="device-list" role="list">
          {#each $discoveredDevices as device (device.ip)}
            <li class="device-row">
              <span class="device-name">{device.name}</span>
              <span class="device-ip">{device.ip}</span>
              <button
                type="button"
                class="btn-browse"
                aria-label={`Browse ${device.name}`}
                onclick={() => handleBrowse(device.ip)}
              >
                {$browseLoading ? '…' : 'Browse'}
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      {#if $browsedShares.length > 0}
        <ul class="browsed-list" role="list">
          {#each $browsedShares as share (share.name)}
            <li class="browsed-row">
              <span class="browsed-name">{share.name}</span>
              <button
                type="button"
                class="btn-use"
                onclick={() => handleUseShare(share.name)}
              >
                Use this
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  <!-- Last result strip -->
  {#if $lastShareResult !== null}
    <div
      role="status"
      class="result-strip"
      class:success={$lastShareResult.success}
      class:failure={!$lastShareResult.success}
    >
      {$lastShareResult.success
        ? ($lastShareResult.message ?? 'Done')
        : ($lastShareResult.error ?? 'Something went wrong')}
    </div>
  {/if}
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

  .state-msg {
    color: var(--color-text-secondary);
    font-size: 14px;
    justify-content: center;
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

  .delete-btn {
    color: #ff8080;
    border-color: rgba(208, 69, 69, 0.3);
  }

  .delete-btn:hover {
    background: rgba(208, 69, 69, 0.12);
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

  /* Discover card */
  .discover-card {
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-card);
    padding: 16px;
    margin: 12px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .btn-discover {
    min-height: var(--hit-target-min);
    padding: 0 20px;
    background: transparent;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-card);
    color: var(--color-accent);
    font-size: 14px;
    cursor: pointer;
    align-self: flex-start;
  }

  .btn-discover:hover {
    background: rgba(201, 169, 97, 0.08);
  }

  .device-list,
  .browsed-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .device-row,
  .browsed-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: var(--radius-card);
    background: rgba(255, 255, 255, 0.03);
  }

  .device-name,
  .browsed-name {
    flex: 1;
    color: var(--color-text-primary);
    font-size: 14px;
  }

  .device-ip {
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .btn-browse,
  .btn-use {
    min-height: var(--hit-target-min);
    padding: 0 16px;
    background: transparent;
    border: 1px solid var(--color-text-secondary);
    border-radius: var(--radius-card);
    color: var(--color-text-primary);
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-browse:hover,
  .btn-use:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  /* Result strip */
  .result-strip {
    padding: 8px 12px;
    border-radius: var(--radius-card);
    margin-top: 8px;
    font-size: 14px;
  }

  .result-strip.success {
    background: rgba(34, 166, 109, 0.18);
    color: #4ade80;
  }

  .result-strip.failure {
    background: rgba(208, 69, 69, 0.18);
    color: #ff8080;
  }
</style>
