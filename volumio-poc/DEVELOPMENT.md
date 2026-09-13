# Volumio Svelte POC - Development Guide

This document covers the complete setup, development, and deployment process for the Volumio Svelte POC designed for a 1920x440 LCD touchscreen panel.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Socket.io Connection](#socketio-connection)
- [Building for Production](#building-for-production)
- [Deploying to Raspberry Pi](#deploying-to-raspberry-pi)
- [Running Both Interfaces in Parallel](#running-both-interfaces-in-parallel)
- [Kiosk Mode Setup](#kiosk-mode-setup)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## Overview

This POC is a modern Svelte 5 + TypeScript replacement for the Volumio AngularJS UI, optimized for:
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

### Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Svelte 5 |
| Language | TypeScript |
| Build Tool | Vite 7 |
| Styling | CSS with CSS Variables |
| State Management | Svelte Stores |
| Backend Communication | Socket.io 2.3.1 (CDN) |

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

### Raspberry Pi (Volumio Device)

- Volumio 3.x installed
- Network connectivity to development machine
- SSH access enabled (default password: `volumio`)

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Navigate to the POC directory
cd /path/to/Volumio2-UI/volumio-poc

# Install dependencies
npm install
```

### 2. Configure Volumio Backend Connection

The POC automatically detects the environment and connects to the correct host:

| Environment | Page served from | Connects to |
|-------------|------------------|-------------|
| Raspberry Pi (kiosk) | localhost:8080 | localhost:3000 |
| Mac (Vite dev) | localhost:5173 | PI_IP:3000 |
| Remote browser | PI_IP:8080 | PI_IP:3000 |

**To change the development IP**, edit `src/lib/config.ts`:

```typescript
// Line 18 - Update with your Volumio device IP
const DEV_VOLUMIO_IP = '192.168.86.22';
```

**Finding your Volumio IP:**
```bash
# Option 1: From Volumio web interface
# Go to http://volumio.local/api/host

# Option 2: Using ping
ping volumio.local

# Option 3: Check your router's DHCP client list
```

### 3. Start Development Server

```bash
npm run dev
```

The dev server starts at `http://localhost:5173` and is also accessible from other devices on your network at `http://YOUR_MAC_IP:5173`.

## Socket.io Connection

### Critical Version Compatibility

**Volumio backend uses Socket.io v2.3.x** - This is NOT compatible with Socket.io v4 clients!

We load Socket.io from CDN to avoid bundling issues:

```html
<!-- In index.html -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.3.1/socket.io.js"></script>
```

### Connection Configuration

```typescript
// src/lib/services/socket.ts
const socket = io('http://VOLUMIO_IP', {
  transports: ['polling', 'websocket']  // Start with polling, upgrade to websocket
});
```

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

### Testing Socket Connection

A standalone test file is included at `public/test-socket.html`:

```bash
# Open in browser
open http://localhost:5173/test-socket.html
```

## Building for Production

```bash
# Build optimized production bundle
npm run build

# Output is in the dist/ directory
ls -la dist/
# index.html
# assets/
#   index-*.js
#   index-*.css
```

## Deploying to Raspberry Pi

### Prerequisites on macOS

```bash
# Install sshpass for automated SSH authentication
brew install hudochenkov/sshpass/sshpass
```

### Deployment Commands

```bash
# 1. Build the POC
npm run build

# 2. Create directory on Raspberry Pi
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.22 "mkdir -p ~/volumio-poc"

# 3. Copy files to Raspberry Pi
sshpass -p 'volumio' scp -o StrictHostKeyChecking=no -r dist/* volumio@192.168.86.22:~/volumio-poc/

# 4. Start HTTP server on port 8080
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.22 "cd ~/volumio-poc && nohup python3 -m http.server 8080 > /dev/null 2>&1 &"

# 5. Verify server is running
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.22 "ss -tlnp | grep 8080"
```

### One-Liner Deployment Script

```bash
# Full deployment in one command
npm run build && \
sshpass -p 'volumio' ssh volumio@192.168.86.22 "mkdir -p ~/volumio-poc" && \
sshpass -p 'volumio' scp -r dist/* volumio@192.168.86.22:~/volumio-poc/ && \
sshpass -p 'volumio' ssh volumio@192.168.86.22 "pkill -f 'python3 -m http.server 8080' 2>/dev/null; cd ~/volumio-poc && nohup python3 -m http.server 8080 > /dev/null 2>&1 &"
```

## Running Both Interfaces in Parallel

After deployment, both interfaces run simultaneously:

| Interface | URL | Port |
|-----------|-----|------|
| Original Volumio UI | http://192.168.86.22 | 80 (or 3000) |
| Svelte POC | http://192.168.86.22:8080 | 8080 |

Both share the same Volumio backend Socket.io connection and display the same player state.

### Managing the POC Server

```bash
# Stop the POC server
sshpass -p 'volumio' ssh volumio@192.168.86.22 "pkill -f 'python3 -m http.server 8080'"

# Check if POC server is running
sshpass -p 'volumio' ssh volumio@192.168.86.22 "ss -tlnp | grep 8080"

# Restart the POC server
sshpass -p 'volumio' ssh volumio@192.168.86.22 "cd ~/volumio-poc && nohup python3 -m http.server 8080 > /dev/null 2>&1 &"
```

## Kiosk Mode Setup

The Volumio kiosk runs Chromium in fullscreen mode via `/opt/volumiokiosk.sh`.

### Kiosk Script Location

```
/opt/volumiokiosk.sh          # Main kiosk startup script
/opt/volumiokiosk.sh.backup   # Backup of original (created during POC setup)
```

### Switching Kiosk Chrome to POC

```bash
# 1. Backup original kiosk script (if not already done)
sshpass -p 'volumio' ssh volumio@192.168.86.22 "echo 'volumio' | sudo -S cp /opt/volumiokiosk.sh /opt/volumiokiosk.sh.backup"

# 2. Update URL from port 3000 to 8080
sshpass -p 'volumio' ssh volumio@192.168.86.22 "echo 'volumio' | sudo -S sed -i 's|http://localhost:3000|http://localhost:8080|g' /opt/volumiokiosk.sh"

# 3. Update port check from 3000 to 8080
sshpass -p 'volumio' ssh volumio@192.168.86.22 "echo 'volumio' | sudo -S sed -i 's|127.0.0.1/3000|127.0.0.1/8080|g' /opt/volumiokiosk.sh"

# 4. Restart kiosk service
sshpass -p 'volumio' ssh volumio@192.168.86.22 "echo 'volumio' | sudo -S systemctl restart volumio-kiosk"
```

### Restoring Original Volumio UI

```bash
# Restore original kiosk script
sshpass -p 'volumio' ssh volumio@192.168.86.22 "echo 'volumio' | sudo -S cp /opt/volumiokiosk.sh.backup /opt/volumiokiosk.sh"

# Restart kiosk service
sshpass -p 'volumio' ssh volumio@192.168.86.22 "echo 'volumio' | sudo -S systemctl restart volumio-kiosk"
```

### Kiosk Service Management

```bash
# Check kiosk status
sshpass -p 'volumio' ssh volumio@192.168.86.22 "systemctl status volumio-kiosk --no-pager"

# Restart kiosk
sshpass -p 'volumio' ssh volumio@192.168.86.22 "echo 'volumio' | sudo -S systemctl restart volumio-kiosk"

# Stop kiosk
sshpass -p 'volumio' ssh volumio@192.168.86.22 "echo 'volumio' | sudo -S systemctl stop volumio-kiosk"

# Start kiosk
sshpass -p 'volumio' ssh volumio@192.168.86.22 "echo 'volumio' | sudo -S systemctl start volumio-kiosk"
```

### Quick Switch Script

Create `switch-kiosk.sh` for easy switching:

```bash
#!/bin/bash
# Usage: ./switch-kiosk.sh [poc|original]

VOLUMIO_IP="${VOLUMIO_IP:-192.168.86.22}"
VOLUMIO_PASSWORD="${VOLUMIO_PASSWORD:-volumio}"

case "$1" in
  poc)
    echo "Switching to Svelte POC..."
    sshpass -p "$VOLUMIO_PASSWORD" ssh volumio@$VOLUMIO_IP "echo '$VOLUMIO_PASSWORD' | sudo -S sed -i 's|localhost:3000|localhost:8080|g' /opt/volumiokiosk.sh"
    sshpass -p "$VOLUMIO_PASSWORD" ssh volumio@$VOLUMIO_IP "echo '$VOLUMIO_PASSWORD' | sudo -S sed -i 's|127.0.0.1/3000|127.0.0.1/8080|g' /opt/volumiokiosk.sh"
    ;;
  original)
    echo "Switching to original Volumio UI..."
    sshpass -p "$VOLUMIO_PASSWORD" ssh volumio@$VOLUMIO_IP "echo '$VOLUMIO_PASSWORD' | sudo -S cp /opt/volumiokiosk.sh.backup /opt/volumiokiosk.sh"
    ;;
  *)
    echo "Usage: $0 [poc|original]"
    exit 1
    ;;
esac

sshpass -p "$VOLUMIO_PASSWORD" ssh volumio@$VOLUMIO_IP "echo '$VOLUMIO_PASSWORD' | sudo -S systemctl restart volumio-kiosk"
echo "Done! Kiosk restarted."
```

## Troubleshooting

### Socket.io Connection Issues

**Symptom:** "Socket.io server in v2.x with a v3.x client" error

**Solution:** Ensure you're using Socket.io 2.3.1 from CDN, not npm package:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.3.1/socket.io.js"></script>
```

**Symptom:** Connection fails with `.local` hostname

**Solution:** Use IP address instead of hostname:
```typescript
const defaultHost = 'http://192.168.86.22';  // Use IP, not volumio.local
```

### Build Issues

**Symptom:** `$lib` path not resolved

**Solution:** Ensure `vite.config.ts` has the alias:
```typescript
resolve: {
  alias: {
    '$lib': path.resolve('./src/lib')
  }
}
```

### Display Issues

**Symptom:** Layout doesn't fill 1920x440

**Solution:** Check `src/app.css`:
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
volumio-poc/
├── index.html              # Entry point with Socket.io CDN
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration with $lib alias
├── svelte.config.js        # Svelte configuration
├── tsconfig.json           # TypeScript configuration
├── DEVELOPMENT.md          # This file
│
├── src/
│   ├── main.ts             # App entry point (Svelte 5 mount API)
│   ├── App.svelte          # Root component with connection state
│   ├── app.css             # Global CSS with iOS 26 design system
│   │
│   └── lib/
│       ├── services/
│       │   └── socket.ts   # Socket.io wrapper service
│       │
│       ├── stores/
│       │   └── player.ts   # Player state and actions
│       │
│       └── components/
│           ├── PlayerBar.svelte      # Main 1920x440 layout
│           ├── AlbumArt.svelte       # Album artwork display
│           ├── TrackInfo.svelte      # Track title, artist, album
│           ├── PlayerControls.svelte # Play/pause, prev/next, shuffle/repeat
│           ├── SeekBar.svelte        # Progress/seek slider
│           ├── VolumeControl.svelte  # Volume slider and mute
│           └── Icon.svelte           # SVG icon component
│
├── public/
│   └── test-socket.html    # Standalone socket test page
│
└── dist/                   # Production build output
    ├── index.html
    └── assets/
        ├── index-*.js
        └── index-*.css
```

## Environment Variables

Currently hardcoded. Future improvement: use `.env` files:

```bash
# .env.development
VITE_VOLUMIO_HOST=http://192.168.86.22

# .env.production
VITE_VOLUMIO_HOST=http://localhost
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally with `npm run dev`
4. Build and test on Raspberry Pi
5. Submit a pull request

## License

Same license as Volumio2-UI (GPL-3.0)
