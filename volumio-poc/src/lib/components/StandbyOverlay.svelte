<script lang="ts">
  import { isStandby, brightness, lcdActions } from '$lib/stores/lcd';
  import { navigationActions } from '$lib/stores/navigation';

  // Calculate dimmer opacity (inverted brightness)
  // brightness 100% = opacity 0, brightness 0% = opacity 1
  $: dimmerOpacity = (100 - $brightness) / 100;

  function handleWake(event: TouchEvent | MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    if ($isStandby) {
      console.log('📺 Wake from standby');
      lcdActions.wake();
      navigationActions.goHome();
    }
  }
</script>

<!-- Brightness dimmer overlay (always present, opacity based on brightness) -->
<div
  class="brightness-dimmer"
  style="opacity: {dimmerOpacity}"
  aria-hidden="true"
></div>

<!-- Standby overlay (captures all touches when in standby) -->
<div
  class="standby-overlay"
  class:active={$isStandby}
  on:touchstart={handleWake}
  on:mousedown={handleWake}
  role="presentation"
  aria-label="Screen is in standby. Touch to wake."
></div>

<style>
  .brightness-dimmer {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: black;
    pointer-events: none;
    z-index: 9998;
    transition: opacity 0.3s ease;
  }

  .standby-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: black;
    z-index: 9999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.5s ease;
  }

  .standby-overlay.active {
    opacity: 1;
    pointer-events: all;
    cursor: pointer;
  }
</style>
