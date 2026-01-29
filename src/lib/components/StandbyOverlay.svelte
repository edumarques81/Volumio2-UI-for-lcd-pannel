<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { isDimmedStandby, brightness, lcdActions } from '$lib/stores/lcd';
  import { navigationActions } from '$lib/stores/navigation';

  // Check if running on physical LCD (Pi uses ?layout=lcd URL parameter)
  // This is more reliable than screen dimension detection
  let isPhysicalLcd = false;

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const layout = params.get('layout');
    isPhysicalLcd = layout === 'lcd' || layout === 'lcd-panel';
  }

  // Only apply standby overlay on physical LCD panel, not remote browsers
  // Use isDimmedStandby to detect when brightness is at standby level (20% or below)
  $: shouldShowOverlay = isPhysicalLcd && $isDimmedStandby;
  $: shouldApplyBrightness = isPhysicalLcd;

  // Calculate dimmer opacity (inverted brightness)
  // brightness 100% = opacity 0, brightness 0% = opacity 1
  $: dimmerOpacity = (100 - $brightness) / 100;

  // Debounce tracking to prevent rapid wake calls
  let lastWakeTime = 0;
  const DEBOUNCE_MS = 500;

  /**
   * Document-level touch handler for wake from standby.
   * Uses capture phase to intercept ALL touches before any other handlers.
   * This is more reliable than element-level handlers on Pi/Wayland.
   */
  function handleDocumentTouch(event: TouchEvent) {
    // Only handle touch wake on physical LCD panel
    if (!isPhysicalLcd) {
      return; // Not a physical LCD, ignore
    }

    // Check if in dimmed standby mode using get() for synchronous access
    const inDimmedStandby = get(isDimmedStandby);

    if (!inDimmedStandby) {
      return; // Not in dimmed standby, let event propagate normally
    }

    // We're in dimmed standby - consume this touch and wake up
    event.stopPropagation();
    event.preventDefault();
    event.stopImmediatePropagation();

    // Debounce rapid touches
    const now = Date.now();
    if (now - lastWakeTime < DEBOUNCE_MS) {
      return;
    }
    lastWakeTime = now;

    console.log('📺 Wake from dimmed standby (document touch capture)');
    lcdActions.wake();  // Restore to working brightness
    navigationActions.goHome();
  }

  /**
   * Mouse handler for desktop testing
   */
  function handleMouseDown(event: MouseEvent) {
    // Only handle mouse wake on physical LCD panel
    if (!isPhysicalLcd) {
      return; // Not a physical LCD, ignore
    }

    const inDimmedStandby = get(isDimmedStandby);

    if (!inDimmedStandby) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    const now = Date.now();
    if (now - lastWakeTime < DEBOUNCE_MS) {
      return;
    }
    lastWakeTime = now;

    console.log('📺 Wake from dimmed standby (mousedown)');
    lcdActions.wake();  // Restore to working brightness
    navigationActions.goHome();
  }

  onMount(() => {
    // Add document-level touch listener in CAPTURE phase
    // This fires BEFORE any element handlers, ensuring we catch all touches
    // Use { passive: false } to allow preventDefault()
    document.addEventListener('touchstart', handleDocumentTouch, {
      capture: true,
      passive: false
    });

    console.log('📺 StandbyOverlay: Document touch capture listener registered');
  });

  onDestroy(() => {
    document.removeEventListener('touchstart', handleDocumentTouch, { capture: true });
  });
</script>

<!-- Brightness dimmer overlay (only on physical LCD, opacity based on brightness) -->
{#if isPhysicalLcd}
  <div
    class="brightness-dimmer"
    style="opacity: {dimmerOpacity}"
    aria-hidden="true"
  ></div>

  <!-- Standby overlay (only on physical LCD, captures mouse for testing) -->
  <div
    class="standby-overlay"
    class:active={shouldShowOverlay}
    on:mousedown={handleMouseDown}
    role="presentation"
    aria-label="Screen is in standby. Touch to wake."
  ></div>
{/if}

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
    /* Transparent - just captures touches, brightness dimmer handles visuals */
    background-color: transparent;
    z-index: 10000;
    pointer-events: none;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .standby-overlay.active {
    /* Capture all pointer events when in dimmed standby mode */
    pointer-events: all;
    cursor: pointer;
  }
</style>
