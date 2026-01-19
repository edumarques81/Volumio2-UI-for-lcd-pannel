# Volumio2-UI Svelte Migration Plan

## Executive Summary

**Objective**: Migrate Volumio2-UI from AngularJS 1.5 to Svelte 4, while simultaneously adapting the interface for a 1920x440 LCD touchscreen panel with iOS 26-inspired design.

**Target Platform**: Raspberry Pi 5 (ARM64)
**Display**: 1920x440 LCD touchscreen
**Design Language**: iOS 26 (modern iOS look and feel)
**Layout**: Single horizontal bar (all-in-one)
**Touch Targets**: Minimum 44x44px (iOS standard)
**Typography**: Large & readable (18-24px base), using open-source fonts: Inter, Public Sans, Roboto, Manrope, IBM Plex Sans, Satoshi, General Sans, Fira Sans, or Open Sans

---

## Migration Strategy Overview

### Phased Approach

1. **Phase 1**: Project Setup & Development Environment (1-2 weeks)
2. **Phase 2**: Service Layer Migration (2-3 weeks)
3. **Phase 3**: Core Components & Layout (3-4 weeks)
4. **Phase 4**: Feature Components (3-4 weeks)
5. **Phase 5**: LCD Panel Optimization & iOS Design (2-3 weeks)
6. **Phase 6**: Testing & Quality Assurance (2 weeks)
7. **Phase 7**: Deployment & Documentation (1 week)

**Total Estimated Time**: 14-19 weeks

---

## Phase 1: Project Setup & Development Environment

### Goals
- Set up Svelte development environment
- Configure build tools
- Establish parallel development workflow
- Set up testing infrastructure

### New Project Structure

```
volumio-svelte/
├── src/
│   ├── lib/
│   │   ├── stores/           # Svelte stores (replaces Angular services)
│   │   ├── components/       # Reusable Svelte components
│   │   ├── services/         # Non-reactive services (Socket.io wrapper)
│   │   ├── utils/            # Helper functions
│   │   └── types/            # TypeScript type definitions
│   ├── routes/               # SvelteKit routes (replaces ui-router)
│   ├── app.html              # HTML template
│   └── app.css               # Global styles
├── static/                   # Static assets
├── tests/
│   ├── unit/                 # Vitest unit tests
│   ├── integration/          # Component integration tests
│   └── e2e/                  # Playwright e2e tests
├── svelte.config.js
├── vite.config.js
├── tsconfig.json
├── playwright.config.js
└── package.json
```

### Tasks

#### 1.1 Initialize Svelte Project
**Files to Create**:
- `volumio-svelte/package.json`
- `volumio-svelte/svelte.config.js`
- `volumio-svelte/vite.config.js`
- `volumio-svelte/tsconfig.json`

**Commands**:
```bash
# Create new Svelte project with TypeScript
npm create svelte@latest volumio-svelte
cd volumio-svelte
npm install

# Install core dependencies
npm install socket.io-client
npm install -D @sveltejs/adapter-static

# Install UI libraries for iOS look and feel
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install testing frameworks
npm install -D vitest @testing-library/svelte
npm install -D playwright @playwright/test
```

#### 1.2 Configure Build System
**Files to Create/Modify**:
- `volumio-svelte/vite.config.js`

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    globals: true
  },
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://192.168.31.234:3000', // Volumio backend
        ws: true
      }
    }
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'socket.io': ['socket.io-client']
        }
      }
    }
  }
});
```

#### 1.3 Set Up Parallel Development
**Strategy**: Run both AngularJS and Svelte versions side-by-side during migration

**Files to Create**:
- `volumio-svelte/src/lib/services/local-config.json`

```json
{
  "volumioBackend": "http://192.168.31.234:3000"
}
```

#### 1.4 Configure Testing Infrastructure
**Files to Create**:
- `volumio-svelte/tests/setup.ts`
- `volumio-svelte/playwright.config.ts`
- `volumio-svelte/vitest.config.ts`

---

## Phase 2: Service Layer Migration

### Goals
- Migrate SocketService to framework-agnostic wrapper
- Convert Angular services to Svelte stores
- Maintain Socket.io communication protocol
- Ensure backward compatibility with Volumio backend API

### Architecture Change

**AngularJS Pattern**:
```javascript
// Angular Service (singleton, dependency injection)
class PlayerService {
  constructor($rootScope, socketService) {
    this.$rootScope = $rootScope;
    this.socketService = socketService;
    this.state = null;
  }

  play() {
    this.socketService.emit('play');
  }
}
```

**Svelte Pattern**:
```typescript
// Svelte Store (reactive, imported directly)
import { writable, derived } from 'svelte/store';
import { socketService } from './socket';

export const playerState = writable(null);

export const playerActions = {
  play: () => socketService.emit('play'),
  pause: () => socketService.emit('pause'),
  // ...
};
```

### Service Migration Map

| AngularJS Service | Svelte Store/Service | Type | Priority |
|-------------------|---------------------|------|----------|
| `SocketService` | `socketService` | Service (class) | P0 (Critical) |
| `PlayerService` | `playerStore` | Store (writable) | P0 (Critical) |
| `BrowseService` | `browseStore` | Store (writable) | P1 (High) |
| `PlayQueueService` | `queueStore` | Store (writable) | P1 (High) |
| `PlaylistService` | `playlistStore` | Store (writable) | P1 (High) |
| `VolumeService` | `volumeStore` | Store (writable) | P0 (Critical) |
| `MultiRoomService` | `multiRoomStore` | Store (writable) | P2 (Medium) |
| `ModalService` | `modalStore` | Store (writable) | P1 (High) |
| `ToastMessageService` | `toastStore` | Store (writable) | P1 (High) |
| `UiSettingsService` | `settingsStore` | Store (writable + localStorage) | P1 (High) |
| `AudioOutputsService` | `outputsStore` | Store (writable) | P2 (Medium) |
| `MatchmediaService` | `mediaQueryStore` | Store (derived) | P1 (High) |
| `UpdaterService` | `updaterStore` | Store (writable) | P2 (Medium) |
| `RipperService` | `ripperStore` | Store (writable) | P3 (Low) |
| MyVolumio Services | `myvolumio/*` | Multiple stores | P3 (Low) |

### Tasks

#### 2.1 Create Socket.io Service Wrapper
**File**: `volumio-svelte/src/lib/services/socket.ts`

```typescript
import io, { Socket } from 'socket.io-client';
import { get, writable } from 'svelte/store';

export const connectionState = writable<'connected' | 'disconnected' | 'connecting'>('disconnected');
export const loadingState = writable<boolean>(false);

class SocketService {
  private socket: Socket | null = null;
  private host: string;
  private loadingBarRequestEvents: string[] = [
    'browseLibrary', 'search', 'goTo', 'GetTrackInfo',
    'createPlaylist', 'listPlaylist', 'addToPlaylist',
    // ... (same list as AngularJS)
  ];

  constructor(host: string) {
    this.host = host;
    this.connect();
  }

  connect(): void {
    this.socket = io(this.host, { timeout: 500 });

    this.socket.on('connect', () => {
      connectionState.set('connected');
      console.log(`Socket connected to ${this.host}`);
    });

    this.socket.on('disconnect', () => {
      connectionState.set('disconnected');
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', () => {
      connectionState.set('disconnected');
      console.error(`Socket connect_error for host ${this.host}`);
    });
  }

  emit(eventName: string, data?: any, callback?: (response: any) => void): void {
    if (!this.socket) return;

    if (this.loadingBarRequestEvents.includes(eventName)) {
      loadingState.set(true);
    }

    this.socket.emit(eventName, data, (response) => {
      loadingState.set(false);
      callback?.(response);
    });
  }

  on<T = any>(eventName: string, callback: (data: T) => void): () => void {
    if (!this.socket) return () => {};

    const handler = (data: T) => {
      loadingState.set(false);
      callback(data);
    };

    this.socket.on(eventName, handler);

    // Return unsubscribe function
    return () => {
      this.socket?.off(eventName, handler);
    };
  }

  off(eventName: string, handler?: Function): void {
    this.socket?.off(eventName, handler as any);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
export const socketService = new SocketService(
  import.meta.env.VITE_VOLUMIO_HOST || 'http://localhost:3000'
);
```

**Test File**: `volumio-svelte/tests/unit/services/socket.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { socketService, connectionState } from '$lib/services/socket';

describe('SocketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should connect to backend', async () => {
    // Mock socket.io-client
    const mockSocket = vi.fn();

    // Test connection state
    expect(socketService.isConnected).toBe(false);
  });

  it('should emit events correctly', () => {
    const callback = vi.fn();
    socketService.emit('play', {}, callback);
    // Assert emit was called
  });

  it('should handle reconnection', () => {
    // Test reconnection logic
  });
});
```

#### 2.2 Create Player Store
**File**: `volumio-svelte/src/lib/stores/player.ts`

```typescript
import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';
import type { PlayerState, TrackInfo } from '$lib/types';

// State stores
export const playerState = writable<PlayerState | null>(null);
export const trackInfo = writable<TrackInfo | null>(null);
export const volume = writable<number>(80);
export const mute = writable<boolean>(false);
export const shuffle = writable<boolean>(false);
export const repeat = writable<'off' | 'all' | 'one'>('off');
export const seek = writable<number>(0);
export const duration = writable<number>(0);
export const isPlaying = derived(playerState, $state => $state?.status === 'play');

// Actions
export const playerActions = {
  play: () => {
    socketService.emit('play');
  },

  pause: () => {
    socketService.emit('pause');
  },

  stop: () => {
    socketService.emit('stop');
  },

  prev: () => {
    socketService.emit('prev');
  },

  next: () => {
    socketService.emit('next');
  },

  setVolume: (vol: number) => {
    volume.set(vol);
    socketService.emit('volume', vol);
  },

  toggleMute: () => {
    const currentMute = get(mute);
    mute.set(!currentMute);
    socketService.emit('mute', !currentMute);
  },

  toggleShuffle: () => {
    const currentShuffle = get(shuffle);
    shuffle.set(!currentShuffle);
    socketService.emit('setRandom', { value: !currentShuffle });
  },

  setRepeat: (mode: 'off' | 'all' | 'one') => {
    repeat.set(mode);
    const repeatSingle = mode === 'one';
    socketService.emit('setRepeat', {
      value: mode !== 'off',
      repeatSingle
    });
  },

  seekTo: (position: number) => {
    seek.set(position);
    socketService.emit('seek', position);
  }
};

// Initialize listeners
export function initPlayerStore() {
  socketService.on('pushState', (state: PlayerState) => {
    playerState.set(state);
    volume.set(state.volume ?? 80);
    mute.set(state.mute ?? false);
    shuffle.set(state.random ?? false);

    if (state.repeat !== undefined) {
      repeat.set(state.repeat ? (state.repeatSingle ? 'one' : 'all') : 'off');
    }

    if (state.seek !== undefined) {
      seek.set(state.seek);
    }

    if (state.duration !== undefined) {
      duration.set(state.duration);
    }
  });

  socketService.on('pushQueue', (queue) => {
    // Handle queue updates
  });
}
```

**Test File**: `volumio-svelte/tests/unit/stores/player.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { playerState, playerActions, volume } from '$lib/stores/player';

describe('Player Store', () => {
  beforeEach(() => {
    playerState.set(null);
    volume.set(80);
  });

  it('should initialize with default values', () => {
    expect(get(volume)).toBe(80);
    expect(get(playerState)).toBe(null);
  });

  it('should update volume when setVolume is called', () => {
    playerActions.setVolume(50);
    expect(get(volume)).toBe(50);
  });

  it('should emit socket events on play', () => {
    // Mock socketService.emit
    playerActions.play();
    // Assert emit was called with 'play'
  });
});
```

#### 2.3 Create Additional Core Stores

**Files to Create**:
- `volumio-svelte/src/lib/stores/browse.ts` - Browse/navigation state
- `volumio-svelte/src/lib/stores/queue.ts` - Play queue management
- `volumio-svelte/src/lib/stores/playlist.ts` - Playlist CRUD
- `volumio-svelte/src/lib/stores/settings.ts` - UI settings with localStorage persistence
- `volumio-svelte/src/lib/stores/toast.ts` - Toast notification system
- `volumio-svelte/src/lib/stores/modal.ts` - Modal dialog management
- `volumio-svelte/src/lib/stores/outputs.ts` - Audio outputs
- `volumio-svelte/src/lib/stores/media-query.ts` - Responsive breakpoints

#### 2.4 Create Type Definitions
**File**: `volumio-svelte/src/lib/types/index.ts`

```typescript
export interface PlayerState {
  status: 'play' | 'pause' | 'stop';
  position: number;
  title: string;
  artist: string;
  album: string;
  albumart: string;
  uri: string;
  trackType: string;
  seek: number;
  duration: number;
  samplerate: string;
  bitdepth: string;
  bitrate: string;
  random: boolean;
  repeat: boolean;
  repeatSingle: boolean;
  volume: number;
  mute: boolean;
  stream: string;
  updatedb: boolean;
  volatile: boolean;
}

export interface TrackInfo {
  uri: string;
  service: string;
  name: string;
  artist: string;
  album: string;
  type: string;
  tracknumber: number;
  albumart: string;
  duration: number;
  samplerate: string;
  bitdepth: string;
  bitrate: string;
  trackType: string;
}

export interface BrowseItem {
  service: string;
  type: 'folder' | 'song' | 'playlist' | 'webradio';
  title: string;
  artist?: string;
  album?: string;
  albumart?: string;
  uri: string;
  icon?: string;
}

export interface QueueItem {
  uri: string;
  service: string;
  name: string;
  artist: string;
  album: string;
  type: string;
  duration: number;
  albumart: string;
  samplerate: string;
  bitdepth: string;
  bitrate: string;
  trackType: string;
}

// ... more types
```

---

## Phase 3: Core Components & Layout

### Goals
- Create Svelte component equivalents for AngularJS directives
- Build 1920x440 optimized layout
- Implement iOS 26 design language
- Ensure touch-friendly UI (44x44px minimum)

### Component Migration Map

| AngularJS Directive | Svelte Component | Priority |
|---------------------|------------------|----------|
| `player-buttons` | `PlayerControls.svelte` | P0 |
| `volume-manager` | `VolumeControl.svelte` | P0 |
| `track-info` | `TrackInfo.svelte` | P0 |
| `player-seekbar` | `SeekBar.svelte` | P0 |
| `main-menu` | `Sidebar.svelte` | P1 |
| `playlist` | `Playlist.svelte` | P1 |
| `browse-scroll-manager` | `BrowseList.svelte` | P1 |
| `audio-outputs` | `OutputSelector.svelte` | P2 |
| `knob` | `Knob.svelte` | P2 |
| `equalizer` | `Equalizer.svelte` | P3 |
| `multi-room-dock` | `MultiRoom.svelte` | P3 |

### Tasks

#### 3.1 Create Root Layout Component
**File**: `volumio-svelte/src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { connectionState, socketService } from '$lib/services/socket';
  import { initPlayerStore } from '$lib/stores/player';
  import PlayerBar from '$lib/components/PlayerBar.svelte';
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';

  let mounted = false;

  onMount(() => {
    initPlayerStore();
    // Initialize other stores
    mounted = true;
  });
</script>

<!-- 1920x440 optimized layout -->
<div class="volumio-app" style="width: 1920px; height: 440px; overflow: hidden;">
  {#if $connectionState === 'connected'}
    <!-- Single horizontal bar layout -->
    <PlayerBar />
  {:else}
    <LoadingIndicator />
  {/if}

  <ToastContainer />
</div>

<style>
  .volumio-app {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 18px; /* Base font size for legibility */
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    color: #ffffff;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
</style>
```

#### 3.2 Create PlayerBar Component (Main Layout)
**File**: `volumio-svelte/src/lib/components/PlayerBar.svelte`

```svelte
<script lang="ts">
  import { playerState, trackInfo } from '$lib/stores/player';
  import AlbumArt from './AlbumArt.svelte';
  import TrackInfo from './TrackInfo.svelte';
  import PlayerControls from './PlayerControls.svelte';
  import VolumeControl from './VolumeControl.svelte';
  import SeekBar from './SeekBar.svelte';
  import OutputSelector from './OutputSelector.svelte';
  import MenuButton from './MenuButton.svelte';
</script>

<div class="player-bar">
  <!-- Left: Menu & Album Art (340px) -->
  <div class="section-left">
    <MenuButton />
    <AlbumArt size="large" />
  </div>

  <!-- Center: Track Info & Controls (1000px) -->
  <div class="section-center">
    <TrackInfo />
    <PlayerControls />
    <SeekBar />
  </div>

  <!-- Right: Volume & Outputs (580px) -->
  <div class="section-right">
    <VolumeControl />
    <OutputSelector />
  </div>
</div>

<style>
  .player-bar {
    display: flex;
    width: 1920px;
    height: 440px;
    padding: 24px 32px;
    gap: 40px;
    align-items: center;
    background: rgba(20, 20, 25, 0.95);
    backdrop-filter: blur(40px); /* iOS-style blur */
  }

  .section-left {
    display: flex;
    align-items: center;
    gap: 24px;
    width: 340px;
    flex-shrink: 0;
  }

  .section-center {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    min-width: 0; /* Allow text truncation */
  }

  .section-right {
    display: flex;
    align-items: center;
    gap: 32px;
    width: 580px;
    flex-shrink: 0;
  }
</style>
```

#### 3.3 Create AlbumArt Component
**File**: `volumio-svelte/src/lib/components/AlbumArt.svelte`

```svelte
<script lang="ts">
  import { playerState } from '$lib/stores/player';

  export let size: 'small' | 'medium' | 'large' = 'medium';

  const sizes = {
    small: 80,
    medium: 120,
    large: 320 // Fits in 440px height with padding
  };

  $: albumart = $playerState?.albumart || '/static/default-album.png';
  $: title = $playerState?.title || 'No track playing';
</script>

<div class="album-art {size}" style="--size: {sizes[size]}px">
  <img src={albumart} alt={title} />
</div>

<style>
  .album-art {
    width: var(--size);
    height: var(--size);
    border-radius: 16px; /* iOS-style rounded corners */
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
```

#### 3.4 Create TrackInfo Component
**File**: `volumio-svelte/src/lib/components/TrackInfo.svelte`

```svelte
<script lang="ts">
  import { playerState } from '$lib/stores/player';

  $: title = $playerState?.title || 'No track';
  $: artist = $playerState?.artist || 'Unknown artist';
  $: album = $playerState?.album || '';
  $: trackType = $playerState?.trackType || '';
  $: samplerate = $playerState?.samplerate || '';
  $: bitdepth = $playerState?.bitdepth || '';
</script>

<div class="track-info">
  <div class="title">{title}</div>
  <div class="metadata">
    <span class="artist">{artist}</span>
    {#if album}
      <span class="separator">•</span>
      <span class="album">{album}</span>
    {/if}
  </div>
  {#if samplerate || bitdepth}
    <div class="quality">
      {#if samplerate}{samplerate}{/if}
      {#if bitdepth && samplerate}/{/if}
      {#if bitdepth}{bitdepth}{/if}
      {#if trackType}• {trackType}{/if}
    </div>
  {/if}
</div>

<style>
  .track-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .title {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.02em; /* iOS-style tight spacing */
  }

  .metadata {
    font-size: 18px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.7);
    display: flex;
    align-items: center;
    gap: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .quality {
    font-size: 16px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    display: flex;
    gap: 8px;
  }

  .separator {
    color: rgba(255, 255, 255, 0.4);
  }
</style>
```

#### 3.5 Create PlayerControls Component
**File**: `volumio-svelte/src/lib/components/PlayerControls.svelte`

```svelte
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
</script>

<div class="player-controls">
  <!-- Shuffle -->
  <button
    class="control-btn secondary"
    class:active={$shuffle}
    on:click={playerActions.toggleShuffle}
    aria-label="Shuffle"
  >
    <Icon name="shuffle" size={24} />
  </button>

  <!-- Previous -->
  <button
    class="control-btn secondary"
    on:click={playerActions.prev}
    aria-label="Previous track"
  >
    <Icon name="skip-back" size={28} />
  </button>

  <!-- Play/Pause (Large center button) -->
  <button
    class="control-btn primary"
    on:click={handlePlayPause}
    aria-label={$isPlaying ? 'Pause' : 'Play'}
  >
    <Icon name={$isPlaying ? 'pause' : 'play'} size={36} />
  </button>

  <!-- Next -->
  <button
    class="control-btn secondary"
    on:click={playerActions.next}
    aria-label="Next track"
  >
    <Icon name="skip-forward" size={28} />
  </button>

  <!-- Repeat -->
  <button
    class="control-btn secondary"
    class:active={$repeat !== 'off'}
    on:click={() => {
      const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
      const currentIndex = modes.indexOf($repeat);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      playerActions.setRepeat(nextMode);
    }}
    aria-label="Repeat"
  >
    <Icon name={$repeat === 'one' ? 'repeat-one' : 'repeat'} size={24} />
  </button>
</div>

<style>
  .player-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    padding: 12px 0;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1); /* iOS-style easing */
    -webkit-tap-highlight-color: transparent;
    background: none;
    color: rgba(255, 255, 255, 0.8);
  }

  /* Touch target size: minimum 44x44px (iOS standard) */
  .control-btn.secondary {
    width: 56px;
    height: 56px;
  }

  .control-btn.primary {
    width: 72px;
    height: 72px;
    background: linear-gradient(135deg, #007AFF 0%, #0051D5 100%); /* iOS blue */
    color: #ffffff;
    box-shadow: 0 4px 16px rgba(0, 122, 255, 0.4);
  }

  .control-btn:hover {
    transform: scale(1.05);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .control-btn.primary:hover {
    box-shadow: 0 6px 20px rgba(0, 122, 255, 0.6);
  }

  .control-btn.active {
    color: #007AFF; /* iOS blue for active state */
  }
</style>
```

#### 3.6 Create SeekBar Component
**File**: `volumio-svelte/src/lib/components/SeekBar.svelte`

```svelte
<script lang="ts">
  import { seek, duration, playerActions } from '$lib/stores/player';

  let isDragging = false;
  let localSeek = 0;

  $: displaySeek = isDragging ? localSeek : $seek;
  $: progress = $duration > 0 ? (displaySeek / $duration) * 100 : 0;

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleSeekStart() {
    isDragging = true;
  }

  function handleSeekChange(event: Event) {
    const target = event.target as HTMLInputElement;
    localSeek = parseFloat(target.value);
  }

  function handleSeekEnd() {
    playerActions.seekTo(localSeek);
    isDragging = false;
  }
</script>

<div class="seekbar">
  <span class="time">{formatTime(displaySeek)}</span>

  <div class="track">
    <input
      type="range"
      min="0"
      max={$duration}
      step="0.1"
      value={displaySeek}
      on:mousedown={handleSeekStart}
      on:touchstart={handleSeekStart}
      on:input={handleSeekChange}
      on:mouseup={handleSeekEnd}
      on:touchend={handleSeekEnd}
      style="--progress: {progress}%"
    />
  </div>

  <span class="time">{formatTime($duration)}</span>
</div>

<style>
  .seekbar {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .time {
    font-size: 16px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    min-width: 60px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .track {
    flex: 1;
    position: relative;
    height: 44px; /* Touch target height */
    display: flex;
    align-items: center;
  }

  input[type="range"] {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  /* Track */
  input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 6px;
    background: linear-gradient(
      to right,
      #007AFF 0%,
      #007AFF var(--progress),
      rgba(255, 255, 255, 0.2) var(--progress),
      rgba(255, 255, 255, 0.2) 100%
    );
    border-radius: 3px;
  }

  /* Thumb */
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    margin-top: -7px;
  }

  input[type="range"]:active::-webkit-slider-thumb {
    transform: scale(1.2);
  }
</style>
```

#### 3.7 Create VolumeControl Component
**File**: `volumio-svelte/src/lib/components/VolumeControl.svelte`

```svelte
<script lang="ts">
  import { volume, mute, playerActions } from '$lib/stores/player';
  import Icon from './Icon.svelte';

  let showSlider = false;

  function handleVolumeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    playerActions.setVolume(parseInt(target.value, 10));
  }

  $: volumeIcon = $mute ? 'volume-mute' :
                  $volume > 50 ? 'volume-high' :
                  $volume > 0 ? 'volume-low' : 'volume-mute';
</script>

<div class="volume-control">
  <button
    class="volume-btn"
    on:click={playerActions.toggleMute}
    aria-label={$mute ? 'Unmute' : 'Mute'}
  >
    <Icon name={volumeIcon} size={28} />
  </button>

  <div class="volume-slider">
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value={$volume}
      on:input={handleVolumeChange}
      aria-label="Volume"
      style="--volume: {$volume}%"
    />
  </div>

  <span class="volume-text">{$volume}%</span>
</div>

<style>
  .volume-control {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .volume-btn {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    cursor: pointer;
    transition: all 0.2s;
  }

  .volume-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
  }

  .volume-btn:active {
    transform: scale(0.95);
  }

  .volume-slider {
    flex: 1;
    min-width: 200px;
    height: 44px; /* Touch target */
    display: flex;
    align-items: center;
  }

  input[type="range"] {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 6px;
    background: linear-gradient(
      to right,
      #007AFF 0%,
      #007AFF var(--volume),
      rgba(255, 255, 255, 0.2) var(--volume),
      rgba(255, 255, 255, 0.2) 100%
    );
    border-radius: 3px;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    margin-top: -7px;
  }

  .volume-text {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    min-width: 60px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
```

---

## Phase 4: Feature Components

### Tasks

#### 4.1 Browse/Library Components
**Files to Create**:
- `volumio-svelte/src/lib/components/BrowseList.svelte`
- `volumio-svelte/src/lib/components/BrowseItem.svelte`
- `volumio-svelte/src/routes/browse/+page.svelte`

#### 4.2 Queue Management
**Files to Create**:
- `volumio-svelte/src/lib/components/Queue.svelte`
- `volumio-svelte/src/lib/components/QueueItem.svelte`
- `volumio-svelte/src/routes/queue/+page.svelte`

#### 4.3 Playlist Management
**Files to Create**:
- `volumio-svelte/src/lib/components/PlaylistList.svelte`
- `volumio-svelte/src/lib/components/PlaylistItem.svelte`
- `volumio-svelte/src/routes/playlists/+page.svelte`

#### 4.4 Settings/Plugin Interface
**Files to Create**:
- `volumio-svelte/src/lib/components/SettingsPanel.svelte`
- `volumio-svelte/src/lib/components/PluginRenderer.svelte`
- `volumio-svelte/src/routes/settings/+page.svelte`

---

## Phase 5: LCD Panel Optimization & iOS Design

### Goals
- Fine-tune layout for 1920x440 resolution
- Implement iOS 26 design system
- Add touch gestures
- Optimize font sizes and spacing
- Ensure 44x44px minimum touch targets

### Tasks

#### 5.1 Typography System
**File**: `volumio-svelte/src/app.css`

```css
/* Import chosen font (example: Inter) */
@import url('https://rsms.me/inter/inter.css');

:root {
  /* iOS-inspired color system */
  --color-bg-primary: #1c1c1e;
  --color-bg-secondary: #2c2c2e;
  --color-bg-tertiary: #3a3a3c;
  --color-text-primary: #ffffff;
  --color-text-secondary: rgba(255, 255, 255, 0.7);
  --color-text-tertiary: rgba(255, 255, 255, 0.5);
  --color-accent: #007AFF;
  --color-accent-dark: #0051D5;

  /* Typography scale for 1920x440 */
  --font-size-xs: 14px;
  --font-size-sm: 16px;
  --font-size-base: 18px;
  --font-size-lg: 20px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;
  --font-size-3xl: 40px;

  /* iOS-style spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;

  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.25);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.35);

  /* Touch target size */
  --touch-target-min: 44px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: var(--font-size-base);
  line-height: 1.5;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
}

/* iOS-style focus ring */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Smooth transitions */
* {
  transition-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
}
```

#### 5.2 Touch Gesture System
**File**: `volumio-svelte/src/lib/utils/gestures.ts`

```typescript
export interface SwipeEvent {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
}

export function swipe(node: HTMLElement, callback: (event: SwipeEvent) => void) {
  let startX: number;
  let startY: number;
  let startTime: number;

  function handleTouchStart(event: TouchEvent) {
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    startTime = Date.now();
  }

  function handleTouchEnd(event: TouchEvent) {
    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;
    const endTime = Date.now();

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const deltaTime = endTime - startTime;

    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const velocity = distance / deltaTime;

    // Minimum swipe distance: 50px
    if (distance < 50) return;

    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    let direction: 'left' | 'right' | 'up' | 'down';

    if (angle >= -45 && angle < 45) direction = 'right';
    else if (angle >= 45 && angle < 135) direction = 'down';
    else if (angle >= -135 && angle < -45) direction = 'up';
    else direction = 'left';

    callback({ direction, distance, velocity });
  }

  node.addEventListener('touchstart', handleTouchStart, { passive: true });
  node.addEventListener('touchend', handleTouchEnd);

  return {
    destroy() {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchend', handleTouchEnd);
    }
  };
}
```

#### 5.3 Create Responsive Menu Drawer
**File**: `volumio-svelte/src/lib/components/MenuDrawer.svelte`

```svelte
<script lang="ts">
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import Icon from './Icon.svelte';

  export let open = false;

  const menuItems = [
    { label: 'Playback', icon: 'play-circle', route: '/' },
    { label: 'Browse', icon: 'folder', route: '/browse' },
    { label: 'Queue', icon: 'list', route: '/queue' },
    { label: 'Playlists', icon: 'music', route: '/playlists' },
    { label: 'Settings', icon: 'settings', route: '/settings' }
  ];
</script>

{#if open}
  <div
    class="drawer-overlay"
    on:click={() => open = false}
    transition:slide={{ duration: 300, easing: quintOut }}
  >
    <div class="drawer" on:click|stopPropagation>
      <div class="drawer-header">
        <h2>Volumio</h2>
        <button class="close-btn" on:click={() => open = false}>
          <Icon name="x" size={28} />
        </button>
      </div>

      <nav class="drawer-nav">
        {#each menuItems as item}
          <a href={item.route} class="nav-item">
            <Icon name={item.icon} size={24} />
            <span>{item.label}</span>
          </a>
        {/each}
      </nav>
    </div>
  </div>
{/if}

<style>
  .drawer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    backdrop-filter: blur(20px);
  }

  .drawer {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 400px;
    background: rgba(30, 30, 35, 0.98);
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .drawer-header h2 {
    font-size: 28px;
    font-weight: 700;
  }

  .close-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: var(--color-text-primary);
    cursor: pointer;
    border-radius: 50%;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .drawer-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px 20px;
    border-radius: 12px;
    font-size: 20px;
    font-weight: 500;
    color: var(--color-text-primary);
    text-decoration: none;
    transition: background 0.2s;
    min-height: 56px; /* Touch target */
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .nav-item:active {
    background: rgba(255, 255, 255, 0.15);
  }
</style>
```

---

## Phase 6: Testing & Quality Assurance

### Testing Strategy

#### 6.1 Unit Tests (Vitest)
**Coverage Target**: 80%+ for stores and services

**Test Files**:
- `tests/unit/services/socket.test.ts`
- `tests/unit/stores/player.test.ts`
- `tests/unit/stores/browse.test.ts`
- `tests/unit/stores/queue.test.ts`
- `tests/unit/utils/formatters.test.ts`

**Run Commands**:
```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

#### 6.2 Component Tests (@testing-library/svelte)
**Test Files**:
- `tests/unit/components/PlayerControls.test.ts`
- `tests/unit/components/VolumeControl.test.ts`
- `tests/unit/components/SeekBar.test.ts`
- `tests/unit/components/TrackInfo.test.ts`

**Example Test**:
```typescript
import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import PlayerControls from '$lib/components/PlayerControls.svelte';
import { playerActions } from '$lib/stores/player';

vi.mock('$lib/stores/player', () => ({
  playerActions: {
    play: vi.fn(),
    pause: vi.fn(),
  },
  isPlaying: { subscribe: vi.fn() }
}));

describe('PlayerControls', () => {
  it('should render play button', () => {
    const { getByLabelText } = render(PlayerControls);
    expect(getByLabelText('Play')).toBeInTheDocument();
  });

  it('should call play action when play button clicked', async () => {
    const { getByLabelText } = render(PlayerControls);
    await fireEvent.click(getByLabelText('Play'));
    expect(playerActions.play).toHaveBeenCalled();
  });
});
```

#### 6.3 Integration Tests
**Test Socket.io communication end-to-end**

**File**: `tests/integration/socket-integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { socketService } from '$lib/services/socket';
import { playerState } from '$lib/stores/player';
import { get } from 'svelte/store';

describe('Socket.io Integration', () => {
  beforeAll(() => {
    // Connect to test backend
  });

  afterAll(() => {
    socketService.disconnect();
  });

  it('should connect to backend', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(socketService.isConnected).toBe(true);
  });

  it('should receive pushState events', (done) => {
    socketService.emit('getState');

    const unsubscribe = playerState.subscribe(state => {
      if (state) {
        expect(state).toHaveProperty('status');
        expect(state).toHaveProperty('title');
        done();
        unsubscribe();
      }
    });
  });
});
```

#### 6.4 End-to-End Tests (Playwright)
**Test on actual Raspberry Pi hardware**

**File**: `tests/e2e/player.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Player Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.player-bar');
  });

  test('should play track when play button clicked', async ({ page }) => {
    const playButton = page.getByLabel('Play');
    await playButton.click();

    // Wait for player state to update
    await page.waitForSelector('[aria-label="Pause"]');
    expect(await playButton.getAttribute('aria-label')).toBe('Pause');
  });

  test('should adjust volume', async ({ page }) => {
    const volumeSlider = page.locator('input[aria-label="Volume"]');
    await volumeSlider.fill('50');

    // Check volume display
    const volumeText = page.locator('.volume-text');
    await expect(volumeText).toHaveText('50%');
  });

  test('should seek track', async ({ page }) => {
    // Implement seek test
  });
});
```

**Run on Raspberry Pi**:
```bash
# On development machine
npm run build

# Copy to Raspberry Pi
scp -r build/* pi@raspberrypi:/home/pi/volumio-ui/

# On Raspberry Pi
cd /home/pi/volumio-ui
npx playwright test --headed
```

#### 6.5 Touch Interaction Tests
**File**: `tests/e2e/touch.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Touch Interactions', () => {
  test.use({ hasTouch: true });

  test('should support swipe gestures', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Swipe right to open menu
    await page.touchscreen.swipe({ x: 0, y: 200 }, { x: 300, y: 200 });
    await expect(page.locator('.drawer')).toBeVisible();
  });

  test('should have minimum 44px touch targets', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
```

#### 6.6 Performance Tests
**File**: `tests/e2e/performance.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test('should load within 1 second on RPi5', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.player-bar');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(1000); // 1 second
  });

  test('should maintain 60fps during animations', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Measure frame rate during volume slider interaction
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let frames = 0;
        const duration = 1000; // 1 second
        const startTime = performance.now();

        function countFrame() {
          frames++;
          if (performance.now() - startTime < duration) {
            requestAnimationFrame(countFrame);
          } else {
            resolve(frames);
          }
        }

        requestAnimationFrame(countFrame);
      });
    }).then((fps) => {
      expect(fps).toBeGreaterThan(55); // Allow some margin
    });
  });
});
```

---

## Phase 7: Deployment & Documentation

### Tasks

#### 7.1 Build Configuration
**File**: `volumio-svelte/svelte.config.js`

```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/kit/vite';

export default {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: true,
      strict: true
    }),

    paths: {
      base: '', // Set to '/volumio' if deployed to subdirectory
    },

    alias: {
      $lib: 'src/lib'
    }
  }
};
```

#### 7.2 Build Scripts
**File**: `volumio-svelte/package.json` (scripts section)

```json
{
  "scripts": {
    "dev": "vite dev --host 0.0.0.0 --port 5173",
    "build": "vite build",
    "build:production": "NODE_ENV=production vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "lint": "eslint .",
    "format": "prettier --write .",
    "deploy:rpi": "./scripts/deploy-to-rpi.sh"
  }
}
```

#### 7.3 Deployment Script
**File**: `volumio-svelte/scripts/deploy-to-rpi.sh`

```bash
#!/bin/bash

# Configuration
RPI_HOST="volumio.local"  # Or IP address
RPI_USER="volumio"
RPI_PATH="/volumio/http/www-svelte"
BUILD_DIR="build"

echo "Building Svelte application..."
npm run build:production

echo "Deploying to Raspberry Pi..."
rsync -avz --delete \
  ${BUILD_DIR}/ \
  ${RPI_USER}@${RPI_HOST}:${RPI_PATH}/

echo "Restarting Volumio UI service..."
ssh ${RPI_USER}@${RPI_HOST} "sudo systemctl restart volumio"

echo "Deployment complete!"
echo "Access at: http://${RPI_HOST}"
```

#### 7.4 Documentation Updates
**File**: `volumio-svelte/README.md`

```markdown
# Volumio2-UI Svelte Edition

Modern Svelte-based UI for Volumio2 audio player, optimized for 1920x440 LCD touchscreen displays.

## Features

- ⚡ Lightning-fast performance with Svelte
- 📱 iOS 26-inspired design language
- 👆 Touch-optimized interface (44x44px minimum targets)
- 🎨 1920x440 LCD panel layout
- 🔌 Socket.io real-time communication
- 🧪 Comprehensive test coverage
- 📦 TypeScript for type safety

## Quick Start

### Development

\`\`\`bash
npm install
npm run dev
\`\`\`

Visit http://localhost:5173

### Production Build

\`\`\`bash
npm run build:production
\`\`\`

### Testing

\`\`\`bash
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run test:coverage     # Coverage report
\`\`\`

## Deployment

### To Raspberry Pi

\`\`\`bash
# Configure in scripts/deploy-to-rpi.sh
npm run deploy:rpi
\`\`\`

## Architecture

### Project Structure

\`\`\`
src/
├── lib/
│   ├── stores/          # Svelte stores (state management)
│   ├── components/      # Reusable components
│   ├── services/        # Socket.io and utilities
│   └── types/           # TypeScript definitions
├── routes/              # SvelteKit routes
└── app.css              # Global styles
\`\`\`

### Key Technologies

- **Svelte 4**: Component framework
- **SvelteKit**: Routing and build system
- **Socket.io Client**: Backend communication
- **TypeScript**: Type safety
- **Vitest**: Unit testing
- **Playwright**: E2E testing
- **Tailwind CSS**: Utility-first CSS (optional)

## Migration from AngularJS

This version replaces the original AngularJS implementation with modern Svelte architecture:

- Angular Services → Svelte Stores
- Angular Directives → Svelte Components
- UI Router → SvelteKit Routing
- Dependency Injection → ES6 Imports

## LCD Panel Specifications

- **Resolution**: 1920x440 pixels
- **Layout**: Single horizontal bar
- **Font Size**: 18-24px base
- **Touch Targets**: Minimum 44x44px
- **Typography**: Inter font family

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Initial load: <1s on Raspberry Pi 5
- Bundle size: ~150KB (gzipped)
- Memory usage: ~25MB
- Frame rate: 60fps

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

Same as Volumio2
\`\`\`

#### 7.5 Update CLAUDE.md
**File**: `volumio-svelte/CLAUDE.md`

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Volumio2-UI Svelte Edition is a modern rewrite of the Volumio2 web interface using Svelte 4. It's optimized for 1920x440 LCD touchscreen panels on Raspberry Pi 5.

**Framework**: Svelte 4 + SvelteKit
**Target Platform**: Raspberry Pi 5 (ARM64)
**Display**: 1920x440 LCD touchscreen
**Backend**: Volumio2 (Socket.io API)

## Development Commands

### Setup
\`\`\`bash
npm install
\`\`\`

### Development Server
\`\`\`bash
npm run dev                # Start dev server on localhost:5173
\`\`\`

### Building
\`\`\`bash
npm run build              # Development build
npm run build:production   # Production build (optimized)
npm run preview            # Preview production build
\`\`\`

### Testing
\`\`\`bash
npm run test               # Run unit tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
npm run test:e2e           # E2E tests (Playwright)
npm run test:e2e:ui        # E2E tests with UI
\`\`\`

### Deployment
\`\`\`bash
npm run deploy:rpi         # Deploy to Raspberry Pi
\`\`\`

## Architecture

### State Management: Svelte Stores

The app uses Svelte stores instead of Angular services:

\`\`\`typescript
// src/lib/stores/player.ts
import { writable } from 'svelte/store';

export const playerState = writable(null);
export const volume = writable(80);

export const playerActions = {
  play: () => socketService.emit('play'),
  pause: () => socketService.emit('pause'),
};
\`\`\`

**Key Stores**:
- `player.ts`: Player state, controls, volume
- `browse.ts`: Library browsing
- `queue.ts`: Play queue
- `playlist.ts`: Playlists
- `settings.ts`: UI settings
- `toast.ts`: Notifications
- `modal.ts`: Modal dialogs

### Socket.io Communication

The Socket.io service (`src/lib/services/socket.ts`) maintains the WebSocket connection to Volumio backend:

\`\`\`typescript
import { socketService } from '$lib/services/socket';

// Emit event
socketService.emit('play');

// Listen for events
socketService.on('pushState', (state) => {
  playerState.set(state);
});
\`\`\`

### Component Structure

Components follow iOS design principles:

- **44x44px minimum touch targets**
- **iOS color system** (SF Symbols-inspired)
- **Smooth animations** (cubic-bezier easing)
- **Large, readable fonts** (18-24px base)

### Layout System

**1920x440 Single-Bar Layout**:

\`\`\`
┌─────────────────────────────────────────────────────┐
│ [Menu] [Album Art] │ Track Info + Controls + Seek │ Volume + Outputs │
│   340px            │         1000px                │      580px        │
└─────────────────────────────────────────────────────┘
\`\`\`

**Main Components**:
- `PlayerBar.svelte`: Root layout component
- `AlbumArt.svelte`: Album artwork (320x320px)
- `TrackInfo.svelte`: Song/artist/album info
- `PlayerControls.svelte`: Play/pause/skip buttons
- `SeekBar.svelte`: Progress bar
- `VolumeControl.svelte`: Volume slider
- `OutputSelector.svelte`: Audio output selection

### Routing

SvelteKit file-based routing:

\`\`\`
src/routes/
├── +layout.svelte         # Root layout
├── +page.svelte           # Home (playback view)
├── browse/+page.svelte    # Library browser
├── queue/+page.svelte     # Play queue
└── settings/+page.svelte  # Settings
\`\`\`

### TypeScript Types

Types are defined in `src/lib/types/index.ts`:

\`\`\`typescript
export interface PlayerState {
  status: 'play' | 'pause' | 'stop';
  title: string;
  artist: string;
  album: string;
  albumart: string;
  volume: number;
  seek: number;
  duration: number;
  // ...
}
\`\`\`

## Testing Strategy

### Unit Tests (Vitest)
Test stores and services:

\`\`\`typescript
import { expect, test } from 'vitest';
import { get } from 'svelte/store';
import { playerActions, volume } from '$lib/stores/player';

test('volume updates correctly', () => {
  playerActions.setVolume(50);
  expect(get(volume)).toBe(50);
});
\`\`\`

### Component Tests (@testing-library/svelte)
Test component behavior:

\`\`\`typescript
import { render, fireEvent } from '@testing-library/svelte';
import PlayerControls from '$lib/components/PlayerControls.svelte';

test('play button works', async () => {
  const { getByLabelText } = render(PlayerControls);
  await fireEvent.click(getByLabelText('Play'));
  // Assert
});
\`\`\`

### E2E Tests (Playwright)
Test on real hardware:

\`\`\`typescript
import { test, expect } from '@playwright/test';

test('should play track', async ({ page }) => {
  await page.goto('/');
  await page.click('[aria-label="Play"]');
  await expect(page.locator('[aria-label="Pause"]')).toBeVisible();
});
\`\`\`

## Important Notes

### Socket.io Protocol
Maintain compatibility with Volumio2 backend API. See:
https://github.com/volumio/Volumio2/wiki/WebSockets-API-Reference

### iOS Design System
Follow iOS Human Interface Guidelines:
- Use SF Symbols-inspired icons
- 44x44px minimum touch targets
- System blue (#007AFF) for primary actions
- Smooth animations (0.2-0.3s, cubic-bezier)

### Performance Optimization
- Lazy load routes with SvelteKit
- Preload critical assets
- Use svelte:head for metadata
- Optimize images (WebP format)
- Bundle analysis with vite-bundle-visualizer

### Touch Interactions
- Implement swipe gestures for navigation
- Use passive event listeners
- Provide haptic feedback (if supported)
- Prevent double-tap zoom

### Deployment
Production build outputs to `build/` directory. Deploy to:
- Raspberry Pi: `/volumio/http/www-svelte/`
- Configure reverse proxy if needed

## Backward Compatibility

During migration, both AngularJS and Svelte versions can run side-by-side:
- AngularJS: `/volumio/http/www/` (port 3000)
- Svelte: `/volumio/http/www-svelte/` (port 5173)

Use environment variable to switch backends:
\`\`\`
VITE_VOLUMIO_HOST=http://192.168.31.234:3000
\`\`\`
\`\`\`

---

## File Change Checklist

### Files to Create (New Svelte Project)

#### Configuration
- [ ] `volumio-svelte/package.json`
- [ ] `volumio-svelte/svelte.config.js`
- [ ] `volumio-svelte/vite.config.js`
- [ ] `volumio-svelte/tsconfig.json`
- [ ] `volumio-svelte/playwright.config.ts`
- [ ] `volumio-svelte/.env.example`
- [ ] `volumio-svelte/.gitignore`

#### Services
- [ ] `volumio-svelte/src/lib/services/socket.ts`
- [ ] `volumio-svelte/src/lib/services/local-config.json`

#### Stores
- [ ] `volumio-svelte/src/lib/stores/player.ts`
- [ ] `volumio-svelte/src/lib/stores/browse.ts`
- [ ] `volumio-svelte/src/lib/stores/queue.ts`
- [ ] `volumio-svelte/src/lib/stores/playlist.ts`
- [ ] `volumio-svelte/src/lib/stores/settings.ts`
- [ ] `volumio-svelte/src/lib/stores/toast.ts`
- [ ] `volumio-svelte/src/lib/stores/modal.ts`
- [ ] `volumio-svelte/src/lib/stores/outputs.ts`
- [ ] `volumio-svelte/src/lib/stores/media-query.ts`

#### Types
- [ ] `volumio-svelte/src/lib/types/index.ts`

#### Core Components
- [ ] `volumio-svelte/src/lib/components/PlayerBar.svelte`
- [ ] `volumio-svelte/src/lib/components/AlbumArt.svelte`
- [ ] `volumio-svelte/src/lib/components/TrackInfo.svelte`
- [ ] `volumio-svelte/src/lib/components/PlayerControls.svelte`
- [ ] `volumio-svelte/src/lib/components/SeekBar.svelte`
- [ ] `volumio-svelte/src/lib/components/VolumeControl.svelte`
- [ ] `volumio-svelte/src/lib/components/OutputSelector.svelte`
- [ ] `volumio-svelte/src/lib/components/MenuButton.svelte`
- [ ] `volumio-svelte/src/lib/components/MenuDrawer.svelte`
- [ ] `volumio-svelte/src/lib/components/Icon.svelte`
- [ ] `volumio-svelte/src/lib/components/LoadingIndicator.svelte`
- [ ] `volumio-svelte/src/lib/components/ToastContainer.svelte`

#### Feature Components
- [ ] `volumio-svelte/src/lib/components/BrowseList.svelte`
- [ ] `volumio-svelte/src/lib/components/BrowseItem.svelte`
- [ ] `volumio-svelte/src/lib/components/Queue.svelte`
- [ ] `volumio-svelte/src/lib/components/QueueItem.svelte`
- [ ] `volumio-svelte/src/lib/components/PlaylistList.svelte`
- [ ] `volumio-svelte/src/lib/components/PlaylistItem.svelte`

#### Routes
- [ ] `volumio-svelte/src/routes/+layout.svelte`
- [ ] `volumio-svelte/src/routes/+page.svelte`
- [ ] `volumio-svelte/src/routes/browse/+page.svelte`
- [ ] `volumio-svelte/src/routes/queue/+page.svelte`
- [ ] `volumio-svelte/src/routes/playlists/+page.svelte`
- [ ] `volumio-svelte/src/routes/settings/+page.svelte`

#### Styles
- [ ] `volumio-svelte/src/app.css`
- [ ] `volumio-svelte/src/app.html`

#### Utils
- [ ] `volumio-svelte/src/lib/utils/gestures.ts`
- [ ] `volumio-svelte/src/lib/utils/formatters.ts`

#### Tests
- [ ] `volumio-svelte/tests/setup.ts`
- [ ] `volumio-svelte/tests/unit/services/socket.test.ts`
- [ ] `volumio-svelte/tests/unit/stores/player.test.ts`
- [ ] `volumio-svelte/tests/unit/stores/browse.test.ts`
- [ ] `volumio-svelte/tests/unit/stores/queue.test.ts`
- [ ] `volumio-svelte/tests/unit/components/PlayerControls.test.ts`
- [ ] `volumio-svelte/tests/unit/components/VolumeControl.test.ts`
- [ ] `volumio-svelte/tests/unit/components/SeekBar.test.ts`
- [ ] `volumio-svelte/tests/integration/socket-integration.test.ts`
- [ ] `volumio-svelte/tests/e2e/player.spec.ts`
- [ ] `volumio-svelte/tests/e2e/touch.spec.ts`
- [ ] `volumio-svelte/tests/e2e/performance.spec.ts`

#### Documentation
- [ ] `volumio-svelte/README.md`
- [ ] `volumio-svelte/CLAUDE.md`
- [ ] `volumio-svelte/CONTRIBUTING.md`

#### Scripts
- [ ] `volumio-svelte/scripts/deploy-to-rpi.sh`

### Files to Reference (Original AngularJS)

These files contain business logic and API patterns to replicate:

- [ ] `src/app/services/socket.service.js` - Socket.io event patterns
- [ ] `src/app/services/player.service.js` - Player state management
- [ ] `src/app/services/browse.service.js` - Browse logic
- [ ] `src/app/services/play-queue.service.js` - Queue management
- [ ] `src/app/services/playlist.service.js` - Playlist CRUD
- [ ] `src/app/index.route.js` - Route definitions
- [ ] `src/app/themes/volumio3/assets/variants/volumio/volumio-variant.scss` - Design tokens

---

## Risk Mitigation

### Critical Risks

1. **Socket.io Compatibility**: Ensure all Volumio backend events are properly handled
   - **Mitigation**: Create comprehensive integration test suite
   - **Validation**: Test against real Volumio backend

2. **Performance on Raspberry Pi 5**: Ensure 60fps on ARM64
   - **Mitigation**: Profile early, optimize bundle size, lazy load routes
   - **Validation**: Continuous performance monitoring

3. **Touch Interaction Issues**: Ensure gestures work reliably
   - **Mitigation**: Test on actual LCD touchscreen hardware
   - **Validation**: User acceptance testing

4. **Data Loss During Migration**: Preserve user settings and playlists
   - **Mitigation**: Migration script to convert localStorage format
   - **Validation**: Backup and restore testing

### Testing Requirements

- [ ] All stores have 80%+ unit test coverage
- [ ] All components have integration tests
- [ ] E2E tests pass on Raspberry Pi 5 hardware
- [ ] Touch interaction tests validate 44x44px targets
- [ ] Performance tests confirm <1s load time
- [ ] Socket.io integration tests cover all backend events

---

## Success Criteria

### Phase Completion Checkpoints

#### Phase 1: Setup ✓
- [ ] Svelte project initialized
- [ ] Build system configured
- [ ] Development server running
- [ ] Tests can be executed

#### Phase 2: Services ✓
- [ ] Socket.io service connected to backend
- [ ] All stores created and tested
- [ ] Type definitions complete
- [ ] Store unit tests passing

#### Phase 3: Core Components ✓
- [ ] PlayerBar layout complete
- [ ] All player controls functional
- [ ] Touch targets meet 44px minimum
- [ ] iOS design system implemented

#### Phase 4: Features ✓
- [ ] Browse/library navigation works
- [ ] Queue management works
- [ ] Playlist CRUD works
- [ ] Settings persist

#### Phase 5: LCD Optimization ✓
- [ ] 1920x440 layout perfect
- [ ] Fonts legible at viewing distance
- [ ] Touch gestures responsive
- [ ] iOS 26 look and feel achieved

#### Phase 6: Testing ✓
- [ ] 80%+ unit test coverage
- [ ] E2E tests passing on RPi5
- [ ] Performance benchmarks met
- [ ] Touch interaction validated

#### Phase 7: Deployment ✓
- [ ] Production build optimized
- [ ] Deployment script works
- [ ] Documentation complete
- [ ] User acceptance passed

---

## Next Steps After Plan Approval

1. Create volumio-svelte directory
2. Initialize Svelte project with SvelteKit
3. Set up testing infrastructure
4. Create Socket.io service wrapper
5. Implement player store and test
6. Build PlayerBar component
7. Continue with remaining phases

**Estimated Timeline**: 14-19 weeks full-time development

---

## Questions for Clarification

Before starting implementation:

1. ✓ Design preferences confirmed (iOS 26 style, single bar, touch screen)
2. ✓ Font choice confirmed (Inter or other open-source fonts)
3. Should we support dark/light theme switching, or just dark mode?
4. Are there any MyVolumio cloud features that must be migrated?
5. Should we maintain backward compatibility with old URL schemes?
6. What's the deployment timeline? Can we do phased rollout?
