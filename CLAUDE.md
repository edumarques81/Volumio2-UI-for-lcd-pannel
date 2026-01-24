# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Volumio2-UI is a standalone web user interface for Volumio2 audio player. It communicates with the Volumio2 backend via Socket.io WebSocket API. The UI is served via Express static server and resides at `/volumio/http/www` (Classic UI) or `/volumio/http/www3` (Contemporary UI) on Volumio devices.

This repository contains two projects:
- **Legacy UI** (root): AngularJS 1.5 application (Node.js 10.22.1 required)
- **POC** (`volumio-poc/`): Svelte 5 application for CarPlay-style LCD interface (1920x440)

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
npm run test:coverage                           # Tests with coverage

# Build & Type Check
npm run build                                   # Production build → dist/
npx tsc --noEmit                                # Type check only
```

## Raspberry Pi Development

### Environment Setup

Create `.env` from `.env-example`:
```bash
cp .env-example .env
# Edit with your Pi credentials
```

Required variables:
- `RASPBERRY_PI_SSH_USERNAME` - SSH user (typically `pi`)
- `RASPBERRY_PI_SSH_PASSWORD` - SSH password
- `RASPBERRY_PI_API_ADDRESS` - Pi IP address
- `STELLAR_BACKEND_FOLDER` - Path to stellar-volumio-audioplayer-backend repo

### SSH Access Pattern

All SSH operations MUST use `sshpass` with credentials from `.env`:
```bash
source .env
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "command"
```

### Deployment

**Frontend (POC) to Pi:**
```bash
source .env
cd volumio-poc && npm run build
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" rsync -avz --delete dist/ "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-volumio/"
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "sudo systemctl restart stellar-frontend"
```

**Backend (Stellar) to Pi:**
```bash
source .env
cd "$STELLAR_BACKEND_FOLDER"
GOOS=linux GOARCH=arm64 go build -o stellar-arm64 ./cmd/stellar
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" scp stellar-arm64 "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-backend/stellar"
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "chmod +x ~/stellar-backend/stellar && sudo systemctl restart stellar-backend"
```

**Check logs:**
```bash
source .env
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "journalctl -u stellar-backend -f"
```

### Services on Pi

| Service | Port | Description |
|---------|------|-------------|
| `stellar-frontend` | 8080 | Python HTTP server serving `~/stellar-volumio` |
| `stellar-backend` | 3002 | Stellar Go backend |
| `mpd` | 6600 | Music Player Daemon |

### localhost vs Pi (Important)

- `localhost` = Your macOS development machine
- Pi IP (from `.env`) = Raspberry Pi target device
- Dev mode frontend (`localhost:5173`) connects to Pi backend (`PI_IP:3002`)
- Configure Pi IP in `volumio-poc/src/lib/config.ts` (`DEV_VOLUMIO_IP`)

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

**Tech Stack**: Svelte 5, TypeScript, Vite 7, Vitest, Playwright, Socket.io 4.x

**Key Files:**
- `src/lib/config.ts` - Backend URL configuration (`DEV_VOLUMIO_IP`)
- `src/lib/services/socket.ts` - Socket.IO wrapper
- `src/lib/stores/` - Svelte stores (player, queue, browse, navigation, etc.)
- `src/App.svelte` - Root component with layout switching

**Patterns:**
- State managed via Svelte stores in `src/lib/stores/`
- Tests in `__tests__/` directories adjacent to source files
- Layouts: `LCDLayout` (1920x440), `MobileLayout`, `DesktopLayout`
- Force layout via URL: `?layout=lcd` or `?layout=mobile`

### Socket.IO Events (Stellar Backend)

| Emit | Receive | Description |
|------|---------|-------------|
| `getState` | `pushState` | Get/receive player state |
| `play`, `pause`, `stop` | - | Playback control |
| `prev`, `next` | - | Track navigation |
| `volume` | - | Set volume (0-100) |
| `seek` | - | Seek to position (seconds) |
| `getQueue` | `pushQueue` | Queue management |
| `browseLibrary` | `pushBrowseLibrary` | Library browsing |

## Development Workflow

### Test-Driven Development

1. Write tests first (failing)
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. Run all tests before committing

### Conventional Commits

All commits follow `<type>(<scope>): <description>` format:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code restructuring
- `test` - Adding/correcting tests
- `chore` - Build/tooling changes

Examples:
```bash
git commit -m "feat(audio): add bit-perfect audio status indicator"
git commit -m "fix(device): correct phone detection for tall screens"
git commit -m "test(player): add unit tests for seek functionality"
```

### Development Checklist

Before completing any task:
- [ ] Tests written and passing
- [ ] Code deployed to Pi and verified on hardware
- [ ] Logs checked for errors (`journalctl -u stellar-backend -f`)
- [ ] Commit message follows Conventional Commits format

## Performance Debugging

**FPS Overlay (POC)** - Browser console:
```javascript
__performance.start()   // Show FPS overlay
__performance.stop()    // Hide overlay
```

**Pi Hardware:**
```bash
source .env
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "vcgencmd measure_temp"      # GPU temp
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" ssh "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS" "vcgencmd get_throttled"    # Throttling status
```

## Related Repositories

- **Stellar Backend**: Configured via `STELLAR_BACKEND_FOLDER` in `.env`
  - GitHub: https://github.com/edumarques81/stellar-volumio-audioplayer-backend
  - Go backend with Socket.IO, MPD integration
  - Build: `GOOS=linux GOARCH=arm64 go build -o stellar-arm64 ./cmd/stellar`
  - Test: `go test ./...`
