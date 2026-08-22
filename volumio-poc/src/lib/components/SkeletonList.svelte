<script lang="ts">
  /**
   * Skeleton list loading component
   * Shows a placeholder list while content is loading
   */

  import Skeleton from './Skeleton.svelte';

  export let count: number = 5;
  export let variant: 'browse' | 'queue' = 'browse';
</script>

<div class="skeleton-list">
  {#each Array(count) as _, i}
    <div class="skeleton-item skeleton-item--{variant}">
      {#if variant === 'queue'}
        <div class="skeleton-drag">
          <Skeleton width="16px" height="24px" />
        </div>
        <div class="skeleton-number">
          <Skeleton width="24px" height="24px" />
        </div>
      {/if}

      <div class="skeleton-art">
        <Skeleton variant="rectangle" width="100%" height="100%" rounded={false} />
      </div>

      <div class="skeleton-info">
        <Skeleton width={i % 2 === 0 ? '70%' : '85%'} height="18px" />
        <Skeleton width={i % 3 === 0 ? '50%' : '60%'} height="14px" />
      </div>

      {#if variant === 'queue'}
        <div class="skeleton-duration">
          <Skeleton width="40px" height="14px" />
        </div>
      {/if}

      <div class="skeleton-action">
        <Skeleton variant="circle" size="24px" />
      </div>
    </div>
  {/each}
</div>

<style>
  .skeleton-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .skeleton-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-md);
  }

  .skeleton-item--queue {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .skeleton-drag {
    width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skeleton-number {
    width: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skeleton-art {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-shrink: 0;
  }

  .skeleton-item--queue .skeleton-art {
    width: 48px;
    height: 48px;
  }

  .skeleton-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .skeleton-duration {
    flex-shrink: 0;
    min-width: 50px;
    display: flex;
    justify-content: flex-end;
  }

  .skeleton-action {
    flex-shrink: 0;
    opacity: 0.3;
  }
</style>
