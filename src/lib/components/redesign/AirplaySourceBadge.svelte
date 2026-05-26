<script lang="ts">
  /**
   * AirPlay source badge.
   *
   * Shown in PlayerView only when an AirPlay session is active. Sits next
   * to the FormatStrip in the meta zone so the user can see "this audio
   * is coming from Eduardo's iPhone, not the queue" at a glance.
   *
   * Visual language matches HiResBadge (gold capsule, bold all-caps label)
   * so the LCD looks coherent. We intentionally do NOT subscribe to the
   * airplay store here — the parent passes `sender` so the component is
   * pure and trivially renderable in tests.
   */
  export let sender: string = '';
</script>

<span
  class="airplay-source-badge"
  data-testid="airplay-source-badge"
  aria-label={sender ? `Playing via AirPlay from ${sender}` : 'Playing via AirPlay'}
>
  <span class="label">AIRPLAY</span>
  {#if sender}
    <span class="sep" aria-hidden="true">·</span>
    <span class="sender">{sender}</span>
  {/if}
</span>

<style>
  .airplay-source-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--color-accent);
    color: #000;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    vertical-align: middle;
    white-space: nowrap;
  }
  .label {
    /* Already uppercase from the parent rule, but explicit here so a
       future copy change can't accidentally render lowercase. */
    text-transform: uppercase;
  }
  .sep {
    opacity: 0.65;
    font-weight: 700;
  }
  .sender {
    text-transform: none;
    letter-spacing: 0.2px;
    font-weight: 600;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
