<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { socketService } from '$lib/services/socket';
  import { IconNas, IconDelete, IconClose, IconSearch } from '$lib/components/icons';

  // ── Types matching backend sources/types.go ──
  interface NasShare {
    id: string;
    name: string;
    ip: string;
    path: string;
    fstype: string; // "cifs" or "nfs"
    username?: string;
    options?: string;
    mounted: boolean;
    mountPoint: string;
  }

  interface NasDevice {
    name: string;
    ip: string;
    hostname?: string;
  }

  interface ShareInfo {
    name: string;
    type: string;
    comment?: string;
    writable: boolean;
  }

  interface SourceResult {
    success: boolean;
    message?: string;
    error?: string;
  }

  interface DiscoverResult {
    devices: NasDevice[];
    error?: string;
  }

  interface BrowseSharesResult {
    shares: ShareInfo[];
    error?: string;
  }

  // ── State ──
  const shares = writable<NasShare[]>([]);
  const discoveredDevices = writable<NasDevice[]>([]);
  const browsedShares = writable<ShareInfo[]>([]);
  const loading = writable(false);
  const discovering = writable(false);
  const browsingShares = writable(false);
  const operationResult = writable<SourceResult | null>(null);

  let showAddForm = false;
  let showDeleteConfirm: string | null = null;

  // ── Add NAS Form fields ──
  let formName = '';
  let formIP = '';
  let formPath = '';
  let formFSType: 'cifs' | 'nfs' = 'cifs';
  let formUsername = '';
  let formPassword = '';

  // ── Socket listeners ──
  function onPushListNasShares(data: NasShare[]) {
    shares.set(data || []);
    loading.set(false);
  }

  function onPushNasShareResult(data: SourceResult) {
    operationResult.set(data);
    // Auto-clear result after 4s
    setTimeout(() => operationResult.set(null), 4000);
  }

  function onPushNasDevices(data: DiscoverResult) {
    discovering.set(false);
    if (data.error) {
      operationResult.set({ success: false, error: data.error });
      setTimeout(() => operationResult.set(null), 4000);
      return;
    }
    discoveredDevices.set(data.devices || []);
  }

  function onPushBrowseNasShares(data: BrowseSharesResult) {
    browsingShares.set(false);
    if (data.error) {
      operationResult.set({ success: false, error: data.error });
      setTimeout(() => operationResult.set(null), 4000);
      return;
    }
    browsedShares.set(data.shares?.filter(s => s.type === 'disk') || []);
  }

  // ── Actions ──
  function fetchShares() {
    loading.set(true);
    socketService.emit('getListNasShares');
  }

  function toggleMount(share: NasShare) {
    const event = share.mounted ? 'unmountNasShare' : 'mountNasShare';
    socketService.emit(event, { id: share.id });
  }

  function addShare() {
    if (!formName.trim() || !formIP.trim() || !formPath.trim()) return;

    socketService.emit('addNasShare', {
      name: formName.trim(),
      ip: formIP.trim(),
      path: formPath.trim(),
      fstype: formFSType,
      username: formUsername.trim() || undefined,
      password: formPassword.trim() || undefined,
    });
    resetForm();
  }

  function confirmDeleteShare(shareId: string) {
    showDeleteConfirm = shareId;
  }

  function deleteShare(shareId: string) {
    socketService.emit('deleteNasShare', { id: shareId });
    showDeleteConfirm = null;
  }

  function cancelDelete() {
    showDeleteConfirm = null;
  }

  function discoverDevices() {
    discovering.set(true);
    discoveredDevices.set([]);
    socketService.emit('discoverNasDevices');
  }

  function selectDiscoveredDevice(device: NasDevice) {
    formIP = device.ip;
    formName = formName || device.name || device.hostname || '';
    // Browse shares on this device
    browsingShares.set(true);
    browsedShares.set([]);
    socketService.emit('browseNasShares', { host: device.ip });
  }

  function selectBrowsedShare(share: ShareInfo) {
    formPath = share.name;
  }

  function resetForm() {
    showAddForm = false;
    formName = '';
    formIP = '';
    formPath = '';
    formFSType = 'cifs';
    formUsername = '';
    formPassword = '';
    discoveredDevices.set([]);
    browsedShares.set([]);
  }

  onMount(() => {
    socketService.on('pushListNasShares', onPushListNasShares);
    socketService.on('pushNasShareResult', onPushNasShareResult);
    socketService.on('pushNasDevices', onPushNasDevices);
    socketService.on('pushBrowseNasShares', onPushBrowseNasShares);
    fetchShares();
  });

  onDestroy(() => {
    socketService.off('pushListNasShares', onPushListNasShares);
    socketService.off('pushNasShareResult', onPushNasShareResult);
    socketService.off('pushNasDevices', onPushNasDevices);
    socketService.off('pushBrowseNasShares', onPushBrowseNasShares);
  });
</script>

<div class="nas-manager">
  <!-- Result banner -->
  {#if $operationResult}
    <div class="result-banner" class:error={!$operationResult.success}>
      {$operationResult.success ? $operationResult.message || 'Done' : $operationResult.error || 'Operation failed'}
    </div>
  {/if}

  <!-- Configured shares list -->
  {#if $loading}
    <div class="setting-row">
      <span class="setting-label muted">Loading shares…</span>
    </div>
  {:else if $shares.length === 0}
    <div class="setting-row">
      <span class="setting-label muted">No NAS shares configured</span>
    </div>
  {:else}
    {#each $shares as share (share.id)}
      <div class="share-row">
        <div class="share-info">
          <div class="share-name">
            <IconNas size={14} />
            <span>{share.name}</span>
          </div>
          <span class="share-detail">{share.ip}:/{share.path} ({share.fstype.toUpperCase()})</span>
        </div>
        <div class="share-actions">
          {#if showDeleteConfirm === share.id}
            <div class="confirm-delete">
              <span class="confirm-text">Delete?</span>
              <button class="confirm-btn yes" on:click={() => deleteShare(share.id)}>Yes</button>
              <button class="confirm-btn no" on:click={cancelDelete}>No</button>
            </div>
          {:else}
            <button
              class="mount-btn"
              class:mounted={share.mounted}
              on:click={() => toggleMount(share)}
            >
              {share.mounted ? 'Unmount' : 'Mount'}
            </button>
            <button class="icon-btn delete" on:click={() => confirmDeleteShare(share.id)} aria-label="Delete share {share.name}">
              <IconDelete size={14} />
            </button>
          {/if}
        </div>
      </div>
    {/each}
  {/if}

  <!-- Action buttons -->
  <div class="setting-row actions">
    {#if !showAddForm}
      <button class="action-btn" on:click={() => { showAddForm = true; }}>
        + Add NAS
      </button>
      <button class="action-btn" on:click={discoverDevices} disabled={$discovering}>
        <IconSearch size={12} />
        {$discovering ? 'Scanning…' : 'Scan Network'}
      </button>
    {/if}
  </div>

  <!-- Discovered devices -->
  {#if $discoveredDevices.length > 0 && !showAddForm}
    <div class="discovered-section">
      <span class="sub-header">Discovered Devices</span>
      {#each $discoveredDevices as device}
        <button
          class="discovered-device"
          on:click={() => { showAddForm = true; selectDiscoveredDevice(device); }}
        >
          <span class="device-name">{device.name || device.hostname || device.ip}</span>
          <span class="device-ip">{device.ip}</span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Add NAS form -->
  {#if showAddForm}
    <div class="add-form">
      <div class="form-header">
        <span class="sub-header">Add NAS Share</span>
        <button class="icon-btn" on:click={resetForm} aria-label="Close add form">
          <IconClose size={14} />
        </button>
      </div>

      <div class="form-field">
        <label for="nas-name">Name</label>
        <input id="nas-name" type="text" bind:value={formName} placeholder="My NAS" />
      </div>

      <div class="form-field">
        <label for="nas-fstype">Type</label>
        <select id="nas-fstype" bind:value={formFSType}>
          <option value="cifs">CIFS (Windows/Samba)</option>
          <option value="nfs">NFS</option>
        </select>
      </div>

      <div class="form-field">
        <label for="nas-ip">Host / IP</label>
        <div class="input-with-btn">
          <input id="nas-ip" type="text" bind:value={formIP} placeholder="192.168.1.100" />
          <button
            class="browse-btn"
            on:click={() => { if (formIP.trim()) { browsingShares.set(true); browsedShares.set([]); socketService.emit('browseNasShares', { host: formIP.trim(), username: formUsername.trim() || undefined, password: formPassword.trim() || undefined }); } }}
            disabled={!formIP.trim() || $browsingShares}
          >
            {$browsingShares ? '…' : 'Browse'}
          </button>
        </div>
      </div>

      <div class="form-field">
        <label for="nas-path">Share Path</label>
        {#if $browsedShares.length > 0}
          <select id="nas-path" bind:value={formPath}>
            <option value="">Select a share…</option>
            {#each $browsedShares as s}
              <option value={s.name}>{s.name}{s.comment ? ` — ${s.comment}` : ''}</option>
            {/each}
          </select>
        {:else}
          <input id="nas-path" type="text" bind:value={formPath} placeholder="music" />
        {/if}
      </div>

      {#if formFSType === 'cifs'}
        <div class="form-field">
          <label for="nas-username">Username <span class="optional">(optional)</span></label>
          <input id="nas-username" type="text" bind:value={formUsername} placeholder="guest" />
        </div>

        <div class="form-field">
          <label for="nas-password">Password <span class="optional">(optional)</span></label>
          <input id="nas-password" type="password" bind:value={formPassword} />
        </div>
      {/if}

      <div class="form-actions">
        <button class="action-btn primary" on:click={addShare} disabled={!formName.trim() || !formIP.trim() || !formPath.trim()}>
          Add Share
        </button>
        <button class="action-btn" on:click={resetForm}>
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .nas-manager {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .result-banner {
    padding: 8px 12px;
    border-radius: var(--md-shape-xs, 4px);
    font-size: 12px;
    font-weight: 500;
    background: rgba(129, 199, 132, 0.15);
    color: var(--stellar-status-online, #81C784);
  }
  .result-banner.error {
    background: rgba(255, 180, 171, 0.15);
    color: var(--md-error, #FFB4AB);
  }

  .share-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: var(--md-shape-xs, 4px);
    min-height: 44px;
    gap: 8px;
  }

  .share-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .share-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--md-on-surface);
  }

  .share-detail {
    font-size: 11px;
    color: var(--md-outline);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .share-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .mount-btn {
    padding: 4px 12px;
    border-radius: var(--md-shape-full, 9999px);
    border: 1px solid var(--md-outline-variant);
    background: transparent;
    color: var(--md-on-surface-variant);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    min-height: 32px;
    transition: all 200ms ease-out;
  }
  .mount-btn.mounted {
    background: rgba(129, 199, 132, 0.15);
    border-color: var(--stellar-status-online, #81C784);
    color: var(--stellar-status-online, #81C784);
  }
  .mount-btn:hover {
    background: rgba(255, 177, 200, 0.06);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    color: var(--md-outline);
    cursor: pointer;
    border-radius: 50%;
    transition: all 200ms ease-out;
  }
  .icon-btn:hover {
    color: var(--md-on-surface);
    background: rgba(255, 177, 200, 0.06);
  }
  .icon-btn.delete:hover {
    color: var(--md-error, #FFB4AB);
  }

  .confirm-delete {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .confirm-text {
    font-size: 11px;
    color: var(--md-error, #FFB4AB);
    font-weight: 600;
  }
  .confirm-btn {
    padding: 4px 10px;
    border-radius: var(--md-shape-full, 9999px);
    border: 1px solid var(--md-outline-variant);
    background: transparent;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    min-height: 28px;
    transition: all 200ms ease-out;
  }
  .confirm-btn.yes {
    color: var(--md-error, #FFB4AB);
    border-color: var(--md-error, #FFB4AB);
  }
  .confirm-btn.yes:hover {
    background: rgba(255, 180, 171, 0.15);
  }
  .confirm-btn.no {
    color: var(--md-on-surface-variant);
  }
  .confirm-btn.no:hover {
    background: rgba(255, 177, 200, 0.06);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    min-height: 44px;
    gap: 12px;
  }
  .setting-row.actions {
    gap: 8px;
    justify-content: flex-start;
  }

  .setting-label.muted {
    color: var(--md-outline);
    font-size: 11px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--md-shape-full, 9999px);
    border: 1px solid var(--md-outline-variant);
    background: transparent;
    color: var(--md-on-surface-variant);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease-out;
    min-height: 36px;
  }
  .action-btn:hover:not(:disabled) {
    background: rgba(255, 177, 200, 0.06);
    color: var(--md-primary);
    border-color: var(--md-primary);
  }
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .action-btn.primary {
    background: var(--md-primary-container, #7B2949);
    color: var(--md-on-primary-container, #FFD9E3);
    border-color: transparent;
  }
  .action-btn.primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .discovered-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 2px;
  }

  .sub-header {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--md-outline);
    padding: 6px 8px 4px;
  }

  .discovered-device {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border: none;
    background: none;
    color: var(--md-on-surface);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    border-radius: var(--md-shape-xs, 4px);
    min-height: 44px;
    text-align: left;
    transition: background 200ms ease-out;
    width: 100%;
  }
  .discovered-device:hover {
    background: rgba(255, 177, 200, 0.06);
  }
  .device-name {
    font-weight: 500;
  }
  .device-ip {
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
    color: var(--md-outline);
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(26, 17, 20, 0.4);
    border-radius: var(--md-shape-xs, 4px);
  }

  .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form-field label {
    font-size: 11px;
    font-weight: 600;
    color: var(--md-outline);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .form-field .optional {
    text-transform: none;
    font-weight: 400;
    letter-spacing: 0;
  }
  .form-field input,
  .form-field select {
    padding: 8px 10px;
    border: 1px solid var(--md-outline-variant);
    border-radius: var(--md-shape-xs, 4px);
    background: rgba(26, 17, 20, 0.6);
    color: var(--md-on-surface);
    font-family: inherit;
    font-size: 14px;
    min-height: 44px;
    outline: none;
    transition: border-color 200ms ease-out;
  }
  .form-field input:focus,
  .form-field select:focus {
    border-color: var(--md-primary, #FFB1C8);
  }
  .form-field input::placeholder {
    color: var(--md-outline);
    opacity: 0.5;
  }

  .input-with-btn {
    display: flex;
    gap: 6px;
  }
  .input-with-btn input {
    flex: 1;
  }
  .browse-btn {
    padding: 8px 12px;
    border: 1px solid var(--md-outline-variant);
    border-radius: var(--md-shape-xs, 4px);
    background: transparent;
    color: var(--md-on-surface-variant);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    transition: all 200ms ease-out;
    white-space: nowrap;
  }
  .browse-btn:hover:not(:disabled) {
    background: rgba(255, 177, 200, 0.06);
    border-color: var(--md-primary);
    color: var(--md-primary);
  }
  .browse-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-actions {
    display: flex;
    gap: 8px;
    padding-top: 4px;
  }
</style>
