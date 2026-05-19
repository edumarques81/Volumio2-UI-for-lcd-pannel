#!/bin/bash
# stellar-mount-control installer for Raspberry Pi.
# Run as root on the Pi: sudo bash install-mount-control.sh
#
# WARNING: Pi-only. Installs files under /opt, /etc, /etc/systemd/system.
set -e

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run as root (sudo bash install-mount-control.sh)" >&2
  exit 1
fi

echo "=== Stellar Mount Control Installer ==="
echo "This installs:"
echo "  /opt/stellar-mount-control/mount-control-service.js"
echo "  /etc/stellar-mount-control/token (random, 32-byte hex)"
echo "  /etc/systemd/system/stellar-mount-control.service"
echo "  smbclient + cifs-utils packages (apt-get install)"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && { echo "Aborted."; exit 1; }

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/6] Installing apt dependencies..."
apt-get update
apt-get install -y nodejs smbclient cifs-utils avahi-utils

echo "[2/6] Creating directories..."
mkdir -p /opt/stellar-mount-control
mkdir -p /etc/stellar-mount-control
mkdir -p /mnt/NAS

echo "[3/6] Installing service.js..."
install -m 755 "${REPO_DIR}/pi-kiosk/mount-control-service.js" \
  /opt/stellar-mount-control/mount-control-service.js

echo "[4/6] Provisioning auth token..."
if [ ! -s /etc/stellar-mount-control/token ]; then
  TOKEN=$(openssl rand -hex 32)
  echo "$TOKEN" > /etc/stellar-mount-control/token
  chmod 600 /etc/stellar-mount-control/token
  echo ""
  echo "  → Generated new auth token. Copy this value into the Mac's"
  echo "    ~/.config/stellar-backend/env STELLAR_MOUNT_REMOTE_TOKEN field:"
  echo ""
  echo "    $TOKEN"
  echo ""
else
  echo "  → Token file already exists, leaving as-is."
fi

echo "[5/6] Installing systemd unit..."
install -m 644 "${REPO_DIR}/pi-kiosk/stellar-mount-control.service" \
  /etc/systemd/system/stellar-mount-control.service
systemctl daemon-reload

echo "[6/6] Enabling + starting service..."
systemctl enable stellar-mount-control
systemctl restart stellar-mount-control
sleep 1
systemctl status stellar-mount-control --no-pager | head -12

echo ""
echo "=== Done ==="
echo "Test:"
echo "  curl -H 'X-Auth-Token: \$(sudo cat /etc/stellar-mount-control/token)' \\"
echo "    http://localhost:8082/api/mount/devices"
