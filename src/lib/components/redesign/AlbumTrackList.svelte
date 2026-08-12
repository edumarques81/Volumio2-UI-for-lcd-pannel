<script lang="ts">
  import { formatTime } from '$lib/stores/player';

  type TrackRow = { uri: string; title: string; duration: number; disc?: number; trackNumber?: number };

  export let tracks: TrackRow[] = [];
  // Phase 3 (BROWSE-07): album.discCount, passed down from AlbumPage. When
  // <= 1 (the vast majority of albums), rendering is byte-identical to the
  // pre-Phase-3 flat list — zero regression to single-disc numbering.
  export let discCount: number = 0;

  function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
  }

  interface DiscGroup {
    disc: number;
    tracks: TrackRow[];
  }

  // Group consecutive same-disc tracks, preserving arrival order — tracks
  // already arrive pre-sorted by (disc, trackNumber, title) from the
  // backend, so this never re-sorts, only buckets adjacent runs.
  $: discGroups = ((): DiscGroup[] => {
    if (discCount <= 1) return [];
    const groups: DiscGroup[] = [];
    for (const t of tracks) {
      const disc = t.disc ?? 1;
      const last = groups[groups.length - 1];
      if (last && last.disc === disc) {
        last.tracks.push(t);
      } else {
        groups.push({ disc, tracks: [t] });
      }
    }
    return groups;
  })();
</script>

<!-- TODO: track-row affordance — rows are deliberately read-only metadata
     per spec § 51. See DESIGN-REVIEW 2026-05-08 (deferred to post-redesign).
     Do NOT add a click handler here without revisiting the spec. -->
<ol class="track-list">
  {#if discCount > 1}
    {#each discGroups as group (group.disc)}
      <li class="disc-header" data-testid="disc-header">Disc {group.disc}</li>
      {#each group.tracks as t, i}
        <li>
          <span class="num">{pad2(t.trackNumber || i + 1)}</span>
          <span class="title">{t.title}</span>
          <span class="dur">{t.duration > 0 ? formatTime(t.duration) : '—'}</span>
        </li>
      {/each}
    {/each}
  {:else}
    {#each tracks as t, i}
      <li>
        <span class="num">{pad2(i + 1)}</span>
        <span class="title">{t.title}</span>
        <span class="dur">{t.duration > 0 ? formatTime(t.duration) : '—'}</span>
      </li>
    {/each}
  {/if}
</ol>

<style>
  .track-list {
    list-style: none;
    margin: 0;
    padding: 0 16px 0 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }
  li {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: 8px;
    padding: 8px 0;
    font-size: 18px;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
  }
  .disc-header {
    display: block;
    padding: 12px 0 4px 0;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-accent);
    white-space: nowrap;
  }
  .disc-header:first-child {
    padding-top: 0;
  }
  .num {
    color: var(--color-accent);
    opacity: 1;
    font-variant-numeric: tabular-nums;
  }
  .title {
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dur {
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
</style>
