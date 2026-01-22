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

### IMPORTANT: localhost vs Raspberry Pi

**NEVER confuse these two environments:**

| Environment | Address | Description |
|-------------|---------|-------------|
| **Local (macOS)** | `localhost` | Developer's macOS machine where code is edited and built |
| **Raspberry Pi** | `192.168.86.34` | Target device running Volumio with LCD panel |

- `localhost` = macOS development machine
- `192.168.86.34` = Raspberry Pi (Volumio)
- When deploying, files are built on **localhost** and copied to **Pi**
- The Pi's kiosk browser loads from `http://localhost:8080` (which is localhost **on the Pi itself**)

### SSH Access (IMPORTANT)

**All SSH and SCP operations MUST use `sshpass` for automation.** The AI assistant should always use sshpass when connecting to the Pi.

```bash
# SSH connection pattern (from macOS to Pi)
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "command here"

# SCP file transfer pattern (from macOS to Pi)
sshpass -p 'volumio' scp -o StrictHostKeyChecking=no local_file volumio@192.168.86.34:/remote/path/

# SCP directory transfer pattern (from macOS to Pi)
sshpass -p 'volumio' scp -o StrictHostKeyChecking=no -r local_dir/* volumio@192.168.86.34:/remote/path/
```

### Pi Configuration

| Setting | Value |
|---------|-------|
| Hostname | `volumioeduardohifi.local` or `volumioeduardohifi.lan` |
| IP Address | `192.168.86.34` |
| SSH User | `volumio` |
| SSH Password | `volumio` |
| Architecture | ARM64 (Raspberry Pi 5) |

### Services and Ports (on Raspberry Pi)

| Service | Port | Description |
|---------|------|-------------|
| **Stellar Frontend** | 8080 | busybox httpd serving `/home/volumio/stellar-volumio` |
| **Stellar Backend** | 3002 | Go backend for POC |
| Volumio backend | 3000 | Original Volumio Node.js backend (not used by POC) |
| MPD | 6600 | Music Player Daemon |
| Kiosk Chrome DevTools | 9222 | Remote debugging port |

**POC uses only ports 8080 (frontend) and 3002 (backend).**

### Important Paths on Pi

| Path | Description |
|------|-------------|
| `/home/volumio/stellar-volumio` | Stellar frontend files (httpd serves from here) |
| `/home/volumio/stellar` | Stellar Go backend binary |
| `/home/volumio/stellar.log` | Stellar backend logs |
| `/opt/volumiokiosk.sh` | Kiosk startup script |
| `/data/volumiokiosk/Default/Cache/` | Chromium kiosk browser cache |

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

**IMPORTANT**: When running `npm run dev` on macOS (localhost:5173), the frontend connects to the **Raspberry Pi's backend** at `192.168.86.34:3002`.

| Environment | Frontend URL | Backend URL |
|-------------|--------------|-------------|
| **Dev mode (macOS)** | `localhost:5173` | `192.168.86.34:3002` (Pi) |
| **Deployed (Pi kiosk)** | `localhost:8080` (on Pi) | `localhost:3002` (on Pi) |
| **Remote access** | `192.168.86.34:8080` | `192.168.86.34:3002` |

This is configured in `volumio-poc/src/lib/config.ts`. The Stellar backend must be running on the Pi for dev mode to work.

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

**IMPORTANT**: The httpd server on the Pi serves files from `/home/volumio/stellar-volumio`.

```bash
# Build the POC
cd volumio-poc
npm run build

# Ensure directory exists and deploy frontend to Pi
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "mkdir -p /home/volumio/stellar-volumio"
sshpass -p 'volumio' scp -o StrictHostKeyChecking=no -r dist/* volumio@192.168.86.34:/home/volumio/stellar-volumio/

# Clear browser cache and restart kiosk
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "echo 'volumio' | sudo -S rm -rf /data/volumiokiosk/Default/Cache/* && echo 'volumio' | sudo -S systemctl restart volumio-kiosk"
```

### Stellar Backend Deployment

```bash
# Build for ARM64
cd stellar-volumio-audioplayer-backend
GOOS=linux GOARCH=arm64 go build -o stellar-arm64 ./cmd/stellar

# Stop existing, deploy, and start
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "pkill stellar || true"
sshpass -p 'volumio' scp -o StrictHostKeyChecking=no stellar-arm64 volumio@192.168.86.34:/home/volumio/stellar
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "chmod +x /home/volumio/stellar && nohup /home/volumio/stellar -port 3002 > /home/volumio/stellar.log 2>&1 &"

# Check logs
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "tail -f /home/volumio/stellar.log"
```

### Stellar Backend Repository

- **Location**: `/Users/eduardomarques/workspace/stellar-volumio-audioplayer-backend`
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
│   ├── App.svelte              # Root component
│   ├── app.css                 # Global CSS
│   └── lib/
│       ├── config.ts           # Backend URL configuration
│       ├── services/
│       │   └── socket.ts       # Socket.IO wrapper
│       ├── stores/
│       │   ├── player.ts       # Player state store
│       │   └── version.ts      # Version info store
│       ├── utils/
│       │   └── deviceDetection.ts  # Device/layout detection
│       └── components/
│           ├── LCDLayout.svelte    # 1920x440 LCD layout
│           ├── MobileLayout.svelte # Mobile/tablet layout
│           ├── PlayerBar.svelte    # Main player bar
│           ├── AlbumArt.svelte     # Album artwork
│           └── ...
├── e2e/                        # Playwright E2E tests
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
# Open a persistent SSH session at the start of work
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34

# Or run commands to verify connectivity
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "echo 'Pi connection OK' && uptime"
```

**Testing workflow on Pi:**

1. **Deploy changes** - Use the deployment commands in the sections above
2. **Check logs** - Monitor for errors:
   ```bash
   # Stellar backend logs
   sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "tail -f /home/volumio/stellar.log"

   # System logs
   sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "journalctl -f"

   # Kiosk/browser logs
   sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "journalctl -u volumio-kiosk -f"
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
