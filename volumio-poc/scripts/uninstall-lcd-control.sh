#!/bin/bash
#
# LCD Control Service Uninstaller for Raspberry Pi
# Run as root: sudo bash uninstall-lcd-control.sh
#
# This script removes all files and services created by install-lcd-control.sh
#

set -e

echo "=== LCD Control Service Uninstaller ==="
echo ""
echo "This will remove the LCD control service and all related files."
echo ""
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root (sudo bash uninstall-lcd-control.sh)"
  exit 1
fi

# Stop and disable service
echo "[1/4] Stopping and disabling service..."
if systemctl is-active --quiet lcd-control 2>/dev/null; then
  systemctl stop lcd-control
  echo "  - Service stopped"
fi

if systemctl is-enabled --quiet lcd-control 2>/dev/null; then
  systemctl disable lcd-control
  echo "  - Service disabled"
fi

# Remove systemd service file
echo "[2/4] Removing systemd service..."
if [ -f /etc/systemd/system/lcd-control.service ]; then
  rm -f /etc/systemd/system/lcd-control.service
  systemctl daemon-reload
  echo "  - Removed /etc/systemd/system/lcd-control.service"
else
  echo "  - Service file not found (skipped)"
fi

# Remove scripts and service files
echo "[3/4] Removing scripts and files..."
if [ -f /usr/local/bin/lcd_off ]; then
  rm -f /usr/local/bin/lcd_off
  echo "  - Removed /usr/local/bin/lcd_off"
fi

if [ -f /usr/local/bin/lcd_on ]; then
  rm -f /usr/local/bin/lcd_on
  echo "  - Removed /usr/local/bin/lcd_on"
fi

if [ -d /opt/lcd-control ]; then
  rm -rf /opt/lcd-control
  echo "  - Removed /opt/lcd-control/"
fi

# Remove config directory
echo "[4/4] Removing configuration..."
if [ -d /etc/lcd-control ]; then
  rm -rf /etc/lcd-control
  echo "  - Removed /etc/lcd-control/"
fi

echo ""
echo "=== Uninstallation Complete ==="
echo ""
echo "The LCD control service has been completely removed."
echo ""
