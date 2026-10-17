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

  // The character the cell is *heading for*, which is not the same thing as
  // the one it is showing: during a flip `settled` is still the old one.
  //
  // This is what the effect compares against, and it has to be, because the
  // prop is re-evaluated far more often than it changes. The board rebuilds
  // its `parts` object every 200ms so the seconds cell cannot lag the wall
  // clock, and a fresh object wakes this component even when the character in
  // it is identical. Comparing against `settled` meant every one of those
  // ticks re-entered flipTo for a flip already in flight -- clearTimers()
  // cancelled the reset that would have settled the cell, so `settled` never
  // advanced, so the next tick did it again. The cell animated forever and
  // visibly flickered, and it never recovered, because nothing in that loop
  // could ever make the guard true again.
  let pending = first;

  let timers: ReturnType<typeof setTimeout>[] = [];

  const FALL_MS = 150;
  const LAND_MS = 170;
  const RESET_MS = 330;

  /** Put all four halves on one character and drop the animation classes. */
  function paint(next: string): void {
    topText = botText = leafTopText = leafBotText = next;
    falling = false;
    landing = false;
  }

  function snapTo(next: string): void {
    paint(next);
    settled = next;
    pending = next;
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
    paint(settled); // shut any in-flight animation; `settled` does not move

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

  // $derived memoises, so an identical character arriving inside a new parent
  // object does not wake the effect below at all. `pending` is the belt to
  // that braces: it also covers a repeat that arrives by some other route.
  const target = $derived(value);

  $effect(() => {
    const next = target;
    if (next === pending) return;
    pending = next;
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

  /* The leaves ride 1px in front of the halves, and the hinge 1px in front of
     the leaves.

     `perspective` on .flap makes this a 3D rendering context, and in one of
     those the painting order of two *coplanar* surfaces is undefined — z-index
     does not settle it. Both leaves end their swing flat against the half
     behind them (leaf-top is flat at rest; leaf-bot lands flat), so without a
     depth offset the cell z-fights between the old and the new character:
     the flicker starts the first time a cell flips, because the transition is
     what promotes the leaf to its own composited layer, and never stops.

     1px against 1400px of perspective scales a leaf by 0.07% — under a tenth
     of a pixel on the largest cell, so the leaf still registers with the half
     it covers. */
  .leaf-top {
    transform-origin: 50% 100%;
    transform: translateZ(1px) rotateX(0deg);
    z-index: 3;
  }

  .leaf-bot {
    transform-origin: 50% 0%;
    transform: translateZ(1px) rotateX(90deg);
    z-index: 3;
  }

  /* Transitions live with the state classes on purpose — see the header note. */
  .flap.falling .leaf-top {
    transform: translateZ(1px) rotateX(-90deg);
    transition: transform var(--fall) cubic-bezier(0.4, 0, 0.9, 0.5);
  }

  .flap.landing .leaf-bot {
    transform: translateZ(1px) rotateX(0deg);
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
    transform: translateZ(2px);
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
