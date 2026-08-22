#!/bin/bash
# Deploy script for Volumio POC UI
# Uses rsync for efficient incremental updates

PI_HOST="${VOLUMIO_PI_HOST:-192.168.86.34}"
PI_USER="${VOLUMIO_PI_USER:-volumio}"
PI_PASS="${VOLUMIO_PI_PASS:-volumio}"
REMOTE_PATH="/home/volumio/svelte-poc"

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
