# Audio Streamer Architecture Plan

## Overview

This document outlines the architecture for a production-grade audio streaming appliance built on Raspberry Pi 5, featuring:

- **Frontend**: Svelte 5 POC (1920x440 LCD + desktop/tablet support)
- **Backend**: Custom Golang backend replacing Volumio
- **Audio**: Bit-perfect playback up to PCM 384kHz/32-bit and DSD512

### Hardware Target

- **Raspberry Pi 5** (8GB recommended)
- **LCD**: 1920x440 touchscreen
- **DDC**: Singxer SU-6 (USB input → I2S output)
  - PCM: up to 384kHz/32-bit
  - DSD: up to DSD512 (22.5MHz) native
- **DAC**: SMSL DO300EX (I2S input)
  - Matching PCM/DSD capabilities

---

## Part 1: Bit-Perfect Audio Configuration

### Current State Analysis

Volumio's current configuration:
- `mixer_type: "None"` - Software volume disabled (good)
- `volume_normalization: "no"` - No normalization (good)
- ALSA uses `type plug` - **May cause resampling**
- `dop: "no"` - DSD over PCM disabled

### Requirements for Bit-Perfect

1. **Direct Hardware Access**: Bypass ALSA plug layer
2. **Native Sample Rates**: No resampling (44.1k, 48k, 88.2k, 96k, 176.4k, 192k, 352.8k, 384k)
3. **DSD Support**: Native DSD or DoP passthrough
4. **No Volume Processing**: Digital volume disabled
5. **Exclusive Device Access**: No mixing with system sounds

### Proposed ALSA Configuration

```conf
# /etc/asound.conf - Bit-perfect configuration

# Default PCM - direct hardware access
pcm.!default {
    type hw
    card "U20SU6"
    format S32_LE    # 32-bit for maximum quality
}

ctl.!default {
    type hw
    card "U20SU6"
}

# DoP (DSD over PCM) support
pcm.dop {
    type plug
    slave {
        pcm "hw:U20SU6"
        format DSD_U32_BE
    }
}
```

### Proposed MPD Configuration

```conf
# /etc/mpd.conf - Audiophile configuration

# Primary output - bit-perfect PCM
audio_output {
    type            "alsa"
    name            "Bit-Perfect USB"
    device          "hw:U20SU6"
    auto_resample   "no"
    auto_format     "no"
    auto_channels   "no"
    dop             "yes"           # Enable DSD over PCM
    mixer_type      "none"          # No software volume
}

# DSD native output (if supported)
audio_output {
    type            "alsa"
    name            "DSD Native"
    device          "hw:U20SU6"
    dsd_native      "yes"
    enabled         "no"            # Enable manually
}

# Audio quality settings
samplerate_converter    "soxr very high"  # Only if resampling needed
audio_buffer_size       "4096"            # Larger buffer for stability
buffer_before_play      "20%"
```

### UI Toggle for Quality Mode

Add to Settings > Playback:

| Option | Normal Mode | Audiophile Mode |
|--------|-------------|-----------------|
| Software Volume | Enabled | Disabled |
| Resampling | Auto | Disabled |
| DSD Mode | DoP | Native (if supported) |
| Buffer Size | 2048 KB | 4096 KB |
| Exclusive Access | No | Yes |

---

## Part 2: Golang Backend Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SVELTE FRONTEND                            │
│                    (1920x440 LCD Display)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket (port 3000)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GOLANG BACKEND                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   TRANSPORT LAYER                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │ Socket.io   │  │  REST API   │  │  Static Files   │   │  │
│  │  │ Server      │  │  (Gin)      │  │  Server         │   │  │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────────┘   │  │
│  └─────────┼────────────────┼───────────────────────────────┘  │
│            │                │                                   │
│  ┌─────────┼────────────────┼───────────────────────────────┐  │
│  │         ▼                ▼        SERVICE LAYER           │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │  Event Hub (pub/sub) ←→ State Manager            │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │       │                                                   │  │
│  │  ┌────┴────┬────────┬────────┬────────┬────────────┐     │  │
│  │  │         │        │        │        │            │     │  │
│  │  ▼         ▼        ▼        ▼        ▼            ▼     │  │
│  │ Player  Library   Queue  Playlist  System   Streaming    │  │
│  │ Service Service  Service Service  Service   Service      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 INFRASTRUCTURE LAYER                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │  │
│  │  │   MPD    │ │  SQLite  │ │  ALSA    │ │  GPIO    │     │  │
│  │  │  Client  │ │ Metadata │ │  Control │ │  (LCD)   │     │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │  │
│  └───────┼────────────┼────────────┼────────────┼────────────┘  │
└──────────┼────────────┼────────────┼────────────┼───────────────┘
           ▼            ▼            ▼            ▼
       ┌───────┐   ┌────────┐   ┌────────┐   ┌────────┐
       │  MPD  │   │ SQLite │   │  ALSA  │   │  GPIO  │
       │:6600  │   │  DB    │   │ Devices│   │  Pins  │
       └───────┘   └────────┘   └────────┘   └────────┘
```

### Package Structure

```
backend/
├── cmd/
│   └── audioplayer/
│       └── main.go                 # Entry point
│
├── internal/
│   ├── transport/
│   │   ├── socketio/               # Socket.io server
│   │   │   ├── server.go
│   │   │   ├── handlers.go         # Event handlers
│   │   │   └── events.go           # Event definitions
│   │   └── rest/                   # REST API
│   │       ├── router.go
│   │       └── handlers.go
│   │
│   ├── domain/
│   │   ├── player/                 # Player service
│   │   │   ├── service.go
│   │   │   ├── state.go
│   │   │   └── types.go
│   │   ├── library/                # Music library
│   │   │   ├── service.go
│   │   │   ├── scanner.go
│   │   │   └── types.go
│   │   ├── queue/                  # Queue management
│   │   ├── playlist/               # Playlist CRUD
│   │   ├── favorites/              # Favorites
│   │   ├── streaming/              # Tidal/Qobuz (future)
│   │   └── system/                 # System control
│   │       ├── service.go
│   │       ├── audio.go            # Bit-perfect config
│   │       ├── lcd.go              # LCD control
│   │       └── network.go
│   │
│   ├── infra/
│   │   ├── mpd/                    # MPD client
│   │   │   ├── client.go
│   │   │   ├── commands.go
│   │   │   └── watcher.go
│   │   ├── metadata/               # SQLite storage
│   │   ├── storage/                # NAS/USB mounts
│   │   └── alsa/                   # ALSA control
│   │
│   ├── events/                     # Event system
│   │   ├── hub.go
│   │   └── types.go
│   │
│   └── config/                     # Configuration
│       └── config.go
│
├── pkg/
│   └── api/                        # Shared types
│       └── types.go
│
├── configs/
│   ├── config.yaml                 # App config
│   ├── mpd.conf.template           # MPD template
│   └── asound.conf.template        # ALSA template
│
└── scripts/
    ├── install.sh                  # Installation
    └── update.sh                   # OTA updates
```

### Key Libraries

| Purpose | Library | Notes |
|---------|---------|-------|
| MPD Client | `github.com/fhs/gompd/v2` | Mature, well-tested |
| WebSocket | `github.com/googollee/go-socket.io` | Volumio compatibility |
| HTTP Router | `github.com/gin-gonic/gin` | Fast, middleware support |
| Metadata | `github.com/dhowden/tag` | ID3, FLAC, OGG tags |
| Database | `modernc.org/sqlite` | Pure Go, no CGO |
| Config | `github.com/spf13/viper` | YAML + env vars |
| Logging | `log/slog` | Go 1.21+ standard |
| GPIO | `github.com/warthog618/gpiocdev` | Pi 5 compatible |
| systemd | `github.com/coreos/go-systemd` | Service integration |

### Socket.io API (Volumio Compatible)

#### Player Events

| Emit → | ← Push | Description |
|--------|--------|-------------|
| `getState` | `pushState` | Get player state |
| `play` | `pushState` | Start/resume playback |
| `pause` | `pushState` | Pause playback |
| `stop` | `pushState` | Stop playback |
| `prev` | `pushState` | Previous track |
| `next` | `pushState` | Next track |
| `seek {N}` | `pushState` | Seek to position |
| `volume {N}` | `pushState` | Set volume (0-100) |
| `setRandom {bool}` | `pushState` | Toggle shuffle |
| `setRepeat {bool}` | `pushState` | Toggle repeat |

#### Queue Events

| Emit → | ← Push | Description |
|--------|--------|-------------|
| `getQueue` | `pushQueue` | Get current queue |
| `addToQueue {item}` | `pushQueue` | Add item to queue |
| `removeFromQueue {index}` | `pushQueue` | Remove item |
| `moveQueue {from, to}` | `pushQueue` | Reorder queue |
| `clearQueue` | `pushQueue` | Clear queue |

#### Browse Events

| Emit → | ← Push | Description |
|--------|--------|-------------|
| `getBrowseSources` | `pushBrowseSources` | Get root sources |
| `browseLibrary {uri}` | `pushBrowseLibrary` | Browse folder |
| `search {query}` | `pushBrowseLibrary` | Search library |
| `replaceAndPlay {item}` | `pushState`, `pushQueue` | Play item |

#### System Events

| Emit → | ← Push | Description |
|--------|--------|-------------|
| `getSystemInfo` | `pushSystemInfo` | System information |
| `getPlaybackOptions` | `pushPlaybackOptions` | Audio devices |
| `setPlaybackSettings {config}` | callback | Change audio config |
| `reboot` | - | Reboot system |
| `shutdown` | - | Shutdown system |

### State Types (Go)

```go
type PlayerState struct {
    Status       string `json:"status"`       // play, pause, stop
    Position     int    `json:"position"`     // Queue position
    Title        string `json:"title"`
    Artist       string `json:"artist"`
    Album        string `json:"album"`
    AlbumArt     string `json:"albumart"`
    URI          string `json:"uri"`
    TrackType    string `json:"trackType"`    // flac, dsf, mp3
    Seek         int    `json:"seek"`         // Position in ms
    Duration     int    `json:"duration"`     // Duration in seconds
    SampleRate   string `json:"samplerate"`   // e.g., "192000"
    BitDepth     string `json:"bitdepth"`     // e.g., "24"
    Random       bool   `json:"random"`
    Repeat       bool   `json:"repeat"`
    RepeatSingle bool   `json:"repeatSingle"`
    Volume       int    `json:"volume"`
    Mute         bool   `json:"mute"`
    Service      string `json:"service"`
    Bitperfect   bool   `json:"bitperfect"`   // Custom: bit-perfect mode
}

type AudioConfig struct {
    BitPerfectMode   bool   `json:"bitPerfectMode"`
    SoftwareVolume   bool   `json:"softwareVolume"`
    DSDMode          string `json:"dsdMode"`          // native, dop, pcm
    ResamplingMode   string `json:"resamplingMode"`   // none, soxr
    ExclusiveAccess  bool   `json:"exclusiveAccess"`
    BufferSize       int    `json:"bufferSize"`       // KB
    OutputDevice     string `json:"outputDevice"`
}
```

---

## Part 3: Implementation Phases

### Phase 1: Bit-Perfect Audio (1 week)

**Branch**: `feature/bit-perfect-audio`

1. [ ] Create audiophile ALSA configuration
2. [ ] Create audiophile MPD configuration
3. [ ] Add "Audiophile Mode" toggle to Settings UI
4. [ ] Add audio quality indicator to player (sample rate, bit depth)
5. [ ] Test with various formats (FLAC 24/192, DSD64, DSD256)

### Phase 2: Golang Backend Foundation (2 weeks)

**Repository**: `audioplayer-backend/`

1. [ ] Project scaffolding with Go modules
2. [ ] Socket.io server with basic events
3. [ ] MPD client connection and watcher
4. [ ] Player state management
5. [ ] Basic playback controls

### Phase 3: Queue and Library (2 weeks)

1. [ ] Queue management (CRUD)
2. [ ] Browse sources implementation
3. [ ] Local file browsing
4. [ ] Album art serving
5. [ ] Search functionality

### Phase 4: Playlists and Favorites (1 week)

1. [ ] SQLite storage for playlists
2. [ ] Playlist CRUD operations
3. [ ] Favorites management
4. [ ] Track info API

### Phase 5: System Integration (2 weeks)

1. [ ] Audio device enumeration (ALSA)
2. [ ] Audio output switching
3. [ ] Bit-perfect mode toggle
4. [ ] LCD brightness control
5. [ ] Power management

### Phase 6: Storage and Metadata (2 weeks)

1. [ ] NAS/SMB mount configuration
2. [ ] USB device detection
3. [ ] Metadata database
4. [ ] Background library scanning

### Phase 7: Production Hardening (1 week)

1. [ ] Graceful shutdown
2. [ ] systemd integration
3. [ ] Logging and monitoring
4. [ ] OTA update mechanism

---

## Part 4: Development Workflow

### Local Development

```bash
# Build and deploy to Pi
npm run deploy

# Run E2E tests
npm run test:e2e

# Run unit tests
npm run test
```

### Pi Connection

SSH config with persistent connection:
```
Host volumio-pi
    HostName 192.168.86.34
    User volumio
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 4h
```

### Testing Audio Quality

1. Use known test files (2L test bench, SACD rips)
2. Verify bit-perfect with USB audio analyzer
3. Check MPD logs for format conversions
4. Monitor ALSA output format

---

## Appendix: Volumio API Reference

See Volumio WebSocket API documentation:
https://developers.volumio.com/api/websocket-api
