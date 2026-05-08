<script lang="ts">
  // Stand-alone interactive edge chevron for the Library screen.
  // Parent positions horizontally via side prop (left:0 / right:0) — the
  // component handles vertical centering on its own. Stroke-only SVG glyph
  // so weight is consistent across platforms (no Unicode `‹`/`›`).
  export let side: 'left' | 'right';
  export let onTap: () => void;

  $: ariaLabel = side === 'left' ? 'Previous album' : 'Next album';
  $: testId = `library-chevron-${side}`;
  // Left chevron points left (`‹`): from upper-right → middle-left → lower-right.
  // Right chevron points right (`›`): from upper-left → middle-right → lower-left.
  $: chevronPoints = side === 'left' ? '40,16 16,32 40,48' : '24,16 48,32 24,48';
  $: positionStyle = side === 'left' ? 'left: 0;' : 'right: 0;';
</script>

<button
  class="edge-chevron"
  type="button"
  aria-label={ariaLabel}
  data-testid={testId}
  style={positionStyle}
  on:click={onTap}
>
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <polyline
      points={chevronPoints}
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </svg>
</button>

<style>
  .edge-chevron {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 88px;
    min-height: 88px;
    padding: 0;
    margin: 0;
    background: none;
    border: none;
    /* Same color as the album title (off-white) — matches the reference
       image. Was gold; the mock shows them in the title color. */
    color: var(--color-text-primary);
    cursor: pointer;
    transition: transform 80ms ease;
    -webkit-tap-highlight-color: transparent;
  }
  .edge-chevron:active {
    transform: translateY(-50%) scale(0.92);
  }
  .edge-chevron:focus-visible {
    outline: 2px solid var(--color-text-primary);
    outline-offset: 4px;
    border-radius: 8px;
  }
</style>
