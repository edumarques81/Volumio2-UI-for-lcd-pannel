#!/bin/bash
#
# Deploy Volumio POC to Raspberry Pi
# Usage: ./deploy-to-pi.sh [user@host] [destination_path]
#
# Example: ./deploy-to-pi.sh volumio@192.168.86.34 /home/volumio/volumio-poc
#

set -e

# Default values
PI_HOST="${1:-volumio@192.168.86.34}"
DEST_PATH="${2:-/home/volumio/volumio-poc}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Volumio POC Deployment ==="
echo ""
echo "Target: $PI_HOST:$DEST_PATH"
echo "Source: $PROJECT_DIR"
echo ""

# Check if dist exists, build if not
if [ ! -d "$PROJECT_DIR/dist" ]; then
  echo "[1/4] Building project..."
  cd "$PROJECT_DIR"
  npm run build
else
  echo "[1/4] Using existing build in dist/"
fi

# Create destination directory on Pi
echo "[2/4] Creating destination directory on Pi..."
ssh "$PI_HOST" "mkdir -p $DEST_PATH"

# Copy built files
echo "[3/4] Copying built files to Pi..."
scp -r "$PROJECT_DIR/dist/"* "$PI_HOST:$DEST_PATH/"

# Copy install/uninstall scripts
echo "[4/4] Copying LCD control scripts..."
scp "$PROJECT_DIR/scripts/install-lcd-control.sh" "$PI_HOST:/tmp/"
scp "$PROJECT_DIR/scripts/uninstall-lcd-control.sh" "$PI_HOST:/tmp/"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Files deployed to: $PI_HOST:$DEST_PATH"
echo ""
echo "Next steps on the Pi:"
echo "  1. Install LCD control service:"
echo "     sudo bash /tmp/install-lcd-control.sh"
echo ""
echo "  2. Serve the POC (if not using existing web server):"
echo "     cd $DEST_PATH && npx serve -l 8080"
echo ""
echo "  3. Or configure your web server to serve from $DEST_PATH"
echo ""
