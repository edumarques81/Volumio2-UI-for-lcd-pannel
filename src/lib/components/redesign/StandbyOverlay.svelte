<script lang="ts">
  import DepartureBoardClock from './standby/DepartureBoardClock.svelte';
  import { standbyActive, standbyBrightness, standbyActions } from '$lib/stores/standby';

  /**
   * The standby surface: the LCD's only real "off".
   *
   * There is no backlight to cut on this panel (see src/lib/stores/standby.ts
   * for the full set of hardware levers that were tried and are closed), so
   * standby is painted, not switched. The sequence the user asked for is
   * literal: the live UI dims away under a black veil, and the clock face
   * fades up behind it at the configured brightness.
   *
   * It must also swallow the tap that wakes it. Without stopPropagation the
   * same touch that ends standby lands on whatever control happens to be
   * underneath — in the worst case a transport button or a settings toggle.
   */

  const FADE_MS = 1400;

  function wake(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    standbyActions.exit();
  }

  function onKeydown(event: KeyboardEvent): void {
    // Any key wakes; this is a kiosk panel, not a dialog.
    wake(event);
  }
</script>

{#if $standbyActive}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="standby"
    role="button"
    tabindex="0"
    aria-label="Display is in standby. Activate to wake."
    data-testid="standby-overlay"
    style="--standby-fade:{FADE_MS}ms; --standby-dim:{$standbyBrightness / 100}"
    onpointerdown={wake}
    ontouchstart={wake}
    onkeydown={onKeydown}
  >
    <div class="veil"></div>
    <div class="face">
      <DepartureBoardClock />
    </div>
  </div>
{/if}

<style>
  .standby {
    position: fixed;
    inset: 0;
    z-index: 3000; /* above every modal (highest in app is 2000) */
    background: transparent;
    border: 0;
    padding: 0;
    cursor: none;
    /* The panel is touch-only; nothing here should be selectable or draggable. */
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }

  .standby:focus-visible {
    outline: none;
  }

  /* The veil IS the dimming step — it fades over the live UI rather than
     dimming it in place, which keeps the live layout untouched. */
  .veil {
    position: absolute;
    inset: 0;
    background: #000000;
    opacity: 0;
    animation: veil-in var(--standby-fade) ease forwards;
  }

  .face {
    position: absolute;
    inset: 0;
    opacity: 0;
    filter: brightness(var(--standby-dim));
    animation: face-in calc(var(--standby-fade) * 0.75) ease forwards;
    animation-delay: calc(var(--standby-fade) * 0.6);
  }

  @keyframes veil-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes face-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* No fade for anyone who has asked motion to stop: go straight to the face. */
  @media (prefers-reduced-motion: reduce) {
    .veil,
    .face {
      animation: none;
      opacity: 1;
    }
  }
</style>
