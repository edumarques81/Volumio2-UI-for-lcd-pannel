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
  // 2:1. The numeral half-spread is fixed by the 90° sweep and the pivot depth
  // at (CY − Y_NUM)·tan45, so a WIDER plate does not spread the scale — it
  // shrinks the scale into the middle third. 2:1 is where the spread matches
  // the reference instrument.
  //
  // The pivot sits ON the bottom edge (CY === VB_H), which is what bisects the
  // hub ball so exactly its top half shows.
  const VB_W = 700;
  const VB_H = 350;
  const CX = 350;
  const CY = 350;

  const HUB_R = 46;
  const TAIL = 14; // counterweight behind the pivot, hidden under the ball
  const R_NEEDLE = 252; // tip pushes just past the numeral row
  // Near-constant width: the reference pointer is a flat blade, not a taper.
  const HALF_BASE = 3.0;
  const HALF_TIP = 2.4;

  // Rows of the printed face, top to bottom.
  const PILL_Y = 45;
  const PILL_W = 88;
  const PILL_H = 28;
  const Y_NUM = 110;
  const TICK_TOP = 150;
  const TICK_BOT = 192;
  const RULE_Y = 204;
  const RULE_X0 = 38;
  const RULE_X1 = VB_W - RULE_X0;
  const UNIT_Y = 262;

  // How far the recess shading reaches in from the top and from each wall.
  // The two side figures differ because the walls are not lit alike — see the
  // lighting model below.
  // The top wash runs the FULL height. Stopping it partway leaves a horizontal
  // seam where the gradient ends, which reads as a painted band rather than as
  // light falling off; the eye finds that edge long before it notices depth.
  const LIP_TOP = VB_H;
  const LIP_OUTER_W = VB_W * 0.34;
  const LIP_INNER_W = VB_W * 0.1;

  /**
   * Where the needle ray at `deg` crosses the horizontal row `y`.
   *
   * The scale is printed FLAT but the pointer rotates, so a numeral can't sit
   * at a fixed pitch — it has to sit where its own ray lands. Ticks are drawn
   * along the same rays, which is what kills the parallax: the needle is always
   * collinear with the tick it indicates.
   */
  function xAt(deg: number, y: number): number {
    return CX + (CY - y) * Math.tan((deg * Math.PI) / 180);
  }

  /** Engraved points, precomputed once — the face never changes. */
  const marks = SCALE_POINTS_DB.map((db, i) => {
    const deg = ANGLE_MIN_DEG + (i * SWEEP_DEG) / (SCALE_POINTS_DB.length - 1);
    return {
      db,
      label: String(db),
      textX: xAt(deg, Y_NUM),
      tickX1: xAt(deg, TICK_TOP),
      tickX2: xAt(deg, TICK_BOT),
    };
  });

  // Needle drawn pointing straight up; the group rotates it into place.
  const needlePath = [
    `M ${CX - HALF_BASE} ${CY + TAIL}`,
    `L ${CX - HALF_TIP} ${CY - R_NEEDLE}`,
    `L ${CX + HALF_TIP} ${CY - R_NEEDLE}`,
    `L ${CX + HALF_BASE} ${CY + TAIL}`,
    'Z',
  ].join(' ');

  /**
   * The pointer's shadow, cast on the faceplate below it.
   *
   * Drawn centred on the blade and then DISPLACED bodily in world space by the
   * cast-shadow group, rather than painted as an off-centre band inside the
   * rotation. That distinction is the entire depth cue: a shadow welded
   * alongside the blade reads as a contact shadow — the needle lying flat on
   * the card — whereas a rigid translate away from the light is what a
   * pointer floating clear of the card actually casts. Since the needle and
   * its hub sit at one height, that displacement is constant, which is why a
   * single translate on a parent group is enough.
   *
   * Half-width is roughly three times the blade's, as a penumbra widens with
   * height, and the fill is correspondingly softer and lighter than a contact
   * shadow would be.
   */
  const SHADOW_HW = 7.5;
  const shadowPath = [
    `M ${CX - SHADOW_HW} ${CY + TAIL}`,
    `L ${CX - SHADOW_HW} ${CY - R_NEEDLE}`,
    `L ${CX + SHADOW_HW} ${CY - R_NEEDLE}`,
    `L ${CX + SHADOW_HW} ${CY + TAIL}`,
    'Z',
  ].join(' ');

  const HI_Y = CY - HUB_R * 0.46;

  /**
   * One lamp, centred BETWEEN the two plates and set above them.
   *
   * Everything directional is mirrored per channel off this: highlights face
   * inward towards the light, recess shading and cast shadows fall outward.
   * That mirroring, more than any individual gradient, is what tells the eye
   * where the lamp is — lighting both plates from the same corner (which is
   * what this did before) reads as two photographs of one meter rather than
   * one object lit once, and no amount of tuning a single plate fixes it.
   *
   * `lit` is the x-direction from a plate towards the light in viewBox terms:
   * the LEFT plate is lit from its right (+1), the RIGHT plate from its left
   * (−1). Every asymmetry below is derived from that one number, so the pair
   * cannot drift out of agreement.
   */
  const ELEV_X = 11; // horizontal throw of the front-plane cast shadow…
  const ELEV_Y = 4; //  …and its much smaller drop, the lamp being high.

  function lighting(lit: 1 | -1) {
    return {
      // objectBoundingBox u of the lit edge and of the far one. Gradients that
      // brighten towards the light run uLit → uDark; ones that darken away
      // from it run the other way.
      uLit: lit > 0 ? 1 : 0,
      uDark: lit > 0 ? 0 : 1,
      shX: -lit * ELEV_X,
      outerX: lit > 0 ? 0 : VB_W - LIP_OUTER_W,
      innerX: lit > 0 ? VB_W - LIP_INNER_W : 0,
      // Sphere shading: highlight towards the light, terminator away from it.
      ballCx: 0.5 + lit * 0.1,
      termX1: lit > 0 ? 0.88 : 0.12,
      termX2: lit > 0 ? 0.06 : 0.94,
      hiX: CX + lit * HUB_R * 0.34,
      hiTilt: lit > 0 ? 26 : -26,
    };
  }

  type Lighting = ReturnType<typeof lighting>;

  const LIGHT_L = lighting(1);
  const LIGHT_R = lighting(-1);

  const AXIS_MIN = SCALE_POINTS_DB[0];
  const AXIS_MAX = SCALE_POINTS_DB[SCALE_POINTS_DB.length - 1] + OVERSHOOT_DB;
</script>

{#snippet meter(channel: string, label: string, angle: number, db: number, L: Lighting)}
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
    <div class="vu-plate" style="aspect-ratio: {VB_W} / {VB_H}">
      <svg viewBox="0 0 {VB_W} {VB_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <!-- Near-white cool faceplate, brightest at the top corner nearest
               the lamp and falling away across the card towards the far one. -->
          <linearGradient id="vu-face-{channel}" x1={L.uLit} y1="0" x2={L.uDark} y2="0.85">
            <stop offset="0%" stop-color="#F8FAFC" />
            <stop offset="42%" stop-color="#EFF2F5" />
            <stop offset="100%" stop-color="#DDE3E8" />
          </linearGradient>

          <!-- Fine diagonal weave in the card stock, just at the edge of visible. -->
          <pattern
            id="vu-weave-{channel}"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(28)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="#7B8894"
              stroke-opacity="0.05"
              stroke-width="1"
            />
          </pattern>

          <!-- Soft diagonal sheen off the cover glass, entering from the lamp
               side. -->
          <linearGradient id="vu-sheen-{channel}" x1={L.uLit} y1="0" x2={L.uDark} y2="0.6">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.26" />
            <stop offset="38%" stop-color="#FFFFFF" stop-opacity="0.05" />
            <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
          </linearGradient>

          <!-- The hub is a BALL bisected by the bottom edge, not a flat disc,
               but a PALE one: a near-white dome ringed by a bright rim rather
               than a strongly modelled sphere. Being the most obviously
               three-dimensional thing on the plate, it is also where a
               mis-aimed light is most obvious — so its shading centre, its
               terminator and its specular all swing with `lit`. -->
          <radialGradient id="vu-ball-{channel}" cx={L.ballCx} cy="0.26" r="0.82">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="38%" stop-color="#FAFCFD" />
            <stop offset="72%" stop-color="#EAEFF2" />
            <stop offset="100%" stop-color="#D5DDE3" />
          </radialGradient>
          <!-- Soft cast shadow of the elevated hub. This replaces the contact
               ambient-occlusion ring that used to hug the ball: a hub floating
               clear of the card has nothing to occlude against, so a ring there
               would flatten it back down onto the print. -->
          <radialGradient id="vu-hub-shadow-{channel}" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="#0E1620" stop-opacity="0.22" />
            <stop offset="50%" stop-color="#0E1620" stop-opacity="0.20" />
            <stop offset="72%" stop-color="#0E1620" stop-opacity="0.10" />
            <stop offset="100%" stop-color="#0E1620" stop-opacity="0" />
          </radialGradient>
          <!-- Terminator: the far side of the sphere falls away from the light. -->
          <linearGradient id="vu-ball-term-{channel}" x1={L.termX1} y1="0.06" x2={L.termX2} y2="0.92">
            <stop offset="0%" stop-color="#6C7883" stop-opacity="0" />
            <stop offset="60%" stop-color="#6C7883" stop-opacity="0" />
            <stop offset="100%" stop-color="#6C7883" stop-opacity="0.22" />
          </linearGradient>
          <radialGradient id="vu-ball-hi-{channel}" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.90" />
            <stop offset="52%" stop-color="#FFFFFF" stop-opacity="0.28" />
            <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
          </radialGradient>

          <!-- Soft edges on the pointer shadow without paying for a per-frame
               blur filter: a cross-band gradient does the same job for free.
               userSpaceOnUse coordinates live in the rotating group's local
               space, so the band rotates with the blade. -->
          <linearGradient
            id="vu-needle-shadow-{channel}"
            gradientUnits="userSpaceOnUse"
            x1={CX - SHADOW_HW}
            y1="0"
            x2={CX + SHADOW_HW}
            y2="0"
          >
            <stop offset="0%" stop-color="#6E7A85" stop-opacity="0" />
            <stop offset="28%" stop-color="#6E7A85" stop-opacity="0.24" />
            <stop offset="72%" stop-color="#6E7A85" stop-opacity="0.24" />
            <stop offset="100%" stop-color="#6E7A85" stop-opacity="0" />
          </linearGradient>

          <!-- userSpaceOnUse: an objectBoundingBox gradient on a HORIZONTAL
               line has a zero-height box and paints nothing at all. -->
          <linearGradient
            id="vu-rule-{channel}"
            gradientUnits="userSpaceOnUse"
            x1={RULE_X0}
            y1="0"
            x2={RULE_X1}
            y2="0"
          >
            <stop offset="0%" stop-color="#14181C" stop-opacity="0.55" />
            <stop offset="10%" stop-color="#14181C" stop-opacity="1" />
            <stop offset="90%" stop-color="#14181C" stop-opacity="1" />
            <stop offset="100%" stop-color="#14181C" stop-opacity="0.55" />
          </linearGradient>

          <!-- Recess shading. The plate sits behind the screen surface, so the
               opening drops a shadow onto it. With the lamp centred between the
               plates and high, that shadow is deepest along the TOP of both and
               down the OUTER wall of each — the inner wall faces the light and
               only picks up a whisper. Drawn inside the SVG because a CSS inset
               shadow paints UNDER child content and would be hidden by the face.

               The outer band is deliberately wide and slow (26% of the plate),
               because it is the gradual falloff, not the depth at the wall, that
               reads as a light some distance away rather than a painted edge. -->
          <linearGradient id="vu-lip-top-{channel}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#08111A" stop-opacity="0.30" />
            <stop offset="12%" stop-color="#08111A" stop-opacity="0.15" />
            <stop offset="42%" stop-color="#08111A" stop-opacity="0.05" />
            <stop offset="100%" stop-color="#08111A" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="vu-lip-outer-{channel}" x1={L.uDark} y1="0" x2={L.uLit} y2="0">
            <stop offset="0%" stop-color="#08111A" stop-opacity="0.24" />
            <stop offset="35%" stop-color="#08111A" stop-opacity="0.10" />
            <stop offset="70%" stop-color="#08111A" stop-opacity="0.03" />
            <stop offset="100%" stop-color="#08111A" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="vu-lip-inner-{channel}" x1={L.uLit} y1="0" x2={L.uDark} y2="0">
            <stop offset="0%" stop-color="#08111A" stop-opacity="0.06" />
            <stop offset="100%" stop-color="#08111A" stop-opacity="0" />
          </linearGradient>

          <!-- The near-white hairline round the opening: the front-most surface
               catching the lamp directly. Brightest at the corner facing the
               light and fading round to the far one, which is what stops it
               reading as a drawn outline. -->
          <linearGradient id="vu-bevel-{channel}" x1={L.uLit} y1="0" x2={L.uDark} y2="1">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
            <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0.55" />
            <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.28" />
          </linearGradient>
        </defs>

        <rect width={VB_W} height={VB_H} fill="url(#vu-face-{channel})" />
        <rect width={VB_W} height={VB_H} fill="url(#vu-weave-{channel})" />

        <!-- Channel name in an outlined capsule, top centre. -->
        <g class="pill">
          <rect
            x={CX - PILL_W / 2}
            y={PILL_Y - PILL_H / 2}
            width={PILL_W}
            height={PILL_H}
            rx={PILL_H / 2}
          />
          <text x={CX} y={PILL_Y + 1}>{label}</text>
        </g>

        <!-- Flat numeral row, then radial ticks along the same rays. -->
        <g class="numerals">
          {#each marks as m (m.db)}
            <text x={m.textX.toFixed(2)} y={Y_NUM}>{m.label}</text>
          {/each}
        </g>
        <g class="ticks">
          {#each marks as m (m.db)}
            <line x1={m.tickX1.toFixed(2)} y1={TICK_TOP} x2={m.tickX2.toFixed(2)} y2={TICK_BOT} />
          {/each}
        </g>

        <line
          class="rule"
          x1={RULE_X0}
          y1={RULE_Y}
          x2={RULE_X1}
          y2={RULE_Y}
          stroke="url(#vu-rule-{channel})"
        />

        <text class="unit" x={CX} y={UNIT_Y}>dB</text>

        <!-- Shadow of the whole front-plane assembly — needle AND hub together,
             since they sit at one height. Displaced bodily away from the lamp
             rather than drawn against the blade; that displacement, read against
             the ~5-unit width of the pointer it belongs to, is what sets how far
             proud of the printed card the assembly appears. The inner group
             carries the same rotation as the needle, so the shadow swings with
             it while the offset stays put. -->
        <g class="cast-shadow" transform="translate({L.shX} {ELEV_Y})">
          <!-- Comfortably wider than the ball: the shadow is only visible where
               it clears the ball's own silhouette, so a radius that merely
               matches it shows nothing at all once the group is displaced. -->
          <circle cx={CX} cy={CY} r={HUB_R * 1.4} fill="url(#vu-hub-shadow-{channel})" />
          <g transform="rotate({angle.toFixed(3)} {CX} {CY})">
            <path d={shadowPath} fill="url(#vu-needle-shadow-{channel})" />
          </g>
        </g>

        <g
          class="needle-pivot"
          data-testid="vu-meter-{channel}-needle"
          transform="rotate({angle.toFixed(3)} {CX} {CY})"
        >
          <path class="needle" d={needlePath} />
        </g>

        <!-- Ball drawn AFTER the needle so the pointer emerges from under it. -->
        <circle cx={CX} cy={CY} r={HUB_R} fill="url(#vu-ball-{channel})" />
        <circle cx={CX} cy={CY} r={HUB_R} fill="url(#vu-ball-term-{channel})" />
        <circle class="hub-ring-out" cx={CX} cy={CY} r={HUB_R} />
        <circle class="hub-ring-in" cx={CX} cy={CY} r={HUB_R - 1.6} />
        <ellipse
          cx={L.hiX}
          cy={HI_Y}
          rx={HUB_R * 0.34}
          ry={HUB_R * 0.21}
          transform="rotate({L.hiTilt} {L.hiX} {HI_Y})"
          fill="url(#vu-ball-hi-{channel})"
        />

        <rect width={VB_W} height={VB_H} fill="url(#vu-sheen-{channel})" />
        <rect width={VB_W} height={LIP_TOP} fill="url(#vu-lip-top-{channel})" />
        <rect x={L.outerX} width={LIP_OUTER_W} height={VB_H} fill="url(#vu-lip-outer-{channel})" />
        <rect x={L.innerX} width={LIP_INNER_W} height={VB_H} fill="url(#vu-lip-inner-{channel})" />

        <!-- Last of all, over the sheen and the recess shading: the bright edge
             is the surface nearest the viewer, so nothing may wash over it.
             rx matches .vu-plate's 6px border-radius through the viewBox scale,
             or `overflow: hidden` would clip square corners off it. -->
        <rect
          class="bevel"
          x="0.9"
          y="0.9"
          width={VB_W - 1.8}
          height={VB_H - 1.8}
          rx="5"
          stroke="url(#vu-bevel-{channel})"
        />
      </svg>
    </div>
  </div>
{/snippet}

<div class="vu-meter-view" data-testid="vu-meter-view">
  {@render meter('l', 'LEFT', angleL, dbL, LIGHT_L)}
  {@render meter('r', 'RIGHT', angleR, dbR, LIGHT_R)}
</div>

<style>
  .vu-meter-view {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 30px;
    padding: 30px;
    background: #070709;
    box-sizing: border-box;
  }

  /* Portrait surfaces (mobile) stack the pair instead of squeezing it. The
     plate is height-driven in landscape and width-driven here. */
  @media (max-aspect-ratio: 1 / 1) {
    .vu-meter-view {
      flex-direction: column;
      gap: 20px;
    }

    .vu-meter {
      height: auto;
      width: 100%;
    }

    .vu-plate {
      height: auto;
      width: 100%;
    }
  }

  .vu-meter {
    flex: 0 1 auto;
    min-width: 0;
    min-height: 0;
    height: 100%;
    width: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /*
   * No chassis, no bezel: the plate is cut straight into the black screen, the
   * way the instrument sits in the chassis band of the reference. All that is
   * left for CSS is the hard dark rim, one hairline of light along the bottom
   * sill, and the depth it throws outwards.
   *
   * `aspect-ratio` is set inline from the viewBox so the frame shrink-wraps the
   * plate — otherwise the SVG letterboxes inside a wide flex item.
   */
  .vu-plate {
    height: 100%;
    width: auto;
    max-width: 100%;
    border-radius: 6px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.9),
      0 1px 0 rgba(255, 255, 255, 0.14),
      0 16px 36px rgba(0, 0, 0, 0.6);
  }

  /*
   * The frontend bundles no webfonts, and on the Pi `system-ui` resolves to
   * DejaVu Sans — far wider and heavier than the light grotesque on the
   * faceplate. Piboto is the Pi's metric-compatible Roboto clone and ships a
   * Light cut; Nimbus Sans is the Helvetica clone. Weight 300 picks the light
   * face on the Mac (Helvetica Neue) and on the Pi (Piboto Light) alike.
   */
  svg {
    width: 100%;
    height: 100%;
    display: block;
    font-family: 'Helvetica Neue', Piboto, Roboto, 'Nimbus Sans', Helvetica, Arial, sans-serif;
  }

  /* Ink on the faceplate is black, only faintly cooled — the reference prints
     at near-full contrast against the near-white card. */
  .pill rect {
    fill: none;
    stroke: #14181c;
    stroke-opacity: 0.42;
    stroke-width: 1.1;
  }

  .pill text {
    fill: #14181c;
    fill-opacity: 0.9;
    font-size: 17px;
    font-weight: 300;
    letter-spacing: 1.4px;
    text-anchor: middle;
    dominant-baseline: middle;
    /* letter-spacing pads the trailing side; nudge back to optical centre. */
    transform: translateX(0.7px);
  }

  .ticks line {
    stroke: #14181c;
    stroke-opacity: 0.78;
    stroke-width: 1.5;
    stroke-linecap: butt;
  }

  .rule {
    stroke: #14181c;
    stroke-opacity: 0.92;
    stroke-width: 1.6;
  }

  .numerals text {
    fill: #14181c;
    fill-opacity: 0.95;
    font-size: 26px;
    font-weight: 300;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .unit {
    fill: #14181c;
    fill-opacity: 0.95;
    font-size: 40px;
    font-weight: 300;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .needle {
    fill: #e03b32;
  }

  .bevel {
    fill: none;
    stroke-width: 1.8;
  }

  .hub-ring-in {
    fill: none;
    stroke: #ffffff;
    stroke-opacity: 0.85;
    stroke-width: 1.6;
  }

  .hub-ring-out {
    fill: none;
    stroke: #59636d;
    stroke-opacity: 0.3;
    stroke-width: 1;
  }
</style>
