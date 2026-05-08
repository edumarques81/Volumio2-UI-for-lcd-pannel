<script lang="ts">
  import { currentAlbumBio, bioLoading } from '$lib/stores/bios';

  // Album title used to italicize matching substrings inside the bio paragraph.
  // Optional — when omitted or blank we render the summary as plain text. We
  // never use {@html}; segments are emitted via Svelte's text-binding so any
  // user-supplied HTML in the bio stays inert.
  export let title: string = '';

  type Segment = { kind: 'plain' | 'em'; text: string };

  // Escape every regex-special character so the title is matched as a literal
  // substring (e.g. "Hello.World+" must not be parsed as a regex).
  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildSegments(summary: string, rawTitle: string): Segment[] {
    if (!summary) return [];
    const trimmed = rawTitle?.trim() ?? '';
    if (!trimmed) return [{ kind: 'plain', text: summary }];

    const re = new RegExp(escapeRegex(trimmed), 'gi');
    const out: Segment[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(summary)) !== null) {
      if (m.index > last) {
        out.push({ kind: 'plain', text: summary.slice(last, m.index) });
      }
      out.push({ kind: 'em', text: m[0] }); // preserve original casing
      last = m.index + m[0].length;
      // Guard against zero-width matches (defensive — escapeRegex should
      // already prevent this, but a literal empty title is filtered above).
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < summary.length) {
      out.push({ kind: 'plain', text: summary.slice(last) });
    }
    return out;
  }

  $: segments = buildSegments($currentAlbumBio.summary, title);
</script>

{#if $currentAlbumBio.summary}
  <p class="bio">{#each segments as seg}{#if seg.kind === 'em'}<em>{seg.text}</em>{:else}{seg.text}{/if}{/each}</p>
{:else if $bioLoading}
  <div class="loading" aria-label="Loading bio"></div>
{/if}

<style>
  .bio {
    color: var(--color-text-primary);
    font-size: 18px;
    line-height: 1.5;
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
  }
  .loading {
    width: 80px;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, transparent, rgba(201,169,97,0.25), transparent);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  @keyframes shimmer {
    0%   { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
</style>
