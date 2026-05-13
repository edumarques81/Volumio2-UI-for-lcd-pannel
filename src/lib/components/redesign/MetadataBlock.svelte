<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { selectedArtist } from '$lib/stores/library';

  export let title: string = '';
  export let artist: string = '';
  export let album: string = '';

  $: isFiltered = $selectedArtist === artist && artist !== '';
</script>

<div class="metadata-block" data-testid="metadata-block">
  {#if title}
    <h1 class="title-row" data-testid="metadata-title">{title}</h1>
  {/if}
  {#if artist}
    <div class="artist-row" class:is-filter-active={isFiltered} data-testid="metadata-artist">
      <Icon name="user" size={22} />
      <span>{artist}</span>
    </div>
  {/if}
  {#if album}
    <div class="album-row" data-testid="metadata-album">
      <Icon name="vinyl-record" size={22} />
      <span>{album}</span>
    </div>
  {/if}
</div>

<style>
  .metadata-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }
  .title-row {
    font-size: 56px;
    font-weight: 400;
    color: var(--color-text-primary);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.1;
  }
  .artist-row, .album-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 300;
    color: var(--color-text-secondary);
    overflow: hidden;
    transition: color 200ms ease-out;
  }
  .artist-row span, .album-row span {
    min-width: 0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artist-row :global(svg), .album-row :global(svg) {
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .artist-row.is-filter-active {
    color: var(--color-accent-bright);
  }

  @media (prefers-reduced-motion: reduce) {
    .artist-row { transition: none; }
  }
</style>
