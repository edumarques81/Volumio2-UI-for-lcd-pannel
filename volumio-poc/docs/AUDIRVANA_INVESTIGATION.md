# Audirvana Studio Linux Integration Investigation

**Date**: 2026-01-25
**Version Investigated**: Audirvana Studio 2.11.6 (ARM64)
**Target Platform**: Raspberry Pi 5 (Debian Bookworm)

---

## Executive Summary

Audirvana Studio for Linux provides **limited integration options** for third-party applications. The primary control mechanism uses a **proprietary binary protocol** not documented publicly. However, we CAN integrate at the **discovery and detection level**.

### What We CAN Do
- Detect Audirvana installation and running state
- Discover Audirvana instances via mDNS (`_audirvana-ap._tcp`)
- Read service metadata (port, protocol version, OS)
- Share music library folders between our app and Audirvana

### What We CANNOT Do (Without Reverse Engineering)
- Send playback commands (play/pause/stop/etc.)
- Read playback status (current track, position, state)
- Control volume or queue
- Subscribe to event streams

---

## 1. Investigation Findings

### 1.1 Package Contents Analysis

**Package**: `audirvana-studio_2.11.6_arm64.deb` (28.9 MB)

| Artifact | Location | Purpose |
|----------|----------|---------|
| Main Binary | `/opt/audirvana/studio/audirvanaStudio` | Core application (33.6 MB) |
| Service Script | `/opt/audirvana/studio/setAsService.sh` | Enable/disable systemd service |
| Systemd Unit | `/opt/audirvana/studio/share/etc/audirvanaStudio.service` | Service definition |
| Libraries | `/opt/audirvana/studio/lib*.so` | Bundled dependencies (ICU, TagLib, etc.) |
| SMB Helper | `/opt/audirvana/studio/smb_mount_helper` | Network share mounting |
| Locales | `/opt/audirvana/studio/share/locale/` | UI translations (de, en, es, fr, ja, zh_CN) |

**Dependencies**:
- `libasound2`, `libavahi-client3`, `libavahi-common3`
- `libc6`, `libcurl4`, `libgcc-s1`, `libstdc++6`
- `libudev1`, `libxml2`

### 1.2 Runtime Services

**Systemd Service**: `audirvanaStudio.service`
```ini
[Unit]
Description=Run audirvanaStudio
DefaultDependencies=no
After=avahi-daemon.service

[Service]
Type=simple
User=eduardo  # configurable
Group=audio
WorkingDirectory=/opt/audirvana/studio
ExecStart=/opt/audirvana/studio/audirvanaStudio
Restart=always

[Install]
WantedBy=default.target
```

**Process Details**:
- PID: 6448
- Memory: ~31 MB RSS
- CPU: <1% idle
- Threads: 68

**Open Files/Sockets**:
| Type | Path/Port | Purpose |
|------|-----------|---------|
| Unix Socket | `/tmp/com.audirvana.audirvanaStudio.lock` | Single-instance lock |
| TCP | `*:39887` (dynamic) | Remote server for mobile app |

### 1.3 Network Discovery (mDNS)

**Service Type**: `_audirvana-ap._tcp`

**Discovered Service**:
```
Service: stellar
Type: _audirvana-ap._tcp
Domain: local
Hostname: stellar.local
Address: 192.168.86.34
Port: 39887
TXT Records:
  - protovers=4.1.0
  - osversion=Linux
  - txtvers=1
```

**Discovery Command**:
```bash
avahi-browse -r _audirvana-ap._tcp --terminate
```

### 1.4 Control Protocol Analysis

**Port**: Dynamic (49152+), advertised via mDNS
**Protocol**: **Proprietary Binary** (NOT HTTP/REST/WebSocket)

**Evidence from Binary Analysis**:
```
Transport::Session::sendStatus
Transport::Session::do_read
Audirvana::Transport::IoRunner
asio::local::stream_protocol  # Unix domain sockets
reactive_socket_service       # Async I/O
```

**HTTP Probe Result**:
```
$ curl -v http://127.0.0.1:39887/
* Connected to 127.0.0.1 port 39887
> GET / HTTP/1.1
< Empty reply from server
curl: (52) Empty reply from server
```

**Conclusion**: The remote server does NOT speak HTTP. It uses a custom binary protocol.

### 1.5 UPnP Capabilities

Audirvana acts as a **UPnP Control Point** (not a renderer):

**Supported UPnP Services** (from binary strings):
- `urn:schemas-upnp-org:service:ConnectionManager:1`
- `urn:schemas-upnp-org:service:AVTransport:1`
- `urn:schemas-upnp-org:service:RenderingControl:1`
- `urn:schemas-wiimu-com:service:PlayQueue:1`

This means Audirvana can **stream TO** UPnP renderers, but does not **expose** a UPnP interface for control.

### 1.6 Configuration Files

| File | Location | Format |
|------|----------|--------|
| User Config | `~/.config/audirvana/audirvana-studio.ini` | INI |
| Admin Config | `~/.config/audirvana/adminconfig.json` | JSON |
| Database | `~/.local/share/audirvana/*.db` | SQLite |
| Logs | `~/.local/share/audirvana/audirvana_studio.log` | Text |

**Admin Config Options** (from binary):
```json
{
  "remoteServerPort": 49152,
  "upnpServerPort": 49153
}
```

---

## 2. Integration Strategy

### 2.1 Recommended: Detection + Status Only

**Feasibility**: HIGH
**Complexity**: LOW
**Risk**: NONE

We implement:
1. mDNS discovery of Audirvana instances
2. Process detection (systemd service status)
3. Port/version metadata extraction
4. Installation detection

**What users get**:
- "Audirvana Studio is running on stellar.local:39887"
- Protocol version and OS information
- Service health monitoring

### 2.2 Alternative: Shared Music Library

**Feasibility**: HIGH
**Complexity**: LOW
**Risk**: NONE

Both Audirvana and our app can point to the same music folders:
- NAS shares mounted at `/home/eduardo/Music`
- Local storage paths
- Audirvana indexes independently

**Limitation**: No real-time sync of playlists/favorites.

### 2.3 Future: UPnP Renderer Mode

**Feasibility**: MEDIUM
**Complexity**: HIGH
**Risk**: LOW

Our app could expose itself as a UPnP renderer. Then:
- Audirvana can stream to our app
- We control playback locally

This is an advanced feature for later.

---

## 3. Implementation Plan

### Milestone 1: Detection & Discovery (MVP)

**Files to Create**:
- `volumio-poc/src/lib/services/audirvana.ts` - Service module
- `volumio-poc/src/lib/stores/audirvana.ts` - Svelte store
- `volumio-poc/src/lib/services/__tests__/audirvana.test.ts` - Unit tests

**Features**:
1. Parse `avahi-browse` output to find Audirvana instances
2. Detect service running via systemctl
3. Expose status endpoint: `GET /integrations/audirvana/status`

**Response Format**:
```typescript
interface AudiorvanaStatus {
  installed: boolean;
  running: boolean;
  instances: AudiorvanaInstance[];
}

interface AudiorvanaInstance {
  name: string;
  hostname: string;
  address: string;
  port: number;
  protocol_version: string;
  os: string;
}
```

### Milestone 2: Backend Integration

**Files to Modify**:
- `stellar-volumio-audioplayer-backend/internal/domain/audirvana/` - New domain
- `stellar-volumio-audioplayer-backend/internal/transport/socketio/handlers.go` - Add handlers

**Socket.IO Events**:
| Emit | Receive | Description |
|------|---------|-------------|
| `getAudirvanaStatus` | `pushAudirvanaStatus` | Get detection status |

---

## 4. Commands Reference

### Service Management
```bash
# Enable service (creates systemd unit)
sudo /opt/audirvana/studio/setAsService.sh enable eduardo

# Start/stop/status
sudo /opt/audirvana/studio/setAsService.sh start
sudo /opt/audirvana/studio/setAsService.sh stop
sudo /opt/audirvana/studio/setAsService.sh status

# Disable (removes systemd unit)
sudo /opt/audirvana/studio/setAsService.sh disable
```

### Discovery
```bash
# Find Audirvana instances on network
avahi-browse -r _audirvana-ap._tcp --terminate

# Check if service is running
systemctl is-active audirvanaStudio

# Get service port from mDNS
avahi-browse -rp _audirvana-ap._tcp --terminate | grep "^=" | cut -d';' -f9
```

### Diagnostics
```bash
# View logs
journalctl -u audirvanaStudio -f

# Check open ports
ss -lntup | grep audirvana

# Check process
ps aux | grep audirvanaStudio
```

---

## 5. Appendix: Binary Strings of Interest

```
_audirvana-ap._tcp              # mDNS service type
Transport::Session::sendStatus  # Status broadcast function
upnpRenderer                    # UPnP renderer discovery
adminconfig.json                # Config file name
remoteServerPort                # Port config key
protovers=4.1.0                 # Current protocol version
```

---

## 6. References

- [Audirvana Headless Pi Guide](https://community.audirvana.com/t/step-by-step-headless-audirvana-studio-on-raspberry-pi-os-64bit/41802)
- [Audirvana Linux Download](https://audirvana.com/download-linux/)
- [Audirvana Forum - Port Discussion](https://community.audirvana.com/t/audirvana-studio-linux-port/41066)
