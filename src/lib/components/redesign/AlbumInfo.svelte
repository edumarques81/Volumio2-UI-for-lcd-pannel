<script lang="ts">
  import { currentAlbumBio, bioLoading } from '$lib/stores/bios';
</script>

{#if $currentAlbumBio.summary}
  <p class="bio">{$currentAlbumBio.summary}</p>
{:else if $bioLoading}
  <div class="loading" aria-label="Loading bio"></div>
{/if}

<style>
  .bio {
    color: var(--color-text-secondary);
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
