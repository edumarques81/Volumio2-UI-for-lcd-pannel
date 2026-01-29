#!/bin/bash
# /opt/volumiokiosk.sh - Optimized Chromium Kiosk for Raspberry Pi 5
#
# This script launches Chromium in kiosk mode with optimal settings for:
# - Smooth scrolling and animations
# - GPU acceleration (Pi5 VideoCore VII)
# - Touch input
# - Minimal memory footprint
#
# IMPORTANT: Do NOT use --disable-gpu-compositing or --disable-3d-apis
# These flags destroy performance and cause choppy animations!

set -euo pipefail

# Configuration
KIOSK_URL="${KIOSK_URL:-http://localhost:8080}"
KIOSK_DATA_DIR="${KIOSK_DATA_DIR:-/data/volumiokiosk}"

# Wait for the web server to be ready
echo "[kiosk] Waiting for web server at $KIOSK_URL..."
for i in {1..30}; do
    if timeout 2 bash -c "</dev/tcp/127.0.0.1/8080" 2>/dev/null; then
        echo "[kiosk] Web server ready"
        break
    fi
    echo "[kiosk] Waiting... ($i/30)"
    sleep 1
done

# Clean up any crash flags from previous sessions
if [ -f "$KIOSK_DATA_DIR/Default/Preferences" ]; then
    sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$KIOSK_DATA_DIR/Default/Preferences" 2>/dev/null || true
    sed -i 's/"exit_type":"Crashed"/"exit_type":"None"/' "$KIOSK_DATA_DIR/Default/Preferences" 2>/dev/null || true
fi

# Clean up singleton locks
if [ -L "$KIOSK_DATA_DIR/SingletonCookie" ]; then
    rm -rf "$KIOSK_DATA_DIR/Singleton"* 2>/dev/null || true
fi

# Start window manager (openbox is lightweight)
echo "[kiosk] Starting openbox window manager..."
openbox-session &
sleep 1

# Disable screen blanking and DPMS auto-timeout (we control it manually)
echo "[kiosk] Configuring display settings..."
xset s off          # Disable screensaver
xset s noblank      # Disable screen blanking
xset -dpms          # Disable DPMS auto-timeout (we control via service)
# Re-enable DPMS for manual control
xset +dpms
xset dpms 0 0 0     # Set all timeouts to 0 (manual control only)

echo "[kiosk] Starting Chromium kiosk..."

# Chromium flags for optimal Pi5 performance
# Reference: https://www.chromium.org/developers/design-documents/gpu-command-buffer/
exec /usr/bin/chromium-browser \
    "$KIOSK_URL" \
    \
    `# === Kiosk Mode ===` \
    --kiosk \
    --no-first-run \
    --noerrdialogs \
    --disable-infobars \
    --check-for-update-interval=31536000 \
    --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \
    \
    `# === User Data ===` \
    --user-data-dir="$KIOSK_DATA_DIR" \
    \
    `# === Display & Touch ===` \
    --force-device-scale-factor=1 \
    --touch-events=enabled \
    --enable-touchview \
    \
    `# === GPU Acceleration (CRITICAL for smooth scrolling) ===` \
    --enable-gpu-rasterization \
    --enable-zero-copy \
    --use-gl=egl \
    --use-angle=gles \
    --enable-accelerated-video-decode \
    --ignore-gpu-blocklist \
    --enable-native-gpu-memory-buffers \
    \
    `# === Compositing (DO NOT DISABLE - causes choppy animations) ===` \
    --enable-gpu-compositing \
    --enable-oop-rasterization \
    --canvas-oop-rasterization \
    \
    `# === Feature Flags ===` \
    --enable-features=VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization,UseOzonePlatform \
    --ozone-platform=x11 \
    \
    `# === Performance Tuning ===` \
    --disable-background-networking \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-component-update \
    --disable-domain-reliability \
    --disable-sync \
    \
    `# === Reduce Memory/CPU ===` \
    --disable-breakpad \
    --disable-crash-reporter \
    --disable-default-apps \
    --disable-extensions \
    --disable-hang-monitor \
    --disable-popup-blocking \
    --disable-prompt-on-repost \
    --disable-translate \
    \
    `# === Security (for local kiosk) ===` \
    --disable-web-security \
    --allow-running-insecure-content \
    \
    `# === Scrolling (keep smooth scrolling enabled!) ===` \
    --enable-smooth-scrolling \
    --enable-scroll-prediction \
    \
    `# === Process Model ===` \
    --process-per-site \
    --renderer-process-limit=2 \
    --num-raster-threads=4 \
    \
    `# === Misc ===` \
    --autoplay-policy=no-user-gesture-required \
    --disable-pinch \
    --disable-remote-extensions \
    --disable-features=TranslateUI
