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
 *   GET    /api/system/info
 *     → 200 {"id","host","name","type","serviceName","hardware","variant"}
 *   GET    /api/system/device
 *     → 200 {"uuid","name"}
 *   GET    /api/network/status
 *     → 200 {"type","ip","ssid","strength","interface"}
 *   GET    /api/audio/bitperfect
 *     → 200 {"status","issues","warnings","config"}
 *   GET    /api/audio/dsd
 *     → 200 {"mode","success","error"?}
 *   GET    /api/audio/mixer
 *     → 200 {"enabled","success","error"?}
 *   POST   /api/audio/dsd          body {mode: "native"|"dop"}
 *     → 200 {"mode","success"} | 400 invalid mode | 500 write/restart failure
 */

const http = require('http');
const { exec, execSync, execFile } = require('child_process');
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

// Quiet variant of execFile: resolves with trimmed stdout or '' on error/timeout.
function execFileQuiet(cmd, args, timeoutMs = 1500) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs }, (err, stdout) => {
      resolve(err ? '' : stdout.toString().trim());
    });
  });
}

// --- Audio config helpers (ported from audio_config.go) ---

// matchConfigValue checks if a config setting has a specific value.
// Mirrors matchConfigValue() in audio_config.go lines 429-446.
function matchConfigValue(config, setting, value) {
  const lines = config.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#')) continue;
    if (line.startsWith(setting)) {
      let rest = line.slice(setting.length).trimStart();
      const expectedValue = '"' + value + '"';
      if (rest.startsWith(expectedValue) || rest === expectedValue) {
        return true;
      }
    }
  }
  return false;
}

// extractConfigValue extracts the value for a config setting (inside double quotes).
// Mirrors extractConfigValue() in audio_config.go lines 449-469.
function extractConfigValue(config, setting) {
  const lines = config.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#')) continue;
    if (line.startsWith(setting)) {
      let rest = line.slice(setting.length).trimStart();
      const start = rest.indexOf('"');
      if (start !== -1) {
        const end = rest.indexOf('"', start + 1);
        if (end !== -1) {
          return rest.slice(start + 1, end);
        }
      }
    }
  }
  return '';
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
    const [hostname, model] = await Promise.all([
      execFileQuiet('hostname', []),
      fs.promises.readFile('/proc/device-tree/model', 'utf8').then(s => s.replace(/\0/g, '').trim()).catch(() => 'Raspberry Pi'),
    ]);
    if (!hostname) console.warn('[m1e] hostname lookup returned empty string');
    const payload = {
      id: hostname,
      host: hostname,
      name: hostname,
      type: 'audio_player',
      serviceName: 'stellar',
      hardware: model,
      variant: 'stellar-pi',
    };
    sendJson(res, 200, payload);
  } catch (e) {
    sendJson(res, 500, { error: e.message, code: 'system_info_failed' });
  }
}

async function handleSystemDevice(req, res) {
  try {
    const [machineId, hostname] = await Promise.all([
      fs.promises.readFile('/etc/machine-id', 'utf8').then(s => s.trim()).catch(() => ''),
      execFileQuiet('hostname', []),
    ]);
    const uuid = machineId || hostname || '';
    sendJson(res, 200, { uuid, name: hostname || 'Stellar' });
  } catch (e) {
    sendJson(res, 500, { error: e.message, code: 'system_device_failed' });
  }
}

async function handleNetworkStatus(req, res) {
  try {
    // Default-route interface
    let iface = '';
    const routeRaw = await execFileQuiet('ip', ['-j', 'route', 'get', '1.1.1.1']);
    try {
      const route = JSON.parse(routeRaw);
      iface = (route[0] && route[0].dev) || '';
    } catch {}

    // IPv4 address on that interface
    let ip = '';
    if (iface) {
      const addrRaw = await execFileQuiet('ip', ['-j', 'addr', 'show', 'dev', iface]);
      try {
        const addrs = JSON.parse(addrRaw);
        const inet = (addrs[0] && addrs[0].addr_info || []).find(a => a.family === 'inet');
        ip = (inet && inet.local) || '';
      } catch {}
    }

    // Wi-Fi metadata (only for wireless interfaces)
    let type = 'ethernet';
    let ssid = '';
    let strength = 0;
    const isWifi = iface.startsWith('wlan') || iface.startsWith('wl');
    if (isWifi) {
      type = 'wifi';
      ssid = await execFileQuiet('iwgetid', ['-r']);
      const iwconfigOut = await execFileQuiet('iwconfig', [iface]);
      const m = iwconfigOut.match(/Signal level=(-?\d+)\s*dBm/);
      if (m) {
        const dbm = parseInt(m[1], 10);
        // Convert dBm to 0-100 percentage (rough: -50dBm=100, -100dBm=0)
        strength = Math.max(0, Math.min(100, 2 * (dbm + 100)));
      }
    }

    sendJson(res, 200, { type, ip, ssid, strength, interface: iface });
  } catch (e) {
    sendJson(res, 500, { error: e.message, code: 'network_status_failed' });
  }
}

// --- Audio handlers (M1.E) ---
// Response shapes mirror Go structs: BitPerfectStatus, DsdModeResponse, MixerModeResponse.
// Algorithms ported verbatim from audio_config.go (GetBitPerfectStatus,
// CheckBitPerfectFromConfig, GetDsdMode, GetMixerMode).

async function handleAudioBitperfect(req, res) {
  try {
    // Read configs gracefully — on failure continue with empty string (matches Go warn+continue).
    let mpdConfig = '';
    try {
      mpdConfig = await fs.promises.readFile('/etc/mpd.conf', 'utf8');
    } catch (e) {
      console.warn('[m1e] Failed to read /etc/mpd.conf:', e.message);
    }

    let alsaConfig = '';
    try {
      alsaConfig = await fs.promises.readFile('/etc/asound.conf', 'utf8');
    } catch (_) {}

    const aplayOutput = await execFileQuiet('aplay', ['-l']);

    const result = { status: 'ok', issues: [], warnings: [], config: [] };

    // Check 1: MPD resampler
    if (mpdConfig.includes('resampler')) {
      if (mpdConfig.includes('plugin') && (mpdConfig.includes('soxr') || mpdConfig.includes('libsamplerate'))) {
        result.issues.push('MPD: Resampler is enabled - audio will be resampled');
      }
    } else {
      result.config.push('MPD: No resampler configured (good)');
    }

    // Check 2: Volume normalization
    if (mpdConfig.includes('volume_normalization') && mpdConfig.includes('"yes"')) {
      if (matchConfigValue(mpdConfig, 'volume_normalization', 'yes')) {
        result.issues.push('MPD: Volume normalization is enabled - audio will be modified');
      }
    } else {
      result.config.push('MPD: Volume normalization disabled (good)');
    }

    // Check 3: Direct hardware output
    if (mpdConfig.includes('device') && mpdConfig.includes('"hw:')) {
      const device = extractConfigValue(mpdConfig, 'device');
      if (device !== '' && device.startsWith('hw:')) {
        result.config.push('MPD: Direct hardware output: ' + device + ' (good)');
      }
    } else if (mpdConfig.includes('device') && mpdConfig.includes('"volumio"')) {
      result.issues.push("MPD: Using 'volumio' device (goes through plug layer)");
    } else if (mpdConfig !== '') {
      result.warnings.push('MPD: Could not determine audio device');
    }

    // Check 4: Auto conversion settings
    for (const setting of ['auto_resample', 'auto_format', 'auto_channels']) {
      if (matchConfigValue(mpdConfig, setting, 'no')) {
        result.config.push(setting + ': disabled (good)');
      } else if (matchConfigValue(mpdConfig, setting, 'yes')) {
        result.issues.push(setting + ': enabled - audio may be converted');
      }
    }

    // Check 5: DSD playback mode
    if (matchConfigValue(mpdConfig, 'dop', 'yes')) {
      result.warnings.push('DSD over PCM (DoP): enabled - consider native DSD for true bit-perfect');
    } else if (matchConfigValue(mpdConfig, 'dop', 'no')) {
      result.config.push('DSD: Native DSD mode (DoP disabled) - true bit-perfect DSD');
    } else if (mpdConfig !== '') {
      result.config.push('DSD: DoP not configured (native DSD assumed)');
    }

    // Check 6: Mixer type
    if (matchConfigValue(mpdConfig, 'mixer_type', 'none')) {
      result.config.push('Mixer: disabled (bit-perfect volume)');
    } else if (matchConfigValue(mpdConfig, 'mixer_type', 'software')) {
      result.warnings.push('Mixer: software mixing enabled (not bit-perfect)');
    }

    // Check 7: ALSA config
    if (alsaConfig !== '') {
      if (alsaConfig.includes('type') && alsaConfig.includes('plug')) {
        result.warnings.push("ALSA: 'plug' type detected - may convert formats");
      }
      if (alsaConfig.includes('type') && alsaConfig.includes('hw')) {
        result.config.push('ALSA: Direct hardware access configured (good)');
      }
    }

    // Check 8: USB DAC presence (Singxer SU-6)
    if (aplayOutput !== '') {
      if (aplayOutput.includes('U20SU6') || aplayOutput.includes('SU-6') || aplayOutput.includes('SU6')) {
        result.config.push('Hardware: Singxer SU-6 detected (native DSD capable)');
      } else {
        result.warnings.push('Hardware: Singxer SU-6 not detected');
      }
    }

    // Determine overall status
    if (result.issues.length > 0) {
      result.status = 'error';
    } else if (result.warnings.length > 0) {
      result.status = 'warning';
    } else {
      result.status = 'ok';
    }

    sendJson(res, 200, result);
  } catch (e) {
    sendJson(res, 500, { status: 'error', issues: ['handler exception: ' + e.message], warnings: [], config: [] });
  }
}

async function handleAudioDsd(req, res) {
  try {
    let content;
    try {
      content = await fs.promises.readFile('/etc/mpd.conf', 'utf8');
    } catch (_) {
      return sendJson(res, 200, { mode: 'native', success: false, error: 'Failed to read MPD config' });
    }

    let mode = 'native';
    if (content.includes('dop')) {
      // 13 spaces between dop and "yes" — matches the Go source literal exactly
      if (content.includes('dop             "yes"') || content.includes('dop "yes"')) {
        mode = 'dop';
      }
    }

    sendJson(res, 200, { mode, success: true });
  } catch (e) {
    sendJson(res, 200, { mode: 'native', success: false, error: e.message });
  }
}

async function handleAudioMixer(req, res) {
  try {
    let content;
    try {
      content = await fs.promises.readFile('/etc/mpd.conf', 'utf8');
    } catch (_) {
      return sendJson(res, 200, { enabled: false, success: false, error: 'Failed to read MPD config' });
    }

    let enabled = false;
    const lines = content.split('\n');
    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('mixer_type')) {
        if (trimmed.includes('"software"')) {
          enabled = true;
        }
        break; // early termination on first mixer_type match (mirrors Go break)
      }
    }

    sendJson(res, 200, { enabled, success: true });
  } catch (e) {
    sendJson(res, 200, { enabled: false, success: false, error: e.message });
  }
}

// POST /api/audio/dsd — Set DSD playback mode. Body: {mode: "native"|"dop"}
// Ports SetDsdMode() from audio_config.go:519-573.
// Service runs as root — no sudo. Idempotency: skip write+restart if content unchanged (D6).
async function handleAudioDsdWrite(req, res) {
  let body;
  try { body = await parseBody(req); } catch (_) { body = {}; }
  const mode = body.mode;
  if (mode !== 'native' && mode !== 'dop') {
    return sendJson(res, 400, { mode: mode || '', success: false, error: "Invalid mode. Must be 'native' or 'dop'", code: 'invalid_input' });
  }

  let content;
  try {
    content = await fs.promises.readFile('/etc/mpd.conf', 'utf8');
  } catch (e) {
    return sendJson(res, 500, { mode, success: false, error: 'Failed to read MPD config: ' + e.message, code: 'dsd_read_failed' });
  }

  const dopValue = mode === 'dop' ? 'yes' : 'no';
  let newContent = content;

  // Mirror the four replace attempts in SetDsdMode() (audio_config.go:543-557):
  if (content.includes('dop             "yes"')) {
    newContent = content.replace('dop             "yes"', 'dop             "' + dopValue + '"');
  } else if (content.includes('dop             "no"')) {
    newContent = content.replace('dop             "no"', 'dop             "' + dopValue + '"');
  } else if (content.includes('dop "yes"')) {
    newContent = content.replace('dop "yes"', 'dop "' + dopValue + '"');
  } else if (content.includes('dop "no"')) {
    newContent = content.replace('dop "no"', 'dop "' + dopValue + '"');
  } else {
    return sendJson(res, 500, { mode, success: false, error: 'Could not find dop setting in MPD config', code: 'dsd_setting_not_found' });
  }

  // Idempotency check (D6): skip write + restart if content unchanged.
  if (newContent === content) {
    console.log('[m1e1] DSD mode already set to', mode, '— no write needed');
    return sendJson(res, 200, { mode, success: true });
  }

  try {
    await fs.promises.writeFile('/etc/mpd.conf', newContent, 'utf8');
  } catch (e) {
    return sendJson(res, 500, { mode, success: false, error: 'Failed to write MPD config: ' + e.message, code: 'dsd_write_failed' });
  }

  const restartOut = await execFileQuiet('systemctl', ['restart', 'mpd'], 30000);
  if (restartOut === '' || restartOut === undefined) {
    // execFileQuiet returns '' on error, but systemctl restart mpd produces no stdout on success either.
    // Check via is-active to distinguish.
    const active = await execFileQuiet('systemctl', ['is-active', 'mpd'], 3000);
    if (active !== 'active') {
      return sendJson(res, 500, { mode, success: false, error: 'Config updated but MPD failed to restart', code: 'dsd_restart_failed' });
    }
  }

  console.log('[m1e1] DSD mode set to', mode);
  sendJson(res, 200, { mode, success: true });
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
    if (req.method === 'GET' && u.pathname === '/api/network/status') {
      return await handleNetworkStatus(req, res);
    }
    if (req.method === 'GET' && u.pathname === '/api/audio/bitperfect') {
      return await handleAudioBitperfect(req, res);
    }
    if (req.method === 'GET' && u.pathname === '/api/audio/dsd') {
      return await handleAudioDsd(req, res);
    }
    if (req.method === 'GET' && u.pathname === '/api/audio/mixer') {
      return await handleAudioMixer(req, res);
    }
    if (req.method === 'POST' && u.pathname === '/api/audio/dsd') {
      return await handleAudioDsdWrite(req, res);
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
