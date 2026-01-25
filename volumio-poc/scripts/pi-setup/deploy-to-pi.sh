#!/bin/bash
# ============================================================
# Deploy Stellar to Raspberry Pi
# ============================================================
#
# This script deploys the frontend and optionally the backend
# to a configured Raspberry Pi.
#
# Usage:
#   ./deploy-to-pi.sh [--backend]
#
# Requires .env file with:
#   RASPBERRY_PI_SSH_USERNAME
#   RASPBERRY_PI_SSH_PASSWORD
#   RASPBERRY_PI_API_ADDRESS
#   STELLAR_BACKEND_FOLDER (if deploying backend)
#
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Load .env
ENV_FILE="$PROJECT_ROOT/../../.env"
if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE="$PROJECT_ROOT/../.env"
fi
if [ ! -f "$ENV_FILE" ]; then
    log_error "No .env file found. Create one from .env-example"
    exit 1
fi

source "$ENV_FILE"

# Validate required vars
if [ -z "$RASPBERRY_PI_SSH_USERNAME" ] || [ -z "$RASPBERRY_PI_SSH_PASSWORD" ] || [ -z "$RASPBERRY_PI_API_ADDRESS" ]; then
    log_error "Missing required environment variables in .env"
    log_error "Required: RASPBERRY_PI_SSH_USERNAME, RASPBERRY_PI_SSH_PASSWORD, RASPBERRY_PI_API_ADDRESS"
    exit 1
fi

PI_USER="$RASPBERRY_PI_SSH_USERNAME"
PI_PASS="$RASPBERRY_PI_SSH_PASSWORD"
PI_HOST="$RASPBERRY_PI_API_ADDRESS"

SSH_CMD="sshpass -p '$PI_PASS' ssh -o StrictHostKeyChecking=no $PI_USER@$PI_HOST"
SCP_CMD="sshpass -p '$PI_PASS' scp -o StrictHostKeyChecking=no"
RSYNC_CMD="sshpass -p '$PI_PASS' rsync -avz --delete"

DEPLOY_BACKEND=false

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend)
            DEPLOY_BACKEND=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ============================================================
# Build Frontend
# ============================================================
log_info "Building frontend..."
cd "$PROJECT_ROOT"
npm run build

# ============================================================
# Deploy Frontend
# ============================================================
log_info "Deploying frontend to Pi..."
eval "$RSYNC_CMD dist/ $PI_USER@$PI_HOST:~/stellar-volumio/"

log_info "Restarting frontend service..."
eval "$SSH_CMD 'sudo systemctl restart stellar-frontend'"

# ============================================================
# Deploy Backend (optional)
# ============================================================
if [ "$DEPLOY_BACKEND" = true ]; then
    if [ -z "$STELLAR_BACKEND_FOLDER" ]; then
        log_error "STELLAR_BACKEND_FOLDER not set in .env"
        exit 1
    fi

    if [ ! -d "$STELLAR_BACKEND_FOLDER" ]; then
        log_error "Backend folder not found: $STELLAR_BACKEND_FOLDER"
        exit 1
    fi

    log_info "Building backend for ARM64..."
    cd "$STELLAR_BACKEND_FOLDER"
    GOOS=linux GOARCH=arm64 go build -o stellar-arm64 ./cmd/stellar

    log_info "Deploying backend to Pi..."
    eval "$SCP_CMD stellar-arm64 $PI_USER@$PI_HOST:~/stellar-backend/stellar"
    eval "$SSH_CMD 'chmod +x ~/stellar-backend/stellar'"

    log_info "Restarting backend service..."
    eval "$SSH_CMD 'sudo systemctl restart stellar-backend'"

    rm -f stellar-arm64
fi

# ============================================================
# Verify
# ============================================================
log_info "Waiting for services to start..."
sleep 3

log_info "Checking service status..."
eval "$SSH_CMD 'systemctl is-active stellar-frontend stellar-backend'"

log_info "============================================================"
log_info "Deployment complete!"
log_info "============================================================"
log_info "Frontend: http://$PI_HOST:8080"
log_info "Backend:  http://$PI_HOST:3000"
