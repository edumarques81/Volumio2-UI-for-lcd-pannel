<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  export let title: string = '';
  export let artist: string = '';
  export let album: string = '';
</script>

<div class="metadata-block">
  {#if title}
    <h1 class="title-row">{title}</h1>
  {/if}
  {#if artist}
    <div class="artist-row">
      <Icon name="user" size={22} />
      <span>{artist}</span>
    </div>
  {/if}
  {#if album}
    <div class="album-row">
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
    white-space: nowrap;
    overflow: hidden;
  }
  .artist-row :global(svg), .album-row :global(svg) {
    color: var(--color-accent);
    flex-shrink: 0;
  }
</style>
