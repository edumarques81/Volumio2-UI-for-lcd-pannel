#!/usr/bin/env node
/**
 * LCD Control Service
 *
 * A minimal HTTP service to control the LCD panel on/off state.
 * Requires token authentication for security.
 *
 * Endpoints:
 *   POST /api/screen/off   - Turn screen off
 *   POST /api/screen/on    - Turn screen on
 *   GET  /api/screen/status - Get current screen status
 *
 * Authentication:
 *   Header: X-Auth-Token: <token>
 *   Token is read from /etc/lcd-control/token
 */

const http = require('http');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.LCD_CONTROL_PORT || 8081;
const TOKEN_FILE = process.env.LCD_CONTROL_TOKEN_FILE || '/etc/lcd-control/token';
const LCD_OFF_SCRIPT = '/usr/local/bin/lcd_off';
const LCD_ON_SCRIPT = '/usr/local/bin/lcd_on';

// Load auth token
let AUTH_TOKEN = null;
try {
    AUTH_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    console.log(`[lcd-control] Auth token loaded from ${TOKEN_FILE}`);
} catch (err) {
    console.warn(`[lcd-control] WARNING: Could not load token from ${TOKEN_FILE}: ${err.message}`);
    console.warn('[lcd-control] Running WITHOUT authentication (not recommended for production)');
}

// Get X11 environment
function getX11Env() {
    const env = { ...process.env };
    env.DISPLAY = ':0';

    // Find XAUTHORITY
    try {
        const authFiles = fs.readdirSync('/tmp').filter(f => f.startsWith('serverauth.'));
        if (authFiles.length > 0) {
            env.XAUTHORITY = `/tmp/${authFiles[0]}`;
        }
    } catch (e) {
        env.XAUTHORITY = '/home/volumio/.Xauthority';
    }

    return env;
}

// Check screen status
function getScreenStatus() {
    try {
        const env = getX11Env();
        const output = execSync('xset q 2>/dev/null | grep "Monitor is"', {
            env,
            encoding: 'utf8',
            timeout: 5000
        });

        if (output.includes('Monitor is On')) {
            return 'on';
        } else if (output.includes('Monitor is Off')) {
            return 'off';
        }
        return 'unknown';
    } catch (err) {
        return 'unknown';
    }
}

// Execute LCD control script
function executeLcdScript(script, callback) {
    const env = getX11Env();

    exec(script, { env, timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[lcd-control] Script error: ${error.message}`);
            callback(false, error.message, stdout + stderr);
        } else {
            console.log(`[lcd-control] Script output: ${stdout}`);
            callback(true, null, stdout);
        }
    });
}

// Verify auth token
function checkAuth(req) {
    if (!AUTH_TOKEN) {
        return true; // No token configured, allow all (development mode)
    }

    const providedToken = req.headers['x-auth-token'];
    return providedToken === AUTH_TOKEN;
}

// Parse JSON body
function parseBody(req, callback) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            callback(null, body ? JSON.parse(body) : {});
        } catch (e) {
            callback(e, null);
        }
    });
}

// Send JSON response
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token'
    });
    res.end(JSON.stringify(data));
}

// Request handler
const server = http.createServer((req, res) => {
    const url = req.url;
    const method = req.method;

    console.log(`[lcd-control] ${method} ${url}`);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
    }

    // Check authentication for non-GET requests (allow status without auth)
    if (method !== 'GET' && !checkAuth(req)) {
        sendJson(res, 401, {
            success: false,
            error: 'Unauthorized - invalid or missing X-Auth-Token header'
        });
        return;
    }

    // Route handling
    if (url === '/api/screen/off' && method === 'POST') {
        executeLcdScript(LCD_OFF_SCRIPT, (success, error, output) => {
            sendJson(res, success ? 200 : 500, {
                success,
                status: success ? 'off' : 'error',
                error,
                output: output?.trim()
            });
        });

    } else if (url === '/api/screen/on' && method === 'POST') {
        executeLcdScript(LCD_ON_SCRIPT, (success, error, output) => {
            sendJson(res, success ? 200 : 500, {
                success,
                status: success ? 'on' : 'error',
                error,
                output: output?.trim()
            });
        });

    } else if (url === '/api/screen/status' && method === 'GET') {
        const status = getScreenStatus();
        sendJson(res, 200, {
            success: true,
            status,
            timestamp: new Date().toISOString()
        });

    } else if (url === '/' || url === '/api') {
        sendJson(res, 200, {
            service: 'lcd-control',
            version: '1.0.0',
            endpoints: {
                'POST /api/screen/off': 'Turn screen off',
                'POST /api/screen/on': 'Turn screen on',
                'GET /api/screen/status': 'Get screen status'
            },
            auth: AUTH_TOKEN ? 'required (X-Auth-Token header)' : 'disabled'
        });

    } else {
        sendJson(res, 404, {
            success: false,
            error: 'Not found'
        });
    }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[lcd-control] LCD Control Service running on port ${PORT}`);
    console.log(`[lcd-control] Auth: ${AUTH_TOKEN ? 'enabled' : 'disabled'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[lcd-control] Received SIGTERM, shutting down...');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('[lcd-control] Received SIGINT, shutting down...');
    server.close(() => process.exit(0));
});
