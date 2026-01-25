<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { isStandby, brightness, lcdActions } from '$lib/stores/lcd';
  import { navigationActions } from '$lib/stores/navigation';

  // Calculate dimmer opacity (inverted brightness)
  // brightness 100% = opacity 0, brightness 0% = opacity 1
  $: dimmerOpacity = (100 - $brightness) / 100;

  // Debounce tracking to prevent rapid wake calls
  let lastWakeTime = 0;
  const DEBOUNCE_MS = 500;

  // Reference to overlay element for non-passive event listeners
  let overlayElement: HTMLDivElement;

  function handleWake(event: TouchEvent | MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    // Only process if in standby mode
    if (!$isStandby) {
      return;
    }

    // Debounce rapid touches
    const now = Date.now();
    if (now - lastWakeTime < DEBOUNCE_MS) {
      return;
    }
    lastWakeTime = now;

    console.log('📺 Wake from standby');
    lcdActions.wake();
    navigationActions.goHome();
  }

  onMount(() => {
    // Add non-passive event listeners for reliable touch handling on Pi/Wayland
    // Svelte's on:touchstart creates passive listeners by default which ignore preventDefault()
    if (overlayElement) {
      overlayElement.addEventListener('touchstart', handleWake, { passive: false });
      overlayElement.addEventListener('touchend', handleWake, { passive: false });
    }
  });

  onDestroy(() => {
    // Cleanup event listeners
    if (overlayElement) {
      overlayElement.removeEventListener('touchstart', handleWake);
      overlayElement.removeEventListener('touchend', handleWake);
    }
  });
</script>

<!-- Brightness dimmer overlay (always present, opacity based on brightness) -->
<div
  class="brightness-dimmer"
  style="opacity: {dimmerOpacity}"
  aria-hidden="true"
></div>

<!-- Standby overlay (captures all touches when in standby) -->
<div
  bind:this={overlayElement}
  class="standby-overlay"
  class:active={$isStandby}
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
    z-index: 9999;
    transition: opacity 0.5s ease;
  }

  .standby-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: black;
    z-index: 10000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.5s ease;
    /* Critical for Pi/Wayland touch handling */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .standby-overlay.active {
    opacity: 1;
    pointer-events: all;
    cursor: pointer;
  }
</style>
