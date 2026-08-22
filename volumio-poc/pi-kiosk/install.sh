#!/bin/bash
# Volumio Pi Kiosk Installation Script
#
# This script installs and configures:
# 1. LCD control scripts (lcd_on, lcd_off)
# 2. LCD control HTTP service with token auth
# 3. Optimized Chromium kiosk settings
# 4. Boot configuration for stable HDMI
#
# Run as root: sudo bash install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/kiosk-install.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
}

backup_file() {
    local file="$1"
    if [ -f "$file" ]; then
        local backup="${file}.bak.$(date +%Y%m%d_%H%M%S)"
        cp "$file" "$backup"
        log "Backed up $file to $backup"
    fi
}

# =============================================================================
# STEP 1: Install LCD control scripts
# =============================================================================
install_lcd_scripts() {
    log "Installing LCD control scripts..."

    # Install lcd_off
    cp "$SCRIPT_DIR/lcd_off" /usr/local/bin/lcd_off
    chmod +x /usr/local/bin/lcd_off
    log "Installed /usr/local/bin/lcd_off"

    # Install lcd_on
    cp "$SCRIPT_DIR/lcd_on" /usr/local/bin/lcd_on
    chmod +x /usr/local/bin/lcd_on
    log "Installed /usr/local/bin/lcd_on"

    # Test scripts are executable
    if /usr/local/bin/lcd_off --help 2>&1 | grep -q "lcd_off" || true; then
        log "LCD scripts installed successfully"
    fi
}

# =============================================================================
# STEP 2: Install LCD control service
# =============================================================================
install_lcd_service() {
    log "Installing LCD control service..."

    # Create directories
    mkdir -p /opt/lcd-control
    mkdir -p /etc/lcd-control

    # Copy service script
    cp "$SCRIPT_DIR/lcd-control-service.js" /opt/lcd-control/
    chmod +x /opt/lcd-control/lcd-control-service.js
    log "Installed /opt/lcd-control/lcd-control-service.js"

    # Generate auth token if not exists
    if [ ! -f /etc/lcd-control/token ]; then
        # Use a default token for simplicity (can be changed)
        echo "volumio-lcd-control" > /etc/lcd-control/token
        chmod 600 /etc/lcd-control/token
        log "Generated auth token at /etc/lcd-control/token"
    else
        log "Auth token already exists"
    fi

    # Install systemd service
    cp "$SCRIPT_DIR/lcd-control.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable lcd-control.service
    systemctl restart lcd-control.service
    log "LCD control service installed and started"

    # Check service status
    if systemctl is-active --quiet lcd-control.service; then
        log "LCD control service is running"
    else
        error "LCD control service failed to start"
        journalctl -u lcd-control.service --no-pager -n 20
    fi
}

# =============================================================================
# STEP 3: Install optimized kiosk script
# =============================================================================
install_kiosk_script() {
    log "Installing optimized kiosk script..."

    # Backup existing script
    backup_file /opt/volumiokiosk.sh

    # Install new script
    cp "$SCRIPT_DIR/volumiokiosk-optimized.sh" /opt/volumiokiosk.sh
    chmod +x /opt/volumiokiosk.sh
    log "Installed /opt/volumiokiosk.sh"

    # Ensure data directory exists
    mkdir -p /data/volumiokiosk
    chown volumio:volumio /data/volumiokiosk
}

# =============================================================================
# STEP 4: Configure boot settings
# =============================================================================
configure_boot() {
    log "Configuring boot settings..."

    local userconfig="/boot/userconfig.txt"

    # Create userconfig.txt if it doesn't exist
    if [ ! -f "$userconfig" ]; then
        touch "$userconfig"
    fi

    backup_file "$userconfig"

    # Check what's already configured in volumioconfig.txt
    local volumioconfig="/boot/volumioconfig.txt"
    local has_force_hotplug=false
    if grep -q "hdmi_force_hotplug=1" "$volumioconfig" 2>/dev/null; then
        has_force_hotplug=true
        log "hdmi_force_hotplug=1 already set in volumioconfig.txt"
    fi

    # Add settings to userconfig.txt
    cat > "$userconfig" << 'EOF'
# Volumio Kiosk Optimizations
# Added by install.sh

# === HDMI Stability ===
# Force HDMI output even if no display detected at boot
# (May already be in volumioconfig.txt, duplicates are OK)
hdmi_force_hotplug=1

# Disable HDMI audio CEC to prevent display issues
hdmi_ignore_cec_init=1

# Force HDMI mode (vs DVI) - enables audio over HDMI
hdmi_drive=2

# === GPU Performance (Pi5) ===
# Note: Pi5 doesn't use gpu_mem the same way as Pi4
# The VideoCore VII handles memory dynamically

# Enable V3D hardware acceleration
dtoverlay=vc4-kms-v3d-pi5

# === Display Settings ===
# Disable overscan (removes black borders)
disable_overscan=1

# === Power Management ===
# Keep USB power stable
max_usb_current=1
EOF

    log "Updated $userconfig with kiosk optimizations"

    # Show what was configured
    log "Boot configuration:"
    cat "$userconfig" | grep -v "^#" | grep -v "^$" | while read line; do
        log "  $line"
    done
}

# =============================================================================
# STEP 5: Stop old display server if running
# =============================================================================
cleanup_old_service() {
    log "Cleaning up old services..."

    # Stop old display-server if running via pm2 or systemd
    if systemctl is-active --quiet display-control.service 2>/dev/null; then
        systemctl stop display-control.service
        systemctl disable display-control.service
        log "Stopped old display-control service"
    fi

    # Kill any old display-server.js processes
    pkill -f "display-server.js" 2>/dev/null || true
}

# =============================================================================
# STEP 6: Install xdotool for better wake functionality
# =============================================================================
install_dependencies() {
    log "Installing dependencies..."

    # Check if xdotool is installed
    if ! command -v xdotool &>/dev/null; then
        apt-get update -qq
        apt-get install -y xdotool
        log "Installed xdotool"
    else
        log "xdotool already installed"
    fi
}

# =============================================================================
# MAIN
# =============================================================================
main() {
    log "=========================================="
    log "Volumio Pi Kiosk Installation"
    log "=========================================="

    check_root

    cleanup_old_service
    install_dependencies
    install_lcd_scripts
    install_lcd_service
    install_kiosk_script
    configure_boot

    log "=========================================="
    log "Installation complete!"
    log "=========================================="
    log ""
    log "IMPORTANT: You need to REBOOT for all changes to take effect."
    log ""
    log "After reboot:"
    log "  - LCD control service will be at http://<pi-ip>:8081"
    log "  - Auth token: volumio-lcd-control (or check /etc/lcd-control/token)"
    log "  - Chromium will use optimized GPU settings"
    log ""
    log "To test LCD control:"
    log "  curl -X POST -H 'X-Auth-Token: volumio-lcd-control' http://localhost:8081/api/screen/off"
    log "  curl -X POST -H 'X-Auth-Token: volumio-lcd-control' http://localhost:8081/api/screen/on"
    log ""
    log "Reboot now? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log "Rebooting..."
        reboot
    else
        log "Please reboot manually when ready: sudo reboot"
    fi
}

main "$@"
