#!/bin/bash

# Stellar Volumio Deploy Script
# Usage: ./deploy.sh [pi-ip-address]

PI_IP="${1:-192.168.86.22}"
PI_USER="volumio"
PI_PASS="volumio"
REMOTE_DIR="/home/volumio/stellar-volumio"

echo "Building Stellar Volumio..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "📦 Deploying to $PI_USER@$PI_IP:$REMOTE_DIR..."
sshpass -p "$PI_PASS" scp -o StrictHostKeyChecking=no -r dist/* "$PI_USER@$PI_IP:$REMOTE_DIR/"

if [ $? -eq 0 ]; then
    echo "✅ Deployed successfully!"
    echo "🌐 Access at: http://$PI_IP:8080"
else
    echo "❌ Deploy failed"
    exit 1
fi
