<script lang="ts" generics="T">
  import { createEventDispatcher } from 'svelte';

  export let items: T[] = [];
  export let keyFn: (item: T) => string;
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    reorder: { from: number; to: number };
  }>();

  let draggedIndex: number | null = null;
  let dropTargetIndex: number | null = null;
  let touchStartY = 0;
  let touchCurrentY = 0;
  let draggedElement: HTMLElement | null = null;
  let listElement: HTMLElement;

  function handleDragStart(event: DragEvent, index: number) {
    if (disabled) return;

    draggedIndex = index;
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', index.toString());

    // Set a custom drag image (optional)
    const target = event.target as HTMLElement;
    target.classList.add('dragging');
  }

  function handleDragEnd(event: DragEvent) {
    const target = event.target as HTMLElement;
    target.classList.remove('dragging');
    draggedIndex = null;
    dropTargetIndex = null;
  }

  function handleDragOver(event: DragEvent, index: number) {
    if (disabled || draggedIndex === null) return;

    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';

    if (index !== draggedIndex) {
      dropTargetIndex = index;
    }
  }

  function handleDragLeave(event: DragEvent) {
    // Only clear if we're actually leaving the drop zone
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (!relatedTarget || !listElement.contains(relatedTarget)) {
      dropTargetIndex = null;
    }
  }

  function handleDrop(event: DragEvent, index: number) {
    if (disabled || draggedIndex === null) return;

    event.preventDefault();

    if (draggedIndex !== index) {
      dispatch('reorder', { from: draggedIndex, to: index });
    }

    draggedIndex = null;
    dropTargetIndex = null;
  }

  // Touch support for mobile drag-and-drop
  function handleTouchStart(event: TouchEvent, index: number) {
    if (disabled) return;

    const touch = event.touches[0];
    touchStartY = touch.clientY;
    touchCurrentY = touch.clientY;
    draggedIndex = index;
    draggedElement = event.target as HTMLElement;

    // Find the list item element
    while (draggedElement && !draggedElement.classList.contains('draggable-item')) {
      draggedElement = draggedElement.parentElement;
    }

    if (draggedElement) {
      draggedElement.classList.add('dragging');
    }
  }

  function handleTouchMove(event: TouchEvent) {
    if (disabled || draggedIndex === null || !draggedElement) return;

    const touch = event.touches[0];
    touchCurrentY = touch.clientY;

    // Calculate new position
    const delta = touchCurrentY - touchStartY;
    draggedElement.style.transform = `translateY(${delta}px)`;

    // Find the item we're hovering over
    const elements = Array.from(listElement.querySelectorAll('.draggable-item'));
    for (let i = 0; i < elements.length; i++) {
      if (i === draggedIndex) continue;

      const rect = elements[i].getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;

      if (touchCurrentY > rect.top && touchCurrentY < rect.bottom) {
        dropTargetIndex = i;
        break;
      }
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (disabled || draggedIndex === null) return;

    if (draggedElement) {
      draggedElement.classList.remove('dragging');
      draggedElement.style.transform = '';
    }

    if (dropTargetIndex !== null && dropTargetIndex !== draggedIndex) {
      dispatch('reorder', { from: draggedIndex, to: dropTargetIndex });
    }

    draggedIndex = null;
    dropTargetIndex = null;
    draggedElement = null;
  }
</script>

<div class="draggable-list" bind:this={listElement}>
  {#each items as item, index (keyFn(item))}
    <div
      class="draggable-item"
      class:drag-over={dropTargetIndex === index && draggedIndex !== index}
      class:dragging={draggedIndex === index}
      draggable={!disabled}
      on:dragstart={(e) => handleDragStart(e, index)}
      on:dragend={handleDragEnd}
      on:dragover={(e) => handleDragOver(e, index)}
      on:dragleave={handleDragLeave}
      on:drop={(e) => handleDrop(e, index)}
      on:touchstart={(e) => handleTouchStart(e, index)}
      on:touchmove={handleTouchMove}
      on:touchend={handleTouchEnd}
      role="listitem"
    >
      <slot {item} {index} isDragging={draggedIndex === index} />
    </div>
  {/each}
</div>

<style>
  .draggable-list {
    display: flex;
    flex-direction: column;
    gap: var(--draggable-gap, 4px);
  }

  .draggable-item {
    position: relative;
    transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
    user-select: none;
    touch-action: none;
  }

  .draggable-item.dragging {
    opacity: 0.5;
    z-index: 1000;
  }

  .draggable-item.drag-over {
    transform: translateY(4px);
  }

  .draggable-item.drag-over::before {
    content: '';
    position: absolute;
    top: -4px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--color-accent, #007aff);
    border-radius: 1px;
  }

  /* Touch feedback */
  @media (hover: none) {
    .draggable-item:active {
      background: rgba(255, 255, 255, 0.05);
    }
  }
</style>
