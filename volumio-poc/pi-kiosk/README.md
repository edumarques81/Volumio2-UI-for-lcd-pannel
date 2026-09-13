# Volumio Pi Kiosk - LCD Control & Optimizations

This directory contains scripts and configurations to optimize the Raspberry Pi 5 kiosk experience for the Volumio POC.

## Features

1. **LCD On/Off Control** - Turn the LCD panel on/off without "no signal" blue screen
2. **HTTP API** - Control LCD from any device (mobile, computer, or the Pi itself)
3. **Optimized Chromium** - Smooth scrolling and animations with GPU acceleration
4. **Boot Configuration** - Stable HDMI output

## Quick Install

```bash
# Copy files to Pi
scp -r pi-kiosk volumio@<pi-ip>:/home/volumio/

# SSH into Pi
ssh volumio@<pi-ip>

# Run installer
cd /home/volumio/pi-kiosk
sudo bash install.sh
```

## Components

### 1. LCD Control Scripts

- `/usr/local/bin/lcd_off` - Turn LCD off (uses DPMS standby to avoid "no signal")
- `/usr/local/bin/lcd_on` - Turn LCD on

### 2. LCD Control HTTP Service

Runs on port 8081 with token authentication.

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/screen/off` | Turn screen off |
| POST | `/api/screen/on` | Turn screen on |
| GET | `/api/screen/status` | Get current status |

**Authentication:**

Add header: `X-Auth-Token: volumio-lcd-control`

**Example (from frontend):**

```javascript
// Turn LCD off
await fetch('http://192.168.86.34:8081/api/screen/off', {
  method: 'POST',
  headers: {
    'X-Auth-Token': 'volumio-lcd-control'
  }
});

// Turn LCD on
await fetch('http://192.168.86.34:8081/api/screen/on', {
  method: 'POST',
  headers: {
    'X-Auth-Token': 'volumio-lcd-control'
  }
});

// Get status
const response = await fetch('http://192.168.86.34:8081/api/screen/status');
const data = await response.json();
// data.status = 'on' | 'off' | 'unknown'
```

### 3. Optimized Chromium Kiosk

The kiosk script (`/opt/volumiokiosk.sh`) launches Chromium with optimal flags:

**REMOVED (causes performance issues):**
- `--disable-gpu-compositing` - This was causing software rendering!
- `--disable-3d-apis` - This disabled hardware acceleration!

**ADDED (improves performance):**
- `--enable-gpu-rasterization` - GPU-accelerated rasterization
- `--enable-zero-copy` - Efficient memory handling
- `--use-gl=egl` - Native OpenGL ES
- `--enable-accelerated-video-decode` - Hardware video decode
- `--enable-gpu-compositing` - GPU compositing
- `--enable-native-gpu-memory-buffers` - Native GPU buffers
- `--enable-smooth-scrolling` - Smooth scrolling enabled

### 4. Boot Configuration

Added to `/boot/userconfig.txt`:

```ini
# HDMI Stability
hdmi_force_hotplug=1      # Force HDMI even if no display at boot
hdmi_ignore_cec_init=1    # Disable CEC to prevent display issues
hdmi_drive=2              # HDMI mode (enables audio)

# Display
disable_overscan=1        # Remove black borders

# Power
max_usb_current=1         # Stable USB power
```

## Why DPMS Standby Instead of Off?

The "no signal" blue screen happens because:

1. `xset dpms force off` puts the monitor in DPMS "Off" state
2. Some monitors interpret "Off" as "no signal" and show their OSD
3. DPMS "Standby" keeps the HDMI link active but blanks the display

Our solution uses DPMS "Standby" first, which keeps the signal alive but blanks the screen. If your monitor still shows "no signal", it may require:

1. Check monitor OSD settings for "no signal" timeout/display
2. Some monitors can be configured to stay black instead of showing OSD
3. As a last resort, we could render a black screen instead of using DPMS

## Troubleshooting

### LCD won't turn off
```bash
# Check if X11 is running
DISPLAY=:0 xset q

# Check XAUTHORITY
ls -la /tmp/serverauth.*

# Manual test
DISPLAY=:0 XAUTHORITY=/tmp/serverauth.* xset dpms force standby
```

### LCD control service not responding
```bash
# Check service status
sudo systemctl status lcd-control

# View logs
sudo journalctl -u lcd-control -f

# Restart service
sudo systemctl restart lcd-control
```

### Chromium still choppy
```bash
# Check GPU flags
ps aux | grep chromium | grep gpu

# Check for software rendering
# Should NOT see "SwiftShader" in the output

# Enable GPU logging
# Add --enable-logging --v=1 to chromium flags
```

### Boot config not applied
```bash
# Verify config was parsed
vcgencmd get_config hdmi_force_hotplug

# Check for syntax errors
cat /boot/userconfig.txt
```

## Files

| File | Purpose |
|------|---------|
| `lcd_off` | Script to turn LCD off |
| `lcd_on` | Script to turn LCD on |
| `lcd-control-service.js` | HTTP API service |
| `lcd-control.service` | Systemd unit for HTTP service |
| `volumiokiosk-optimized.sh` | Optimized Chromium launch script |
| `install.sh` | Installation script |

## Rollback

To restore original behavior:

```bash
# Restore original kiosk script
sudo cp /opt/volumiokiosk.sh.bak.* /opt/volumiokiosk.sh

# Remove boot config additions
sudo rm /boot/userconfig.txt

# Disable LCD control service
sudo systemctl disable lcd-control
sudo systemctl stop lcd-control

# Reboot
sudo reboot
```
