# Volumio Discovery & Authentication Investigation Report

**Date:** 2025-01-25
**Status:** Investigation Complete
**Author:** Claude Code Investigation Agent

---

## 1. EXECUTIVE SUMMARY

This investigation documents how Volumio implements:
1. **Network Discovery** - mDNS-based peer discovery for multi-room audio
2. **MyVolumio Authentication** - Firebase-based cloud authentication with custom tokens
3. **Device Pairing** - Socket.IO-based real-time connection between devices

### Key Findings

| Area | Protocol/Technology | Status |
|------|---------------------|--------|
| Local Discovery | mDNS via `node-mdns` library | Confirmed |
| Service Type | `_Volumio._tcp` on port 3000 | Confirmed |
| HTTP Discovery | Avahi `_http._tcp` on port 80 | Confirmed |
| Authentication | Firebase Auth + Custom Token API | Confirmed |
| Device Communication | Socket.IO 2.3.x on port 3000 | Confirmed |
| Cloud Endpoints | `functions.volumio.cloud` | Confirmed |

### Current Gap
Our Stellar backend (Go) does **NOT** advertise itself on the network. The Raspberry Pi's Avahi services directory is empty. To be discoverable by Volumio Connect apps, we must implement mDNS advertisement.

---

## 2. DISCOVERY MECHANISM

### 2.1 Confirmed Protocols

Volumio uses **three complementary network presence mechanisms**:

#### Tertiary: UPnP/DLNA Renderer (SSDP Discovery)
- **Daemon**: `upmpdcli` (UPnP Media Renderer)
- **Protocol**: SSDP (Simple Service Discovery Protocol) on UDP 1900
- **Device Type**: UPnP Media Renderer + OpenHome
- **Port**: SSDP multicast for discovery, HTTP for control
- **Config**: `/tmp/upmpdcli.conf` (generated from template)

This allows Volumio to appear as a DLNA/UPnP renderer for apps like BubbleUPnP, HiFi Cast, etc.

**upmpdcli Configuration** (from `/app/plugins/audio_interface/upnp/upmpdcli.conf.tmpl`):
```ini
openhome = 1                    # Enable OpenHome protocol
ohmanufacturername = Volumio
ohmodelname = Volumio
mpdport = 6599                  # Proxied MPD port
externalvolumecontrol = 1       # Volume via Volumio
```

**Service Control**:
```bash
systemctl start upmpdcli.service   # Start UPnP renderer
systemctl stop upmpdcli.service    # Stop UPnP renderer
```

---

Volumio also uses **two mDNS services**:

#### Primary: Custom "Volumio" Service (Peer Discovery)
- **Library**: `node-mdns` (npm package `mdns`)
- **Service Type**: `_Volumio._tcp`
- **Port**: 3000 (WebSocket/Socket.IO API)
- **TXT Records**:
  - `volumioName`: Device display name (e.g., "Living Room")
  - `UUID`: Unique device identifier

**Code Location**: `/volumio3-backend/app/plugins/system_controller/volumiodiscovery/index.js:163-207`

```javascript
// Advertisement creation
var txt_record = {
  volumioName: name,
  UUID: uuid
};
self.ad = mdns.createAdvertisement(mdns.tcp(serviceName), servicePort, {txtRecord: txt_record});
self.ad.start();
```

#### Secondary: HTTP Service (Browser Discovery)
- **Service Type**: `_http._tcp`
- **Port**: 80 (Web UI)
- **Configuration File**: `/etc/avahi/services/volumio.service`

**Code Location**: `/volumio3-backend/app/plugins/system_controller/system/index.js:516-528`

```xml
<?xml version="1.0" standalone="no"?>
<service-group>
  <name replace-wildcards="yes">Volumio</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
  </service>
</service-group>
```

### 2.2 Service Configuration

**File**: `/volumio3-backend/app/plugins/system_controller/volumiodiscovery/config.json`
```json
{
  "service": { "type": "string", "value": "Volumio" },
  "port": { "type": "number", "value": 3000 }
}
```

### 2.3 Discovery Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        mDNS Discovery Flow                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Device A (Startup)                    Network                           │
│  ─────────────────                     ───────                           │
│       │                                                                  │
│       ├─► Advertise _Volumio._tcp ─────────────► Multicast (224.0.0.251) │
│       │   Port: 3000                              UDP Port 5353          │
│       │   TXT: volumioName, UUID                                         │
│       │                                                                  │
│       ├─► Browse for _Volumio._tcp ◄───────────────────────────────────┤ │
│       │                                                                  │
│  Device B (Existing)                                                     │
│  ───────────────────                                                     │
│       │                                                                  │
│       ├─► Receives serviceUp event                                       │
│       │   - Extracts IP, port, TXT records                              │
│       │   - Stores in foundVolumioInstances                             │
│       │                                                                  │
│       └─► Connects via Socket.IO ──────────────► http://DeviceA:3000    │
│           - Emits 'initSocket' with own UUID                            │
│           - Emits 'getState'                                            │
│           - Listens for 'pushState'                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Why Devices Aren't Found Across Subnets

mDNS uses **multicast UDP** with TTL=1 by default (RFC 6762):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Multicast TTL=1 Behavior                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Subnet A (192.168.1.0/24)              Subnet B (192.168.2.0/24)        │
│  ─────────────────────────              ─────────────────────────        │
│                                                                          │
│   [Volumio]──multicast──►[Router]        [Phone App]                    │
│      │                      │                 │                         │
│      │   224.0.0.251:5353   │                 │                         │
│      │   TTL=1 (hops=1)     │   ✗ BLOCKED     │                         │
│      │                      ├─────────────────┤                         │
│      │                      │   TTL decrements│                         │
│      │                      │   to 0, dropped │                         │
│      │                      │                 │                         │
│   [Other Device] ◄─────────┤                 │                         │
│      ✓ RECEIVES            │                 │                         │
│      (same subnet)         │                 │                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Technical Details**:
- Packets sent to `224.0.0.251:5353` (IPv4) or `ff02::fb:5353` (IPv6)
- TTL=1 means packets are dropped after first hop
- Most home routers don't forward multicast between VLANs/subnets
- This is why "Volumio players only detect on 255.255.255.0 home LAN"

**Solutions**:
1. **Same Subnet**: Ensure all devices on same network (most common)
2. **mDNS Reflector**: `avahi-daemon` with `enable-reflector=yes` (requires router support)
3. **mDNS Proxy**: Run reflector on router (DD-WRT, OpenWrt)
4. **Manual IP**: Fall back to direct IP entry in app settings

### 2.5 Required Daemons/Services

**Complete Network Presence Stack**:

| Service | Daemon | Protocol | Port | Purpose |
|---------|--------|----------|------|---------|
| mDNS Discovery | `avahi-daemon` | mDNS | UDP 5353 | Peer device discovery |
| Volumio API | `node-mdns` | mDNS | TCP 3000 | Custom `_Volumio._tcp` service |
| HTTP Web UI | `avahi-daemon` | mDNS | TCP 80 | `_http._tcp` for browsers |
| UPnP Renderer | `upmpdcli` | SSDP | UDP 1900 | DLNA/OpenHome renderer |

**Verification Commands**:
```bash
# mDNS services
systemctl status avahi-daemon           # Check Avahi daemon
avahi-browse -a                         # List all mDNS services
avahi-browse -r _Volumio._tcp           # Find Volumio devices
avahi-browse -r _http._tcp              # Find web interfaces

# UPnP services
systemctl status upmpdcli               # Check UPnP renderer
gssdp-discover                          # List UPnP devices (if installed)
```

**Our Current Pi Status**:
```
avahi-daemon    ✓ Running (UDP 5353 open)
upmpdcli        ✗ Not installed
_Volumio._tcp   ✗ Not advertised (no service file)
_http._tcp      ✗ Not advertised (no service file)
```

---

## 3. AUTHENTICATION (MyVolumio)

### 3.1 Login Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MyVolumio Authentication Flow                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Browser/App                 Device Backend              Cloud           │
│  ───────────                 ──────────────              ─────           │
│       │                           │                         │            │
│  1. User enters email/password    │                         │            │
│       │                           │                         │            │
│  2. ├─► Firebase Auth ────────────────────────────────────►│            │
│       │  signInWithEmailAndPassword()     myvolumio.firebaseapp.com     │
│       │                           │                         │            │
│  3. ◄─┤ Firebase returns:         │                         │            │
│       │  - idToken (short-lived)  │                         │            │
│       │  - refreshToken           │                         │            │
│       │  - user UID               │                         │            │
│       │                           │                         │            │
│  4. ├─► Get custom token ─────────────────────────────────►│            │
│       │  GET functions.volumio.cloud/api/v1/getCustomToken  │            │
│       │  Header: idToken          │                         │            │
│       │                           │                         │            │
│  5. ◄─┤ Returns customToken (JWT) │                         │            │
│       │                           │                         │            │
│  6. ├─► Socket.IO emit ──────────►│                         │            │
│       │  'setMyVolumioToken'      │                         │            │
│       │  {token: customToken}     │                         │            │
│       │                           │                         │            │
│  7.   │                    Backend validates token          │            │
│       │                    Enables premium features         │            │
│       │                           │                         │            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Token Storage Locations

**Important**: Volumio uses **session tokens/keys** rather than storing passwords. Passwords are only used during initial Firebase authentication, then exchanged for tokens.

| Location | What's Stored | Purpose |
|----------|---------------|---------|
| Browser LocalStorage | Firebase auth state (idToken, refreshToken) | Frontend session persistence |
| Firebase Realtime DB | User profile (`/users/{uid}`) | User data (name, plan, etc.) |
| Device Backend (sharedVars) | `myvolumio.uid`, custom token | Authorizes premium features |
| `database.volumio.cloud` | Cloud playlists, settings | Premium cloud backup/sync |
| `functions.volumio.cloud` | Token validation | Issues custom tokens |

**Backend Shared Variables** (from `playlistManager.js`):
- `myVolumio.cloudDeviceEnabled` - Whether cloud sync is active
- `myvolumio.uid` - User's MyVolumio UID (or '0' if not logged in)

### 3.3 Cloud Endpoints

**All Volumio Cloud Endpoints** (from `utils/tests/checkRemoteEndpoints.js`):
| Endpoint | Purpose |
|----------|---------|
| `https://functions.volumio.cloud` | Cloud Functions API (auth, subscriptions) |
| `https://database.volumio.cloud` | Cloud data storage (playlists, settings) |
| `https://myvolumio.firebaseio.com` | Firebase Realtime DB (user profiles) |
| `http://plugins.volumio.org` | Plugin repository |
| `http://pushupdates.volumio.org` | Update notifications |
| `https://radio-directory.firebaseapp.com` | Internet radio directory |
| `http://cddb.volumio.org` | CD database |
| `https://browsing-performer.dfs.volumio.org` | Music metadata |

**Primary API Base URLs**:
- Production: `https://functions.volumio.cloud`
- Development: `https://functions-dev.volumio.cloud`

**API Endpoints**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/getCustomToken` | GET | Exchange Firebase idToken for custom token |
| `/api/v1/getSubscriptionCancelUrl` | GET | Get Stripe/Paddle cancel URL |
| `/api/v1/updateSubscription` | POST | Change subscription plan |
| `/api/v1/cancelSubscription` | POST | Cancel subscription |
| `/api/v1/enableMyVolumioDevice` | POST | Enable device for account |
| `/api/v1/disableMyVolumioDevice` | POST | Disable device |
| `/api/v1/deleteMyVolumioDevice` | POST | Remove device from account |

### 3.4 Firebase Configuration

**Production**:
```javascript
{
  apiKey: "AIzaSyDzEZmwJZS4KZtG9pEXOxlm1XcZikP0KbA",
  authDomain: "myvolumio.firebaseapp.com",
  databaseURL: "https://myvolumio.firebaseio.com",
  projectId: "myvolumio"
}
```

### 3.5 Socket.IO Authentication Events

| Event | Direction | Data | Purpose |
|-------|-----------|------|---------|
| `setMyVolumioToken` | Frontend→Backend | `{token: string}` | Send auth token to device |
| `getMyVolumioToken` | Frontend→Backend | - | Request token from device |
| `pushMyVolumioToken` | Backend→Frontend | `{token: string}` | Device sends token to frontend |
| `getMyVolumioStatus` | Frontend→Backend | - | Check if user logged in |
| `pushMyVolumioStatus` | Backend→Frontend | `{loggedIn, uid}` | Login status response |
| `myVolumioLogout` | Frontend→Backend | - | Notify backend of logout |
| `pushMyVolumioLogout` | Backend→Frontend | - | Force frontend logout |

### 3.6 Relevant Source Files

| File | Purpose |
|------|---------|
| `Volumio2-UI/src/app/services/myvolumio/auth.service.js` | Main auth orchestrator |
| `Volumio2-UI/src/app/services/myvolumio/angularfire.service.js` | Firebase wrapper |
| `Volumio2-UI/src/app/services/myvolumio/firebase-api-functions.service.js` | Cloud API calls |
| `Volumio2-UI/src/app/components/myvolumio/login/myvolumio-login.controller.js` | Login UI |

---

## 4. CONNECTION / PAIRING FLOW

### 4.1 Device-to-Device Connection

After mDNS discovery, devices establish Socket.IO connections:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Device Pairing Flow                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Device A (Discoverer)              Device B (Discovered)                │
│  ─────────────────────              ─────────────────────                │
│       │                                   │                              │
│  1. serviceUp event received              │                              │
│     - IP: 192.168.1.100                   │                              │
│     - UUID: abc-123                       │                              │
│     - Name: "Kitchen"                     │                              │
│       │                                   │                              │
│  2. ├─► Socket.IO connect ───────────────►│ http://192.168.1.100:3000   │
│       │                                   │                              │
│  3. ├─► emit('initSocket') ─────────────►│ {id: myUUID}                 │
│       │                                   │                              │
│  4. ├─► emit('getState') ───────────────►│                              │
│       │                                   │                              │
│  5. ◄─┤ on('pushState') ◄────────────────┤ {status, volume, track...}   │
│       │                                   │                              │
│  6. Store remote device state             │                              │
│     foundVolumioInstances[uuid] = state   │                              │
│       │                                   │                              │
│  7. ├─► emit('getMultiroomSyncOutput') ─►│                              │
│       │                                   │                              │
│  8. Push device list to UI                │                              │
│     pushMultiroomDevices(devices)         │                              │
│       │                                   │                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Connection URL Pattern

- **Local**: `http://<IP>:3000` (direct Socket.IO)
- **Cloud (MyVolumio)**: `https://<remote-host>` (via Firebase device list)

### 4.3 Device Identity (UUID)

- Each Volumio device has a unique UUID stored in `system.uuid`
- UUID is broadcast in mDNS TXT record
- UUID is used as key in `foundVolumioInstances` store
- UUID identifies device in Firebase for cloud access

### 4.4 Multiroom Sync Events

| Event | Purpose |
|-------|---------|
| `initSocket` | Register device UUID with remote |
| `getState` / `pushState` | Sync playback state |
| `pushMultiroomSyncOutput` | Sync audio output configuration |
| `enableMultiroomSyncOutput` | Enable synced playback |
| `disableMultiroomSyncOutput` | Disable synced playback |
| `getMultiroomSyncOutput` | Request sync output status |

### 4.5 Fallback Flows

1. **mDNS Fails**: User must enter IP manually in settings
2. **Socket.IO Timeout**: Auto-reconnect with exponential backoff
3. **Device Offline**: Marked as disconnected in UI, retried on `serviceUp`

---

## 5. IMPLEMENTATION PLAN (Milestones)

### M1: Advertise Discovery Service

**Goal**: Make our device discoverable by Volumio Connect apps

**Tasks**:
1. Install `avahi-daemon` on Pi (already running)
2. Create `/etc/avahi/services/stellar.service` with `_Volumio._tcp` service
3. OR implement mDNS advertisement in Go using `github.com/grandcat/zeroconf`
4. Broadcast TXT records: `volumioName`, `UUID`

**Avahi Service File** (recommended approach):
```xml
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">%h</name>
  <service>
    <type>_Volumio._tcp</type>
    <port>3002</port>
    <txt-record>volumioName=Stellar</txt-record>
    <txt-record>UUID=stellar-unique-id</txt-record>
  </service>
  <service>
    <type>_http._tcp</type>
    <port>8080</port>
  </service>
</service-group>
```

**Go Implementation** (alternative):
```go
import "github.com/grandcat/zeroconf"

server, _ := zeroconf.Register(
    "Stellar",           // Instance name
    "_Volumio._tcp",     // Service type
    "local.",            // Domain
    3002,                // Port
    []string{            // TXT records
        "volumioName=Stellar",
        "UUID=" + uuid,
    },
    nil,                 // Interfaces (nil = all)
)
defer server.Shutdown()
```

**Acceptance Criteria**:
- `avahi-browse -r _Volumio._tcp` shows our device
- Volumio Connect app discovers our device

---

### M2: Implement Compatible Control Endpoints

**Goal**: Respond to standard Volumio Socket.IO events

**Required Events** (already implemented in Stellar):
- [x] `getState` / `pushState`
- [x] `play`, `pause`, `stop`, `next`, `prev`
- [x] `volume`, `seek`
- [x] `getQueue` / `pushQueue`

**Additional Events for Multiroom**:
- [ ] `initSocket` - Accept incoming device connections
- [ ] `pushMultiroomSyncOutput` - Sync output status
- [ ] `getMultiRoomDevices` / `pushMultiRoomDevices`

**REST Endpoints** (for remote control apps):
- [ ] `GET /api/v1/commands?cmd=<command>` - Volumio REST API compatibility
- [ ] `GET /api/v1/getState` - REST state endpoint

---

### M3: Integrate MyVolumio Tokens

**Goal**: Accept MyVolumio authentication tokens

**Tasks**:
1. Implement `setMyVolumioToken` Socket.IO handler
2. Validate token with `functions.volumio.cloud` or locally
3. Store authenticated state in session
4. Implement `getMyVolumioStatus` / `pushMyVolumioStatus`

**Token Validation Options**:
- **Option A**: Call Volumio cloud to validate (requires internet)
- **Option B**: Decode JWT locally (requires public key from Volumio)
- **Option C**: Trust token if format is valid (less secure)

**Recommendation**: Start with Option A for compatibility, cache validation result.

---

### M4: UPnP/DLNA Renderer (Optional)

**Goal**: Allow third-party apps (BubbleUPnP, HiFi Cast) to stream to our device

**Options**:
1. **Install upmpdcli** (same as Volumio) - Requires MPD
2. **Implement UPnP AV Transport** in Go - Significant effort
3. **Skip** - Focus on mDNS discovery first

**Recommendation**: Defer to future milestone unless UPnP is a hard requirement.

---

### M5: Validate with iOS/Android

**Goal**: Confirm discovery and control works with official apps

**Test Matrix**:
| App | Platform | Test |
|-----|----------|------|
| Volumio Connect | iOS | mDNS discovery, playback control |
| Volumio Connect | Android | mDNS discovery, playback control |
| Volumio Web | Browser | Direct IP access |
| BubbleUPnP | Android | UPnP renderer discovery (if M4) |
| HiFi Cast | iOS | UPnP renderer discovery (if M4) |

---

## 6. TEST PLAN

### 6.1 Network Topology Tests

| Test | Setup | Expected |
|------|-------|----------|
| Same Subnet | Pi and phone on same WiFi | Device discovered in <5s |
| Different Subnet | Pi on eth0, phone on WiFi (different VLAN) | Device NOT discovered (expected) |
| Hotspot Active | Pi running AP mode | Device discoverable on AP network |
| mDNS Reflector | Router with mDNS proxy | Device discovered across subnets |

### 6.2 Discovery Tests

```bash
# On Mac/Linux (same network):
avahi-browse -r _Volumio._tcp

# Expected output:
# + eth0 IPv4 Stellar _Volumio._tcp local
# = eth0 IPv4 Stellar _Volumio._tcp local
#    hostname = [raspberrypi.local]
#    address = [192.168.86.34]
#    port = [3002]
#    txt = ["volumioName=Stellar" "UUID=stellar-uuid"]
```

### 6.3 Discovery Failure Cases

| Failure | Cause | Mitigation |
|---------|-------|------------|
| No devices found | Avahi not running | `sudo systemctl start avahi-daemon` |
| Name conflict | Duplicate service name | Use unique device name |
| Timeout | Network congestion | Increase browse timeout |
| Wrong port | Misconfigured service | Verify port in service file |

### 6.4 Authentication Tests

| Test | Action | Expected |
|------|--------|----------|
| Valid token | Send valid MyVolumio token | `pushMyVolumioStatus` with `loggedIn: true` |
| Invalid token | Send malformed token | `pushMyVolumioStatus` with `loggedIn: false` |
| Token expiry | Wait for token to expire | Auto-refresh or re-login prompt |
| Logout | Emit `myVolumioLogout` | Session cleared, `pushMyVolumioLogout` |

### 6.5 E2E Test Checklist

- [ ] Device appears in Volumio Connect app within 10 seconds
- [ ] Tapping device connects and shows Now Playing
- [ ] Play/Pause controls work
- [ ] Volume slider works
- [ ] Track info (title, artist, album art) displays correctly
- [ ] Queue is accessible and playable
- [ ] MyVolumio login works (if implementing M3)

---

## 7. WHAT WE NEED FROM THE USER

### Required for Implementation

1. **Decision on mDNS approach**:
   - Avahi service file (simpler, OS-level)
   - Go zeroconf library (more control, in-process)

2. **Device UUID strategy**:
   - Generate random UUID on first boot
   - Derive from hardware (MAC address, serial)
   - User-configurable

3. **MyVolumio integration priority**:
   - Essential for launch?
   - Can defer to later milestone?

### Nice to Have

4. **Access to Volumio Connect app source** (if available):
   - Would confirm exact discovery expectations
   - Currently reverse-engineered from backend code

5. **Test devices**:
   - iOS device with Volumio Connect
   - Android device with Volumio Connect
   - Another Volumio device for multiroom testing

---

## 8. ARCHITECTURAL RECOMMENDATIONS (From Review)

### 8.1 Critical: Socket.IO Version Compatibility (P0)

**Risk**: Stellar uses Socket.IO v3 (`github.com/zishang520/socket.io/v3`), but Volumio Connect apps use Socket.IO v2.x client. These have breaking protocol differences.

**Action Required Before Implementation**:
```bash
# Test v2 client compatibility with current Stellar server
# Create test script using socket.io-client v2.x
# Attempt connection to Stellar on port 3002
# Document which events work/fail
```

**Mitigation Options**:
1. Enable `allowEIO3` compatibility mode in Go Socket.IO library (if available)
2. Run separate Socket.IO v2 compatibility server on port 3000
3. Switch to Go Socket.IO v2 library

### 8.2 Port Strategy Decision (P0)

**Current**: Stellar serves on port 3002
**Volumio Standard**: Port 3000

**Options**:
- **A**: Change Stellar to port 3000 (breaking change for existing setups)
- **B**: Advertise port 3002 in mDNS (may not work if apps hardcode 3000)
- **C**: Run compatibility proxy on port 3000 → 3002

**Recommendation**: Test with Volumio Connect apps first to determine if non-3000 ports work.

### 8.3 mDNS Implementation: Go zeroconf Preferred

**Reasoning**:
1. **Lifecycle Management**: UUID and device name can change at runtime
2. **Single Source of Truth**: Configuration stays in Go application
3. **Health-Aware**: Can stop advertising when service unhealthy
4. **Testable**: Unit tests possible, unlike Avahi service files

**Hybrid Approach**:
- Avahi file for `_http._tcp` (static web UI)
- Go zeroconf for `_Volumio._tcp` (dynamic with TXT records)

### 8.4 Architecture Refactoring (P2)

The current `Server` struct in `server.go` is becoming a "God object". Before adding discovery and auth:

**Create Separate Packages**:
```
internal/
  discovery/
    mdns.go        # mDNS advertisement
    types.go
  auth/
    myvolumio.go   # MyVolumio token handling
    types.go
```

### 8.5 Multiroom Support Gap

The plan mentions multiroom events but doesn't detail:
- Maintaining Socket.IO connections to ALL discovered devices
- Bidirectional state synchronization
- Reconnection handling on failure

This is significant work not fully scoped.

---

## 9. RISKS & MITIGATIONS (Updated)

| Risk | Impact | Likelihood | Priority | Mitigation |
|------|--------|------------|----------|------------|
| **Socket.IO v2/v3 incompatibility** | Complete failure of Volumio Connect | Medium-High | P0 | Test early, have port fallback |
| **Port 3000 vs 3002 mismatch** | Apps can't connect | Medium | P0 | Test if apps accept non-3000 ports |
| Volumio changes service type | Discovery breaks | Low | P2 | Monitor releases |
| MyVolumio token format changes | Auth breaks | Low | P3 | Abstract validation |
| mDNS library issues | Build fails | Low | P2 | Avahi file fallback |
| Multicast blocked by network | Discovery fails | Medium | P2 | Document manual IP fallback |
| UUID conflicts | Device confusion | Medium | P2 | Hardware-derived UUID |
| mDNS name conflicts | Multiple "Stellar" devices | Medium | P2 | Implement getNewName collision handling |

---

## 9. APPENDIX: KEY SOURCE FILE REFERENCES

### Volumio2-UI (Frontend)

| File | Lines | Purpose |
|------|-------|---------|
| `src/app/services/myvolumio/auth.service.js` | 1-650 | Authentication orchestration |
| `src/app/services/myvolumio/angularfire.service.js` | 53-78 | Firebase config |
| `src/app/services/myvolumio/firebase-api-functions.service.js` | 126-140 | Token API |
| `src/app/services/socket.service.js` | 1-100 | Socket.IO wrapper |
| `src/app/services/device-endpoints.service.js` | 1-150 | Multi-device connection |
| `src/app/services/multi-room.service.js` | 1-100 | Multiroom management |

### Volumio3-Backend

| File | Lines | Purpose |
|------|-------|---------|
| `app/plugins/system_controller/volumiodiscovery/index.js` | 163-207 | mDNS advertisement |
| `app/plugins/system_controller/volumiodiscovery/index.js` | 209-309 | mDNS browsing |
| `app/plugins/system_controller/volumiodiscovery/index.js` | 327-383 | Remote Socket.IO connection |
| `app/plugins/system_controller/volumiodiscovery/config.json` | 1-11 | Service config |
| `app/plugins/system_controller/system/index.js` | 516-556 | Avahi HTTP service |

### Stellar Backend (Current)

| File | Lines | Purpose |
|------|-------|---------|
| `cmd/stellar/main.go` | 158-289 | HTTP/Socket.IO server |
| `internal/transport/socketio/server.go` | 72-105 | Socket.IO config |
| `internal/domain/sources/linux_discoverer.go` | 21-46 | NAS discovery (not service advertisement) |

---

*End of Investigation Report*
