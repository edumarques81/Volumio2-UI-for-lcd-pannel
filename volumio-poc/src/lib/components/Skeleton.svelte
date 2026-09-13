<script lang="ts">
  /**
   * Skeleton loading component
   *
   * Usage:
   * <Skeleton /> - Default rectangle
   * <Skeleton width="100px" height="20px" />
   * <Skeleton variant="circle" size="48px" />
   * <Skeleton variant="text" lines={3} />
   */

  export let variant: 'rectangle' | 'circle' | 'text' = 'rectangle';
  export let width: string = '100%';
  export let height: string = '20px';
  export let size: string = '48px'; // For circle variant
  export let lines: number = 1; // For text variant
  export let rounded: boolean = true;
</script>

{#if variant === 'text'}
  <div class="skeleton-text">
    {#each Array(lines) as _, i}
      <div
        class="skeleton"
        class:rounded
        style:width={i === lines - 1 && lines > 1 ? '60%' : '100%'}
        style:height="1em"
      ></div>
    {/each}
  </div>
{:else if variant === 'circle'}
  <div
    class="skeleton skeleton-circle"
    style:width={size}
    style:height={size}
  ></div>
{:else}
  <div
    class="skeleton"
    class:rounded
    style:width
    style:height
  ></div>
{/if}

<style>
  .skeleton {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 0%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0.05) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton.rounded {
    border-radius: var(--radius-sm);
  }

  .skeleton-circle {
    border-radius: 50%;
  }

  .skeleton-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
      background: rgba(255, 255, 255, 0.1);
    }
  }
</style>
