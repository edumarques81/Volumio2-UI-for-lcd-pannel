# Session Context - Volumio POC

## Last Updated
2026-01-22

## Environment Setup

### IMPORTANT: localhost vs Raspberry Pi
- **localhost** = macOS development machine (your computer)
- **192.168.86.34** = Raspberry Pi running Volumio with LCD panel (1920x440)

### Raspberry Pi Status
- **Cleaned up** - All POC files removed from `/home/volumio/`
- **Rebooted** - Fresh start
- **Kiosk URL reset** to `http://localhost:8080` (no `?layout=lcd`)

### Ports on Raspberry Pi
| Service | Port | Description |
|---------|------|-------------|
| POC Frontend | 8080 | busybox httpd (needs files deployed to `/home/volumio/svelte-poc`) |
| Stellar Backend | 3002 | Go backend (needs binary deployed to `/home/volumio/stellar`) |
| MPD | 6600 | Music Player Daemon |

## Project Repositories

### 1. Frontend (Svelte POC)
- **Location**: `/Users/eduardomarques/workspace/Volumio2-UI/volumio-poc`
- **Branch**: `feature/add-version-info`
- **Build**: `npm run build` → outputs to `dist/`
- **Deploy**: Copy `dist/*` to Pi at `/home/volumio/svelte-poc/`

### 2. Backend (Stellar)
- **Location**: `/Users/eduardomarques/workspace/stellar-volumio-audioplayer-backend`
- **Branch**: `feature/add-version-info`
- **Build**: `GOOS=linux GOARCH=arm64 go build -o stellar-arm64 ./cmd/stellar`
- **Deploy**: Copy `stellar-arm64` to Pi at `/home/volumio/stellar`

## Recent Work Completed

### Version Feature (Complete)
1. ✅ Backend version package (`internal/version/version.go`) with tests
2. ✅ Backend startup banner shows version
3. ✅ Socket.IO `getVersion` event handler → emits `pushVersion`
4. ✅ REST endpoint `/api/v1/version`
5. ✅ Frontend version store (`src/lib/stores/version.ts`) with tests
6. ✅ Settings UI shows version info (Settings → System → Version Info)

### Responsive Layout Feature (In Progress)
- Added device detection (`src/lib/utils/deviceDetection.ts`)
- Created `LCDLayout.svelte` for LCD panel (1920x440)
- Created `MobileLayout.svelte` for phones/tablets
- **Issue**: User wants LCD panel to keep original layout, only mobile/tablet to use responsive
- **Solution Added**: URL param `?layout=lcd` forces LCD layout
- Kiosk script at `/opt/volumiokiosk.sh` can use `?layout=lcd` for Pi

## Deployment Commands

```bash
# Build and deploy frontend
cd /Users/eduardomarques/workspace/Volumio2-UI/volumio-poc
npm run build
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "mkdir -p /home/volumio/svelte-poc"
sshpass -p 'volumio' scp -o StrictHostKeyChecking=no -r dist/* volumio@192.168.86.34:/home/volumio/svelte-poc/

# Build and deploy backend
cd /Users/eduardomarques/workspace/stellar-volumio-audioplayer-backend
GOOS=linux GOARCH=arm64 go build -o stellar-arm64 ./cmd/stellar
sshpass -p 'volumio' scp -o StrictHostKeyChecking=no stellar-arm64 volumio@192.168.86.34:/home/volumio/stellar
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "chmod +x /home/volumio/stellar && nohup /home/volumio/stellar -port 3002 > /home/volumio/stellar.log 2>&1 &"

# Clear kiosk cache and restart
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "echo 'volumio' | sudo -S rm -rf /data/volumiokiosk/Default/Cache/* && echo 'volumio' | sudo -S systemctl restart volumio-kiosk"

# Check backend logs
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "tail -f /home/volumio/stellar.log"
```

## To Force LCD Layout on Kiosk

If you want the kiosk to always use LCD layout:

```bash
sshpass -p 'volumio' ssh -o StrictHostKeyChecking=no volumio@192.168.86.34 "echo 'volumio' | sudo -S sed -i 's|KIOSK_URL:-http://localhost:8080|KIOSK_URL:-http://localhost:8080?layout=lcd|' /opt/volumiokiosk.sh"
```

## Pending Work

1. **Fix responsive layout** - Ensure LCD panel uses original layout by default
2. **Deploy and test** version feature on Pi
3. **Test mobile/tablet** layouts on actual devices

## Plan File
See `/Users/eduardomarques/.claude/plans/synchronous-zooming-eagle.md` for full implementation plan (Phases 1-7).

## Git Branches
- Frontend: `feature/add-version-info` (uncommitted changes for device detection URL param)
- Backend: `feature/add-version-info` (version feature complete)
