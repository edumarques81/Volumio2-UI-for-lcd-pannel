<script lang="ts">
  import { onMount } from 'svelte';
  import LibrarySettings from './settings/LibrarySettings.svelte';
  import AudioSettings from './settings/AudioSettings.svelte';
  import SystemSettings from './settings/SystemSettings.svelte';
  import { initSourcesStore } from '$lib/stores/sources';
  import { initVersionStore } from '$lib/stores/version';
  import { audioDevicesActions } from '$lib/stores/audioDevices';

  // Lazy-init stores that only Settings consumes. All three init functions
  // are idempotent, so re-mounting Settings doesn't double-register listeners.
  let audioDevicesUnsub: (() => void) | null = null;
  onMount(() => {
    initSourcesStore();
    initVersionStore();
    audioDevicesUnsub = audioDevicesActions.init();
    return () => {
      audioDevicesUnsub?.();
    };
  });
</script>

<section class="settings-view" data-testid="settings-view" aria-label="Settings">
  <div class="column" data-testid="settings-column-library">
    <LibrarySettings />
  </div>
  <div class="separator" aria-hidden="true"></div>
  <div class="column" data-testid="settings-column-audio">
    <AudioSettings />
  </div>
  <div class="separator" aria-hidden="true"></div>
  <div class="column" data-testid="settings-column-system">
    <SystemSettings />
  </div>
</section>

<style>
  .settings-view {
    display: grid;
    grid-template-columns: 1fr 1px 1fr 1px 1fr;
    width: 100%;
    height: 100%;
    background: transparent;
    color: var(--color-text-primary);
    overflow: hidden;
  }
  .column {
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
  }
  .separator {
    width: 1px;
    height: 100%;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(255, 255, 255, 0.5) 50%,
      transparent 100%
    );
    pointer-events: none;
  }
</style>
