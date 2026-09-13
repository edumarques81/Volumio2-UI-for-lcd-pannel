#!/bin/bash

# Volumio Kiosk Switcher
# Usage: ./switch-kiosk.sh [poc|original]
#
# Switches the Volumio kiosk display between:
# - poc: Svelte POC on port 8080
# - original: Original Volumio UI on port 3000

set -e

VOLUMIO_IP="${VOLUMIO_IP:-192.168.86.22}"
VOLUMIO_PASSWORD="${VOLUMIO_PASSWORD:-volumio}"

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "Error: sshpass is not installed."
    echo "Install with: brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

case "$1" in
  poc)
    echo "=========================================="
    echo "Switching to Svelte POC"
    echo "=========================================="
    echo "Updating kiosk script..."
    sshpass -p "$VOLUMIO_PASSWORD" ssh -o StrictHostKeyChecking=no volumio@$VOLUMIO_IP "echo '$VOLUMIO_PASSWORD' | sudo -S sed -i 's|localhost:3000|localhost:8080|g' /opt/volumiokiosk.sh"
    sshpass -p "$VOLUMIO_PASSWORD" ssh -o StrictHostKeyChecking=no volumio@$VOLUMIO_IP "echo '$VOLUMIO_PASSWORD' | sudo -S sed -i 's|127.0.0.1/3000|127.0.0.1/8080|g' /opt/volumiokiosk.sh"
    ;;
  original)
    echo "=========================================="
    echo "Switching to Original Volumio UI"
    echo "=========================================="
    echo "Restoring original kiosk script..."
    sshpass -p "$VOLUMIO_PASSWORD" ssh -o StrictHostKeyChecking=no volumio@$VOLUMIO_IP "echo '$VOLUMIO_PASSWORD' | sudo -S cp /opt/volumiokiosk.sh.backup /opt/volumiokiosk.sh"
    ;;
  status)
    echo "=========================================="
    echo "Kiosk Status"
    echo "=========================================="
    sshpass -p "$VOLUMIO_PASSWORD" ssh -o StrictHostKeyChecking=no volumio@$VOLUMIO_IP "systemctl status volumio-kiosk --no-pager" || true
    echo ""
    echo "Current kiosk URL:"
    sshpass -p "$VOLUMIO_PASSWORD" ssh -o StrictHostKeyChecking=no volumio@$VOLUMIO_IP "grep 'http://localhost' /opt/volumiokiosk.sh"
    exit 0
    ;;
  *)
    echo "Volumio Kiosk Switcher"
    echo ""
    echo "Usage: $0 [poc|original|status]"
    echo ""
    echo "Commands:"
    echo "  poc       - Switch to Svelte POC (port 8080)"
    echo "  original  - Switch to original Volumio UI (port 3000)"
    echo "  status    - Show current kiosk status and URL"
    echo ""
    echo "Environment variables:"
    echo "  VOLUMIO_IP       - Volumio device IP (default: 192.168.86.22)"
    echo "  VOLUMIO_PASSWORD - Volumio password (default: volumio)"
    exit 1
    ;;
esac

echo "Restarting kiosk service..."
sshpass -p "$VOLUMIO_PASSWORD" ssh -o StrictHostKeyChecking=no volumio@$VOLUMIO_IP "echo '$VOLUMIO_PASSWORD' | sudo -S systemctl restart volumio-kiosk"

sleep 3

echo ""
echo "=========================================="
echo "Done!"
echo "=========================================="
echo ""
echo "Kiosk is now displaying: $1"
echo ""
echo "Access URLs:"
echo "  Original Volumio UI: http://${VOLUMIO_IP}"
echo "  Svelte POC:          http://${VOLUMIO_IP}:8080"
