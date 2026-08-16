<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    vuRmsL,
    vuRmsR,
    rmsToMeterDb,
    meterDbToAngle,
    SCALE_POINTS_DB,
    SWEEP_DEG,
    ANGLE_MIN_DEG,
    OVERSHOOT_DB,
  } from '$lib/stores/spectrum';

  /**
   * A pair of reconstructed analog VU meters, LEFT and RIGHT.
   *
   * The faceplate is drawn once as static SVG; per frame only each needle
   * group's `transform` changes. That matters on the Pi kiosk — the segmented
   * bar this replaced re-evaluated 80 element classes every frame, this
   * touches two attributes.
   *
   * Ballistics: a moving-coil movement integrates rectified current with a
   * ~300 ms time constant, so the smoothing runs on the LINEAR rms and the dB
   * scale is applied afterwards, as ink on the faceplate. See the note on
   * vuRmsL in $lib/stores/spectrum.
   */

  const TAU_MS = 300; // RMS integration time-constant (classic-VU spec)

  // Linear amplitude, 0..1 — the physical analogue of coil current.
  let displayedL = $state(0);
  let displayedR = $state(0);
  let raf = 0;
  let lastT = 0;
  // $state so $effect tracks the flip in onMount and re-runs.
  let reducedMotion = $state(false);

  const dbL = $derived(rmsToMeterDb(displayedL));
  const dbR = $derived(rmsToMeterDb(displayedR));
  const angleL = $derived(meterDbToAngle(dbL));
  const angleR = $derived(meterDbToAngle(dbR));

  function tick(t: number) {
    raf = requestAnimationFrame(tick);
    const dt = lastT ? t - lastT : 16;
    lastT = t;
    const alpha = 1 - Math.exp(-dt / TAU_MS);
    displayedL += ($vuRmsL - displayedL) * alpha;
    displayedR += ($vuRmsR - displayedR) * alpha;
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

  // In reduced-motion mode the RAF loop is skipped; the needles step directly
  // off the store at the 20 fps push cadence.
  $effect(() => {
    if (reducedMotion) {
      displayedL = $vuRmsL;
      displayedR = $vuRmsR;
    }
  });

  // ── Faceplate geometry, in viewBox units ────────────────────────────────
  // The plate is wider than tall and the sweep fills it, as on the reference —
  // a real VU faceplate is mostly instrument, not margin. The pivot sits ON the
  // plate near the bottom edge rather than off it.
  //
  // A ±45° sweep of radius R needs 2·R·sin45 ≈ 1.41R of width and R of height,
  // so the viewBox is that bounding box plus a margin band for the numerals and
  // the channel plate. The aspect ratio is carried into CSS so the bezel
  // shrink-wraps the plate instead of letterboxing it.
  const VB_W = 360;
  const VB_H = 264;
  const CX = 180;
  const CY = 240;

  const R_LABEL = 170;     // engraved numerals (outermost)
  const R_TICK_OUT = 152;
  const R_TICK_IN = 132;
  const R_ARC = 122;       // the long baseline stroke, inside the ticks
  const R_DB = 76;         // the "dB" caption
  const R_NEEDLE = 148;    // tip reaches into the tick band
  const R_TAIL = -14;      // a little counterweight behind the pivot
  const HALF_BASE = 3.0;
  const HUB_R = 17;

  const ANGLE_MAX_DEG = ANGLE_MIN_DEG + SWEEP_DEG;
  const ARC_PAD_DEG = 5;   // the baseline runs slightly past the end ticks

  // How far the bezel-lip shadow reaches in from each edge. Top is deepest —
  // the light is above, so the overhang shadows the top of the plate hardest.
  const LIP_TOP = VB_H * 0.46;
  const LIP_BOTTOM = VB_H * 0.22;
  const LIP_SIDE = VB_W * 0.22;

  // Thickness of the chassis the opening is cut through, in viewBox units.
  // Drawing the four cut walls in perspective is what actually reads as depth:
  // the top wall is the underside of the lip and goes nearly black, the bottom
  // wall faces up into the light. Everything else is a gradient that only
  // *suggests* depth; these walls are the thing the eye measures it by.
  const WALL = 13;
  const wallTop = `M 0 0 H ${VB_W} L ${VB_W - WALL} ${WALL} H ${WALL} Z`;
  const wallBottom = `M 0 ${VB_H} H ${VB_W} L ${VB_W - WALL} ${VB_H - WALL} H ${WALL} Z`;
  const wallLeft = `M 0 0 L ${WALL} ${WALL} V ${VB_H - WALL} L 0 ${VB_H} Z`;
  const wallRight = `M ${VB_W} 0 L ${VB_W - WALL} ${WALL} V ${VB_H - WALL} L ${VB_W} ${VB_H} Z`;

  function polar(r: number, deg: number): { x: number; y: number } {
    const rad = (deg * Math.PI) / 180;
    return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
  }

  /** Engraved points, precomputed once — the face never changes. */
  const marks = SCALE_POINTS_DB.map((db, i) => {
    const deg = ANGLE_MIN_DEG + (i * SWEEP_DEG) / (SCALE_POINTS_DB.length - 1);
    return {
      db,
      label: String(db),
      inner: polar(R_TICK_IN, deg),
      outer: polar(R_TICK_OUT, deg),
      text: polar(R_LABEL, deg),
    };
  });

  const arcStart = polar(R_ARC, ANGLE_MIN_DEG - ARC_PAD_DEG);
  const arcEnd = polar(R_ARC, ANGLE_MAX_DEG + ARC_PAD_DEG);
  const arcPath = `M ${arcStart.x.toFixed(2)} ${arcStart.y.toFixed(2)} A ${R_ARC} ${R_ARC} 0 0 1 ${arcEnd.x.toFixed(2)} ${arcEnd.y.toFixed(2)}`;

  // Needle drawn pointing straight up; the group rotates it into place.
  const needlePath = [
    `M ${CX - HALF_BASE} ${CY - R_TAIL}`,
    `L ${CX} ${CY - R_NEEDLE}`,
    `L ${CX + HALF_BASE} ${CY - R_TAIL}`,
    'Z',
  ].join(' ');

  const dbCaption = polar(R_DB, 0);

  const AXIS_MIN = SCALE_POINTS_DB[0];
  const AXIS_MAX = SCALE_POINTS_DB[SCALE_POINTS_DB.length - 1] + OVERSHOOT_DB;
</script>

{#snippet meter(channel: string, label: string, angle: number, db: number)}
  <div
    class="vu-meter"
    data-testid="vu-meter-{channel}"
    role="meter"
    aria-label="{label} channel level"
    aria-valuemin={AXIS_MIN}
    aria-valuemax={AXIS_MAX}
    aria-valuenow={Math.round(db * 10) / 10}
    aria-valuetext="{db <= AXIS_MIN ? 'below' : ''} {Math.round(db * 10) / 10} dB"
  >
    <div class="vu-well" style="aspect-ratio: {VB_W} / {VB_H}">
    <svg viewBox="0 0 {VB_W} {VB_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <!-- Faceplate: cool white falling to a warm shelf at the bottom, the
             way an ivory-painted plate reads under a warm bezel light. -->
        <linearGradient id="vu-face-{channel}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FCFBF7" />
          <stop offset="55%" stop-color="#EFEDE4" />
          <stop offset="100%" stop-color="#DAD5C6" />
        </linearGradient>

        <!-- ── Recess shading ────────────────────────────────────────────
             The plate is set BEHIND the chassis opening, not flush with it.
             What sells that is the shadow the bezel lip drops onto the plate:
             heavy along the top edge, lighter down the sides, lighter still
             along the bottom where bounce fills it in. Four directional
             gradients rather than one radial — a radial reads as a glow in
             the middle, an asymmetric top-weighted falloff reads as depth. -->
        <linearGradient id="vu-lip-top-{channel}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0C0904" stop-opacity="0.74" />
          <stop offset="14%" stop-color="#0C0904" stop-opacity="0.40" />
          <stop offset="46%" stop-color="#0C0904" stop-opacity="0.13" />
          <stop offset="100%" stop-color="#0C0904" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="vu-lip-bottom-{channel}" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#140F07" stop-opacity="0.40" />
          <stop offset="30%" stop-color="#140F07" stop-opacity="0.14" />
          <stop offset="100%" stop-color="#140F07" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="vu-lip-left-{channel}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0F0B05" stop-opacity="0.56" />
          <stop offset="22%" stop-color="#0F0B05" stop-opacity="0.20" />
          <stop offset="100%" stop-color="#0F0B05" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="vu-lip-right-{channel}" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stop-color="#0F0B05" stop-opacity="0.56" />
          <stop offset="22%" stop-color="#0F0B05" stop-opacity="0.20" />
          <stop offset="100%" stop-color="#0F0B05" stop-opacity="0" />
        </linearGradient>

        <!-- The cut walls. Top is the lip's underside (no light reaches it),
             bottom faces up and catches the room, sides fall between. -->
        <linearGradient id="vu-wall-top-{channel}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.97" />
          <stop offset="100%" stop-color="#0B0906" stop-opacity="0.86" />
        </linearGradient>
        <linearGradient id="vu-wall-bottom-{channel}" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#7A7469" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#2A2721" stop-opacity="0.9" />
        </linearGradient>
        <!-- Mirrored pair: each side wall is darkest at the outer (deep) edge
             and picks up a little bounce where it meets the plate. -->
        <linearGradient id="vu-wall-left-{channel}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0A0805" stop-opacity="0.94" />
          <stop offset="100%" stop-color="#333028" stop-opacity="0.82" />
        </linearGradient>
        <linearGradient id="vu-wall-right-{channel}" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stop-color="#0A0805" stop-opacity="0.94" />
          <stop offset="100%" stop-color="#333028" stop-opacity="0.82" />
        </linearGradient>

        <!-- Glass sitting proud of the recessed plate: one broad diagonal
             sheen, and a hard bright sliver along the very top edge where the
             cover meets the lip. -->
        <linearGradient id="vu-glass-{channel}" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.13" />
          <stop offset="34%" stop-color="#FFFFFF" stop-opacity="0.03" />
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="vu-hub-{channel}" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stop-color="#4A4843" />
          <stop offset="100%" stop-color="#1D1C19" />
        </linearGradient>
      </defs>

      <rect width={VB_W} height={VB_H} fill="url(#vu-face-{channel})" />

      <!-- Channel plate -->
      <g class="pill">
        <rect x={CX - 46} y="14" width="92" height="30" rx="15" />
        <text x={CX} y="30">{label}</text>
      </g>

      <!-- Engraved scale -->
      <g class="ticks">
        {#each marks as m (m.db)}
          <line x1={m.inner.x} y1={m.inner.y} x2={m.outer.x} y2={m.outer.y} />
        {/each}
      </g>
      <path class="baseline" d={arcPath} />
      <g class="numerals">
        {#each marks as m (m.db)}
          <text x={m.text.x} y={m.text.y}>{m.label}</text>
        {/each}
      </g>
      <text class="unit" x={dbCaption.x} y={dbCaption.y}>dB</text>

      <!-- Needle. The shadow offset is applied OUTSIDE the rotation so the
           light stays fixed on the plate instead of swinging with the needle. -->
      <g transform="translate(4 6)">
        <g transform="rotate({angle.toFixed(3)} {CX} {CY})">
          <path class="needle-shadow" d={needlePath} />
        </g>
      </g>
      <g
        class="needle-pivot"
        data-testid="vu-meter-{channel}-needle"
        transform="rotate({angle.toFixed(3)} {CX} {CY})"
      >
        <path class="needle" d={needlePath} />
      </g>

      <circle class="hub" cx={CX} cy={CY} r={HUB_R} fill="url(#vu-hub-{channel})" />
      <circle class="hub-cap" cx={CX} cy={CY} r="6.5" />

      <!-- Bezel-lip shadow, cast onto the plate from the chassis opening.
           Above the ink (it falls on the printed face too) and below the
           glass. -->
      <!-- Inset by WALL so each gradient's dark end lands where the plate
           actually starts, not underneath the wall that covers it. -->
      <rect y={WALL} width={VB_W} height={LIP_TOP} fill="url(#vu-lip-top-{channel})" />
      <rect
        y={VB_H - WALL - LIP_BOTTOM}
        width={VB_W}
        height={LIP_BOTTOM}
        fill="url(#vu-lip-bottom-{channel})"
      />
      <rect x={WALL} width={LIP_SIDE} height={VB_H} fill="url(#vu-lip-left-{channel})" />
      <rect
        x={VB_W - WALL - LIP_SIDE}
        width={LIP_SIDE}
        height={VB_H}
        fill="url(#vu-lip-right-{channel})"
      />

      <!-- Cover glass. It sits inside the opening, so it goes UNDER the walls:
           painting it last would wash the black top wall out to grey. -->
      <rect width={VB_W} height={VB_H} fill="url(#vu-glass-{channel})" />

      <!-- The walls of the cut, in perspective. Drawn last of the opaque
           layers so they overlap the plate rather than the other way round —
           the chassis is in front of the plate, and that overlap is the cue.
           The inner edges get hairlines: dark where the top wall meets the
           plate (contact shadow), bright along the top of the bottom wall
           (the only cut edge that faces the light). -->
      <path d={wallTop} fill="url(#vu-wall-top-{channel})" />
      <path d={wallLeft} fill="url(#vu-wall-left-{channel})" />
      <path d={wallRight} fill="url(#vu-wall-right-{channel})" />
      <path d={wallBottom} fill="url(#vu-wall-bottom-{channel})" />
      <path
        d="M {WALL} {WALL} H {VB_W - WALL}"
        stroke="#000000"
        stroke-opacity="0.85"
        stroke-width="1.6"
        fill="none"
      />
      <path
        d="M {WALL} {VB_H - WALL} H {VB_W - WALL}"
        stroke="#CFC8B8"
        stroke-opacity="0.55"
        stroke-width="1.2"
        fill="none"
      />
    </svg>
    </div>
  </div>
{/snippet}

<div class="vu-meter-view" data-testid="vu-meter-view">
  {@render meter('l', 'LEFT', angleL, dbL)}
  {@render meter('r', 'RIGHT', angleR, dbR)}
</div>

<style>
  .vu-meter-view {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: 20px 28px;
    background: #08080a;
    box-sizing: border-box;
  }

  /* Portrait surfaces (mobile) stack the pair instead of squeezing it. The
     chassis is height-driven in landscape and width-driven here. */
  @media (max-aspect-ratio: 1 / 1) {
    .vu-meter-view {
      flex-direction: column;
      gap: 20px;
    }

    .vu-meter {
      height: auto;
      width: 100%;
    }

    .vu-well {
      height: auto;
      width: 100%;
    }
  }

  /*
   * Three layers, outermost first: the chassis face (.vu-meter), the cut
   * opening it sits behind (.vu-well), and the plate itself (svg).
   *
   * The chassis is brushed metal catching light from above. The opening is
   * cut through it, so its top inner edge is a hard shadow and its bottom
   * inner edge is a bright lip — that pairing is the whole depth illusion,
   * and it's why the highlight sits on the BOTTOM here and on the TOP of the
   * chassis. The plate's own recess shading is drawn inside the SVG, because
   * CSS inset shadows paint under child content and would be hidden by it.
   */
  .vu-meter {
    flex: 0 1 auto;
    min-width: 0;
    min-height: 0;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    /* A generous surround: the more chassis there is around the opening, the
       more the plate reads as sitting inside a box rather than pasted on. */
    padding: 30px;
    background:
      linear-gradient(158deg, #34333a 0%, #1d1d22 38%, #101014 72%, #08080b 100%);
    box-shadow:
      0 10px 26px rgba(0, 0, 0, 0.75),
      0 2px 4px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.11),
      inset 0 -1px 0 rgba(0, 0, 0, 0.8);
    box-sizing: border-box;
  }

  /* The opening cut through the chassis. `aspect-ratio` is set inline from the
     viewBox so the frame shrink-wraps the plate — otherwise the SVG letterboxes
     inside it and leaves dead chassis to the left and right. */
  .vu-well {
    height: 100%;
    width: auto;
    max-width: 100%;
    border-radius: 4px;
    overflow: hidden;
    background: #08080a;
    /* The cut walls themselves are drawn in the SVG; what's left for CSS is
       what the opening does to the chassis AROUND it — a hard rim, the lip
       above it catching light, and the depth it throws outwards. */
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.9),
      0 -2px 2px -1px rgba(255, 255, 255, 0.1),
      0 4px 12px rgba(0, 0, 0, 0.8),
      0 1px 3px rgba(0, 0, 0, 0.9);
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  }

  .pill rect {
    fill: none;
    stroke: #3a3934;
    stroke-width: 1.6;
  }

  .pill text {
    fill: #33322e;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 2.4px;
    text-anchor: middle;
    dominant-baseline: middle;
    /* letter-spacing pads the trailing side; nudge back to optical centre. */
    transform: translateX(1.2px);
  }

  .ticks line {
    stroke: #33322e;
    stroke-width: 2.2;
    stroke-linecap: butt;
  }

  .baseline {
    fill: none;
    stroke: #33322e;
    stroke-width: 2.4;
    stroke-linecap: round;
  }

  .numerals text {
    fill: #33322e;
    font-size: 19px;
    font-weight: 500;
    letter-spacing: -0.3px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .unit {
    fill: #33322e;
    font-size: 17px;
    font-weight: 400;
    letter-spacing: 0.4px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .needle {
    fill: #bf2f27;
  }

  .needle-shadow {
    fill: #1a1408;
    opacity: 0.22;
  }

  .hub {
    stroke: #6a675f;
    stroke-width: 0.8;
  }

  .hub-cap {
    fill: #8c8a83;
    opacity: 0.55;
  }
</style>
