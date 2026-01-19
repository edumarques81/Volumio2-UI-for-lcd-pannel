#!/bin/bash

# Volumio Svelte POC - Deployment Script
# Usage: ./deploy.sh [VOLUMIO_IP] [VOLUMIO_PASSWORD]

set -e

# Configuration
VOLUMIO_IP="${1:-192.168.86.22}"
VOLUMIO_PASSWORD="${2:-volumio}"
VOLUMIO_USER="volumio"
POC_PORT="8080"
POC_DIR="~/volumio-poc"

echo "=========================================="
echo "Volumio Svelte POC Deployment"
echo "=========================================="
echo "Target: ${VOLUMIO_USER}@${VOLUMIO_IP}"
echo "POC Port: ${POC_PORT}"
echo ""

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "Error: sshpass is not installed."
    echo "Install with: brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

# Build the project
echo "[1/5] Building production bundle..."
npm run build

# Create directory on Raspberry Pi
echo "[2/5] Creating directory on Raspberry Pi..."
sshpass -p "${VOLUMIO_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VOLUMIO_USER}@${VOLUMIO_IP} "mkdir -p ${POC_DIR}"

# Copy files
echo "[3/5] Copying files to Raspberry Pi..."
sshpass -p "${VOLUMIO_PASSWORD}" scp -o StrictHostKeyChecking=no -r dist/* ${VOLUMIO_USER}@${VOLUMIO_IP}:${POC_DIR}/

# Stop existing server if running
echo "[4/5] Stopping existing POC server (if any)..."
sshpass -p "${VOLUMIO_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VOLUMIO_USER}@${VOLUMIO_IP} "pkill -f 'python3 -m http.server' 2>/dev/null; pkill -f 'busybox httpd' 2>/dev/null || true"

# Start HTTP server (busybox httpd - more efficient than Python)
echo "[5/5] Starting busybox httpd on port ${POC_PORT}..."
sshpass -p "${VOLUMIO_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VOLUMIO_USER}@${VOLUMIO_IP} "cd ${POC_DIR} && nohup busybox httpd -f -p ${POC_PORT} -h . > /dev/null 2>&1 &"

# Verify
sleep 2
RESULT=$(sshpass -p "${VOLUMIO_PASSWORD}" ssh -o StrictHostKeyChecking=no ${VOLUMIO_USER}@${VOLUMIO_IP} "ss -tlnp 2>/dev/null | grep ${POC_PORT}" || echo "")

if [ -n "$RESULT" ]; then
    echo ""
    echo "=========================================="
    echo "Deployment Successful!"
    echo "=========================================="
    echo ""
    echo "Access URLs:"
    echo "  Original Volumio UI: http://${VOLUMIO_IP}"
    echo "  Svelte POC:          http://${VOLUMIO_IP}:${POC_PORT}"
    echo ""
else
    echo ""
    echo "Warning: Could not verify server is running."
    echo "Check manually with: ssh ${VOLUMIO_USER}@${VOLUMIO_IP}"
fi
