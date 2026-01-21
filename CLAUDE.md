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

## Volumio POC (Svelte)

The `volumio-poc/` directory contains a Svelte-based POC for a CarPlay-style LCD interface (1920x440).

### POC Deployment to Raspberry Pi

**IMPORTANT**: The httpd server on the Pi serves files from `/home/volumio/svelte-poc`, NOT `/home/volumio/poc`.

```bash
# Build the POC
cd volumio-poc
npm run build

# Deploy to Pi (use sshpass for automation)
sshpass -p "volumio" scp -r dist/* volumio@192.168.86.34:/home/volumio/svelte-poc/

# Clear browser cache and restart kiosk
sshpass -p "volumio" ssh volumio@192.168.86.34 "rm -rf /data/volumiokiosk/Default/Cache/* /data/volumiokiosk/Default/Code\ Cache/* 2>/dev/null && echo volumio | sudo -S systemctl restart volumio-kiosk"
```

### Pi Network Information
- Hostname: `volumioeduardohifi.lan` or `volumio@192.168.86.34`
- SSH password: `volumio`
- POC web server: `http://localhost:8080` (busybox httpd serving from `/home/volumio/svelte-poc`)
- Volumio backend: `http://localhost:3000`
- Stellar backend (Go): `http://localhost:3002`
- Kiosk service: `volumio-kiosk.service`
