#!/bin/bash
# ============================================================
# Stellar Streamer - Raspberry Pi Setup Script
# ============================================================
#
# This script configures a Raspberry Pi as a Stellar audio streamer
# with LCD kiosk display and optional Audirvana Studio integration.
#
# Run this on the Pi after installing Raspberry Pi OS Lite (64-bit).
#
# Usage:
#   ./setup-streamer.sh [--with-audirvana]
#
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_section() { echo -e "\n${BLUE}============================================================${NC}"; echo -e "${BLUE} $1${NC}"; echo -e "${BLUE}============================================================${NC}"; }

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Please run this script as a regular user, not root"
    exit 1
fi

STELLAR_USER=$(whoami)
STELLAR_HOME=$HOME
INSTALL_AUDIRVANA=false

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-audirvana)
            INSTALL_AUDIRVANA=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Usage: $0 [--with-audirvana]"
            exit 1
            ;;
    esac
done

log_section "Stellar Streamer Setup"
log_info "User: $STELLAR_USER"
log_info "Home: $STELLAR_HOME"
log_info "Audirvana: $INSTALL_AUDIRVANA"

# ============================================================
log_section "1. System Dependencies"
# ============================================================

log_info "Updating package lists..."
sudo apt-get update

log_info "Installing system packages..."
sudo apt-get install -y \
    mpd mpc \
    python3 python3-pip python3-websocket \
    curl wget \
    cifs-utils nfs-common \
    avahi-daemon \
    cage chromium-browser \
    fonts-noto-color-emoji \
    alsa-utils

# ============================================================
log_section "2. Directory Structure"
# ============================================================

log_info "Creating directories..."
mkdir -p "$STELLAR_HOME/stellar-backend"
mkdir -p "$STELLAR_HOME/stellar-volumio"
sudo mkdir -p /data/stellar
sudo chown "$STELLAR_USER:$STELLAR_USER" /data/stellar
sudo mkdir -p /mnt/NAS
sudo chown "$STELLAR_USER:$STELLAR_USER" /mnt/NAS
sudo mkdir -p /var/lib/mpd/music
sudo mkdir -p /var/lib/mpd/playlists

# Create symlinks for music sources
sudo ln -sf /mnt/NAS /var/lib/mpd/music/NAS 2>/dev/null || true

# ============================================================
log_section "3. MPD Configuration"
# ============================================================

log_info "Configuring MPD..."
sudo tee /etc/mpd.conf > /dev/null << 'MPDCONF'
# Stellar MPD Configuration
# Optimized for bit-perfect audio playback

# Directories
music_directory         "/var/lib/mpd/music"
playlist_directory      "/var/lib/mpd/playlists"
db_file                 "/var/lib/mpd/tag_cache"
state_file              "/var/lib/mpd/state"
sticker_file            "/var/lib/mpd/sticker.sql"

# User and network
user                    "mpd"
bind_to_address         "localhost"
port                    "6600"

# Symlinks for NAS/USB sources
follow_outside_symlinks "yes"
follow_inside_symlinks  "yes"

# Auto-update database when files change
auto_update             "yes"

# Character encoding
filesystem_charset      "UTF-8"

# Input plugins
input {
    plugin "curl"
}

# Decoder settings - disable hybrid DSD for pure PCM
decoder {
    plugin                  "hybrid_dsd"
    enabled                 "no"
}

decoder {
    plugin        "wildmidi"
    enabled       "no"
}

# USB DAC Output - bit-perfect configuration
# This will be auto-detected or can be customized
audio_output {
    type        "alsa"
    name        "USB DAC"
    device      "hw:2,0"
    mixer_type  "none"
}
MPDCONF

# Add mpd user to audio group
sudo usermod -a -G audio mpd 2>/dev/null || true

sudo systemctl enable mpd
sudo systemctl restart mpd

# ============================================================
log_section "4. Systemd Services"
# ============================================================

log_info "Installing Stellar Backend service..."
sudo tee /etc/systemd/system/stellar-backend.service > /dev/null << EOF
[Unit]
Description=Stellar Audio Backend
After=network.target mpd.service
Wants=mpd.service

[Service]
Type=simple
User=$STELLAR_USER
WorkingDirectory=$STELLAR_HOME/stellar-backend
ExecStart=$STELLAR_HOME/stellar-backend/stellar -port 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

log_info "Installing Stellar Frontend service..."
sudo tee /etc/systemd/system/stellar-frontend.service > /dev/null << EOF
[Unit]
Description=Stellar Audio Frontend
After=network.target

[Service]
Type=simple
User=$STELLAR_USER
WorkingDirectory=$STELLAR_HOME/stellar-volumio
ExecStart=/usr/bin/python3 -m http.server 8080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable stellar-backend stellar-frontend

# ============================================================
log_section "5. Kiosk Configuration"
# ============================================================

log_info "Installing kiosk script..."
sudo tee /usr/local/bin/stellar-kiosk.sh > /dev/null << 'KIOSKEOF'
#!/bin/bash
# ============================================================
# Stellar Kiosk - Raspberry Pi 5 with Vulkan GPU Acceleration
# ============================================================
#
# This script:
# 1. Waits for the Stellar backend to be ready
# 2. Launches Cage compositor with Chromium in kiosk mode
# 3. Uses Vulkan for optimal GPU performance on RPi 5
#
# ============================================================

export XDG_RUNTIME_DIR=/run/user/$(id -u)
mkdir -p $XDG_RUNTIME_DIR

# Wait for Stellar backend to be ready
echo "Waiting for Stellar backend..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:3000/socket.io/?EIO=4\&transport=polling > /dev/null 2>&1; then
        echo "Backend ready after ${WAITED}s"
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
    if [ $((WAITED % 10)) -eq 0 ]; then
        echo "Still waiting for backend... (${WAITED}s)"
    fi
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "Warning: Backend not ready after ${MAX_WAIT}s, starting browser anyway"
fi

# Launch Chromium in kiosk mode via Cage compositor
exec cage -- chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    --password-store=basic \
    --remote-debugging-port=9222 \
    --remote-allow-origins=* \
    --ignore-gpu-blocklist \
    --enable-gpu-rasterization \
    --enable-zero-copy \
    --enable-accelerated-2d-canvas \
    --disable-software-rasterizer \
    --use-vulkan \
    --use-angle=vulkan \
    --enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,VaapiVideoDecoder,CanvasOopRasterization \
    "http://localhost:8080?layout=lcd"
KIOSKEOF

sudo chmod +x /usr/local/bin/stellar-kiosk.sh

# ============================================================
log_section "6. Autologin & Kiosk Startup"
# ============================================================

log_info "Configuring autologin on tty1..."
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf > /dev/null << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $STELLAR_USER --noclear %I \$TERM
EOF

log_info "Configuring bash profile for kiosk..."
# Remove existing kiosk config if present
sed -i '/# Start kiosk on TTY1/,/^fi$/d' "$STELLAR_HOME/.bash_profile" 2>/dev/null || true

cat >> "$STELLAR_HOME/.bash_profile" << 'BASHEOF'

# Start kiosk on TTY1 only
if [ "$(tty)" = "/dev/tty1" ]; then
    exec /usr/local/bin/stellar-kiosk.sh
fi
BASHEOF

# ============================================================
log_section "7. Avahi mDNS Discovery"
# ============================================================

log_info "Configuring Avahi for device discovery..."
sudo tee /etc/avahi/services/stellar.service > /dev/null << 'AVAHIEOF'
<?xml version="1.0" standalone="no"?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">%h</name>

  <!-- Volumio Discovery Service (for Volumio Connect apps) -->
  <service>
    <type>_Volumio._tcp</type>
    <subtype>_volumio._sub._Volumio._tcp</subtype>
    <port>3000</port>
    <txt-record>volumioName=Stellar</txt-record>
    <txt-record>UUID=stellar-rpi-001</txt-record>
    <txt-record>state=play</txt-record>
    <txt-record>systemversion=3.0</txt-record>
  </service>

  <!-- HTTP Web UI -->
  <service>
    <type>_http._tcp</type>
    <port>8080</port>
    <txt-record>path=/</txt-record>
  </service>

  <!-- SSH -->
  <service>
    <type>_ssh._tcp</type>
    <port>22</port>
  </service>

  <!-- SFTP -->
  <service>
    <type>_sftp-ssh._tcp</type>
    <port>22</port>
  </service>
</service-group>
AVAHIEOF

sudo systemctl enable avahi-daemon
sudo systemctl restart avahi-daemon

# ============================================================
log_section "8. Sudoers for NAS Mounting"
# ============================================================

log_info "Configuring passwordless sudo for mount commands..."
sudo tee /etc/sudoers.d/stellar-mount > /dev/null << EOF
# Allow stellar user to mount/umount NAS shares without password
$STELLAR_USER ALL=(ALL) NOPASSWD: /usr/bin/mount -t cifs *
$STELLAR_USER ALL=(ALL) NOPASSWD: /usr/bin/mount -t nfs *
$STELLAR_USER ALL=(ALL) NOPASSWD: /usr/bin/umount /mnt/NAS/*
$STELLAR_USER ALL=(ALL) NOPASSWD: /usr/bin/mkdir -p /mnt/NAS/*
EOF
sudo chmod 440 /etc/sudoers.d/stellar-mount

# ============================================================
# Audirvana Studio (optional)
# ============================================================
if [ "$INSTALL_AUDIRVANA" = true ]; then
    log_section "9. Audirvana Studio"

    log_info "Creating Audirvana directories..."
    sudo mkdir -p /opt/audirvana/studio
    sudo chown -R "$STELLAR_USER:$STELLAR_USER" /opt/audirvana

    log_info "Installing Audirvana service..."
    sudo tee /etc/systemd/system/audirvanaStudio.service > /dev/null << EOF
[Unit]
Description=Audirvana Studio
DefaultDependencies=no
After=avahi-daemon.service

[Service]
Type=simple
User=$STELLAR_USER
Group=audio
WorkingDirectory=/opt/audirvana/studio
ExecStart=/opt/audirvana/studio/audirvanaStudio
Restart=always

[Install]
WantedBy=default.target
EOF

    sudo systemctl daemon-reload
    # Don't enable by default - managed by Stellar backend
    # sudo systemctl enable audirvanaStudio

    log_warn "Audirvana Studio binary must be manually installed to /opt/audirvana/studio/"
fi

# ============================================================
log_section "10. Initialize Data Directory"
# ============================================================

log_info "Creating default sources configuration..."
if [ ! -f /data/stellar/sources.json ]; then
    cat > /data/stellar/sources.json << 'SOURCESEOF'
{
  "nasShares": {}
}
SOURCESEOF
fi

# ============================================================
log_section "Setup Complete"
# ============================================================

echo ""
log_info "Stellar Streamer setup complete!"
echo ""
echo "Next steps:"
echo "  1. Deploy the Stellar backend binary:"
echo "     scp stellar-arm64 $STELLAR_USER@$(hostname):~/stellar-backend/stellar"
echo ""
echo "  2. Deploy the frontend files:"
echo "     rsync -avz dist/ $STELLAR_USER@$(hostname):~/stellar-volumio/"
echo ""
echo "  3. Configure your USB DAC in /etc/mpd.conf if needed"
echo "     Run 'aplay -l' to list audio devices"
echo ""
echo "  4. Reboot the Pi:"
echo "     sudo reboot"
echo ""
echo "Services (ports):"
echo "  - stellar-backend  : 3000 (Socket.IO API)"
echo "  - stellar-frontend : 8080 (Web UI)"
echo "  - mpd              : 6600 (Music Player Daemon)"
echo ""
echo "The kiosk will start automatically on boot."
if [ "$INSTALL_AUDIRVANA" = true ]; then
    echo ""
    echo "Audirvana:"
    echo "  - Install binary to: /opt/audirvana/studio/audirvanaStudio"
    echo "  - Service managed by Stellar backend (mutual exclusion with MPD)"
fi
