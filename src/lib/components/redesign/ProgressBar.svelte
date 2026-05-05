<script lang="ts">
  // Plays-side gold, 9px track, 24px gold thumb. Tap-to-seek + drag-to-scrub.
  // Drag suspends `seek` updates from the parent until release; emits `onSeek`
  // only on commit.
  export let seek: number = 0;       // seconds (committed value from store)
  export let duration: number = 0;   // seconds
  export let onSeek: (newSeek: number) => void;

  let dragging = false;
  let dragValue = 0;

  $: displaySeek = dragging ? dragValue : seek;
  $: percent = duration > 0 ? Math.max(0, Math.min(100, (displaySeek / duration) * 100)) : 0;

  function format(s: number): string {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const total = Math.floor(s);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function positionFromEvent(e: MouseEvent | PointerEvent, track: Element): number {
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    return duration > 0 ? (x / rect.width) * duration : 0;
  }

  function handleClick(e: MouseEvent) {
    if (dragging) return;
    const newSeek = positionFromEvent(e, e.currentTarget as Element);
    onSeek(newSeek);
  }

  function handlePointerDown(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragging = true;
    dragValue = positionFromEvent(e, target);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragging) return;
    dragValue = positionFromEvent(e, e.currentTarget as HTMLElement);
  }

  function handlePointerUp(e: PointerEvent) {
    if (!dragging) return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    onSeek(dragValue);
    dragging = false;
  }

  function handleKey(e: KeyboardEvent) {
    if (duration <= 0) return;
    const step = Math.max(1, duration * 0.05); // 5% per arrow press
    if (e.key === 'ArrowRight') {
      onSeek(Math.min(duration, seek + step));
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      onSeek(Math.max(0, seek - step));
      e.preventDefault();
    }
  }
</script>

<div class="progress-bar">
  <span class="time time-start">{format(displaySeek)}</span>
  <div
    class="track"
    role="slider"
    tabindex="0"
    aria-valuemin="0"
    aria-valuemax={duration}
    aria-valuenow={Math.round(displaySeek)}
    data-testid="progress-track"
    on:click={handleClick}
    on:keydown={handleKey}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    on:pointercancel={handlePointerUp}
  >
    <div class="fill" style="width:{percent}%"></div>
    <div class="thumb" style="left:{percent}%" data-testid="progress-thumb"></div>
  </div>
  <span class="time time-end">{format(duration)}</span>
</div>

<style>
  .progress-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
  }
  .time {
    font-size: 24px;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    min-width: 60px;
  }
  .time-end { text-align: right; }
  .track {
    position: relative;
    flex: 1;
    height: var(--progress-track-height);
    background: var(--color-bg-unplayed-track);
    border-radius: 999px;
    cursor: pointer;
    /* expand hit zone without changing visual size */
    padding: calc((var(--hit-target-min) - var(--progress-track-height)) / 2) 0;
    background-clip: content-box;
  }
  .fill {
    position: absolute;
    top: calc((var(--hit-target-min) - var(--progress-track-height)) / 2);
    left: 0;
    height: var(--progress-track-height);
    background: var(--color-accent);
    border-radius: 999px;
    pointer-events: none;
  }
  .thumb {
    position: absolute;
    top: 50%;
    width: var(--progress-thumb-size);
    height: var(--progress-thumb-size);
    background: var(--color-accent);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 8px var(--color-accent-glow);
    pointer-events: none;
  }
</style>
