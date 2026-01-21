#!/bin/bash
#
# LCD Control Service Installer for Raspberry Pi
# Run as root: sudo bash install-lcd-control.sh
#
# ============================================================================
# WARNING: This script is intended to run ONLY on a Raspberry Pi running
#          Volumio with a connected LCD display. Do NOT run this on your
#          local development machine (Mac/Linux desktop).
#
#          This script will:
#          - Install system services
#          - Create files in /opt, /etc, /usr/local/bin
#          - Register a systemd service
#
#          To undo changes, run: sudo bash uninstall-lcd-control.sh
# ============================================================================
#

set -e

echo "=== LCD Control Service Installer ==="
echo ""
echo "WARNING: This script should ONLY run on a Raspberry Pi!"
echo "         Do NOT run this on your local development machine."
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
  echo "ERROR: Please run as root (sudo bash install-lcd-control.sh)"
  exit 1
fi

# Create directories
echo "[1/6] Creating directories..."
mkdir -p /opt/lcd-control
mkdir -p /etc/lcd-control
mkdir -p /usr/local/bin

# Create lcd_off script
echo "[2/6] Creating lcd_off script..."
cat > /usr/local/bin/lcd_off << 'SCRIPT'
#!/bin/bash
export DISPLAY=:0
for auth in /tmp/serverauth.*; do
  if [ -f "$auth" ]; then
    export XAUTHORITY="$auth"
    break
  fi
done
xset dpms force off
SCRIPT
chmod +x /usr/local/bin/lcd_off

# Create lcd_on script
echo "[3/6] Creating lcd_on script..."
cat > /usr/local/bin/lcd_on << 'SCRIPT'
#!/bin/bash
export DISPLAY=:0
for auth in /tmp/serverauth.*; do
  if [ -f "$auth" ]; then
    export XAUTHORITY="$auth"
    break
  fi
done
xset dpms force on
SCRIPT
chmod +x /usr/local/bin/lcd_on

# Create the Node.js service
echo "[4/6] Creating LCD control service..."
cat > /opt/lcd-control/service.js << 'SERVICE'
#!/usr/bin/env node
const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');

const PORT = 8081;
const TOKEN_FILE = '/etc/lcd-control/token';

let AUTH_TOKEN = null;
try {
  AUTH_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  console.log('[lcd-control] Auth token loaded');
} catch (err) {
  console.warn('[lcd-control] No token file, running without auth');
}

let screenState = 'on';

function runCommand(cmd, callback) {
  const env = { ...process.env, DISPLAY: ':0' };
  try {
    const authFiles = fs.readdirSync('/tmp').filter(f => f.startsWith('serverauth.'));
    if (authFiles.length > 0) env.XAUTHORITY = `/tmp/${authFiles[0]}`;
  } catch (e) {}
  exec(cmd, { env }, callback);
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Auth check
  if (AUTH_TOKEN && req.headers['x-auth-token'] !== AUTH_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const url = req.url;

  if (req.method === 'GET' && url === '/api/screen/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: screenState }));
  } else if (req.method === 'POST' && url === '/api/screen/off') {
    runCommand('/usr/local/bin/lcd_off', (err) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      } else {
        screenState = 'off';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, status: 'off' }));
      }
    });
  } else if (req.method === 'POST' && url === '/api/screen/on') {
    runCommand('/usr/local/bin/lcd_on', (err) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      } else {
        screenState = 'on';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, status: 'on' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[lcd-control] Listening on port ${PORT}`);
});
SERVICE
chmod +x /opt/lcd-control/service.js

# Create auth token
echo "[5/6] Creating auth token..."
echo "volumio-lcd-control" > /etc/lcd-control/token
chmod 600 /etc/lcd-control/token

# Create systemd service
echo "[6/6] Creating systemd service..."
cat > /etc/systemd/system/lcd-control.service << 'SYSTEMD'
[Unit]
Description=LCD Control Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/lcd-control/service.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SYSTEMD

# Enable and start service
systemctl daemon-reload
systemctl enable lcd-control
systemctl start lcd-control

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Service status:"
systemctl status lcd-control --no-pager
echo ""
echo "Test with:"
echo "  curl -H 'X-Auth-Token: volumio-lcd-control' http://localhost:8081/api/screen/status"
echo ""
