# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stellar Volumio is a modern Svelte 5 web application for controlling Volumio-compatible audio players. It features a CarPlay-style interface optimized for LCD displays (1920x440) and communicates with the backend via Socket.IO WebSocket API.

**Related Workspaces** (additional working directories):
- `stellar-volumio-audioplayer-backend/` - Go backend with Socket.IO, MPD integration
- `volumio3-backend/` - Original Volumio3 backend (Node.js)

## Development Environment

> **Key Concept:** Development happens on your Mac, deployment targets the Pi.

- Dev mode frontend (`localhost:5173`) connects to Pi backend (`PI_IP:3000`)
- Configure Pi IP in `src/lib/config.ts` (`DEV_VOLUMIO_IP`)
- Production: Frontend and backend both run on the Pi

## Quick Reference

```bash
# Setup
npm install                                     # Install dependencies (first time)

# Development
npm run dev                                     # Dev server (localhost:5173)

# Testing
npm test                                        # Unit tests (watch mode)
npm run test:run                                # Unit tests (once)
npm run test:coverage                           # Unit tests with coverage
npm run test:run src/lib/stores/__tests__/player.test.ts  # Single test file
npm run test:run -- --grep "player state"       # Tests matching pattern
npm run test:e2e                                # E2E tests (Playwright)
npm run test:e2e:headed                         # E2E in headed browser
npm run test:e2e:ui                             # Playwright UI mode
npm run test:e2e:debug                          # E2E debug mode

# Build & Type Check
npm run build                                   # Production build → dist/
npm run preview                                 # Preview production build locally
npx tsc --noEmit                                # Type check only

# Deploy to Pi
npm run deploy                                  # Runs scripts/deploy.sh
```

## Raspberry Pi Development

### Environment Setup

Create `.env` in the **project root**:
```bash
cp .env-example .env
# Edit with your Pi credentials
```

**Root .env variables:**
| Variable | Description | Example |
|----------|-------------|---------|
| `RASPBERRY_PI_SSH_USERNAME` | SSH user | `volumio` |
| `RASPBERRY_PI_SSH_PASSWORD` | SSH password | `volumio` |
| `RASPBERRY_PI_API_ADDRESS` | Pi IP address | `192.168.1.100` |
| `STELLAR_BACKEND_FOLDER` | Path to Stellar backend repo | `/path/to/stellar-backend` |

### SSH Helper

```bash
source .env
SSH_CMD="sshpass -p '$RASPBERRY_PI_SSH_PASSWORD' ssh -o StrictHostKeyChecking=no $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"
```

### Deployment

**IMPORTANT:** Always stop services before deploying and start them after.

```bash
# 1. Stop services
source .env
SSH_CMD="sshpass -p '$RASPBERRY_PI_SSH_PASSWORD' ssh -o StrictHostKeyChecking=no $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"
eval "$SSH_CMD 'sudo systemctl stop stellar-frontend stellar-backend'"

# 2. Deploy Frontend (Stellar Volumio)
npm run deploy

# 3. Deploy Backend (Stellar) - CGO required for SQLite
# Install cross-compiler: brew install FiloSottile/musl-cross/musl-cross
source .env && cd "$STELLAR_BACKEND_FOLDER"
CGO_ENABLED=1 CC=aarch64-linux-musl-gcc GOOS=linux GOARCH=arm64 \
  go build -ldflags='-linkmode external -extldflags "-static"' -o stellar-arm64 ./cmd/stellar
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" scp stellar-arm64 "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-backend/stellar"
eval "$SSH_CMD 'chmod +x ~/stellar-backend/stellar'"

# 4. Start services
eval "$SSH_CMD 'sudo systemctl start stellar-backend stellar-frontend'"
```

**View logs:** `eval "$SSH_CMD 'journalctl -u stellar-backend -f'"`

### Services on Pi

| Service | Port | Description |
|---------|------|-------------|
| `stellar-frontend` | 8080 | Python HTTP server serving `~/stellar-volumio` |
| `stellar-backend` | 3000 | Stellar Go backend (Volumio standard port) |
| `mpd` | 6600 | Music Player Daemon |

## Architecture

**Tech Stack**: Svelte 5, TypeScript, Vite 7, Vitest 4.x, Playwright, Socket.io 4.x

**Key Files:**
- `src/lib/config.ts` - Backend URL configuration (`DEV_VOLUMIO_IP`)
- `src/lib/services/socket.ts` - Socket.IO wrapper
- `src/lib/stores/` - Svelte stores (see below)
- `src/App.svelte` - Root component with layout switching

**Key Stores** (in `src/lib/stores/`):
- `player.ts` - Playback state, volume, seek, track info
- `queue.ts` - Play queue management
- `browse.ts` - Library browsing, navigation history
- `library.ts` - MPD-driven library browsing (albums, artists, radio)
- `playlist.ts` - Playlist CRUD (list, create, delete, play, add/remove items)
- `navigation.ts` - View routing, layout mode
- `lcd.ts` - LCD standby modes (CSS dimmed / hardware), brightness
- `settings.ts` - UI preferences

**Patterns:**
- Each store exports: `init*Store()` function, writable stores, derived stores, and `*Actions` object
- Tests in `__tests__/` directories adjacent to source files
- Layouts: `LCDLayout` (1920x440), `MobileLayout`, `DesktopLayout`
- Force layout via URL: `?layout=lcd` or `?layout=mobile`

**Store Pattern Example:**
```typescript
// src/lib/stores/example.ts
import { writable, derived, get } from 'svelte/store';
import { socketService } from '$lib/services/socket';

// 1. State stores (writables)
export const exampleData = writable<SomeType | null>(null);
export const exampleLoading = writable<boolean>(false);

// 2. Derived stores (computed from writables)
export const exampleCount = derived(exampleData, $data => $data?.items.length ?? 0);

// 3. Actions object (methods that modify state or emit socket events)
export const exampleActions = {
  fetch: () => socketService.emit('getExample'),
  update: (value: string) => socketService.emit('updateExample', { value }),
};

// 4. Init function (registers socket listeners, called once from App.svelte)
let initialized = false;
export function initExampleStore() {
  if (initialized) return;
  initialized = true;

  socketService.on<SomeType>('pushExample', (data) => {
    exampleData.set(data);
  });

  // Request initial state
  exampleActions.fetch();
}
```

**LCD Panel Design (1920x440):**
- Touch targets: 44x44px minimum
- App tiles: 179x179px icons
- Control buttons: 90x90px, Play button: 98x98px

**Header Tokens (v1.3.1+):**
- CSS var `--header-height-slim: 52px` defined in `app.css`
- Internal pages use slim header: 52px height, 44px back button
- Audirvana uses `BackHeader.svelte` component (unchanged styling)
- Main screen tiles: Spotify and USB removed (v1.3.1)

**PlaylistsView (v1.6.0+):**

Dedicated view for managing playlists, accessed via Playlists tile from home screen.

**Features:**
- Header with back button and playlist count
- Search bar below header (filters playlists by name)
- Create playlist button in header
- Grid of playlist cards with play overlay
- Delete button (appears on hover) with confirmation modal
- Empty state with create button
- Loading skeleton during fetch
- Error state with retry

**Navigation:** `navigationActions.goToPlaylists()`

**Components:** `src/lib/components/views/PlaylistsView.svelte`

**Store:** `src/lib/stores/playlist.ts` exports:
- `playlists` - Array of playlist names
- `playlistsLoading`, `playlistsError` - Loading/error states
- `playlistsCount` - Derived count
- `playlistActions` - CRUD operations (see Socket.IO events below)

**Docked Mini Player (v1.4.0+):**

The home screen features a permanently docked mini player on the left side (~40% width).

**Components** (in `src/lib/components/miniplayer/`):
- `DockedMiniPlayer.svelte` - Main shell with deep-sunk styling
- `MiniPlayerQueueStrip.svelte` - Horizontal scroll of upcoming tracks

**Layout:**
- CSS Grid: 40% mini player | 60% app tiles
- Square edges, no rounded corners
- "Deep sunk" effect on right edge (inner shadow + gradient)

**Features:**
- Large album artwork (200x200px)
- Track info (title, artist, album) + format badges (FLAC, 96kHz, 24bit)
- Transport controls (shuffle, prev, play/pause, next, repeat)
- Seek bar with time display
- Source label (NAS, USB, LOCAL, QOBUZ, TIDAL, etc.)
- Expand button -> full PlayerView
- Queue strip showing upcoming tracks (tap to play)

**Source Label Mapping** (`src/lib/utils/sourceClassifier.ts`):
| URI Pattern | Label |
|-------------|-------|
| `NAS/` or `music-library/NAS/` | NAS |
| `USB/` or `music-library/USB/` | USB |
| `INTERNAL/` or `music-library/INTERNAL/` | LOCAL |
| `qobuz://` | QOBUZ |
| `tidal://` | TIDAL |
| `spotify://` | SPOTIFY |
| `webradio/` or `http(s)://` | WEBRADIO |
| `audirvana:` | AUDIRVANA |
| Unknown | Hidden (null) |

**Library Context Menu (v1.7.0+):**

Context menu system for Album and Track items throughout the library views.

**Components:**
- `TrackItem.svelte` - Reusable track row with play and more buttons (48px min height)
- `LibraryContextMenu.svelte` - Context menu with library-specific actions

**TrackItem Features:**
- Track number (1-indexed from array position)
- Title and artist display with text ellipsis
- Duration formatting (M:SS)
- Play button on click
- More button (3-dots) for context menu

**LibraryContextMenu Options:**
| Option | Album | Track | Description |
|--------|-------|-------|-------------|
| Play Now | Yes | Yes | Start playback immediately |
| Play Next | Yes | Yes | Insert after current track |
| Add to Queue | Yes | Yes | Append to end of queue |
| Add to Playlist | Yes | Yes | Opens PlaylistSelector modal |
| View Info | No | Yes | Opens track info modal |

**Touch Targets (optimized for LCD):**
- AlbumGrid play button: 64x64px (up from 56px)
- AlbumGrid more button: 40x40px
- AlbumGrid tile min-width: 220px (up from 200px)
- TrackItem row: 48px min height

**Store Actions** (in `libraryActions`):
- `playAlbumNext(album)` - Insert album after current track
- `addTrackToQueue(track)` - Add single track to queue
- `playTrackNext(track)` - Insert track after current track

**UI Store Types** (in `src/lib/stores/ui.ts`):
- `ContextItemType`: `'browse' | 'queue' | 'album' | 'track'`
- `LibraryContextItem`: `Album | Track`
- `ContextMenuItem`: Union of all item types

**Store Initialization:**
```typescript
// In App.svelte onMount():
initPlayerStore();   // Registers pushState listener, requests initial state
initBrowseStore();   // Registers pushBrowseLibrary listener
initQueueStore();    // Registers pushQueue listener
```

### Socket.IO Events (Stellar Backend)

**Player Events:**
| Emit | Receive | Description |
|------|---------|-------------|
| `getState` | `pushState` | Get/receive player state |
| `play`, `pause`, `stop` | - | Playback control |
| `toggle` | - | Play/pause toggle (Volumio Connect) |
| `prev`, `next` | - | Track navigation |
| `volume` | - | Set volume (0-100) |
| `seek` | - | Seek to position (seconds) |
| `setRandom` | - | Toggle shuffle (`{ value: boolean }`) |
| `setRepeat` | - | Set repeat mode (`{ value: boolean, repeatSingle: boolean }`) |
| `mute` | - | Mute/unmute (`'mute'` or `'unmute'`) |
| `GetTrackInfo` | `pushTrackInfo` | Extended track metadata |

**Queue/Library Events:**
| Emit | Receive | Description |
|------|---------|-------------|
| `getQueue` | `pushQueue` | Queue management |
| `browseLibrary` | `pushBrowseLibrary` | Library browsing (folder-based) |
| `search` | `pushBrowseLibrary` | Search results |
| `addToPlaylist`, `removeFromPlaylist` | - | Playlist modification |
| `createPlaylist`, `deletePlaylist` | - | Playlist CRUD |
| `playPlaylist` | - | Play entire playlist |
| `addToFavourites`, `removeFromFavourites` | - | Favorites management |
| `enqueue` | - | Add items to queue |

**MPD-Driven Library Events (v1.2.0+):**
| Emit | Receive | Description |
|------|---------|-------------|
| `library:albums:list` | `pushLibraryAlbums` | List albums with scope/sort/query |
| `library:artists:list` | `pushLibraryArtists` | List artists |
| `library:artist:albums` | `pushLibraryArtistAlbums` | Albums by specific artist |
| `library:album:tracks` | `pushLibraryAlbumTracks` | Tracks for an album |
| `library:radio:list` | `pushLibraryRadio` | Radio stations from playlists |

**Library Scope Values:** `all`, `nas`, `local`, `usb`
**Sort Orders:** `alphabetical`, `by_artist`, `recently_added`, `year`

**Library Cache Events (v1.3.0+):**
| Emit | Receive | Description |
|------|---------|-------------|
| `library:cache:status` | `pushLibraryCacheStatus` | Get cache statistics |
| `library:cache:rebuild` | - | Trigger full cache rebuild |
| - | `library:cache:updated` | Broadcast when cache rebuild completes |

**Artwork Enrichment Events (v1.4.0+):**
| Emit | Receive | Description |
|------|---------|-------------|
| `enrichment:status` | `pushEnrichmentStatus` | Get enrichment worker status |
| `enrichment:queue` | `pushEnrichmentQueueResult` | Trigger missing album artwork queue |
| `enrichment:artists:queue` | `pushEnrichmentQueueResult` | Trigger missing artist artwork queue (v1.5.0+) |

**EnrichmentStatus Payload:**
```typescript
interface EnrichmentStatus {
  workerRunning: boolean;   // Worker processing jobs
  pending: number;          // Jobs waiting to process
  running: number;          // Jobs currently processing
  completed: number;        // Successfully completed jobs
  failed: number;           // Failed jobs
  queueRunning: boolean;    // Coordinator scanning for missing artwork
}
```

**CacheStatus Payload:**
```typescript
interface CacheStatus {
  lastUpdated: string;      // ISO timestamp
  albumCount: number;
  artistCount: number;
  trackCount: number;
  artworkCached: number;
  artworkMissing: number;
  radioCount: number;
  isBuilding: boolean;
  buildProgress: number;    // 0-100
  schemaVersion: string;
}
```

**System Events:**
| Emit | Receive | Description |
|------|---------|-------------|
| `getNetworkStatus` | `pushNetworkStatus` | Network connection info |
| `getLcdStatus` | `pushLcdStatus` | LCD panel state |
| `lcdStandby`, `lcdWake` | `pushLcdStatus` | LCD hardware power control (wlr-randr) |
| - | `pushToastMessage` | Toast notifications from backend |

**Volumio Connect Events (v1.5.0+):**

These events enable compatibility with Volumio Connect mobile apps (iOS/Android).

| Emit | Receive | Description |
|------|---------|-------------|
| `getDeviceInfo` | `pushDeviceInfo` | Get device UUID and name |
| `getMultiRoomDevices` | `pushMultiRoomDevices` | List devices (single-device mode) |
| `initSocket` | - | Register connecting device (acknowledgment) |
| `toggle` | - | Play/pause toggle |
| `addPlay` | - | Clear queue, add URI, and play |
| `playNext` | - | Insert URI after current track |
| `addToQueueNext` | - | Alias for playNext |
| `moveQueue` | - | Reorder queue (`{ from: int, to: int }`) |
| `removeFromQueue` | - | Remove item from queue (position or `{ value: int }`) |

**DeviceInfo Payload:**
```typescript
interface DeviceInfo {
  uuid: string;    // Unique device identifier (persisted)
  name: string;    // Device name (default: hostname)
}
```

**MultiRoomDevices Payload:**
```typescript
interface MultiRoomDevices {
  misc: { debug: boolean };
  list: [{
    id: string;           // Device UUID
    name: string;         // Device name
    host: string;         // HTTP URL
    isSelf: boolean;      // true for this device
    type: "device";       // Always "device"
    volumeAvailable: boolean;
    state: {
      status: string;     // "play" | "pause" | "stop"
      volume: number;
      mute: boolean;
      artist: string;
      track: string;
      albumart: string;
    }
  }]
}
```

**LCD Control System:**
- Two standby modes: CSS Dimmed (default, instant wake) or Hardware (wlr-randr, saves power)
- Key files: `lcd.ts` (store), `StandbyOverlay.svelte` (overlay + touch handling)
- State: ON -> DIMMED -> STANDBY
- Force layout via URL: `?layout=lcd` or `?layout=mobile`

**Stand By Tile (v2.0.2+):**
- Located in `AppLauncher.svelte` as a home screen tile
- Replaces the LCD Off button previously in the StatusBar
- Title: "Stand By"
- Subtitle: Reactive state indicator ("ON" when in standby, "OFF" when screen is active)
- Action: Calls `lcdActions.toggle()` to switch standby mode
- Respects the configured standby mode (CSS Dimmed or Hardware) from settings

**Connection Grace Period (v2.0.1+):**

Prevents UI flicker during brief network disconnections. Instead of immediately showing the "Connection Failed" screen, the UI remains stable during a 3-second grace period.

**Implementation:**
- `src/lib/services/socket.ts` - Grace period timer and `isReconnecting` store
- `src/lib/components/ReconnectingOverlay.svelte` - Subtle overlay during reconnection

**Behavior:**
| Event | Before Grace Period | After Grace Period |
|-------|--------------------|--------------------|
| Disconnect | UI stays visible, overlay shows | Full disconnect screen |
| Reconnect during grace | Overlay disappears, normal operation | Normal operation |
| Connect (first time) | Immediate (no grace period) | N/A |

**Stores:**
- `connectionState` - Debounced state: only transitions to `'disconnected'` after grace period
- `isReconnecting` - `true` during grace period when attempting to reconnect

**Configuration:**
```typescript
const DISCONNECT_GRACE_PERIOD_MS = 3000; // 3 seconds
```

### Socket.IO Performance Optimization (v2.1.0+)

**MPD Event Debouncing:**
- `BroadcastDebouncer` (`debouncer.go`) collapses rapid MPD subsystem events (100ms window)
- Volume knob turning (20 mixer events) produces 1 broadcast instead of 20
- `database` events bypass debouncer for immediate cache rebuild

**State Diffing:**
- `BroadcastState()` compares key fields with last broadcast before emitting
- Fields checked: status, position, title, artist, album, volume, seek, duration, random, repeat, samplerate, bitdepth, trackType
- Skips broadcast if no fields changed (common during steady playback)

**Connection Limiting:**
- `ConnectionLimiter` (`connlimit.go`) allows 1 external + unlimited local connections
- Local = `127.0.0.1` or `::1` (always allowed)
- Second external connection evicts oldest with a toast notification
- Prevents broadcast multiplication from unlimited clients

**Handler Redundancy Removal:**
- Volumio Connect handlers (addPlay, playNext, moveQueue, removeFromQueue) no longer call `BroadcastQueue()` - MPD watcher handles it via debouncer
- `playPlaylist` sends only unicast to requesting client; MPD watcher broadcasts to all

**Frontend Store Optimization:**
- Change-gated store updates: `volume.set()` only called when value actually differs
- Removed duplicate `getState` request from `initPlayerStore()` (backend pushes on connect)
- Removed duplicate `getQueue()` call from `initQueueStore()` (backend pushes on connect)
- `fixVolumioAssetUrl()` results cached (200-entry LRU) to avoid `new URL()` parsing on every pushState
- `AppLauncher.svelte` uses keyed `{#each}` to prevent full tile re-renders when standby subtitle changes
- Console.log calls removed from hot-path handlers (pushState, player actions, queue actions)

### Socket.IO Compatibility

| Component | Socket.IO Version |
|-----------|-------------------|
| Volumio Connect apps | v2.x client |
| Stellar Go backend | v3 server (EIO3 compat enabled) |
| Stellar Volumio frontend | v4.x client (npm package) |

**mDNS Discovery:** Service type `_Volumio._tcp` via Avahi (`/etc/avahi/services/stellar.service`)

## Development Workflow

### Conventional Commits

Format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Example: `git commit -m "feat(audio): add bit-perfect audio status indicator"`

### E2E Tests

Current pass rate: 38%. Known issues documented in `E2E-TEST-ISSUES.md`.
**Priority:** Add `data-testid` attributes when modifying components.

### Library Cache System (v1.3.0+)

The backend uses SQLite to cache MPD library metadata for faster browsing:

**Architecture:**
- SQLite database at `/home/volumio/stellar-backend/data/library.db`
- Artwork cached at `/home/volumio/stellar-backend/data/cache/artwork/`
- Cache rebuilds on startup and when MPD database changes (via idle events)
- Frontend receives `library:cache:updated` event when rebuild completes

**Resolution Order for Artwork:**
1. Cache (artwork table + file on disk)
2. MPD `albumart` command (folder-based: cover.jpg, etc.)
3. MPD `readpicture` command (embedded in audio file)
4. Placeholder

**Manual Cache Operations:**
```bash
# Check cache database
sqlite3 ~/stellar-backend/data/library.db ".tables"
sqlite3 ~/stellar-backend/data/library.db "SELECT COUNT(*) FROM albums"

# Trigger cache rebuild via Socket.IO
# From browser console:
window.libraryActions.rebuildCache()
```

For detailed design, see `docs/LIBRARY-CACHE-DESIGN.md`.

### Artwork Enrichment System (v1.4.0+)

When albums lack embedded artwork or folder-based cover images, the backend automatically fetches artwork from the Cover Art Archive using MusicBrainz lookups.

**How It Works:**
1. After cache rebuild completes, coordinator scans for albums without artwork
2. MusicBrainz API is queried to find release MBIDs by artist/album name
3. Jobs are queued in SQLite for albums with valid MBIDs
4. Background worker fetches artwork from Cover Art Archive
5. Downloaded artwork is saved to cache directory and linked to albums

**Key Components:**
- `internal/infra/enrichment/musicbrainz.go` - MusicBrainz release search client
- `internal/infra/enrichment/caa.go` - Cover Art Archive client
- `internal/infra/enrichment/coordinator.go` - Orchestrates enrichment workflow
- `internal/infra/enrichment/worker.go` - Background job processor
- `internal/transport/socketio/enrichment_handlers.go` - Socket.IO handlers

**Rate Limiting:** MusicBrainz API is rate-limited to 1 request/second per their guidelines.

**Manual Enrichment Operations:**
```bash
# Check enrichment job queue
sqlite3 ~/stellar-backend/data/library.db "SELECT status, COUNT(*) FROM enrichment_jobs GROUP BY status"

# Trigger enrichment scan via Socket.IO
# From browser console:
socket.emit('enrichment:queue')
```

### Artist Artwork Enrichment (v1.5.0+)

The backend fetches official artist images from external services when artists lack artwork.

**External Services:**
| Service | Use Case | Notes |
|---------|----------|-------|
| Fanart.tv | Primary source | Requires API key, uses MusicBrainz Artist IDs, images cached locally |
| Deezer | Fallback | No auth needed, hotlink only (cannot cache per ToS) |
| First Album | Final fallback | Uses the artist's first album artwork |

**Fallback Chain:**
1. Fanart.tv (if `FANART_API_KEY` configured) - high quality, cacheable
2. Deezer search - returns URL only (hotlink)
3. First album artwork from cache

**Environment Variables:**
| Variable | Description | Required |
|----------|-------------|----------|
| `FANART_API_KEY` | Fanart.tv API key | Optional (get free key at fanart.tv) |

**Socket.IO Events:**
| Emit | Receive | Description |
|------|---------|-------------|
| `enrichment:artists:queue` | `pushEnrichmentQueueResult` | Trigger artist image enrichment scan |

**HTTP Endpoint:**
```
GET /artistart?id={artistID}    # By artist ID (preferred)
GET /artistart?name={artistName} # By artist name (fallback search)
```
- Returns image data directly, or redirects to external URL (Deezer hotlinks)
- Returns 404 if no artwork found

**Key Components:**
- `internal/infra/enrichment/fanarttv.go` - Fanart.tv client (downloads highest-liked artistthumb)
- `internal/infra/enrichment/deezer.go` - Deezer client (returns picture_xl URL)
- `internal/infra/enrichment/musicbrainz.go` - SearchArtist method for MBID lookup

**Manual Operations:**
```bash
# Check artist artwork status
sqlite3 ~/stellar-backend/data/library.db "SELECT name, artwork_id FROM artists WHERE artwork_id != ''"

# Trigger artist enrichment via Socket.IO
# From browser console:
socket.emit('enrichment:artists:queue')
```

### Additional Documentation

- `DEVELOPMENT.md` - Full development guide (kiosk setup, deployment)
- `E2E-TEST-ISSUES.md` - Test failure analysis
- `docs/LIBRARY-CACHE-DESIGN.md` - Library cache architecture
- `docs/ARCHITECTURE.md` - Full backend architecture plan

## Browser Console Debugging

```javascript
// Performance
__performance.toggle()              // FPS overlay
__latency.getStats('pushState')    // Event latency

// Navigation (E2E testing)
__navigation.goToQueue() / goToPlayer() / goToBrowse() / goToSettings()

// Test helpers
testToast.error('Title', 'Message')
testIssue.mpdError()
window.libraryActions.rebuildCache()  // Trigger cache rebuild
```

## Performance Debugging

```bash
# Pi hardware status
source .env && eval "$SSH_CMD 'vcgencmd measure_temp && vcgencmd get_throttled'"
```

## Troubleshooting

- **Socket.io version mismatch**: Stellar Volumio uses 4.x npm package; Stellar backend runs v3 server with EIO3 compat
- **Connection fails with .local hostname**: Use IP address instead
- **`$lib` path not resolved**: Check `vite.config.ts` alias configuration
- **Stellar Volumio not connecting**: Verify `DEV_VOLUMIO_IP` in `src/lib/config.ts`

## Stellar Backend

Configured via `STELLAR_BACKEND_FOLDER` in `.env`. GitHub: https://github.com/edumarques81/stellar-volumio-audioplayer-backend

```bash
cd "$STELLAR_BACKEND_FOLDER"
go test ./...                                      # Run tests
# Build for Pi (CGO required for SQLite)
CGO_ENABLED=1 CC=aarch64-linux-musl-gcc GOOS=linux GOARCH=arm64 \
  go build -ldflags='-linkmode external -extldflags "-static"' -o stellar-arm64 ./cmd/stellar
```

**Architecture:**
- Go backend with Socket.IO, MPD integration via idle watcher
- **MPD as Single Source of Truth** - no state machine
- SQLite cache for library metadata at `/home/volumio/stellar-backend/data/library.db`
- Configuration: `configs/stellar.yaml` on the Pi
