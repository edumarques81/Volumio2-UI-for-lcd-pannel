# Kiosk Browser Alternatives for Raspberry Pi 5

**Research Date**: January 2026
**Target Hardware**: Raspberry Pi 5 (ARM64)
**Target OS**: Raspberry Pi OS Bookworm (Debian 12)
**Use Case**: Svelte 5 web application with Socket.IO on 1920x440 LCD display

---

## Executive Summary

| Solution | ARM64 Support | Modern JS | WebSocket | Memory | Maintained | Recommendation |
|----------|---------------|-----------|-----------|--------|------------|----------------|
| **Chromium + labwc** | Yes | Full | Full | ~400MB | Yes | Best Overall |
| **Cage + Chromium** | Yes | Full | Full | ~350MB | Yes | Best Pure Kiosk |
| **Cog (WPE WebKit)** | Yes | Full | Full | ~100-150MB | Yes | Best Lightweight |
| **Ubuntu Frame + WPE** | Yes | Full | Full | ~130-180MB | Yes | Good for Snaps |
| **Firefox ESR** | Yes | Full | Full | ~300MB | Yes | Video Playback |
| Microsoft Edge | No | N/A | N/A | N/A | N/A | Not Available |
| Uzbl | Maybe | Poor | Unknown | ~50MB | No | Avoid |
| Midori (original) | No | Limited | Unknown | ~50-80MB | No | Avoid |
| Kweb | No | Limited | Unknown | ~30-50MB | No | Avoid |
| Electron | Yes | Full | Full | ~500MB+ | Yes | Not Recommended |

---

## Recommended Options

### 1. Cage Wayland Compositor (Best for Pure Kiosk)

Cage is a Wayland kiosk compositor specifically designed for single-application deployments. It prevents user interaction outside the running application.

#### Installation

```bash
# Install from repositories (Bookworm)
sudo apt update
sudo apt install cage

# Or build from source for latest version
sudo apt install build-essential meson ninja-build \
  libwlroots-dev libwayland-dev libxkbcommon-dev
git clone https://github.com/cage-kiosk/cage.git
cd cage
meson setup build --buildtype=release
ninja -C build
sudo ninja -C build install
```

#### Running Cage with Chromium

```bash
# From TTY (not within another desktop session)
cage -- chromium-browser --kiosk --noerrdialogs \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --ignore-gpu-blocklist \
  http://localhost:8080?layout=lcd
```

#### Systemd Service

Create `/etc/systemd/system/stellar-kiosk.service`:

```ini
[Unit]
Description=Stellar Kiosk Browser
After=network.target

[Service]
User=volumio
Environment=XDG_RUNTIME_DIR=/run/user/1000
ExecStart=/usr/bin/cage -- chromium-browser --kiosk --noerrdialogs \
  --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist \
  http://localhost:8080?layout=lcd
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

#### Advantages

- Single-purpose compositor (minimal overhead)
- Based on wlroots (modern Wayland)
- Prevents user from interacting with anything except the application
- Hardware acceleration via DRM/KMS
- Very stable for kiosk deployments

#### Disadvantages

- Must run from TTY, not within desktop session
- Requires Wayland-compatible browser

**Source**: [Cage GitHub](https://github.com/cage-kiosk/cage)

---

### 2. Cog (WPE WebKit) - Best Lightweight Option

Cog is the official reference launcher for WPE WebKit, designed specifically for embedded kiosk applications.

#### Installation

```bash
# Install from Debian repositories
sudo apt update
sudo apt install cog libwpewebkit-1.1-0

# Debian Bookworm provides Cog 0.16.1-1 with WPE WebKit 2.38.6
```

#### Kiosk Mode Launch

```bash
# Basic fullscreen mode (requires Wayland compositor)
cog --fullscreen http://localhost:8080?layout=lcd

# With DRM platform (direct rendering, no compositor needed)
cog --fullscreen --platform=drm http://localhost:8080?layout=lcd

# Memory optimization
cog --fullscreen --enable-page-cache=false http://localhost:8080?layout=lcd
```

#### Systemd Service

Create `/etc/systemd/system/cog-kiosk.service`:

```ini
[Unit]
Description=Cog Web Kiosk
After=graphical.target network.target

[Service]
Type=simple
User=volumio
Environment=WAYLAND_DISPLAY=wayland-1
Environment=XDG_RUNTIME_DIR=/run/user/1000
ExecStart=/usr/bin/cog --fullscreen --platform=drm http://localhost:8080?layout=lcd
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
```

#### Features

- Full ES6+ JavaScript support (JavaScriptCore)
- Full WebSocket support (Socket.IO compatible)
- Hardware-accelerated rendering
- ~100-150MB memory footprint (vs ~400MB for Chromium)
- Actively maintained by Igalia

#### Limitations

- Requires Wayland compositor or DRM platform
- No built-in devtools (use remote debugging)
- Less familiar than Chromium

**Sources**:
- [Cog GitHub](https://github.com/Igalia/cog)
- [WPE WebKit](https://wpewebkit.org/)
- [Debian Package](https://packages.debian.org/stable/cog)

---

### 3. Chromium with labwc (Raspberry Pi OS Default)

As of 2025, Raspberry Pi OS uses labwc as the default Wayland compositor. This provides excellent Chromium performance.

#### Optimized Chromium Configuration

Create `/etc/chromium.d/00-rpi-vars`:

```bash
export CHROMIUM_FLAGS="$CHROMIUM_FLAGS \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --ignore-gpu-blocklist \
  --enable-features=CanvasOopRasterization,VaapiVideoDecoder \
  --disable-software-rasterizer \
  --use-gl=desktop"
```

#### Kiosk Mode Launch

```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --no-first-run \
  --start-fullscreen \
  --window-size=1920,440 \
  --window-position=0,0 \
  "http://localhost:8080?layout=lcd"
```

#### labwc Autostart Configuration

Edit `~/.config/labwc/autostart`:

```bash
chromium-browser --kiosk --noerrdialogs \
  --enable-gpu-rasterization --enable-zero-copy \
  http://localhost:8080?layout=lcd &
```

#### Advantages

- Best compatibility with web standards
- Excellent developer tools
- Well-tested on Raspberry Pi
- GPU acceleration support

#### Disadvantages

- Higher memory usage (~400MB)
- More complex than minimal alternatives

**Source**: [Raspberry Pi labwc Documentation](https://www.raspberrypi.com/documentation/computers/os.html)

---

### 4. Ubuntu Frame with WPE WebKit

Ubuntu Frame is a Wayland display server for kiosk applications, combined with WPE WebKit via snap.

#### Installation

```bash
# Install snapd
sudo apt update
sudo apt install snapd
sudo reboot

# Install Ubuntu Frame and WPE WebKit
sudo snap install ubuntu-frame
sudo snap install wpe-webkit-mir-kiosk

# Configure URL
sudo snap set wpe-webkit-mir-kiosk url=http://localhost:8080?layout=lcd

# Enable and connect
sudo snap connect wpe-webkit-mir-kiosk:wayland
sudo snap set wpe-webkit-mir-kiosk daemon=true
```

#### Advantages

- Easy snap-based deployment
- Automatic updates
- Security isolation
- Full WebSocket/Socket.IO support

#### Disadvantages

- Requires snap infrastructure
- More disk space usage
- Some touchscreen scroll issues reported

**Source**: [Ubuntu Frame Snapcraft](https://snapcraft.io/ubuntu-frame)

---

### 5. Firefox ESR (Best for Video)

Firefox offers better video playback on Raspberry Pi 5 compared to Chromium.

#### Installation

```bash
sudo apt update
sudo apt install firefox-esr
```

#### Kiosk Mode

```bash
firefox-esr --kiosk http://localhost:8080?layout=lcd
```

#### Hardware Acceleration

Enable in `about:config`:
- `gfx.webrender.all` = true
- `media.ffmpeg.vaapi.enabled` = true

#### Advantages

- Better video playback on Pi 5
- Full WebSocket support
- Lower memory than Chromium

#### Disadvantages

- Slower JavaScript performance than Chromium
- Kiosk mode less polished

**Source**: [Firefox Hardware Acceleration on Pi](https://www.omglinux.com/firefox-hardware-acceleration-raspberry-pi/)

---

## Browsers to Avoid

### Microsoft Edge

**Not available for ARM64 Linux.** Microsoft only provides AMD64 packages.

### Uzbl

**Abandoned since 2017.** Uses outdated WebKit1 with security vulnerabilities.

### Midori (Original WebKit Version)

**Abandoned since 2019.** Not available in Debian Bookworm. The new Midori is Firefox-based and not suitable for kiosk use.

### Kweb

**Abandoned.** Does not support ARM64 or Bookworm. Only works on 32-bit legacy systems.

### Electron

**Not recommended for Pi.** Higher memory usage than standalone Chromium, no hardware video acceleration.

---

## GPU Configuration for Raspberry Pi 5

### /boot/config.txt Settings

```ini
# Enable V3D driver
dtoverlay=vc4-kms-v3d

# GPU memory (don't exceed 128MB on Pi 5)
gpu_mem=128

# For 1920x440 display
hdmi_group=2
hdmi_mode=87
hdmi_cvt=1920 440 60 6 0 0 0
```

### Verify GPU Acceleration

```bash
# Check OpenGL
glxinfo | grep "OpenGL renderer"
# Should show: V3D 7.1.x

# Check Vulkan
vulkaninfo | grep "GPU"
# Should show: Broadcom V3D
```

---

## Recommendation for Stellar Volumio POC

### Primary: Cage + Chromium

Best combination of stability, performance, and web compatibility:

```bash
# /opt/volumiokiosk.sh
#!/bin/bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)

cage -- chromium-browser \
  --kiosk \
  --noerrdialogs \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --ignore-gpu-blocklist \
  'http://localhost:8080?layout=lcd'
```

### Alternative: Cog (Lower Memory)

If memory is constrained:

```bash
# /opt/volumiokiosk.sh
#!/bin/bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)

cog --fullscreen --platform=drm 'http://localhost:8080?layout=lcd'
```

---

## References

- [Cage GitHub](https://github.com/cage-kiosk/cage)
- [Cog GitHub](https://github.com/Igalia/cog)
- [WPE WebKit](https://wpewebkit.org/)
- [Raspberry Pi Kiosk Display System](https://github.com/TOLDOTECHNIK/Raspberry-Pi-Kiosk-Display-System)
- [Ubuntu Frame](https://canonical.com/mir/docs/run-ubuntu-frame-on-your-device)
- [Chromium Hardware Acceleration](https://www.linuxuprising.com/2021/04/how-to-enable-hardware-acceleration-in.html)
- [RaspberryTips Browser Comparison](https://raspberrytips.com/best-web-browsers-raspberry-pi/)
