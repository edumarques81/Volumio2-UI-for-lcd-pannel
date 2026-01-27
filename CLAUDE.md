# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Volumio2-UI is a standalone web user interface for Volumio2 audio player. It communicates with the Volumio2 backend via Socket.io WebSocket API. The UI is served via Express static server and resides at `/volumio/http/www` (Classic UI) or `/volumio/http/www3` (Contemporary UI) on Volumio devices.

This repository contains two projects:
- **Legacy UI** (root): AngularJS 1.5 application (Node.js 10.22.1 required)
- **POC** (`volumio-poc/`): Svelte 5 application for CarPlay-style LCD interface (1920x440)

**Current Version**: See `volumio-poc/package.json` for POC version

## Important: localhost vs Raspberry Pi

> **Key Concept:** Development happens on your Mac, deployment targets the Pi.

| Term | Refers To | Example |
|------|-----------|---------|
| `localhost` | Your macOS development machine | `localhost:5173` (Vite dev server) |
| Pi IP | Raspberry Pi target device | `192.168.x.x:3000` (Stellar backend) |

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
# Note: Karma doesn't support single-file testing easily. Run full suite.

# Linting
# JSHint runs automatically via webpack during `gulp serve`
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
npm run test:e2e:debug                          # Debug mode with inspector
npm run test:e2e:report                         # View last test report
npm run test:coverage                           # Tests with coverage

# Build & Type Check
npm run build                                   # Production build → dist/
npx tsc --noEmit                                # Type check only

# Linting
# No ESLint/Prettier configured. TypeScript provides type checking.

# Deploy to Pi (see Environment Variables below)
npm run deploy                                  # Runs scripts/deploy.sh
```

## Raspberry Pi Development

### Environment Setup

Create `.env` in the **project root** (not volumio-poc/):
```bash
cp .env-example .env
# Edit with your Pi credentials
```

**Root .env variables** (for SSH helper and backend deployment):
| Variable | Description | Example |
|----------|-------------|---------|
| `RASPBERRY_PI_SSH_USERNAME` | SSH user | `pi` |
| `RASPBERRY_PI_SSH_PASSWORD` | SSH password | `your_password` |
| `RASPBERRY_PI_API_ADDRESS` | Pi IP address | `192.168.1.100` |
| `STELLAR_BACKEND_FOLDER` | Path to Stellar backend repo | `/path/to/stellar-backend` |

**POC deploy script** (`volumio-poc/scripts/deploy.sh`) uses different env vars:
| Variable | Default | Description |
|----------|---------|-------------|
| `VOLUMIO_PI_HOST` | `192.168.86.34` | Pi IP for deployment |
| `VOLUMIO_PI_USER` | `volumio` | SSH user |
| `VOLUMIO_PI_PASS` | `volumio` | SSH password |

Optional (NAS music source):
- `NAS_IP`, `NAS_SHARE`, `NAS_USERNAME`, `NAS_PASSWORD` - Windows NAS config for mounting music shares

### SSH Helper

All SSH operations use `sshpass` with credentials from `.env`. Define this helper:
```bash
source .env
SSH_CMD="sshpass -p '$RASPBERRY_PI_SSH_PASSWORD' ssh -o StrictHostKeyChecking=no $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"
```

### Deployment

**IMPORTANT:** Always stop services before deploying and start them after.

**Step 1: Stop services on Pi**
```bash
source .env
SSH_CMD="sshpass -p '$RASPBERRY_PI_SSH_PASSWORD' ssh -o StrictHostKeyChecking=no $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"
eval "$SSH_CMD 'sudo systemctl stop stellar-frontend stellar-backend'"
```

**Step 2: Deploy Frontend (POC)**
```bash
cd volumio-poc && npm run deploy    # Uses scripts/deploy.sh
```

**Step 3: Deploy Backend (Stellar)**
```bash
source .env && cd "$STELLAR_BACKEND_FOLDER"
# CGO required for SQLite cache - use musl cross-compiler (brew install FiloSottile/musl-cross/musl-cross)
CGO_ENABLED=1 CC=aarch64-linux-musl-gcc GOOS=linux GOARCH=arm64 \
  go build -ldflags='-linkmode external -extldflags "-static"' -o stellar-arm64 ./cmd/stellar
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" scp stellar-arm64 "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-backend/stellar"
eval "$SSH_CMD 'chmod +x ~/stellar-backend/stellar'"
```

**Step 4: Start services on Pi**
```bash
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

**Stores (21 total):**
| Store | Purpose |
|-------|---------|
| `player.ts` | Playback state, volume, seek, track info |
| `queue.ts` | Play queue management |
| `browse.ts` | Library browsing, navigation history |
| `navigation.ts` | View routing, layout mode |
| `audioEngine.ts` | Audio engine selection (Stellar/Audirvana) |
| `audirvana.ts` | Audirvana Studio integration and discovery |
| `audio.ts` | Audio output settings, bit-perfect config |
| `audioDevices.ts` | DAC/output device enumeration |
| `lcd.ts` | LCD standby modes (CSS dimmed / hardware), brightness |
| `network.ts` | Network status |
| `favorites.ts`, `playlist.ts` | User collections |
| `settings.ts` | UI preferences |
| `issues.ts` | System issue notifications |
| `device.ts` | Device detection/information |
| `performance.ts` | FPS monitoring, performance metrics |
| `sources.ts` | Music source configuration |
| `ui.ts` | UI state (drawers, modals) |
| `version.ts` | Application version info |
| `qobuz.ts` | Qobuz streaming integration |
| `localMusic.ts` | Local music library management |
| `library.ts` | MPD-driven library browsing (albums, artists, radio) |

**Patterns:**
- Each store exports: `init*Store()` function, writable stores, derived stores, and `*Actions` object
- Tests in `__tests__/` directories adjacent to source files
- Layouts: `LCDLayout` (1920x440), `MobileLayout`, `DesktopLayout`
- Force layout via URL: `?layout=lcd` or `?layout=mobile`

**LCD Panel Sizes (1920x440):**
- App tiles: 179×179px icons, 33px border-radius
- Album art: 146×146px (Now Playing) or 320×320px (full player)
- Control buttons: 90×90px, Play button: 98×98px
- Touch targets: 44×44px minimum

**MPD-Driven Library Views (v1.2.0+):**
- `AllAlbumsView` - Music Library (all sources)
- `NASAlbumsView` - NAS albums only
- `ArtistsView` - Artists → Albums → Tracks hierarchy
- `RadioView` - Web radio stations
- `AlbumGrid` - Reusable album grid component

**Store Initialization Pattern:**
```typescript
// In App.svelte onMount():
initPlayerStore();   // Registers pushState listener, requests initial state
initBrowseStore();   // Registers pushBrowseLibrary listener
initQueueStore();    // Registers pushQueue listener
// ... etc
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

Two standby modes configurable in Settings → Appearance:
- **CSS Dimmed (default)**: Dims to 20% via overlay. Instant wake, reliable touch-to-wake.
- **Hardware**: Uses `wlr-randr` to power off display. Saves power, slower wake.

**Key Files:** `lcd.ts` (store), `settings.ts` (mode persistence), `StandbyOverlay.svelte` (overlay + touch handling)

**State Model:** ON (100%) → DIMMED (<100%) → DIMMED STANDBY (≤20%) or HARDWARE STANDBY (`lcdState='off'`)

**LCD Actions:** `standby()`, `wake()`, `toggle()`, `turnOff()`, `turnOn()`, `setBrightness(n)`

**Touch Handling:** Non-passive listeners for Pi/Wayland, 500ms debounce, StandbyOverlay only on `?layout=lcd`

**Audirvana Integration:**
| Emit | Receive | Description |
|------|---------|-------------|
| `getAudirvanaStatus` | `pushAudirvanaStatus` | Get Audirvana detection/discovery status |
| `audirvanaStartService` | - | Start Audirvana systemd service |
| `audirvanaStopService` | - | Stop Audirvana systemd service |

The audio engine store manages mutual exclusion between MPD and Audirvana for bit-perfect playback.

### Socket.IO Compatibility & mDNS Discovery

**Version Matrix:**
| Component | Socket.IO Version | Protocol |
|-----------|-------------------|----------|
| Volumio Connect apps (iOS/Android) | v2.x client | Engine.IO v3 |
| Stellar Go backend | v3 server | Engine.IO v4 + EIO3 compat |
| Svelte frontend (POC) | v4 client | Engine.IO v4 |

The Stellar backend enables `allowEIO3: true` to support Socket.IO v2 clients (Volumio Connect apps).

**Note:** The backend now uses port 3000 (Volumio standard port) instead of 3002.

**mDNS Discovery:**
The device is discoverable via Avahi mDNS with service type `_Volumio._tcp`:
```bash
# Verify discovery from Mac
dns-sd -B _Volumio._tcp local.

# Service details
dns-sd -L raspberrypi _Volumio._tcp local.
```

The Avahi service file is at `/etc/avahi/services/stellar.service` on the Pi.

**Test Socket.IO v2 Compatibility:**
```bash
cd volumio-poc/tests/socketio-compat
npm run test:v2    # Test v2 client can connect to Stellar backend
npm run verify:discovery  # Verify mDNS discovery
```

## Development Workflow

### Conventional Commits

Commits follow `<type>(<scope>): <description>` format:
- `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

Example: `git commit -m "feat(audio): add bit-perfect audio status indicator"`

### Development Checklist

- [ ] Tests written and passing
- [ ] Code deployed to Pi and verified on hardware
- [ ] Logs checked for errors (`journalctl -u stellar-backend -f`)

### E2E Test Status

Current E2E tests have **38% pass rate** (21 passing, 34 failing). Known issues documented in `volumio-poc/E2E-TEST-ISSUES.md`:
- Navigation selectors don't match actual component structure
- Player control `data-testid` attributes missing
- Status drawer rendering issues

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

### Additional Documentation

For detailed setup and architecture, see:
- `volumio-poc/DEVELOPMENT.md` - Full development guide (kiosk setup, deployment)
- `volumio-poc/POC_SUMMARY.md` - Project summary with performance metrics
- `volumio-poc/E2E-TEST-ISSUES.md` - Test failure analysis
- `volumio-poc/docs/LIBRARY-CACHE-DESIGN.md` - Library cache architecture

## Browser Console Debugging (POC)

The POC exposes several debugging helpers on `window`:

```javascript
// Performance monitoring
__performance.start()   // Show FPS overlay
__performance.stop()    // Hide overlay
__performance.toggle()  // Toggle overlay

// Latency metrics
__latency.getStats('pushState')  // Latency for specific event
__latency.getAllStats()          // All event latencies
__latency.clear()                // Reset metrics

// Navigation (for E2E testing)
__navigation.goToQueue()
__navigation.goToPlayer()
__navigation.goToBrowse()
__navigation.goToSettings()
__navigation.goHome()

// Test toast notifications
testToast.error('Title', 'Message')
testToast.warning('Title', 'Message')
testToast.success('Title', 'Message')

// Test issue system
testIssue.mpdError()
testIssue.networkError()
testIssue.clear()
```

## Performance Debugging

**Pi Hardware:**
```bash
source .env
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "vcgencmd measure_temp"      # GPU temp
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "vcgencmd get_throttled"    # Throttling status
```

## Quick Troubleshooting

- **Socket.io version mismatch**: Use Socket.io 2.3.x CDN for Legacy, 4.x for POC
- **Connection fails with .local hostname**: Use IP address instead
- **`$lib` path not resolved**: Check `vite.config.ts` alias configuration
- **POC not connecting**: Verify `DEV_VOLUMIO_IP` in `volumio-poc/src/lib/config.ts`

## Related Repositories

### Stellar Backend

Configured via `STELLAR_BACKEND_FOLDER` in `.env`
- GitHub: https://github.com/edumarques81/stellar-volumio-audioplayer-backend

**Commands:**
```bash
cd "$STELLAR_BACKEND_FOLDER"
go test ./...                                      # Run tests
GOOS=linux GOARCH=arm64 go build -o stellar-arm64 ./cmd/stellar  # Build for Pi
```

**Architecture:**
- Go backend with Socket.IO (zishang520/socket.io library), MPD integration
- Uses **MPD as Single Source of Truth** - no state machine (unlike Volumio3-backend's 1500+ line statemachine.js)
- Commands go directly to MPD; state updates come back via MPD idle watcher and broadcast to clients
- Focus: bit-perfect audio playback, single-device operation, minimal footprint
- See repository README for detailed project structure

**Configuration:** `configs/stellar.yaml` on the Pi (port 3000, MPD on localhost:6600)
