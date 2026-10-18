<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { castState, castActive } from '$lib/stores/cast';
  import { modalActions } from '$lib/stores/navigation';

  /**
   * Opens the output picker. Lives in PlayerView's meta zone and renders
   * whether or not anything is playing, because "where does the sound go"
   * is a question the user asks from an idle screen too.
   *
   * While a session is live it names the device, so the LCD never shows a
   * silent DAC and a playing Hub without saying which one it is talking about.
   */
  $: label = $castActive
    ? `Output: ${$castState.deviceName || 'Cast device'}`
    : 'Output: Stellar DAC';
</script>

<button
  type="button"
  class="output-button"
  class:casting={$castActive}
  data-testid="output-button"
  aria-label={label}
  on:click={modalActions.openOutput}
>
  <Icon name={$castActive ? 'cast-connected' : 'cast'} size={22} />
  <span class="name">{$castActive ? ($castState.deviceName || 'Cast device') : 'Stellar DAC'}</span>
</button>

<style>
  .output-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    /* 44pt touch target on the LCD without a 44px-tall capsule: the padding
       plus the icon get it there, and the hit area is what the finger needs. */
    min-height: 44px;
    padding: 4px 14px;
    border-radius: 999px;
    border: 1px solid var(--color-text-secondary);
    background: transparent;
    color: var(--color-text-secondary);
    font-family: system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.2px;
    cursor: pointer;
    white-space: nowrap;
  }
  .output-button:hover { background: rgba(255, 255, 255, 0.05); }
  .output-button:active { transform: scale(0.98); }
  .output-button.casting {
    border-color: #5aa9d6;
    color: #8fcdea;
  }
  .name {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
