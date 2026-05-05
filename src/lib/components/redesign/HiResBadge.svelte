<script lang="ts">
  // Japan Audio Society style: gold-filled rectangle with two stacked lines
  // (label on top, rate on bottom). Used on the Player + Library screens.
  export let rate: string;                       // "96kHz", "192kHz", "DSD64", "24/96"
  export let label: 'HI-RES' | 'DSD' | 'MQA' = 'HI-RES';

  // Sizing — fits the 1920-wide LCD format strip cell
  const width = 88;
  const height = 32;
</script>

<svg
  class="hi-res-badge"
  width={width}
  height={height}
  viewBox="0 0 {width} {height}"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="{label} {rate}"
>
  <rect x="0" y="0" width={width} height={height} rx="3" fill="#c9a961" />
  <text
    x="50%" y="42%"
    text-anchor="middle" dominant-baseline="middle"
    fill="#000" font-weight="700" font-size="11"
    font-family="system-ui, sans-serif"
    letter-spacing="0.5"
  >{label}</text>
  <text
    x="50%" y="78%"
    text-anchor="middle" dominant-baseline="middle"
    fill="#000" font-weight="700" font-size="9"
    font-family="system-ui, sans-serif"
  >{rate}</text>
</svg>

<style>
  .hi-res-badge { display: inline-block; vertical-align: middle; }
</style>
