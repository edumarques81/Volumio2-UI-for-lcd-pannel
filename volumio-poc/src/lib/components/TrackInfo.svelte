<script lang="ts">
  import { currentTrack, trackQuality } from '$lib/stores/player';
</script>

<div class="track-info">
  <div class="title">{$currentTrack.title}</div>
  <div class="metadata">
    <span class="artist">{$currentTrack.artist}</span>
    {#if $currentTrack.album}
      <span class="separator">•</span>
      <span class="album">{$currentTrack.album}</span>
    {/if}
  </div>
  {#if $trackQuality}
    <div class="quality">{$trackQuality}</div>
  {/if}
</div>

<style>
  .track-info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    min-width: 0;
    text-align: center;
  }

  .title {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .metadata {
    font-size: var(--font-size-lg);
    font-weight: 400;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .quality {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-accent);
    background: rgba(0, 122, 255, 0.15);
    padding: 4px 12px;
    border-radius: var(--radius-full);
    display: inline-block;
  }

  .separator {
    color: var(--color-text-tertiary);
  }
</style>
