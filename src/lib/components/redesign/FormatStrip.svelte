<script lang="ts">
  import HiResBadge from './HiResBadge.svelte';
  import { dsdRate } from './playerStateParsers';

  export let bitDepth: number | null = null;
  export let sampleRate: number | null = null;   // Hz, e.g. 96000
  export let codec: string | null = null;        // 'FLAC', 'AAC', 'MP3', 'DSD', 'MQA'

  $: formattedRate = sampleRate ? formatRate(sampleRate) : null;
  $: badgeKind = pickBadgeKind(codec, bitDepth, sampleRate);
  $: hasAnyValue = bitDepth != null || sampleRate != null || codec != null;

  function formatRate(hz: number): string {
    // DSD-rate territory (>= 1 MHz): render as MHz with 1 decimal,
    // dropping a trailing ".0". The cell at the bottom of the strip is
    // shared with the HI-RES / MQA badge rate, so it must be sensible
    // even when codec === 'DSD' (badge text is sourced from dsdRate()).
    if (hz >= 1_000_000) {
      return `${(hz / 1_000_000).toFixed(1).replace(/\.0$/, '')}MHz`;
    }
    return `${(hz / 1000).toString().replace(/\.0$/, '')}kHz`;
  }

  function pickBadgeKind(c: string | null, b: number | null, r: number | null): 'HI-RES' | 'DSD' | 'MQA' | null {
    if (c === 'DSD') return 'DSD';
    if (c === 'MQA') return 'MQA';
    if (b != null && r != null && b >= 24 && r >= 48000) return 'HI-RES';
    return null;
  }
</script>

{#if hasAnyValue}
  <div class="format-strip" data-testid="format-strip">
    {#if badgeKind === 'HI-RES' && formattedRate}
      <HiResBadge label="HI-RES" rate={formattedRate} />
      <span class="sep" aria-hidden="true"></span>
    {:else if badgeKind === 'DSD' && sampleRate}
      <HiResBadge label="DSD" rate={dsdRate(sampleRate)} />
      <span class="sep" aria-hidden="true"></span>
    {:else if badgeKind === 'MQA' && formattedRate}
      <HiResBadge label="MQA" rate={formattedRate} />
      <span class="sep" aria-hidden="true"></span>
    {/if}

    {#if bitDepth != null}
      <span class="cell">{bitDepth}-bit</span>
      <span class="sep" aria-hidden="true"></span>
    {/if}
    {#if formattedRate}
      <span class="cell">{formattedRate}</span>
      <span class="sep" aria-hidden="true"></span>
    {/if}
    {#if codec}
      <span class="cell">{codec}</span>
    {/if}
  </div>
{/if}

<style>
  .format-strip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text-secondary);
    font-size: 18px;
    font-family: system-ui, sans-serif;
  }
  .sep {
    /* Spec § 30: 1px gold vertical line, not a literal pipe character. */
    display: inline-block;
    width: 1px;
    height: 16px;
    background: var(--color-accent);
    opacity: 0.4;
    flex-shrink: 0;
  }
  .sep:last-child { display: none; }
</style>
