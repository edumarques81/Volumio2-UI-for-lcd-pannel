<script lang="ts">
  import { formatTime } from '$lib/stores/player';
  export let tracks: { uri: string; title: string; duration: number }[] = [];
</script>

<!-- TODO: track-row affordance — rows are deliberately read-only metadata
     per spec § 51. See DESIGN-REVIEW 2026-05-04 (deferred to post-redesign).
     Do NOT add a click handler here without revisiting the spec. -->
<ol class="track-list">
  {#each tracks as t, i}
    <li>
      <span class="num">{i + 1}.</span>
      <span class="title">{t.title}</span>
      <span class="dur">{t.duration > 0 ? formatTime(t.duration) : '—'}</span>
    </li>
  {/each}
</ol>

<style>
  .track-list {
    list-style: none;
    margin: 0;
    padding: 0 16px 0 0;
    overflow-y: auto;
    max-height: 200px;
    scrollbar-gutter: stable;
  }
  li {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: 8px;
    padding: 4px 0;
    font-size: 18px;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
  }
  .num { color: var(--color-accent); opacity: 0.7; }
  .title { overflow: hidden; text-overflow: ellipsis; }
  .dur { font-variant-numeric: tabular-nums; }
</style>
