<script lang="ts">
  /**
   * Library-screen variant of the format strip. Replaces `FormatStrip` on
   * the Library surface only (PlayerView still mounts the original
   * `FormatStrip`). Visually mirrors the bottom-of-info-column strip in
   * `library-screen-target-2026-05-08.png`, with one deliberate departure:
   * the "Hi-Res Audio" text label was removed because it duplicated the
   * "HI-RES" badge to its right. The eq glyph alone is the verbal-free
   * hi-res indicator:
   *
   *   [eq glyph] | [HI-RES / 96kHz badge] | 24-bit / 96 kHz | FLAC
   *
   * When the album is not high-res (e.g. 16/44.1 lossless or any lossy
   * codec) the leading hi-res cluster is omitted and the component
   * degrades to a plain muted-gray spec strip:
   *
   *   16-bit / 44.1 kHz | FLAC
   *
   * Pipe separators only appear *between* present segments — never
   * leading, trailing, or doubled. When all three props are null the
   * component renders nothing.
   *
   * Helpers live in `formatStripHelpers.ts`; the badge SVG itself is the
   * unmodified `HiResBadge.svelte` reused as-is.
   */
  import HiResBadge from './HiResBadge.svelte';
  import { dsdRate } from './playerStateParsers';
  import { formatRate, pickBadgeKind } from './formatStripHelpers';

  export let bitDepth: number | null = null;
  export let sampleRate: number | null = null;   // Hz, e.g. 96000
  export let codec: string | null = null;        // 'FLAC' | 'AAC' | 'MP3' | 'DSD' | 'MQA' | ...

  // Compact form ("96kHz") used inside the badge — matches FormatStrip / HiResBadge.
  $: compactRate = sampleRate != null ? formatRate(sampleRate) : null;

  // Spaced form ("96 kHz" / "2.8 MHz") used in the muted-gray spec text,
  // per the reference mock's "24-bit / 96 kHz" treatment.
  $: spacedRate = compactRate ? compactRate.replace(/(kHz|MHz)$/, ' $1') : null;

  $: badgeKind = pickBadgeKind(codec, bitDepth, sampleRate);
  $: hasAnyValue = bitDepth != null || sampleRate != null || codec != null;

  // Pre-compute spec text (combined "{bit}-bit / {rate}" or whichever is
  // available) so the template stays declarative.
  $: specText = (() => {
    if (bitDepth != null && spacedRate) return `${bitDepth}-bit / ${spacedRate}`;
    if (bitDepth != null) return `${bitDepth}-bit`;
    if (spacedRate) return spacedRate;
    return null;
  })();

  // Show the leading "Hi-Res Audio" cluster (eq glyph + label + badge)
  // only when a badge applies AND we have the right metadata to render it.
  $: showHiResCluster =
    (badgeKind === 'HI-RES' && compactRate != null) ||
    (badgeKind === 'DSD' && sampleRate != null) ||
    (badgeKind === 'MQA' && compactRate != null);
</script>

{#if hasAnyValue}
  <div class="hi-res-audio-strip" data-testid="hi-res-audio-strip">
    {#if showHiResCluster}
      <svg
        class="eq-glyph"
        width="22"
        height="22"
        viewBox="0 0 22 22"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Hi-Res Audio indicator"
        data-testid="hi-res-equalizer-glyph"
      >
        <!-- Three vertical bars of varying height (iOS "now playing" look),
             filled with currentColor so the parent's gold accent token wins.
             The accompanying "Hi-Res Audio" text label was removed — the
             eq glyph alone signals hi-res, deduplicating with the badge. -->
        <rect x="2" y="9" width="4" height="11" rx="1" fill="currentColor" />
        <rect x="9" y="3" width="4" height="17" rx="1" fill="currentColor" />
        <rect x="16" y="6" width="4" height="14" rx="1" fill="currentColor" />
      </svg>
      <span class="sep" aria-hidden="true"></span>

      {#if badgeKind === 'HI-RES' && compactRate}
        <HiResBadge label="HI-RES" rate={compactRate} />
      {:else if badgeKind === 'DSD' && sampleRate != null}
        <HiResBadge label="DSD" rate={dsdRate(sampleRate)} />
      {:else if badgeKind === 'MQA' && compactRate}
        <HiResBadge label="MQA" rate={compactRate} />
      {/if}
    {/if}

    {#if specText}
      {#if showHiResCluster}<span class="sep" aria-hidden="true"></span>{/if}
      <span class="cell spec">{specText}</span>
    {/if}

    {#if codec}
      {#if showHiResCluster || specText}<span class="sep" aria-hidden="true"></span>{/if}
      <span class="cell codec">{codec}</span>
    {/if}
  </div>
{/if}

<style>
  .hi-res-audio-strip {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    color: var(--color-text-secondary);
    font-size: 17px;
    font-family: system-ui, sans-serif;
  }
  .eq-glyph {
    display: inline-block;
    vertical-align: middle;
    color: var(--color-accent);
  }
  .sep {
    /* Thin pipe separator between groups. 1px wide, ~16px tall, low-opacity
       muted gray — matches the reference mock's faint dividers. */
    display: inline-block;
    width: 1px;
    height: 16px;
    background: var(--color-text-secondary);
    opacity: 0.4;
    flex-shrink: 0;
  }
  .cell {
    color: var(--color-text-secondary);
    font-size: 17px;
    line-height: 1;
  }
</style>
