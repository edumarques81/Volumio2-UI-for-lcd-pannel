# Stellar Volumio - Development Guide

This document covers the setup, development, and deployment process for Stellar Volumio, designed for a 1920x440 LCD touchscreen panel.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Socket.io Connection](#socketio-connection)
- [Building for Production](#building-for-production)
- [Deploying to Raspberry Pi](#deploying-to-raspberry-pi)
- [Kiosk Mode](#kiosk-mode)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## Overview

Stellar Volumio is a modern Svelte 5 + TypeScript application for Volumio-compatible audio players, optimized for:
- **1920x440 LCD touchscreen** (horizontal bar layout)
- **iOS 26-inspired design** (backdrop blur, large touch targets)
- **Touch interaction** (44px minimum touch targets)
- **Large, readable fonts** (18-24px base, Inter font)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1920x440 LCD Panel                                 │
├────────────────┬─────────────────────────────────────┬──────────────────────┤
│   Left Section │         Center Section              │    Right Section     │
│                │                                     │                      │
│  [Menu] [Art]  │  Track Info + Controls + Seek Bar  │  Volume + [Settings] │
│                │                                     │                      │
└────────────────┴─────────────────────────────────────┴──────────────────────┘
```

> **Where things run:** the frontend is served from the Mac's Vite dev server (`npm run dev`, port 5173). The Pi runs only the Stellar backend (port 3000), MPD (port 6600), and the cage kiosk that loads the Mac-served frontend. There is no port-8080 frontend on the Pi.

### Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Svelte 5 |
| Language | TypeScript |
| Build Tool | Vite 7 |
| Styling | CSS with CSS Variables |
| State Management | Svelte Stores |
| Backend Communication | socket.io-client 4.x (npm) |

## Prerequisites

### Development Machine (macOS/Linux)

```bash
# Node.js 18+ (recommend using nvm)
nvm install 18
nvm use 18

# Verify installation
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher
```

### Raspberry Pi (Stellar device)

- Pi 5 (recommended) or Pi 4 with Raspberry Pi OS Lite (64-bit)
- Stellar backend deployed (see `scripts/pi-setup/`)
- Network connectivity to the Mac dev server
- SSH access enabled

## Local Development Setup

### 1. Install Dependencies

```bash
cd /path/to/Volumio2-UI
npm install
```

### 2. Configure Backend Connection

The Mac dev server connects to the Pi backend by default. Edit `src/lib/config.ts` if your Pi's IP differs:

```typescript
const DEV_VOLUMIO_IP = '192.168.86.25';
```

| Environment | Page served from | Connects to |
|-------------|------------------|-------------|
| Pi LCD kiosk (production) | Mac's Vite dev server (`http://<MAC_IP>:5173`) | Pi backend (`http://<PI_IP>:3000`) |
| Mac browser (dev) | Mac's Vite dev server (`http://localhost:5173`) | Pi backend (`http://<PI_IP>:3000`) |

### 3. Start Development Server

```bash
npm run dev
```

The dev server starts at `http://localhost:5173` and is also reachable from other devices on your network at `http://<MAC_IP>:5173`. The Pi's LCD kiosk uses this exact URL.

## Socket.io Connection

### Version compatibility

| Component | Socket.IO Version |
|-----------|-------------------|
| Stellar Volumio frontend | 4.x client (npm `socket.io-client`) |
| Stellar Go backend | v3 server with EIO3 compat enabled |
| Volumio Connect mobile apps | 2.x clients |

All three must keep working — when changing transport behavior, smoke-test with each client.

### Connection Configuration

The frontend resolves the backend URL via `src/lib/config.ts`. See `src/lib/services/socket.ts` for the wrapper.

### Key Socket Events

| Event (Emit) | Event (Receive) | Description |
|--------------|-----------------|-------------|
| `getState` | `pushState` | Get/receive player state |
| `play` | - | Start playback |
| `pause` | - | Pause playback |
| `stop` | - | Stop playback |
| `prev` | - | Previous track |
| `next` | - | Next track |
| `volume` | - | Set volume (0-100) |
| `seek` | - | Seek to position (seconds) |

(See `CLAUDE.md` for the full event surface.)

## Building for Production

`npm run build` produces an offline-analyzable bundle in `dist/`. The LCD does NOT consume `dist/` — the kiosk loads from `npm run dev`. The build is useful for bundle-size measurements and CI checks.

```bash
npm run build
ls -la dist/
```

## Deploying to Raspberry Pi

### Backend

```bash
./scripts/pi-setup/deploy-to-pi.sh --backend
```

This builds the backend, scps to `~/stellar-backend/stellar` on the Pi, and restarts `stellar-backend.service`. Requires `STELLAR_BACKEND_FOLDER` in `.env`.

### Frontend

There is no frontend deploy step. Run `npm run dev` on the Mac and keep it running while the LCD is in use. The kiosk script `/usr/local/bin/stellar-kiosk.sh` is hard-pointed at `http://192.168.86.221:5173?layout=lcd` (override at install time via `STELLAR_KIOSK_URL` — see `scripts/pi-setup/README.md`).

If the Mac IP changes, update the kiosk script on the Pi:

```bash
source .env
SSH_CMD="sshpass -p '$RASPBERRY_PI_SSH_PASSWORD' ssh -o StrictHostKeyChecking=no $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"
eval "$SSH_CMD 'sudo sed -i \"s|192\\.168\\.86\\.221|<NEW_MAC_IP>|g\" /usr/local/bin/stellar-kiosk.sh'"
```

## Kiosk Mode

The Pi runs cage (Wayland compositor) with Chromium under it, autostarted on tty1 via `~/.bash_profile`. The launcher is `/usr/local/bin/stellar-kiosk.sh`.

### Startup sequence

1. Pi boots, autologin on tty1.
2. `.bash_profile` runs `stellar-kiosk.sh`.
3. The script waits up to 60s for `localhost:3000` (the Stellar backend) to respond.
4. Cage launches Chromium with Vulkan acceleration.
5. Chromium loads `http://192.168.86.221:5173?layout=lcd` (Mac dev server).

### Force kiosk restart

```bash
ssh eduardo@<PI_IP> 'pkill cage'
# Auto-restarts via the bash_profile loop
```

### Browser DevTools (over SSH)

Chromium exposes remote debugging on port 9222:

```bash
# From the Mac:
chrome://inspect -> Configure -> add <PI_IP>:9222
```

## Troubleshooting

### LCD shows a load error

The Mac's Vite dev server is most likely down. On the Mac:

```bash
cd Volumio2-UI && npm run dev
```

### Socket.io connection issues

- Frontend uses 4.x client; backend is v3 with EIO3 compat. If you see "version mismatch" errors, verify `socket.io-client` version in `package.json`.
- If `.local` hostnames fail, use IP addresses instead.

### Build issues

`$lib` path not resolved → check `vite.config.ts` alias:

```typescript
resolve: {
  alias: {
    '$lib': path.resolve('./src/lib')
  }
}
```

### Display issues

Layout doesn't fill 1920x440 → check `src/app.css`:

```css
#app {
  width: 1920px;
  height: 440px;
  max-width: 100vw;
  max-height: 100vh;
}
```

## Project Structure

```
Volumio2-UI/
├── index.html              # Entry point
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration with $lib alias
├── svelte.config.js        # Svelte configuration
├── tsconfig.json           # TypeScript configuration
├── DEVELOPMENT.md          # This file
├── CLAUDE.md               # Authoritative project context
│
├── src/
│   ├── main.ts             # App entry point (Svelte 5 mount API)
│   ├── App.svelte          # Root component
│   ├── app.css             # Global CSS
│   │
│   └── lib/
│       ├── config.ts       # Backend URL resolution
│       ├── services/
│       │   └── socket.ts   # Socket.IO wrapper
│       ├── stores/         # Svelte stores (player, queue, library, ...)
│       └── components/     # UI components
│
├── public/
│   └── config.json         # Runtime config override
│
├── scripts/
│   └── pi-setup/           # Pi provisioning + backend deploy
│
└── dist/                   # Production build output (offline analysis only)
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally with `npm run dev`
4. Verify on the LCD (Mac dev server must be running)
5. Submit a pull request

## License

GPL-3.0
