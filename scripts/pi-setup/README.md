# Raspberry Pi Streamer Setup

Scripts for configuring a Raspberry Pi as a Stellar audio streamer with LCD kiosk display.

## Overview

These scripts automate the setup of a Raspberry Pi as a dedicated audio streamer with:
- **Stellar Backend** - Go-based audio backend with Socket.IO API
- **Stellar Frontend** - Svelte web UI optimized for 1920x440 LCD
- **MPD** - Music Player Daemon for bit-perfect audio playback
- **Kiosk Mode** - Full-screen browser with Vulkan GPU acceleration
- **Audirvana Studio** (optional) - High-end audio playback alternative

## Prerequisites

- Raspberry Pi 5 (recommended) or Pi 4
- Raspberry Pi OS Lite (64-bit) - Bookworm
- LCD display (1920x440 for kiosk mode)
- USB DAC for audio output
- Network connection

## Quick Start

### 1. Flash Raspberry Pi OS

Use Raspberry Pi Imager to flash **Raspberry Pi OS Lite (64-bit)** to your SD card.

Configure in Imager (Ctrl+Shift+X):
- Set hostname (e.g., `stellar`)
- Enable SSH
- Set username/password
- Configure WiFi (if needed)

### 2. Run Setup Script on the Pi

SSH into your Pi and run:

```bash
# Clone or copy the setup script
scp scripts/pi-setup/setup-streamer.sh pi@stellar.local:~/

# SSH into the Pi
ssh pi@stellar.local

# Run the setup script
chmod +x setup-streamer.sh
./setup-streamer.sh

# Or with Audirvana support
./setup-streamer.sh --with-audirvana
```

### 3. Deploy the Application

From your development machine (requires `.env` file):

```bash
# Copy .env-example and configure
cp .env-example .env
# Edit .env with your Pi's IP and credentials

# Deploy frontend only
cd volumio-poc
./scripts/pi-setup/deploy-to-pi.sh

# Deploy frontend AND backend
./scripts/pi-setup/deploy-to-pi.sh --backend
```

### 4. Configure USB DAC

List available audio devices:
```bash
ssh pi@stellar.local "aplay -l"
```

Edit `/etc/mpd.conf` on the Pi to set the correct device:
```bash
ssh pi@stellar.local "sudo nano /etc/mpd.conf"
```

Update the `audio_output` section with your device (e.g., `hw:2,0`).

### 5. Reboot

```bash
ssh pi@stellar.local "sudo reboot"
```

The kiosk should start automatically showing the Stellar UI.

## What Gets Installed

### Services

| Service | Port | Description |
|---------|------|-------------|
| `stellar-backend` | 3000 | Go backend with Socket.IO, MPD integration |
| `stellar-frontend` | 8080 | Python HTTP server serving the UI |
| `mpd` | 6600 | Music Player Daemon |
| `audirvanaStudio` | - | Audirvana Studio (if installed) |

### Files & Directories

| Path | Description |
|------|-------------|
| `~/stellar-backend/stellar` | Backend binary |
| `~/stellar-volumio/` | Frontend static files |
| `/data/stellar/` | Persistent data (playlists, history, sources) |
| `/mnt/NAS/` | NAS mount points |
| `/var/lib/mpd/music/` | MPD music directory |
| `/usr/local/bin/stellar-kiosk.sh` | Kiosk launcher script |
| `/opt/audirvana/studio/` | Audirvana installation (if installed) |

### Configuration Files

| File | Description |
|------|-------------|
| `/etc/mpd.conf` | MPD configuration |
| `/etc/systemd/system/stellar-backend.service` | Backend service |
| `/etc/systemd/system/stellar-frontend.service` | Frontend service |
| `/etc/systemd/system/audirvanaStudio.service` | Audirvana service |
| `/etc/avahi/services/stellar.service` | mDNS discovery |
| `/etc/sudoers.d/stellar-mount` | Passwordless NAS mounting |
| `~/.bash_profile` | Kiosk auto-start on tty1 |

## Kiosk Startup Sequence

1. Pi boots and auto-logs in on tty1
2. `.bash_profile` runs `/usr/local/bin/stellar-kiosk.sh`
3. Kiosk script waits for backend Socket.IO to respond (up to 60s)
4. Cage compositor launches Chromium in kiosk mode with Vulkan
5. Chromium loads `http://localhost:8080?layout=lcd`

## Troubleshooting

### Check Service Status

```bash
systemctl status stellar-backend stellar-frontend mpd
```

### View Logs

```bash
# Backend logs
journalctl -u stellar-backend -f

# Frontend logs
journalctl -u stellar-frontend -f

# MPD logs
journalctl -u mpd -f
```

### Restart Services

```bash
sudo systemctl restart stellar-backend
sudo systemctl restart stellar-frontend
sudo systemctl restart mpd
```

### Force Kiosk Restart

```bash
pkill cage
# Auto-restarts via autologin
```

### Test Socket.IO Connection

```bash
curl -s 'http://localhost:3000/socket.io/?EIO=4&transport=polling'
# Should return JSON with sid
```

### Test MPD Connection

```bash
mpc status
mpc listall | head
```

### Access Browser DevTools

The browser exposes remote debugging on port 9222:
```bash
# List available pages
curl http://PI_IP:9222/json

# Open in Chrome: chrome://inspect -> Configure -> add PI_IP:9222
```

### Audio Issues

```bash
# List audio devices
aplay -l

# Test audio output
speaker-test -D hw:2,0 -c 2

# Check MPD output config
grep -A5 "audio_output" /etc/mpd.conf
```

## Updating

### Update Frontend Only

```bash
cd volumio-poc
./scripts/pi-setup/deploy-to-pi.sh
```

### Update Frontend and Backend

```bash
cd volumio-poc
./scripts/pi-setup/deploy-to-pi.sh --backend
```

### Update Just the Kiosk Script

```bash
source .env
scp scripts/pi-setup/files/stellar-kiosk.sh $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:/tmp/
ssh $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS "sudo mv /tmp/stellar-kiosk.sh /usr/local/bin/ && sudo chmod +x /usr/local/bin/stellar-kiosk.sh"
```

## Audirvana Integration

If installed with `--with-audirvana`:

1. Download Audirvana Studio for Linux ARM64
2. Extract to `/opt/audirvana/studio/`
3. The service is managed by the Stellar backend (mutual exclusion with MPD)
4. Switch between MPD and Audirvana via the Settings UI

## Network Discovery

The device advertises itself via mDNS (Avahi) with:
- `_Volumio._tcp` - Compatible with Volumio Connect apps
- `_http._tcp` - Web UI
- `_ssh._tcp` / `_sftp-ssh._tcp` - SSH/SFTP access

Discover from Mac:
```bash
dns-sd -B _Volumio._tcp local.
```
