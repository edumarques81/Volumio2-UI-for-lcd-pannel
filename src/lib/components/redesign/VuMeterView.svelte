<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { vuLevelL, vuLevelR } from '$lib/stores/spectrum';

  const SEGMENT_COUNT = 40;
  const TAU_MS = 300;  // RMS integration time-constant (classic-VU spec)

  let displayedL = $state(0);
  let displayedR = $state(0);

  let raf = 0;
  let lastT = 0;
  // $state so $effect tracks the flip in onMount and re-runs.
  let reducedMotion = $state(false);

  function tick(t: number) {
    raf = requestAnimationFrame(tick);
    const dt = lastT ? t - lastT : 16;
    lastT = t;
    const alpha = 1 - Math.exp(-dt / TAU_MS);
    displayedL += ($vuLevelL - displayedL) * alpha;
    displayedR += ($vuLevelR - displayedR) * alpha;
  }

  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      raf = requestAnimationFrame(tick);
    }
  });

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
  });

  // In reduced-motion mode the RAF loop is skipped; the bars react
  // directly off the store at the 20 fps push cadence. reducedMotion is
  // $state so this effect re-runs when onMount flips it.
  $effect(() => {
    if (reducedMotion) {
      displayedL = $vuLevelL;
      displayedR = $vuLevelR;
    }
  });
</script>

<section class="vu-meter-view" data-testid="vu-meter-view" aria-label="VU meter">
  <div
    class="vu-bar"
    data-testid="vu-meter-l"
    role="meter"
    aria-label="Left channel level"
    aria-valuemin="0"
    aria-valuemax="1"
    aria-valuenow={displayedL}
  >
    <span class="label">L</span>
    <div class="segments">
      {#each Array(SEGMENT_COUNT) as _, i (i)}
        <div
          class="segment"
          class:lit={i / SEGMENT_COUNT < displayedL}
          data-testid="vu-meter-l-segment-{i}"
        ></div>
      {/each}
    </div>
  </div>

  <div
    class="vu-bar"
    data-testid="vu-meter-r"
    role="meter"
    aria-label="Right channel level"
    aria-valuemin="0"
    aria-valuemax="1"
    aria-valuenow={displayedR}
  >
    <span class="label">R</span>
    <div class="segments">
      {#each Array(SEGMENT_COUNT) as _, i (i)}
        <div
          class="segment"
          class:lit={i / SEGMENT_COUNT < displayedR}
          data-testid="vu-meter-r-segment-{i}"
        ></div>
      {/each}
    </div>
  </div>
</section>

<style>
  .vu-meter-view {
    width: 100%;
    height: 100%;
    background: #050507;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 40px;
    padding: 16px;
    box-sizing: border-box;
  }

  .vu-bar {
    display: flex;
    align-items: center;
    height: 168px;
    gap: 16px;
  }

  .label {
    width: 28px;
    text-align: center;
    font-size: 24px;
    font-weight: 600;
    color: var(--color-accent);
    letter-spacing: 0.05em;
  }

  .segments {
    flex: 1;
    display: flex;
    align-items: stretch;
    gap: 2px;
    height: 100%;
  }

  .segment {
    flex: 1;
    background: var(--color-accent);
    opacity: 0.08;
    border-radius: 2px;
    transition: opacity 50ms linear;
  }

  .segment.lit {
    opacity: 1;
  }
</style>
