# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Volumio2-UI is a standalone web user interface for Volumio2 audio player. It communicates with the Volumio2 backend via Socket.io WebSocket API. The UI is served via Express static server and resides at `/volumio/http/www` (Classic UI) or `/volumio/http/www3` (Contemporary UI) on Volumio devices.

**Node.js Version**: 10.22.1 (strictly enforced - use NVM to manage)

## Development Setup

### Initial Setup

```bash
npm install bower -g
npm install
bower install
```

### Local Development Configuration

Create `/src/app/local-config.json` with the IP address of your Volumio2 device:

```json
{
  "localhost": "http://192.168.31.234"
}
```

This allows the UI to connect to the Volumio2 backend during development.

### Development Server

Start the development server with live reload:

```bash
gulp serve --theme="volumio"
```

**Theme options**: `volumio` (Classic UI) or `volumio3` (Contemporary UI)

**Additional flags**:
- `--env="production"` - Use production mode
- `--debug` - Show debug console logs in browser

Example with all flags:
```bash
gulp serve --theme="volumio3" --env="production" --debug
```

### Building for Production

Build optimized production bundles:

```bash
# Classic UI (Volumio theme)
npm run build:volumio
# or
gulp build --theme="volumio" --env="production"

# Contemporary UI (Volumio3 theme)
npm run build:volumio3
# or
gulp build --theme="volumio3" --env="production"
```

Built files output to the `dist/` directory.

### Testing

```bash
# Run all tests
npm test
# or
gulp test
```

Tests run with Karma + Jasmine + PhantomJS.

## Architecture

### Tech Stack

- **Frontend Framework**: AngularJS 1.5 (not Angular 2+)
- **Build System**: Gulp 3.x with tasks split across `/gulp` directory
- **Module System**: ES6 imports (transpiled with Babel 5)
- **Styling**: SCSS (Bootstrap-based)
- **Dependency Management**: Bower (frontend) + npm (build tools)
- **Real-time Communication**: Socket.io 2.3.x for WebSocket communication with backend

### Key Architectural Patterns

#### 1. Socket.io Communication Layer

The entire application communicates with the Volumio2 backend through WebSocket events. The `SocketService` (`src/app/services/socket.service.js`) is the central hub:

- Manages connection to backend via Socket.io
- Handles request/response event pairs (e.g., `browseLibrary` → `pushBrowseLibrary`)
- Triggers loading bar for long-running requests
- Supports multiple host connections via `this.hosts` object

#### 2. Service-Oriented Architecture

Core functionality is encapsulated in Angular services (all in `src/app/services/`):

- **PlayerService**: Player state, playback control, volume management
- **BrowseService**: Music library browsing and navigation
- **PlayQueueService**: Queue management
- **PlaylistService**: Playlist CRUD operations
- **MultiRoomService**: Multi-room audio synchronization
- **ModalService**: Centralized modal dialog management
- **ThemeManagerProvider**: Theme switching between Classic and Contemporary UIs

#### 3. Theme System

Two distinct UI themes with separate templates:

- **Classic UI** (`volumio`): Located in `src/app/themes/volumio/`
- **Contemporary UI** (`volumio3`): Located in `src/app/themes/volumio3/`

The `ThemeManagerProvider` dynamically loads templates based on the `--theme` flag during build. Each theme has its own:
- HTML templates (layout, header, footer, components)
- SCSS styles
- Asset directories

#### 4. Component Structure

The app uses AngularJS 1.5 component-based architecture:

- **Directives**: Reusable UI components in `src/app/components/`
  - Player controls: `player-buttons`, `volume-manager`, `player-seekbar`
  - Track management: `track-manager`, `playlist`, `track-info`
  - Navigation: `side-menu`, `main-menu`, `browse-hamburger-menu`
  - Specialized: `equalizer`, `knob`, `multi-room-dock`

- **Controllers**: Page/view controllers
  - Main views: `BrowseController`, `PlaybackController`, `PlayQueueController`
  - Plugin system: `PluginController`, `PluginManagerController`
  - MyVolumio integration: Authentication, subscriptions, profiles

#### 5. UI Router States

The application uses `ui-router` for navigation. Main states defined in `src/app/index.route.js`:

- `volumio` (abstract parent state)
  - `volumio.browse` - Music library browsing
  - `volumio.playback` - Playback screen
  - `volumio.play-queue` - Queue management
  - `volumio.plugin` - Plugin configuration
  - `volumio.plugin-manager` - Plugin installation
  - MyVolumio states: login, signup, profile, plans, etc.

All routes resolve `socketResolver` to ensure backend connectivity before loading views.

#### 6. Modal System

Centralized modal management via `ModalService` and `ModalListenerService`:

- Modal controllers in `src/app/components/modals/`
- Special modals: power-off, sleep, alarm-clock, updater, ripper, password
- MyVolumio modals: payment, terms, paying progress

#### 7. Plugin System

Dynamic plugin rendering system:

- Core plugins in `src/app/plugin/core-plugin/`: WiFi, network status, firmware upload, UI settings
- `PluginAttributesDirective` renders plugin UIs from JSON configurations
- Plugin configurations sent from backend, rendered dynamically

#### 8. MyVolumio Integration

Subscription and cloud service integration:

- Firebase authentication (`AngularFireService`, `AuthService`)
- Payment processing: Stripe and Paddle integrations
- Cloud features: device management, remote storage, referral system
- Services in `src/app/services/myvolumio/`

### File Organization

```
src/
├── app/
│   ├── index.module.js          # Main module definition, registers all components
│   ├── index.route.js           # UI router configuration
│   ├── index.run.js             # App initialization
│   ├── index.config.js          # Angular config (toastr, translate, etc.)
│   ├── services/                # Core services
│   │   ├── socket.service.js    # WebSocket communication
│   │   ├── player.service.js    # Player state management
│   │   └── myvolumio/           # MyVolumio cloud services
│   ├── components/              # Reusable directives
│   ├── themes/                  # Theme-specific templates
│   │   ├── volumio/             # Classic UI theme
│   │   └── volumio3/            # Contemporary UI theme
│   ├── browse/                  # Browse view
│   ├── playback/                # Playback view
│   ├── play-queue/              # Queue view
│   ├── plugin/                  # Plugin system
│   └── lib/                     # Third-party libraries
└── index.html                   # Entry point

gulp/                            # Build task definitions
├── build.js                     # Production build tasks
├── server.js                    # Development server
├── scripts.js                   # JavaScript processing
├── styles.js                    # SCSS compilation
└── conf.js                      # Build configuration
```

## Important Notes

### Socket.io Version

The project uses Socket.io 2.3.1. Multiple versions exist in `src/app/lib/socket/` for compatibility, but 2.3.1 is the primary version.

### Backend Communication

All backend interactions go through Socket.io events defined in the [Volumio2 WebSocket API](https://github.com/volumio/Volumio2/wiki/WebSockets-API-Reference). Common event patterns:
- Request: `emit('eventName', data)`
- Response: `on('pushEventName', callback)`

### Deployment

To deploy to a Volumio device:
1. Build the project (`npm run build:volumio`)
2. Copy the `dist/` directory contents to `/volumio/http/www` on the device

The `dist` branch contains only compiled builds for integration with Volumio2 system images.

### Babel and ES6

The codebase uses Babel 5 for ES6 transpilation. Import/export syntax is supported, but many files still use AngularJS 1.x patterns (immediately-invoked function expressions, manual dependency injection).

## Raspberry Pi Development Setup

### Environment Configuration (.env file)

**IMPORTANT**: Create a `.env` file in the project root with your Pi configuration. Copy from `.env-example`:

```bash
cp .env-example .env
# Edit .env with your actual values
```

The `.env` file contains:
```
RASPBERRY_PI_SSH_USERNAME=pi
RASPBERRY_PI_SSH_PASSWORD=your_password
RASPBERRY_PI_HOST=raspberry.local
RASPBERRY_PI_API_ADDRESS=192.168.x.x
STELLAR_BACKEND_FOLDER=/path/to/stellar-volumio-audioplayer-backend/
```

**Never commit `.env` to version control** - it's already in `.gitignore`.

### IMPORTANT: localhost vs Raspberry Pi

**NEVER confuse these two environments:**

| Environment | Address | Description |
|-------------|---------|-------------|
| **Local (macOS)** | `localhost` | Developer's macOS machine where code is edited and built |
| **Raspberry Pi** | IP from `.env` | Target device running the POC with LCD panel |

- `localhost` = macOS development machine
- Pi IP = Raspberry Pi (configured in `.env`)
- When deploying, files are built on **localhost** and copied to **Pi**
- The Pi serves frontend at `http://localhost:8080` (localhost **on the Pi itself**)

### SSH Access (IMPORTANT)

**All SSH and SCP operations MUST use `sshpass` with credentials from `.env` file.**

```bash
# Source the .env file first
source .env

# SSH connection pattern (from macOS to Pi)
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "command here"

# SCP file transfer pattern (from macOS to Pi)
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" scp -o StrictHostKeyChecking=no local_file "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:/remote/path/"

# Rsync for efficient deployment
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" rsync -avz --delete local_dir/ "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/remote_dir/"
```

### Pi Configuration

Configuration values are stored in `.env` file. See `.env-example` for required variables.

| Setting | .env Variable |
|---------|---------------|
| Hostname | `RASPBERRY_PI_HOST` |
| IP Address | `RASPBERRY_PI_API_ADDRESS` |
| SSH User | `RASPBERRY_PI_SSH_USERNAME` |
| SSH Password | `RASPBERRY_PI_SSH_PASSWORD` |
| Architecture | ARM64 (Raspberry Pi 5) |

### Services and Ports (on Raspberry Pi)

| Service | Port | Description |
|---------|------|-------------|
| **Stellar Frontend** | 8080 | python3 http.server serving `~/stellar-volumio` |
| **Stellar Backend** | 3002 | Go backend for POC |
| MPD | 6600 | Music Player Daemon |

**POC uses only ports 8080 (frontend) and 3002 (backend).**

### Systemd Services on Pi

The following services are configured on the Pi:

- `stellar-backend.service` - Stellar Go backend on port 3002
- `stellar-frontend.service` - Python HTTP server on port 8080
- `mpd.service` - Music Player Daemon

```bash
# Check service status
source .env && sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "systemctl status stellar-backend stellar-frontend mpd"

# Restart services
source .env && sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "sudo systemctl restart stellar-backend stellar-frontend"
```

### Important Paths on Pi

| Path | Description |
|------|-------------|
| `~/stellar-volumio` | Stellar frontend files (HTTP server serves from here) |
| `~/stellar-backend/stellar` | Stellar Go backend binary |
| `/etc/systemd/system/stellar-*.service` | Systemd service files |
| `/var/log/syslog` | System logs (check with `journalctl -u stellar-backend`) |

## Volumio POC (Svelte)

The `volumio-poc/` directory contains a Svelte-based POC for a CarPlay-style LCD interface (1920x440).

### POC Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Svelte 5 |
| Language | TypeScript |
| Build Tool | Vite 7 |
| Testing | Vitest + @testing-library/svelte |
| E2E Testing | Playwright |
| Backend Communication | Socket.io 4.x client → Stellar backend |

### Development Mode - Backend Connection

**IMPORTANT**: When running `npm run dev` on macOS (localhost:5173), the frontend connects to the **Raspberry Pi's backend**. The Pi IP is configured in `volumio-poc/src/lib/config.ts` (`DEV_VOLUMIO_IP` constant).

| Environment | Frontend URL | Backend URL |
|-------------|--------------|-------------|
| **Dev mode (macOS)** | `localhost:5173` | `PI_IP:3002` (from config.ts) |
| **Deployed (Pi)** | `localhost:8080` (on Pi) | `localhost:3002` (on Pi) |
| **Remote access** | `PI_IP:8080` | `PI_IP:3002` |

The Stellar backend must be running on the Pi for dev mode to work. Update `DEV_VOLUMIO_IP` in `config.ts` if your Pi IP changes.

### POC Commands

```bash
cd volumio-poc

# Development
npm run dev              # Start Vite dev server (localhost:5173)

# Testing
npm test                 # Run Vitest in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Run tests with coverage

# E2E Testing (Playwright)
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # Run with Playwright UI
npm run test:e2e:headed  # Run in headed browser mode
npm run test:e2e:debug   # Debug E2E tests

# Build
npm run build            # Production build → dist/
```

### Responsive Layout and URL-Based Forcing

The POC supports multiple layouts:
- **LCDLayout** - For the 1920x440 LCD panel
- **MobileLayout** - For phones/tablets

To force a specific layout (useful for kiosk mode), use the `?layout=` URL parameter:
- `?layout=lcd` - Forces LCD layout regardless of screen size
- `?layout=mobile` - Forces mobile layout

**Kiosk configuration** at `/opt/volumiokiosk.sh` can include `?layout=lcd` to ensure the Pi always uses the LCD layout.

### POC Deployment to Raspberry Pi

**IMPORTANT**: The HTTP server on the Pi serves files from `~/stellar-volumio`.

**Manual deployment using .env**:
```bash
# Source credentials and build
source .env
cd volumio-poc
npm run build

# Deploy frontend via rsync
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" rsync -avz --delete dist/ "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-volumio/"

# Restart frontend service
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "sudo systemctl restart stellar-frontend"
```

### Stellar Backend Deployment

```bash
# Source credentials
source .env

# Build for ARM64
cd "$STELLAR_BACKEND_FOLDER"
GOOS=linux GOARCH=arm64 go build -o stellar-arm64 ./cmd/stellar

# Deploy and restart service
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" scp stellar-arm64 "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-backend/stellar"
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "chmod +x ~/stellar-backend/stellar && sudo systemctl restart stellar-backend"

# Check logs
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "journalctl -u stellar-backend -f"
```

### Full Deployment (Frontend + Backend)

```bash
source .env

# Build frontend
cd volumio-poc && npm run build && cd ..

# Build backend
cd "$STELLAR_BACKEND_FOLDER" && GOOS=linux GOARCH=arm64 go build -o stellar-arm64 ./cmd/stellar && cd -

# Deploy both
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" rsync -avz --delete volumio-poc/dist/ "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-volumio/"
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" scp "$STELLAR_BACKEND_FOLDER/stellar-arm64" "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-backend/stellar"

# Restart services
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "chmod +x ~/stellar-backend/stellar && sudo systemctl restart stellar-backend stellar-frontend"
```

### Stellar Backend Repository

- **Location**: Configured in `.env` as `STELLAR_BACKEND_FOLDER`
- **GitHub**: https://github.com/edumarques81/stellar-volumio-audioplayer-backend
- **Library**: `zishang520/socket.io` v3 (proper Socket.IO v4 support)
- **Features**: MPD client, player controls, queue management, music library browsing, version API

### Key Socket.IO Events (Stellar Backend)

| Event (Emit) | Event (Receive) | Description |
|--------------|-----------------|-------------|
| `getState` | `pushState` | Get/receive player state |
| `getVersion` | `pushVersion` | Get backend version info |
| `play` | - | Start playback |
| `pause` | - | Pause playback |
| `stop` | - | Stop playback |
| `prev` | - | Previous track |
| `next` | - | Next track |
| `volume` | - | Set volume (0-100) |
| `seek` | - | Seek to position (seconds) |

### POC Project Structure

```
volumio-poc/
├── src/
│   ├── main.ts                 # App entry point
│   ├── App.svelte              # Root component with layout switching
│   ├── app.css                 # Global CSS
│   └── lib/
│       ├── config.ts           # Backend URL configuration (DEV_VOLUMIO_IP)
│       ├── services/
│       │   └── socket.ts       # Socket.IO wrapper
│       ├── stores/             # Svelte stores (state management)
│       │   ├── player.ts       # Player state (status, seek, track info)
│       │   ├── queue.ts        # Queue management
│       │   ├── browse.ts       # Library browsing state
│       │   ├── audio.ts        # Audio quality info
│       │   ├── audioDevices.ts # Audio output devices
│       │   ├── device.ts       # Device type detection
│       │   ├── favorites.ts    # Favorites management
│       │   ├── lcd.ts          # LCD brightness control
│       │   ├── navigation.ts   # View navigation state
│       │   ├── network.ts      # Network status
│       │   ├── playlist.ts     # Playlist management
│       │   ├── settings.ts     # App settings
│       │   ├── ui.ts           # UI state (modals, etc.)
│       │   └── version.ts      # Backend version info
│       ├── utils/
│       │   └── deviceDetection.ts  # Device/layout detection
│       └── components/
│           ├── layouts/            # Responsive layouts
│           │   ├── LCDLayout.svelte    # 1920x440 LCD panel
│           │   ├── MobileLayout.svelte # Mobile/tablet
│           │   └── DesktopLayout.svelte # Desktop browser
│           ├── views/              # Main app views
│           │   ├── HomeScreen.svelte   # Home/now playing
│           │   ├── BrowseView.svelte   # Library browser
│           │   ├── QueueView.svelte    # Queue management
│           │   ├── PlayerView.svelte   # Full player view
│           │   └── SettingsView.svelte # Settings screen
│           ├── PlayerBar.svelte    # Main player bar
│           ├── AlbumArt.svelte     # Album artwork
│           ├── SeekBar.svelte      # Playback progress
│           ├── VolumeControl.svelte # Volume slider
│           └── ...
├── scripts/
│   ├── deploy.sh               # Build and deploy to Pi (uses rsync)
│   └── deploy-to-pi.sh         # Alternative deployment script
├── e2e/                        # Playwright E2E tests
├── docs/                       # Architecture and research docs
├── dist/                       # Production build output
└── package.json
```

## Development Workflow Requirements

### Test-Driven Development (TDD)

**Claude MUST follow TDD practices when writing code:**

1. **Write tests first** - Before implementing any feature or fix, write failing tests that define the expected behavior
2. **Run tests to confirm they fail** - Verify the tests fail for the right reason
3. **Implement the minimal code** - Write just enough code to make the tests pass
4. **Refactor** - Clean up the code while keeping tests green
5. **Run all tests** - Ensure no regressions were introduced

### Testing Requirements

**Every code change MUST include appropriate tests:**

#### Frontend (Svelte POC)
- Unit tests for stores, utilities, and components
- Tests located in `__tests__/` directories adjacent to source files
- Use Vitest with `@testing-library/svelte`
- Run tests: `cd volumio-poc && npm test`

#### Backend (Stellar - Go)
- Unit tests for all packages
- Tests located in `*_test.go` files
- Run tests: `cd stellar-volumio-audioplayer-backend && go test ./...`

### Raspberry Pi Testing Environment

**Before starting any development work, Claude MUST establish an SSH session to the Pi for testing:**

```bash
# Source credentials first
source .env

# Open a persistent SSH session at the start of work
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"

# Or run commands to verify connectivity
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "echo 'Pi connection OK' && uptime"
```

**Testing workflow on Pi:**

1. **Deploy changes** - Use the deployment commands in the sections above
2. **Check logs** - Monitor for errors:
   ```bash
   source .env

   # Stellar backend logs
   sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "journalctl -u stellar-backend -f"

   # System logs
   sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "journalctl -f"

   # Kiosk/browser logs
   sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "journalctl -u volumio-kiosk -f"
   ```
3. **Verify functionality** - Test the feature/fix works as expected on actual hardware
4. **Check for regressions** - Ensure existing functionality still works

### Conventional Commits

**All commits MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:**

#### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Changes that don't affect code meaning (formatting, whitespace) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Changes to build process or auxiliary tools |
| `ci` | Changes to CI configuration |

#### Scope Examples

- `feat(audio)`: Audio-related feature
- `fix(ui)`: UI bug fix
- `test(player)`: Player-related tests
- `refactor(socket)`: Socket service refactoring

#### Examples

```bash
# Feature
git commit -m "feat(audio): add bit-perfect audio status indicator"

# Bug fix
git commit -m "fix(device): correct phone detection for tall screens"

# Tests
git commit -m "test(audio): add unit tests for audio controller"

# Refactoring
git commit -m "refactor(network): replace REST polling with Socket.IO push"

# Breaking change (add ! after type)
git commit -m "feat(api)!: change audio status event payload structure"
```

#### Multi-line Commit with Body

```bash
git commit -m "$(cat <<'EOF'
feat(lcd): add LCD power control via Socket.IO

- Add lcdStandby and lcdWake event handlers
- Broadcast pushLcdStatus on state changes
- Remove HTTP polling dependency

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Development Checklist

Before considering any task complete, Claude MUST verify:

- [ ] Tests written (TDD - tests first)
- [ ] All local tests pass (frontend and backend)
- [ ] Code deployed to Raspberry Pi
- [ ] Functionality verified on Pi hardware
- [ ] Logs checked for errors
- [ ] Commit message follows Conventional Commits format

## Performance Debugging

### FPS Performance Overlay

The POC includes a built-in FPS monitoring tool accessible via browser console:

```javascript
// Start FPS monitoring (shows overlay)
__performance.start()

// Stop monitoring (hides overlay)
__performance.stop()

// Toggle on/off
__performance.toggle()

// Reset counters
__performance.reset()
```

**Remote access on Pi** via Chrome DevTools at `http://PI_IP:9222`.

### Pi Hardware Monitoring

```bash
source .env

# GPU temperature (target: <70°C, throttling at 80°C)
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "vcgencmd measure_temp"

# Throttling status (0x0 = no throttling)
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "vcgencmd get_throttled"

# CPU/process info
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "top -bn1 | head -20"
```

**Throttling flags** (from `get_throttled`):
- `0x50000` = Under-voltage + throttling occurred
- `0x80000` = Soft temperature limit occurred

### GPU Acceleration Verification

Navigate to `chrome://gpu` on the Pi's Chromium to verify:
- Graphics Feature Status shows "Hardware accelerated"
- GL_RENDERER shows `V3D` (not `llvmpipe`)
