<script lang="ts">
  import { currentTrack } from '$lib/stores/player';

  export let size: 'small' | 'medium' | 'large' = 'large';

  const sizes = {
    small: 80,
    medium: 160,
    large: 360 // 440px - 64px padding = 376px available, using 360px
  };

  $: albumart = $currentTrack.albumart;
  $: title = $currentTrack.title;
</script>

<div class="album-art {size}" style="--size: {sizes[size]}px">
  {#if albumart}
    <img src={albumart} alt={title} on:error={(e) => {
      e.currentTarget.src = '/default-album.svg';
    }} />
  {:else}
    <div class="placeholder">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  {/if}
</div>

<style>
  .album-art {
    width: var(--size);
    height: var(--size);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    flex-shrink: 0;
    background: var(--color-bg-secondary);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
    background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%);
  }
</style>
