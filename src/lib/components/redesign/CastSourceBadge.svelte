<script lang="ts">
  /**
   * Cast source badge.
   *
   * Shown in PlayerView while a Cast session is playing. Where
   * AirplaySourceBadge says "this audio came FROM another device", this one
   * says "this audio is going TO another device" — the opposite direction,
   * so it deliberately does not reuse the gold accent capsule. A cool outline
   * reads as "elsewhere" next to the gold "here" of the rest of the LCD.
   *
   * Pure component: the parent passes the device name so this renders in
   * tests without the store.
   */
  export let device: string = '';
</script>

<span
  class="cast-source-badge"
  data-testid="cast-source-badge"
  aria-label={device ? `Casting to ${device}` : 'Casting'}
>
  <span class="label">CAST</span>
  {#if device}
    <span class="sep" aria-hidden="true">·</span>
    <span class="device">{device}</span>
  {/if}
</span>

<style>
  .cast-source-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 3px 11px;
    border-radius: 999px;
    border: 1px solid #5aa9d6;
    background: rgba(90, 169, 214, 0.12);
    color: #8fcdea;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    vertical-align: middle;
    white-space: nowrap;
  }
  .label {
    text-transform: uppercase;
  }
  .sep {
    opacity: 0.65;
    font-weight: 700;
  }
  .device {
    text-transform: none;
    letter-spacing: 0.2px;
    font-weight: 600;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
