# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Volumio2-UI is a standalone web user interface for Volumio2 audio player. It communicates with the backend via Socket.io WebSocket API. The UI is served via Express static server and resides at `/volumio/http/www` (Classic UI) or `/volumio/http/www3` (Contemporary UI) on Volumio devices.

This repository contains two projects:
- **Legacy UI** (root): AngularJS 1.5 application (Node.js 10.22.1 required)
- **POC** (`volumio-poc/`): Svelte 5 application for CarPlay-style LCD interface (1920x440)

**Related Workspaces** (additional working directories):
- `stellar-volumio-audioplayer-backend/` - Go backend with Socket.IO, MPD integration
- `volumio3-backend/` - Original Volumio3 backend (Node.js)

## Development Environment

> **Key Concept:** Development happens on your Mac, deployment targets the Pi.

- Dev mode frontend (`localhost:5173`) connects to Pi backend (`PI_IP:3000`)
- Configure Pi IP in `volumio-poc/src/lib/config.ts` (`DEV_VOLUMIO_IP`)
- Production: Frontend and backend both run on the Pi

## Quick Reference

### Legacy UI (AngularJS)
```bash
# Initial setup (Node 10.22.1 required via NVM)
npm install bower -g && npm install && bower install

# Development
gulp serve --theme="volumio"                    # Dev server (Classic UI)
gulp serve --theme="volumio3"                   # Dev server (Contemporary UI)
gulp serve --theme="volumio" --debug            # With debug console logs

# Build
npm run build:volumio                           # Production build (Classic)
npm run build:volumio3                          # Production build (Contemporary)

# Test
npm test                                        # Run all tests (Karma + Jasmine)

# Linting - JSHint runs automatically via webpack during `gulp serve`
```

### POC (Svelte)
```bash
cd volumio-poc

# Development
npm run dev                                     # Dev server (localhost:5173)

# Testing
npm test                                        # Unit tests (watch mode)
npm run test:run                                # Unit tests (once)
npm run test:run src/lib/stores/__tests__/player.test.ts  # Single test file
npm run test:run -- --grep "player state"       # Tests matching pattern
npm run test:e2e                                # E2E tests (Playwright)
npm run test:e2e:headed                         # E2E in headed browser
npm run test:e2e:ui                             # Playwright UI mode

# Build & Type Check
npm run build                                   # Production build → dist/
npx tsc --noEmit                                # Type check only

# Deploy to Pi
npm run deploy                                  # Runs scripts/deploy.sh
```

## Raspberry Pi Development

### Environment Setup

Create `.env` in the **project root** (not volumio-poc/):
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

# 2. Deploy Frontend (POC)
cd volumio-poc && npm run deploy

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

### Legacy UI (AngularJS)

**Tech Stack**: AngularJS 1.5, Gulp 3.x, SCSS, Babel 5, Socket.io 2.3.x

**Key Files:**
- `src/app/index.module.js` - Main module, registers all components
- `src/app/index.route.js` - UI router configuration
- `src/app/services/socket.service.js` - WebSocket communication hub
- `src/app/services/player.service.js` - Player state management
- `src/app/local-config.json` - Create with backend IP: `{"localhost": "http://192.168.x.x"}`

**Patterns:**
- All backend communication via Socket.io events (`emit('eventName')` → `on('pushEventName')`)
- Two themes: `volumio` (Classic) and `volumio3` (Contemporary) in `src/app/themes/`
- Services in `src/app/services/`, directives in `src/app/components/`

### POC (Svelte)

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
- `navigation.ts` - View routing, layout mode
- `lcd.ts` - LCD standby modes (CSS dimmed / hardware), brightness
- `settings.ts` - UI preferences

**Patterns:**
- Each store exports: `init*Store()` function, writable stores, derived stores, and `*Actions` object
- Tests in `__tests__/` directories adjacent to source files
- Layouts: `LCDLayout` (1920x440), `MobileLayout`, `DesktopLayout`
- Force layout via URL: `?layout=lcd` or `?layout=mobile`

**LCD Panel Design (1920x440):**
- Touch targets: 44×44px minimum
- App tiles: 179×179px icons
- Control buttons: 90×90px, Play button: 98×98px

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
| `enrichment:queue` | `pushEnrichmentQueueResult` | Trigger missing artwork queue |

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

**LCD Control System:**
- Two standby modes: CSS Dimmed (default, instant wake) or Hardware (wlr-randr, saves power)
- Key files: `lcd.ts` (store), `StandbyOverlay.svelte` (overlay + touch handling)
- State: ON → DIMMED → STANDBY
- Force layout via URL: `?layout=lcd` or `?layout=mobile`

### Socket.IO Compatibility

| Component | Socket.IO Version |
|-----------|-------------------|
| Volumio Connect apps | v2.x client |
| Stellar Go backend | v3 server (EIO3 compat enabled) |
| Svelte frontend (POC) | v4 client |

**mDNS Discovery:** Service type `_Volumio._tcp` via Avahi (`/etc/avahi/services/stellar.service`)

## Development Workflow

### Conventional Commits

Format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Example: `git commit -m "feat(audio): add bit-perfect audio status indicator"`

### E2E Tests

Current pass rate: 38%. Known issues documented in `volumio-poc/E2E-TEST-ISSUES.md`.
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

For detailed design, see `volumio-poc/docs/LIBRARY-CACHE-DESIGN.md`.

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

### Additional Documentation

- `volumio-poc/DEVELOPMENT.md` - Full development guide (kiosk setup, deployment)
- `volumio-poc/E2E-TEST-ISSUES.md` - Test failure analysis
- `volumio-poc/docs/LIBRARY-CACHE-DESIGN.md` - Library cache architecture
- `volumio-poc/docs/ARCHITECTURE.md` - Full backend architecture plan

## Browser Console Debugging (POC)

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

- **Socket.io version mismatch**: Use Socket.io 2.3.x CDN for Legacy, 4.x for POC
- **Connection fails with .local hostname**: Use IP address instead
- **`$lib` path not resolved**: Check `vite.config.ts` alias configuration
- **POC not connecting**: Verify `DEV_VOLUMIO_IP` in `volumio-poc/src/lib/config.ts`

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
