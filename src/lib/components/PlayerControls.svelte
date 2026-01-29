<script lang="ts">
  import { playerActions, isPlaying, shuffle, repeat } from '$lib/stores/player';
  import Icon from './Icon.svelte';

  function handlePlayPause() {
    if ($isPlaying) {
      playerActions.pause();
    } else {
      playerActions.play();
    }
  }

  function cycleRepeat() {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf($repeat);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    playerActions.setRepeat(nextMode);
  }
</script>

<div class="player-controls" data-testid="player-controls">
  <!-- Shuffle -->
  <button
    class="control-btn secondary"
    class:active={$shuffle}
    data-testid="btn-shuffle"
    on:click={playerActions.toggleShuffle}
    aria-label="Shuffle"
  >
    <Icon name="shuffle" size={24} />
  </button>

  <!-- Previous -->
  <button
    class="control-btn secondary"
    data-testid="btn-prev"
    on:click={playerActions.prev}
    aria-label="Previous track"
  >
    <Icon name="skip-back" size={36} />
  </button>

  <!-- Play/Pause (Large center button) -->
  <button
    class="control-btn primary"
    data-testid="btn-play-pause"
    on:click={handlePlayPause}
    aria-label={$isPlaying ? 'Pause' : 'Play'}
  >
    <Icon name={$isPlaying ? 'pause' : 'play'} size={44} />
  </button>

  <!-- Next -->
  <button
    class="control-btn secondary"
    data-testid="btn-next"
    on:click={playerActions.next}
    aria-label="Next track"
  >
    <Icon name="skip-forward" size={36} />
  </button>

  <!-- Repeat -->
  <button
    class="control-btn secondary"
    class:active={$repeat !== 'off'}
    data-testid="btn-repeat"
    on:click={cycleRepeat}
    aria-label="Repeat: {$repeat}"
  >
    <Icon name={$repeat === 'one' ? 'repeat-one' : 'repeat'} size={24} />
  </button>
</div>

<style>
  .player-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-xl);
    padding: var(--spacing-sm) 0;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
    -webkit-tap-highlight-color: transparent;
    background: none;
    color: var(--color-text-primary);
  }

  /* Touch target size: minimum 44px */
  .control-btn.secondary {
    width: 64px;
    height: 64px;
  }

  .control-btn.primary {
    width: 88px;
    height: 88px;
    background: linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent-dark) 100%);
    color: #ffffff;
    box-shadow: 0 4px 24px rgba(0, 122, 255, 0.5);
  }

  .control-btn:hover {
    transform: scale(1.08);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .control-btn.primary:hover {
    box-shadow: 0 8px 32px rgba(0, 122, 255, 0.7);
  }

  .control-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .control-btn.active {
    color: var(--color-accent);
  }
</style>
