<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import FlapUnit from './FlapUnit.svelte';
  import { lastPlayedAlbum } from '$lib/stores/player';
  import {
    RAIL_CELLS,
    clockParts,
    formatLongDate,
    railMessages
  } from './departureBoard';

  /**
   * The Departure Board standby face — Solari di Udine, which is the one
   * flip-clock idiom actually built for a 4.4:1 strip, and whose native
   * palette (amber on black) is already the product's own accent.
   *
   * Laid out in a fixed 1920×440 design space and scaled to the viewport, so
   * the kiosk gets it pixel-exact and a desktop browser or a test renderer
   * still gets a correct, proportional one.
   */

  interface BoardProps {
    /** Freeze the clock for tests and screenshots. */
    frozenAt?: Date;
    hour12?: boolean;
  }

  const { frozenAt, hour12 = false }: BoardProps = $props();

  const STAGE_W = 1920;
  const STAGE_H = 440;

  /** Rail dwell. Long enough to read, short enough to feel mechanical. */
  const RAIL_INTERVAL_MS = 7000;
  /** Per-cell stagger, which is what makes the rail sound like a board. */
  const RAIL_STAGGER_MS = 34;

  let host: HTMLDivElement | undefined = $state();
  let scale = $state(1);

  let now = $state(untrack(() => frozenAt) ?? new Date());
  const parts = $derived(clockParts(now, hour12));
  const longDate = $derived(formatLongDate(now));

  // Rail state: one character per physical cell.
  let railChars = $state<string[]>(Array.from({ length: RAIL_CELLS }, () => ' '));
  let railIndex = -1;

  const messages = $derived(railMessages($lastPlayedAlbum));

  function advanceRail(): void {
    const list = messages;
    if (list.length === 0) return;
    railIndex = (railIndex + 1) % list.length;
    const line = list[railIndex];
    for (let i = 0; i < RAIL_CELLS; i++) {
      setTimeout(() => {
        railChars[i] = line[i] ?? ' ';
      }, i * RAIL_STAGGER_MS);
    }
  }

  onMount(() => {
    // 200ms rather than 1000ms so the seconds cell cannot visibly lag the
    // wall clock; the flap itself only animates when a character changes.
    const clock = frozenAt
      ? null
      : setInterval(() => {
          now = new Date();
        }, 200);

    advanceRail();
    const rail = setInterval(advanceRail, RAIL_INTERVAL_MS);

    let observer: ResizeObserver | null = null;
    const fit = () => {
      if (!host) return;
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      scale = Math.min(width / STAGE_W, height / STAGE_H);
    };
    fit();
    if (typeof ResizeObserver !== 'undefined' && host) {
      observer = new ResizeObserver(fit);
      observer.observe(host);
    }
    window.addEventListener('resize', fit);

    return () => {
      if (clock) clearInterval(clock);
      clearInterval(rail);
      observer?.disconnect();
      window.removeEventListener('resize', fit);
    };
  });
</script>

<div class="board-host" bind:this={host} data-testid="standby-departure-board">
  <div
    class="stage"
    style="width:{STAGE_W}px; height:{STAGE_H}px; transform: translate(-50%, -50%) scale({scale})"
  >
    <div class="clockrow">
      <div class="hhmm">
        <FlapUnit value={parts.hh[0]} w={132} h={200} fs={152} testid="standby-h1" />
        <FlapUnit value={parts.hh[1]} w={132} h={200} fs={152} testid="standby-h2" />
        <div class="colon" aria-hidden="true"><i></i><i></i></div>
        <FlapUnit value={parts.mm[0]} w={132} h={200} fs={152} testid="standby-m1" />
        <FlapUnit value={parts.mm[1]} w={132} h={200} fs={152} testid="standby-m2" />
      </div>
      <div class="secs">
        <FlapUnit value={parts.ss[0]} w={78} h={116} fs={86} testid="standby-s1" />
        <FlapUnit value={parts.ss[1]} w={78} h={116} fs={86} testid="standby-s2" />
      </div>
    </div>

    <div class="meta">
      <p class="mark">STELLAR</p>
      <p class="date" data-testid="standby-date">{longDate}</p>
      <p class="sub">STANDBY</p>
    </div>

    <div class="hair" aria-hidden="true"></div>

    <div class="rail" data-testid="standby-rail">
      {#each railChars as char, i (i)}
        <FlapUnit value={char} w={66} h={62} fs={40} testid={`standby-rail-${i}`} />
      {/each}
    </div>
  </div>

  <!-- The only text a screen reader needs from a clock face. -->
  <p class="sr-only">
    Display in standby. Clock shows {parts.hh}:{parts.mm}. Touch anywhere to wake.
  </p>
</div>

<style>
  .board-host {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000000;
  }

  .stage {
    position: absolute;
    top: 50%;
    left: 50%;
    transform-origin: center center;
  }

  /* ---- clock group ---- */
  .clockrow {
    position: absolute;
    left: 72px;
    top: 46px;
    display: flex;
    align-items: flex-end;
    gap: 28px;
  }

  .hhmm {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .secs {
    display: flex;
    gap: 8px;
  }

  /* Seconds read as secondary: the plain accent, not the bright one.
     FlapUnit is themed through inherited custom properties, so these
     never fight its own selectors. */
  .secs :global(.flap) {
    --flap-ink: var(--color-accent, #c9a961);
  }

  .colon {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 38px;
    padding: 0 6px;
  }

  .colon i {
    display: block;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--color-accent, #c9a961);
    opacity: 0.85;
  }

  /* ---- right-hand meta ---- */
  .meta {
    position: absolute;
    right: 72px;
    top: 58px;
    text-align: right;
  }

  .mark {
    font-family: 'Piboto Condensed', 'Liberation Sans Narrow', 'Nimbus Sans Narrow', 'Arial Narrow', sans-serif;
    font-weight: 500;
    font-size: 40px;
    letter-spacing: 0.42em;
    padding-left: 0.42em;
    color: var(--color-accent, #c9a961);
    margin: 0 0 14px;
  }

  .date {
    font-family: 'DejaVu Sans Mono', 'Noto Sans Mono', monospace;
    font-size: 27px;
    letter-spacing: 0.1em;
    color: #9d968a;
    margin: 0;
  }

  .sub {
    font-family: 'DejaVu Sans Mono', 'Noto Sans Mono', monospace;
    font-size: 18px;
    letter-spacing: 0.2em;
    color: rgba(201, 169, 97, 0.46);
    margin: 12px 0 0;
  }

  /* ---- rail ---- */
  .hair {
    position: absolute;
    left: 72px;
    right: 72px;
    top: 290px;
    height: 1px;
    background: rgba(201, 169, 97, 0.16);
  }

  .rail {
    position: absolute;
    left: 72px;
    top: 320px;
    display: flex;
    gap: 6px;
  }

  .rail :global(.flap) {
    --flap-ink: #cdbf9f;
    --flap-track: 0.02em;
    --flap-bg: #120f0a;
    --flap-radius: 3px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
</style>
