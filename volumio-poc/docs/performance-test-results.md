# Performance Test Results

**Test Date**: January 24, 2026
**Device**: Raspberry Pi 5
**Display**: 1920x440 LCD Panel @ 60Hz
**Frontend**: Stellar Volumio POC (Svelte 5)
**Compositor**: Cage (Wayland)
**Browser**: Chromium 143 with Vulkan

---

## Summary

After comprehensive testing, the optimal configuration uses **Cage compositor + Chromium with Vulkan** and **active cooling**. This achieves ~53 FPS with stable performance and no thermal throttling.

---

## Test Results Comparison

### Configuration Comparison

| Configuration | FPS | Frame Time | Variance | Jank | Dropped Frames |
|--------------|-----|------------|----------|------|----------------|
| Original (X11, no cooling) | 14.8 | 67.5ms | 22.24ms | 2,048 | 7,475 |
| With cooling only | 32.7 | 30.56ms | 6.41ms | 7 | 243 |
| **Vulkan optimized (recommended)** | **52.9** | **18.89ms** | **6.47ms** | 90 | 130 |
| GLES mode | 15.7 | 63.89ms | 6.21ms | 260 | 782 |
| No vsync (uncapped, not recommended) | 403.5 | 2.48ms | 1.10ms | 255 | 2 |

### System Metrics Comparison

| Metric | Before (X11, no cooling) | After (Vulkan + cooling) |
|--------|--------------------------|--------------------------|
| **Temperature** | 80.1°C | 54.9°C |
| **Throttling** | 0x50000 (throttled) | 0x0 (none) |
| **Chromium CPU** | 100% | ~47% |

### Improvement Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **FPS** | 14.8 | 52.9 | **+257%** |
| **Frame Time** | 67.5ms | 18.89ms | **-72%** |
| **Temperature** | 80.1°C | 54.9°C | **-25°C** |
| **Throttling** | Active | None | **Resolved** |

---

## Optimal Configuration (Current Standard)

### Hardware Requirements

- **Active cooling** (fan + heatsink) - Critical for sustained performance
- Raspberry Pi 5 with adequate power supply (5V/5A recommended)

### Boot Configuration

The Pi boots to CLI mode (`multi-user.target`) with autologin on TTY1 that launches the kiosk.

**Files involved:**
- `/etc/systemd/system/getty@tty1.service.d/autologin.conf` - Autologin configuration
- `~/.bash_profile` - Launches kiosk on TTY1
- `/usr/local/bin/stellar-kiosk.sh` - Kiosk startup script

### Kiosk Script (`/usr/local/bin/stellar-kiosk.sh`)

```bash
#!/bin/bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
mkdir -p $XDG_RUNTIME_DIR

exec cage -- chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    --password-store=basic \
    --remote-debugging-port=9222 \
    --ignore-gpu-blocklist \
    --enable-gpu-rasterization \
    --enable-zero-copy \
    --enable-accelerated-2d-canvas \
    --disable-software-rasterizer \
    --enable-features=VaapiVideoDecoder,CanvasOopRasterization,Vulkan \
    --use-vulkan \
    'http://localhost:8080?layout=lcd'
```

### Key Chromium Flags Explained

| Flag | Purpose |
|------|---------|
| `--use-vulkan` | Use Vulkan renderer (faster than GLES on Pi 5) |
| `--enable-gpu-rasterization` | GPU-accelerated rasterization |
| `--enable-zero-copy` | Reduce memory copies for better performance |
| `--enable-accelerated-2d-canvas` | Hardware-accelerated canvas |
| `--disable-software-rasterizer` | Prevent fallback to CPU rendering |
| `--enable-features=Vulkan` | Enable Vulkan feature flag |
| `--password-store=basic` | Disable keyring prompts |
| `--remote-debugging-port=9222` | Enable DevTools for FPS monitoring |

---

## GPU Verification

### WebGL Info (Confirmed Working)

```
vendor: WebKit
renderer: ANGLE (Broadcom, V3D 7.1.10.2, OpenGL ES 3.1 Mesa 24.2.8)
version: WebGL 2.0 (OpenGL ES 3.0 Chromium)
```

### Display Configuration

```
HDMI-A-1: 1920x440 px, 60.000000 Hz (preferred, current)
```

### V3D Driver Status

```
v3d module loaded
Initialized v3d 1.0.0 for 1002000000.v3d
```

---

## Configurations NOT Recommended

### GLES Mode (15.7 FPS)

Using `--use-gl=egl --use-angle=gles` instead of Vulkan results in significantly worse performance on Pi 5.

### No VSync (403 FPS)

Adding `--disable-frame-rate-limit --disable-gpu-vsync` removes frame limiting but causes:
- Screen tearing
- Wasted CPU/GPU cycles
- High jank count (255)
- Not suitable for production

### X11 Mode

Running under X11 instead of Wayland (Cage) adds compositor overhead and prevents optimal GPU utilization.

---

## Troubleshooting

### Check Temperature

```bash
vcgencmd measure_temp
# Target: <60°C, Critical: >75°C
```

### Check Throttling

```bash
vcgencmd get_throttled
# 0x0 = No throttling (good)
# 0x50000 = Under-voltage + throttling occurred
```

### Check FPS Performance

Access Chrome DevTools remotely and run:
```javascript
__performance.start()  // Start monitoring
__performance.getMetrics()  // Get current metrics
__performance.reset()  // Reset counters
```

### Restart Kiosk

```bash
pkill -9 cage && sudo systemctl restart getty@tty1
```

---

## Historical Context

### Original Issues (January 23, 2026)

The initial X11-based kiosk configuration suffered from:
1. **Thermal throttling** at 80°C due to lack of cooling
2. **X11 overhead** instead of native Wayland
3. **Suboptimal Chromium flags** not utilizing Vulkan

### Resolution Steps

1. [x] Added active cooling (fan) to Raspberry Pi
2. [x] Switched from X11 to Cage (Wayland compositor)
3. [x] Enabled Vulkan renderer in Chromium
4. [x] Optimized Chromium flags for GPU acceleration
5. [x] Configured CLI boot with autologin kiosk
6. [x] Documented optimal configuration

---

## Related Documentation

- [Performance Overlay](./performance-overlay.md) - How to use the FPS monitoring tool
- [FPS Testing Research](./fps-testing-research.md) - Background on FPS measurement
- [Kiosk Browser Research](./kiosk-browser-research.md) - Browser alternatives
