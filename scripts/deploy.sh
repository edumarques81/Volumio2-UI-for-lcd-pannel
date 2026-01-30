#!/bin/bash
# Deploy script for Stellar Volumio UI
# Uses rsync for efficient incremental updates

# Load .env file if it exists
if [ -f .env ]; then
    source .env
fi

PI_HOST="${RASPBERRY_PI_API_ADDRESS:-192.168.4.58}"
PI_USER="${RASPBERRY_PI_SSH_USERNAME:-eduardo}"
PI_PASS="${RASPBERRY_PI_SSH_PASSWORD:-volumio}"
REMOTE_PATH="/home/${PI_USER}/stellar-volumio"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building...${NC}"
npm run build || exit 1

echo -e "${YELLOW}Deploying to ${PI_USER}@${PI_HOST}:${REMOTE_PATH}${NC}"
sshpass -p "$PI_PASS" rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    dist/ "${PI_USER}@${PI_HOST}:${REMOTE_PATH}/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deploy complete!${NC}"
    echo "View at: http://${PI_HOST}:8080"
else
    echo "Deploy failed!"
    exit 1
fi
