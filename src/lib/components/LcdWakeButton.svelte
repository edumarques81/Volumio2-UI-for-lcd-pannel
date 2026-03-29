<script lang="ts">
  import { isLcdOn, lcdState, lcdActions } from '$lib/stores/lcd';

  let waking = false;

  function handleWake() {
    waking = true;
    lcdActions.turnOn();
    // Reset visual state after a beat
    setTimeout(() => { waking = false; }, 2000);
  }
</script>

{#if !$isLcdOn && $lcdState !== 'unknown'}
  <button
    class="lcd-wake-fab"
    class:waking
    on:click={handleWake}
    aria-label="Wake LCD display"
  >
    💡 Wake Display
  </button>
{/if}

<style>
  .lcd-wake-fab {
    position: fixed;
    bottom: 160px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    padding: 12px 24px;
    border: none;
    border-radius: var(--md-shape-full, 9999px);
    background: var(--md-primary-container, #7B2949);
    color: var(--md-on-primary-container, #FFD9E3);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2);
    transition: all 200ms ease-out;
    animation: fadeInUp 300ms ease-out;
    -webkit-tap-highlight-color: transparent;
  }

  .lcd-wake-fab:hover {
    background: var(--md-primary, #FFB1C8);
    color: var(--md-on-primary, #1A1114);
    transform: translateX(-50%) scale(1.05);
  }

  .lcd-wake-fab:active {
    transform: translateX(-50%) scale(0.95);
  }

  .lcd-wake-fab.waking {
    opacity: 0.6;
    pointer-events: none;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
