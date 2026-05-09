# Raspberry Pi Streamer Setup

Scripts for configuring a Raspberry Pi as a Stellar audio streamer with an LCD kiosk display.

## Architecture (current)

The Pi runs only the backend services. The frontend is served from the Mac.

| Component | Where it runs | How to start |
|-----------|---------------|--------------|
| Stellar Backend (Go, Socket.IO) | Pi (`stellar-backend` systemd unit, port 3000) | `sudo systemctl start stellar-backend` |
| MPD | Pi (`mpd` systemd unit, port 6600) | `sudo systemctl start mpd` |
| Cage kiosk (Wayland + Chromium) | Pi (autostarted on tty1 via `~/.bash_profile`) | reboot Pi |
| **Stellar Frontend (Svelte/Vite)** | **Mac** (`npm run dev`, port 5173) | `cd Volumio2-UI && npm run dev` |

The kiosk launcher `/usr/local/bin/stellar-kiosk.sh` is hard-pointed at `http://192.168.86.221:5173?layout=lcd`. If the Mac dev server is down, the LCD shows a load error.

> **Always run `npm run dev` on the Mac before powering the LCD.**

## Prerequisites

- Raspberry Pi 5 (recommended) or Pi 4
- Raspberry Pi OS Lite (64-bit) - Bookworm
- LCD display (1920x440 for kiosk mode)
- USB DAC for audio output
- Network connection (Pi must be able to reach the Mac on port 5173)

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
# Copy the setup script
scp scripts/pi-setup/setup-streamer.sh eduardo@<PI_IP>:~/

# SSH into the Pi
ssh eduardo@<PI_IP>

# Run the setup script
chmod +x setup-streamer.sh
./setup-streamer.sh

# Or with Audirvana support
./setup-streamer.sh --with-audirvana
```

The script installs only `stellar-backend` (not `stellar-frontend` — that service no longer exists). It also installs `/usr/local/bin/stellar-kiosk.sh` which is what Chromium launches under cage.

If the Mac IP differs from `192.168.86.221`, override before running:

```bash
STELLAR_KIOSK_URL='http://<MAC_IP>:5173?layout=lcd' ./setup-streamer.sh
```

### 3. Deploy the Backend Binary

From your development machine (requires `.env` file):

```bash
# Copy .env-example and configure
cp .env-example .env
# Edit .env with your Pi's IP and credentials

# Deploy the backend binary
./scripts/pi-setup/deploy-to-pi.sh --backend
```

The frontend is NOT deployed to the Pi. Run `npm run dev` on the Mac instead.

### 4. Configure USB DAC

List available audio devices:
```bash
ssh eduardo@<PI_IP> "aplay -l"
```

Edit `/etc/mpd.conf` on the Pi to set the correct device:
```bash
ssh eduardo@<PI_IP> "sudo nano /etc/mpd.conf"
```

Update the `audio_output` section with your device (e.g., `hw:2,0`).

### 5. Start the Mac dev server, then reboot the Pi

```bash
# On the Mac, in a terminal that stays open:
cd Volumio2-UI && npm run dev

# Then reboot the Pi:
ssh eduardo@<PI_IP> "sudo reboot"
```

The kiosk should start automatically and load the Mac-served frontend.

## What Gets Installed

### Services (systemd, on the Pi)

| Service | Port | Description |
|---------|------|-------------|
| `stellar-backend` | 3000 | Go backend with Socket.IO, MPD integration |
| `mpd` | 6600 | Music Player Daemon |
| `audirvanaStudio` | - | Audirvana Studio (if installed) |

### Files & Directories

| Path | Description |
|------|-------------|
| `~/stellar-backend/stellar` | Backend binary |
| `/data/stellar/` | Persistent data (playlists, history, sources) |
| `/mnt/NAS/` | NAS mount points |
| `/var/lib/mpd/music/` | MPD music directory |
| `/usr/local/bin/stellar-kiosk.sh` | Kiosk launcher script (hard-points at the Mac dev server) |
| `/opt/audirvana/studio/` | Audirvana installation (if installed) |

### Configuration Files

| File | Description |
|------|-------------|
| `/etc/mpd.conf` | MPD configuration |
| `/etc/systemd/system/stellar-backend.service` | Backend service |
| `/etc/systemd/system/audirvanaStudio.service` | Audirvana service |
| `/etc/avahi/services/stellar.service` | mDNS discovery |
| `/etc/sudoers.d/stellar-mount` | Passwordless NAS mounting |
| `~/.bash_profile` | Kiosk auto-start on tty1 |

## Kiosk Startup Sequence

1. Pi boots and auto-logs in on tty1
2. `.bash_profile` runs `/usr/local/bin/stellar-kiosk.sh`
3. Kiosk script waits for backend Socket.IO to respond (up to 60s)
4. Cage compositor launches Chromium in kiosk mode with Vulkan
5. Chromium loads `http://192.168.86.221:5173?layout=lcd` (the Mac's Vite dev server)

## Troubleshooting

### LCD shows a load error
The Mac dev server is most likely not running. From the Mac:

```bash
cd Volumio2-UI && npm run dev
```

If the Mac IP changed, edit `/usr/local/bin/stellar-kiosk.sh` on the Pi (or re-run `STELLAR_KIOSK_URL=... setup-streamer.sh`).

### Check Service Status

```bash
systemctl status stellar-backend mpd
```

### View Logs

```bash
# Backend logs
journalctl -u stellar-backend -f

# MPD logs
journalctl -u mpd -f
```

### Restart Services

```bash
sudo systemctl restart stellar-backend
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
curl http://<PI_IP>:9222/json

# Open in Chrome: chrome://inspect -> Configure -> add <PI_IP>:9222
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

### Update Backend

```bash
./scripts/pi-setup/deploy-to-pi.sh --backend
```

### Update Frontend

There is no frontend update step on the Pi: the Mac's `npm run dev` always serves the latest local source. Just save the file.

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
- `_ssh._tcp` / `_sftp-ssh._tcp` - SSH/SFTP access

Discover from Mac:
```bash
dns-sd -B _Volumio._tcp local.
```
