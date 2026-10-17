<script lang="ts">
  import { untrack } from 'svelte';

  /**
   * One split-flap cell.
   *
   * The mechanism, so the sequencing below is readable: a flap is two static
   * halves (top, bottom) with two hinged leaves laid over them. At rest the
   * top leaf covers the top half and shows the current character. On a change
   * the top leaf — still showing the OLD character — falls forward to 90°,
   * revealing the top half which already carries the NEW one; then the bottom
   * leaf, carrying the NEW character, swings up from 90° to flat over the
   * bottom half, which is still showing the OLD one. Only once it has landed
   * do the resting halves catch up, so nothing ever flashes.
   *
   * Transitions are declared inside the `.falling` / `.landing` classes rather
   * than on the leaves themselves. Removing the class therefore drops the
   * transition with it and the leaves snap back to their rest angles instantly
   * — both are edge-on and invisible at that moment, which is what makes the
   * reset free.
   */
  interface FlapProps {
    /** The character (or short group, e.g. "07") this cell displays. */
    value: string;
    /** Cell geometry in the 1920×440 design space. */
    w: number;
    h: number;
    fs: number;
    /** Bare cells drop the card, the radius and the hinge — glyph only. */
    bare?: boolean;
    testid?: string;
  }

  const { value, w, h, fs, bare = false, testid }: FlapProps = $props();

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The four painted characters. All equal while at rest. Seeded from the
  // prop's first value only -- every later change goes through flipTo, which
  // sets the four of them in the order the animation needs.
  const first = untrack(() => value);
  let topText = $state(first);
  let botText = $state(first);
  let leafTopText = $state(first);
  let leafBotText = $state(first);

  let falling = $state(false);
  let landing = $state(false);

  // $state because the cell publishes it as data-value; tests and the rail
  // read the settled character from there rather than from four spans.
  let settled = $state(first);
  let timers: ReturnType<typeof setTimeout>[] = [];

  const FALL_MS = 150;
  const LAND_MS = 170;
  const RESET_MS = 330;

  function snapTo(next: string): void {
    topText = botText = leafTopText = leafBotText = next;
    falling = false;
    landing = false;
    settled = next;
  }

  function clearTimers(): void {
    for (const t of timers) clearTimeout(t);
    timers = [];
  }

  function flipTo(next: string): void {
    // A change arriving mid-flip (the seconds cells, or a rail message landing
    // on top of the previous one) snaps the in-flight animation shut first.
    // Queueing would let the cell drift behind real time, which on a clock is
    // worse than a dropped frame of animation.
    clearTimers();
    snapTo(settled);

    topText = next;      // revealed as the top leaf falls away
    botText = settled;   // still the old half underneath
    leafTopText = settled;
    leafBotText = next;
    falling = true;

    timers.push(
      setTimeout(() => {
        landing = true;
      }, FALL_MS),
      setTimeout(() => {
        snapTo(next);
      }, RESET_MS)
    );
  }

  $effect(() => {
    const next = value;
    if (next === settled) return;
    if (reduceMotion) {
      snapTo(next);
      return;
    }
    flipTo(next);
  });

  $effect(() => () => clearTimers());
</script>

<div
  class="flap"
  class:bare
  class:falling
  class:landing
  style="--w:{w}px; --h:{h}px; --fs:{fs}px; --fall:{FALL_MS}ms; --land:{LAND_MS}ms"
  data-testid={testid}
  data-value={settled}
  aria-hidden="true"
>
  <div class="half half-top"><span>{topText}</span></div>
  <div class="half half-bot"><span>{botText}</span></div>
  <div class="leaf leaf-top"><span>{leafTopText}</span></div>
  <div class="leaf leaf-bot"><span>{leafBotText}</span></div>
  {#if !bare}
    <div class="hinge"></div>
  {/if}
</div>

<style>
  .flap {
    position: relative;
    width: var(--w);
    height: var(--h);
    perspective: 1400px;
    flex: 0 0 auto;
  }

  .half,
  .leaf {
    position: absolute;
    left: 0;
    width: 100%;
    height: 50%;
    overflow: hidden;
    background: var(--flap-bg, #15120c);
    backface-visibility: hidden;
  }

  .half-top,
  .leaf-top {
    top: 0;
    border-radius: var(--flap-radius, 5px) var(--flap-radius, 5px) 0 0;
  }

  .half-bot,
  .leaf-bot {
    bottom: 0;
    border-radius: 0 0 var(--flap-radius, 5px) var(--flap-radius, 5px);
  }

  .leaf-top {
    transform-origin: 50% 100%;
    transform: rotateX(0deg);
    z-index: 3;
  }

  .leaf-bot {
    transform-origin: 50% 0%;
    transform: rotateX(90deg);
    z-index: 3;
  }

  /* Transitions live with the state classes on purpose — see the header note. */
  .flap.falling .leaf-top {
    transform: rotateX(-90deg);
    transition: transform var(--fall) cubic-bezier(0.4, 0, 0.9, 0.5);
  }

  .flap.landing .leaf-bot {
    transform: rotateX(0deg);
    transition: transform var(--land) cubic-bezier(0.2, 0.6, 0.4, 1);
  }

  .flap span {
    position: absolute;
    left: 0;
    width: 100%;
    height: var(--h);
    line-height: var(--h);
    text-align: center;
    font-family: var(--flap-font, 'Piboto Condensed', 'Liberation Sans Narrow', 'Nimbus Sans Narrow', 'Arial Narrow', sans-serif);
    font-weight: var(--flap-weight, 600);
    font-size: var(--fs);
    letter-spacing: var(--flap-track, 0);
    color: var(--flap-ink, #f5d4a8);
    font-variant-numeric: tabular-nums;
    white-space: pre;
  }

  .half-top span,
  .leaf-top span {
    top: 0;
  }

  .half-bot span,
  .leaf-bot span {
    bottom: 0;
  }

  .hinge {
    position: absolute;
    top: calc(50% - 1px);
    left: 0;
    width: 100%;
    height: 2px;
    background: var(--flap-hinge, rgba(0, 0, 0, 0.92));
    z-index: 5;
  }

  .flap.bare .half,
  .flap.bare .leaf {
    background: transparent;
    border-radius: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .flap.falling .leaf-top,
    .flap.landing .leaf-bot {
      transition: none;
    }
  }
</style>
