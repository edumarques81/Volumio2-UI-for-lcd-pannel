<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { outputPickerOpen, modalActions } from '$lib/stores/navigation';
  import { castState, castActive, castDevices, castDiscovering, castActions } from '$lib/stores/cast';

  /**
   * Output picker — the one place the user chooses where sound comes out.
   *
   * "Stellar DAC" is not a Cast device and never appears in a browse result;
   * it is the local MPD path, so it is rendered as a fixed first row and
   * selecting it means "stop casting". That is deliberately a `cast:stop`
   * (quit the receiver app), not a `cast:disconnect`: the user picking the
   * DAC expects the Hub to go quiet, and disconnect leaves it playing. The
   * leave-playing case is offered separately, in small type, because it is
   * the rarer intent.
   */

  let busyId = '';
  let errorMsg = '';

  // Browse on every open: devices come and go with the power strip, and a
  // list cached from an hour ago is worse than a 4s wait.
  const unsubOpen = outputPickerOpen.subscribe((open) => {
    if (!open) {
      errorMsg = '';
      busyId = '';
      return;
    }
    void castActions.listDevices();
  });
  onDestroy(unsubOpen);

  function close() {
    modalActions.closeOutput();
  }

  async function selectLocal() {
    errorMsg = '';
    if (!$castActive) {
      close();
      return;
    }
    busyId = 'local';
    const response = await castActions.stop();
    busyId = '';
    if (!response.ok) {
      errorMsg = response.error || 'Could not stop casting';
      return;
    }
    close();
  }

  async function selectDevice(id: string) {
    errorMsg = '';
    if ($castActive && $castState.deviceId === id) {
      close();
      return;
    }
    busyId = id;
    const response = await castActions.connect(id);
    busyId = '';
    if (!response.ok) {
      errorMsg = response.error || 'Could not connect to that device';
      return;
    }
    close();
  }

  async function leavePlaying() {
    errorMsg = '';
    busyId = 'disconnect';
    const response = await castActions.disconnect();
    busyId = '';
    if (!response.ok) {
      errorMsg = response.error || 'Could not disconnect';
      return;
    }
    close();
  }

  function refresh() {
    errorMsg = '';
    void castActions.listDevices();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!$outputPickerOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $outputPickerOpen}
  <div class="output-picker" data-testid="output-picker" role="dialog" aria-modal="true" aria-label="Audio output">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="backdrop" data-testid="output-picker-backdrop" on:click={close}></div>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="body" data-testid="output-picker-body" on:click|stopPropagation>
      <header>
        <h2>Output</h2>
        <button
          type="button"
          class="refresh"
          class:spinning={$castDiscovering}
          data-testid="output-picker-refresh"
          aria-label="Search for devices"
          on:click={refresh}
        >
          <Icon name="refresh-cw" size={22} />
        </button>
      </header>

      <ul class="devices">
        <li>
          <button
            type="button"
            class="row"
            class:selected={!$castActive}
            data-testid="output-row-local"
            aria-pressed={!$castActive}
            disabled={busyId !== ''}
            on:click={selectLocal}
          >
            <span class="glyph"><Icon name="speaker" size={26} /></span>
            <span class="text">
              <span class="title">Stellar DAC</span>
              <span class="sub">Singxer SU-6 · bit-perfect</span>
            </span>
            {#if !$castActive}
              <span class="tick" data-testid="output-row-local-tick"><Icon name="check" size={24} /></span>
            {/if}
          </button>
        </li>

        {#each $castDevices as device (device.id)}
          <li>
            <button
              type="button"
              class="row"
              class:selected={$castActive && $castState.deviceId === device.id}
              data-testid="output-row-{device.id}"
              aria-pressed={$castActive && $castState.deviceId === device.id}
              disabled={busyId !== ''}
              on:click={() => selectDevice(device.id)}
            >
              <span class="glyph"><Icon name={device.isGroup ? 'broadcast' : 'cast'} size={26} /></span>
              <span class="text">
                <span class="title">{device.name}</span>
                <span class="sub">{device.isGroup ? 'Speaker group' : (device.model || 'Cast device')}</span>
              </span>
              {#if busyId === device.id}
                <span class="tick connecting">Connecting…</span>
              {:else if $castActive && $castState.deviceId === device.id}
                <span class="tick"><Icon name="check" size={24} /></span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>

      {#if $castDevices.length === 0}
        <p class="empty" data-testid="output-picker-empty">
          {$castDiscovering ? 'Searching for Cast devices…' : 'No Cast devices found on this network.'}
        </p>
      {/if}

      {#if errorMsg}
        <p class="error" role="alert" data-testid="output-picker-error">{errorMsg}</p>
      {/if}

      <footer>
        {#if $castActive}
          <button
            type="button"
            class="link"
            data-testid="output-picker-leave-playing"
            disabled={busyId !== ''}
            on:click={leavePlaying}
          >Leave {$castState.deviceName || 'the device'} playing</button>
        {/if}
        <button type="button" class="done" data-testid="output-picker-done" on:click={close}>Done</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .output-picker {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
  }
  .body {
    position: relative;
    width: 60%;
    max-width: 760px;
    /* The LCD is 440px tall: the dialog must never outgrow the panel, and a
       long device list scrolls inside it rather than off-screen. */
    max-height: 92vh;
    overflow-y: auto;
    background: #0e0e0e;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-card);
    padding: 20px 24px;
    color: var(--color-text-primary);
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.8);
    box-sizing: border-box;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 400;
    color: var(--color-accent);
  }
  .refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-accent);
    cursor: pointer;
  }
  .refresh:hover { background: rgba(255, 255, 255, 0.05); }
  .refresh.spinning :global(svg) { animation: picker-spin 1s linear infinite; }
  @keyframes picker-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .refresh.spinning :global(svg) { animation: none; }
  }

  .devices {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 56px;
    padding: 8px 14px;
    text-align: left;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    border-radius: var(--radius-card);
    color: var(--color-text-primary);
    cursor: pointer;
  }
  .row:hover:not(:disabled) { background: rgba(255, 255, 255, 0.07); }
  .row:disabled { cursor: default; opacity: 0.6; }
  .row.selected {
    border-color: var(--color-accent);
    background: rgba(212, 175, 55, 0.08);
  }
  .glyph {
    display: inline-flex;
    color: var(--color-accent);
    flex: 0 0 auto;
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }
  .title {
    font-size: 17px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    font-size: 12px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tick {
    flex: 0 0 auto;
    color: var(--color-accent);
    font-size: 13px;
  }
  .tick.connecting { color: var(--color-text-secondary); }

  .empty {
    margin: 12px 0 0;
    font-size: 14px;
    color: var(--color-text-secondary);
  }
  .error {
    margin: 12px 0 0;
    color: #ff6b6b;
    font-size: 14px;
  }
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 16px;
  }
  .link {
    border: none;
    background: transparent;
    padding: 8px 0;
    color: var(--color-text-secondary);
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
  }
  .link:disabled { cursor: default; opacity: 0.6; }
  .done {
    margin-left: auto;
    min-height: 44px;
    padding: 10px 28px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-accent);
    background: #1a1408;
    border: 2px solid var(--color-accent);
    border-radius: var(--radius-card);
    cursor: pointer;
  }
  .done:hover { background: #251c0e; }
</style>
