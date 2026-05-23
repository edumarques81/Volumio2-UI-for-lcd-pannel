#!/usr/bin/env node
/**
 * Stellar Mount Control Service
 *
 * HTTP service exposing NAS mount/discover operations to a remote Mac
 * backend. Mirrors the lcd-control.service shape: bearer-token auth,
 * LAN bind, systemd-supervised.
 *
 * Endpoints (all require X-Auth-Token header):
 *   GET    /api/mount/shares?host=<ip>&username=<u>&password=<p>
 *     → 200 {"shares":[{"name","type","comment","writable"}]}
 *     → 401 if missing token; 502 with {code,message} for HOST_UNREACHABLE / AUTH_REQUIRED / BROWSE_FAILED
 *   GET    /api/mount/devices
 *     → 200 {"devices":[{"name","ip","hostname"}]} (avahi-browse _smb._tcp)
 *   POST   /api/mount             body {ip, share, fstype, mountpoint, username?, password?, options?}
 *     → 200 {"success":true} on mount.cifs/mount.nfs success
 *     → 500 {"success":false,"error":"..."} on failure
 *   POST   /api/mount/unmount     body {mountpoint}
 *   GET    /api/mount/is-mounted?path=<mp>
 *     → 200 {"mounted": true|false}
 *   POST   /api/mount/mountpoint  body {path}    → mkdir -p
 *   DELETE /api/mount/mountpoint?path=<p>        → rmdir
 *   POST   /api/mount/symlink     body {source, target}
 *   DELETE /api/mount/symlink?path=<p>
 */

const http = require('http');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.MOUNT_CONTROL_PORT || 8082;
const TOKEN_FILE = process.env.MOUNT_CONTROL_TOKEN_FILE || '/etc/stellar-mount-control/token';
const EXEC_TIMEOUT_MS = 10000;
const DISCOVER_TIMEOUT_MS = 6000;

// Load auth token
let AUTH_TOKEN = null;
try {
  AUTH_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  console.log(`[mount-control] Auth token loaded from ${TOKEN_FILE}`);
} catch (err) {
  console.warn(`[mount-control] WARNING: no token file at ${TOKEN_FILE}: ${err.message}`);
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token'
  });
  res.end(JSON.stringify(body));
}

function checkAuth(req) {
  if (!AUTH_TOKEN) return true; // dev mode
  return req.headers['x-auth-token'] === AUTH_TOKEN;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => buf += c);
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
    });
  });
}

function execAsync(cmd, timeoutMs = EXEC_TIMEOUT_MS) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

function shellQuote(s) {
  // Single-quote for shell, escaping any embedded single-quotes
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// --- Handlers ---

async function browseShares(host, username, password) {
  if (!host) {
    return { status: 400, body: { code: 'BAD_REQUEST', message: 'host required' } };
  }
  let creds = '-N'; // no auth
  if (username && password) {
    creds = `-U ${shellQuote(username + '%' + password)}`;
  } else if (username) {
    creds = `-U ${shellQuote(username)}`;
  }
  const cmd = `smbclient -L //${shellQuote(host)} ${creds} -g 2>&1`;
  const { err, stdout } = await execAsync(cmd, DISCOVER_TIMEOUT_MS);
  if (err) {
    const out = stdout.toLowerCase();
    if (out.includes('logon_failure') || out.includes('access_denied')) {
      return { status: 502, body: { code: 'AUTH_REQUIRED', message: 'authentication required' } };
    }
    if (out.includes('connection_refused') || out.includes('host_unreachable') || out.includes('no route')) {
      return { status: 502, body: { code: 'HOST_UNREACHABLE', message: `host unreachable: ${host}` } };
    }
    return { status: 502, body: { code: 'BROWSE_FAILED', message: err.message } };
  }
  // smbclient -g output rows: "Disk|ShareName|Comment"
  const shares = [];
  for (const line of stdout.split('\n')) {
    const parts = line.split('|');
    if (parts.length < 2) continue;
    const type = parts[0].trim().toLowerCase();
    const name = parts[1].trim();
    if (!name || name === 'IPC$' || name === 'ADMIN$' || name === 'C$') continue;
    if (type !== 'disk' && type !== 'printer') continue;
    shares.push({
      name,
      type,
      comment: (parts[2] || '').trim(),
      writable: type === 'disk',
    });
  }
  return { status: 200, body: { shares } };
}

async function discoverDevices() {
  // avahi-browse is the standard Linux equivalent of macOS dns-sd -B
  const cmd = `timeout 5 avahi-browse -t -r -p _smb._tcp 2>/dev/null`;
  const { stdout } = await execAsync(cmd, DISCOVER_TIMEOUT_MS);
  const devices = [];
  const seen = new Set();
  // avahi-browse -p rows starting with '=' are resolved entries:
  //   =;eth0;IPv4;NAS_Music;_smb._tcp;local;nas.local;192.168.86.26;445;
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('=')) continue;
    const parts = line.split(';');
    if (parts.length < 8) continue;
    const name = parts[3];
    const hostname = parts[6];
    const ip = parts[7];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    devices.push({ name, ip, hostname });
  }
  return { status: 200, body: { devices } };
}

async function mountShare(body) {
  const { ip, share, fstype, mountpoint, username = '', password = '', options = '' } = body;
  if (!ip || !share || !fstype || !mountpoint) {
    return { status: 400, body: { success: false, error: 'ip, share, fstype, mountpoint required' } };
  }
  let cmd;
  if (fstype === 'cifs' || fstype === 'smbfs') {
    const opts = [`uid=mpd`, `gid=audio`, `iocharset=utf8`];
    if (username) opts.push(`username=${username}`);
    if (password) opts.push(`password=${password}`);
    if (options) opts.push(options);
    cmd = `mount -t cifs //${shellQuote(ip)}/${shellQuote(share)} ${shellQuote(mountpoint)} -o ${shellQuote(opts.join(','))} 2>&1`;
  } else if (fstype === 'nfs') {
    cmd = `mount -t nfs ${shellQuote(ip + ':' + share)} ${shellQuote(mountpoint)} 2>&1`;
  } else {
    return { status: 400, body: { success: false, error: `unsupported fstype: ${fstype}` } };
  }
  const { err, stdout } = await execAsync(cmd);
  if (err) return { status: 500, body: { success: false, error: stdout || err.message } };
  return { status: 200, body: { success: true } };
}

async function unmountShare(body) {
  const { mountpoint } = body;
  if (!mountpoint) return { status: 400, body: { success: false, error: 'mountpoint required' } };
  const { err, stdout } = await execAsync(`umount ${shellQuote(mountpoint)} 2>&1`);
  if (err) return { status: 500, body: { success: false, error: stdout || err.message } };
  return { status: 200, body: { success: true } };
}

function isMounted(query) {
  const mp = query.path;
  if (!mp) return { status: 400, body: { mounted: false, error: 'path required' } };
  try {
    execSync(`mountpoint -q ${shellQuote(mp)}`);
    return { status: 200, body: { mounted: true } };
  } catch (e) {
    return { status: 200, body: { mounted: false } };
  }
}

async function createMountPoint(body) {
  const { path: p } = body;
  if (!p) return { status: 400, body: { success: false, error: 'path required' } };
  const { err, stdout } = await execAsync(`mkdir -p ${shellQuote(p)} 2>&1`);
  if (err) return { status: 500, body: { success: false, error: stdout || err.message } };
  return { status: 200, body: { success: true } };
}

async function removeMountPoint(query) {
  const p = query.path;
  if (!p) return { status: 400, body: { success: false, error: 'path required' } };
  const { err, stdout } = await execAsync(`rmdir ${shellQuote(p)} 2>&1`);
  if (err) return { status: 500, body: { success: false, error: stdout || err.message } };
  return { status: 200, body: { success: true } };
}

async function createSymlink(body) {
  const { source, target } = body;
  if (!source || !target) return { status: 400, body: { success: false, error: 'source + target required' } };
  // mkdir -p parent, rm existing target, ln -s
  const parent = path.dirname(target);
  const cmd = `mkdir -p ${shellQuote(parent)} && rm -f ${shellQuote(target)} && ln -s ${shellQuote(source)} ${shellQuote(target)} 2>&1`;
  const { err, stdout } = await execAsync(cmd);
  if (err) return { status: 500, body: { success: false, error: stdout || err.message } };
  return { status: 200, body: { success: true } };
}

async function removeSymlink(query) {
  const p = query.path;
  if (!p) return { status: 400, body: { success: false, error: 'path required' } };
  // Refuse if exists but isn't a symlink (matches darwin impl semantics)
  let stat;
  try { stat = fs.lstatSync(p); } catch (e) {
    if (e.code === 'ENOENT') return { status: 200, body: { success: true } };
    return { status: 500, body: { success: false, error: e.message } };
  }
  if (!stat.isSymbolicLink()) {
    return { status: 400, body: { success: false, error: `not a symlink: ${p}` } };
  }
  try { fs.unlinkSync(p); return { status: 200, body: { success: true } }; }
  catch (e) { return { status: 500, body: { success: false, error: e.message } }; }
}

// --- System power handlers (M1.D) ---
// Mac-resident stellar proxies system:shutdown / system:reboot socket events
// through these endpoints so the action lands on the audio appliance (Pi),
// not on the backend host (Mac). Service runs as root, so no sudo needed.
// `?dry=1` returns success without executing — used to verify the chain end
// to end without actually powering off the streamer.

async function systemAction(action, query) {
  const cmd = action === 'reboot' ? 'shutdown -r now' : 'shutdown -h now';
  const dry = query.dry === '1' || query.dry === 'true';
  if (dry) {
    console.log(`[mount-control] system:${action} dry-run (would: ${cmd})`);
    return { status: 200, body: { success: true, dry: true, action } };
  }
  // Defer the exec so the HTTP response flushes first — without this the
  // caller often sees a connection reset instead of the 200.
  setTimeout(() => {
    console.log(`[mount-control] executing: ${cmd}`);
    exec(cmd, (err) => {
      if (err) console.error(`[mount-control] ${action} failed: ${err.message}`);
    });
  }, 100);
  return { status: 200, body: { success: true, action } };
}

async function handleSystemInfo(req, res) {
  try {
    const { execFile } = require('child_process');
    const exec = (cmd, args) => new Promise((resolve) => {
      execFile(cmd, args, { timeout: 1500 }, (err, stdout) => {
        resolve(err ? '' : stdout.toString().trim());
      });
    });
    const fs = require('fs').promises;
    const [hostname, model] = await Promise.all([
      exec('hostname', []),
      fs.readFile('/proc/device-tree/model', 'utf8').then(s => s.replace(/\0/g, '').trim()).catch(() => 'Raspberry Pi'),
    ]);
    const payload = {
      id: hostname,
      host: hostname,
      name: hostname,
      type: 'audio_player',
      serviceName: 'stellar',
      hardware: model,
      variant: 'stellar-pi',
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message, code: 'system_info_failed' }));
  }
}

async function handleSystemDevice(req, res) {
  try {
    const fs = require('fs').promises;
    const { execFile } = require('child_process');
    const exec = (cmd, args) => new Promise((resolve) => {
      execFile(cmd, args, { timeout: 1500 }, (err, stdout) => {
        resolve(err ? '' : stdout.toString().trim());
      });
    });
    const [machineId, hostname] = await Promise.all([
      fs.readFile('/etc/machine-id', 'utf8').then(s => s.trim()).catch(() => ''),
      exec('hostname', []),
    ]);
    const uuid = machineId || hostname || '';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ uuid, name: hostname || 'Stellar' }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message, code: 'system_device_failed' }));
  }
}

// --- Router ---

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  console.log(`[mount-control] ${req.method} ${u.pathname}`);

  if (req.method === 'OPTIONS') { sendJson(res, 204, null); return; }

  if (!checkAuth(req)) {
    sendJson(res, 401, { error: 'Unauthorized - invalid or missing X-Auth-Token header' });
    return;
  }

  try {
    const q = Object.fromEntries(u.searchParams.entries());
    if (req.method === 'GET' && u.pathname === '/api/mount/shares') {
      const r = await browseShares(q.host, q.username, q.password); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'GET' && u.pathname === '/api/mount/devices') {
      const r = await discoverDevices(); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'POST' && u.pathname === '/api/mount') {
      const body = await parseBody(req); const r = await mountShare(body); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'POST' && u.pathname === '/api/mount/unmount') {
      const body = await parseBody(req); const r = await unmountShare(body); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'GET' && u.pathname === '/api/mount/is-mounted') {
      const r = isMounted(q); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'POST' && u.pathname === '/api/mount/mountpoint') {
      const body = await parseBody(req); const r = await createMountPoint(body); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'DELETE' && u.pathname === '/api/mount/mountpoint') {
      const r = await removeMountPoint(q); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'POST' && u.pathname === '/api/mount/symlink') {
      const body = await parseBody(req); const r = await createSymlink(body); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'DELETE' && u.pathname === '/api/mount/symlink') {
      const r = await removeSymlink(q); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'POST' && u.pathname === '/api/system/shutdown') {
      const r = await systemAction('shutdown', q); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'POST' && u.pathname === '/api/system/reboot') {
      const r = await systemAction('reboot', q); return sendJson(res, r.status, r.body);
    }
    if (req.method === 'GET' && u.pathname === '/api/system/info') {
      return await handleSystemInfo(req, res);
    }
    if (req.method === 'GET' && u.pathname === '/api/system/device') {
      return await handleSystemDevice(req, res);
    }
    if (u.pathname === '/' || u.pathname === '/api') {
      return sendJson(res, 200, {
        service: 'stellar-mount-control',
        version: '1.0.0',
        auth: AUTH_TOKEN ? 'required (X-Auth-Token)' : 'disabled',
      });
    }
    sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('[mount-control] handler error:', e);
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[mount-control] listening on port ${PORT} (auth: ${AUTH_TOKEN ? 'enabled' : 'disabled'})`);
});

process.on('SIGTERM', () => { console.log('[mount-control] SIGTERM'); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { console.log('[mount-control] SIGINT');  server.close(() => process.exit(0)); });
