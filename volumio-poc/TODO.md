# Volumio LCD UI - TODO

## Immediate Improvements

Items to implement when moving from POC to production:

- [~] **Volumio Integration Setup and use** Backend complete (device service, Socket.IO events). PENDING: iOS Volumio app can't discover device via mDNS (service IS advertised correctly as `_Volumio._tcp`, visible from Mac). Need to investigate: network isolation, router mDNS blocking, or add WiFi hotspot "Setup Mode" for initial pairing. Consider adding Settings UI for device name/UUID.
- [ ] **Artists main screen item** Grab official images of the artits using the services already integrated, save them and add to the app DB if needed
- [ ] **Completely review the mobile layout** The mobile interface is not great. It should not start in the miniplayer, it needs to display the mainscreen items using all the screen, it cannot use the same horizontal layout we use for the LCD panel. Buttons need to be visible in the miniplayer and not deform if the screen orientation changes
- [ ] **Playlist menu from the main screen** Implement the playlist screen (accessed via playlist button from the main screen)
- [ ] **Album Tile** when presenting an album tile, anywhere in the app we need a button (in some places this button exist -- Music Library -- that will let the user add the album to a playlist and another to add the album to the playing queue. Or maybe a submenu with those options along with the Option "Play Next")
- [ ] **Song Tile** when presenting a song tile, anywhere in the app we need a button (in some places this button exist -- Music Library -- that will let the user add the album to a playlist and another to add the album to the playing queue. Or maybe a submenu with those options along with the Option "Play Next")
- [ ] **Screen timeout settings** - Add configurable auto-standby timeout in settings
- [ ] **Wake on touch** - Implement touch-to-wake when display is in standby
- [ ] **Music booklet** Use some 3rd party service or online free service or AI or available booklet in the album dir to get information about the album that is playing. You are going to show that information on the right side of the LCD. Put an icon in the miniplayer control indicating that there is a booklet available, and bring that information to the screen if the icon is clicked.
- [ ] **Take over the code repository** Currently the project is running as a poc from the main Volumio2-UI repo. I want the the volumio2-UI code to be safely removed and the volumio-poc code to be copied into the trunc of the folder.

## Streaming Services

### Audirvana Integration (Later)
- [ ] Explore the UnPn approach to let audivarna connect with the streamer (so we have more control over it). I ran a ChatGP research that is very good for that

Extra info: 

Audirvāna ↔ Streamer integration: logging, detection, and “no-compromise” renderer quality
Goal

Enable the streamer UI/backend to reliably know when Audirvāna is playing and show Now Playing (track/artist/album art), without sacrificing audio quality.

Audirvāna on Linux: where logs are and how “verbose” works

A) If Audirvāna is run as a systemd service

Service output (stdout/stderr) is captured by journald.

Commands:

# Identify the unit name
sudo systemctl list-units --type=service --all | grep -i audirvana
sudo systemctl list-unit-files | grep -i audirvana

# Status + recent logs
sudo systemctl status <UNIT> --no-pager -l

# Follow logs live
sudo journalctl -u <UNIT> -f
sudo journalctl -u <UNIT> -n 500 --no-pager
sudo journalctl -u <UNIT> -b --no-pager
sudo journalctl -u <UNIT> -p err..alert --no-pager


B) Audirvāna “app logs”

Audirvāna writes its own logs under:

~/.local/share/audirvana/

Useful commands:

ls -lah ~/.local/share/audirvana/
tail -n 200 ~/.local/share/audirvana/*.log 2>/dev/null


C) Verbose/debug logging

In the Audirvāna Studio UI:

Settings → My Account → Start Log Session

Reproduce the issue

Stop the session and collect logs

Use “Open Log Folder” if available

How the streamer can know “Audirvāna is playing”

There are 3 approaches, ranked by robustness:

Option 1 (recommended): Make the streamer a UPnP/OpenHome renderer

Audirvāna can “play to” a network renderer. If our streamer is the renderer, we get:

Reliable playback state (play/pause/stop/seek)

Now Playing metadata (track/artist/album) + album art URL

Device selection (“output”) becomes a first-class UX feature

What we implement:

Discovery/advertising: SSDP (and optionally mDNS/Avahi for friendly discovery)

Control services (UPnP):

AVTransport (SetURI, Play, Pause, Stop, Seek, Position/Transport status)

RenderingControl (volume/mute optional)

Media delivery:

Local HTTP server: GET /dlna/stream/{trackId} (MUST support Range requests)

Album art endpoint: GET /dlna/art/{trackId}

UI integration:

“Outputs picker”

Now Playing and transport status derived from renderer state

Why this is best:

Standard protocol (not vendor-specific)

Stable across Audirvāna versions

Gives full control + metadata without reverse engineering

Option 2: Talk to Audirvāna’s RemoteServer (fragile)

Audirvāna on Linux can expose a “RemoteServer” and event websocket used by their official remote apps.

Possible to integrate, but likely requires reverse engineering the protocol.

Higher risk of breaking after updates.

Option 3: OS-level audio activity detection (only “is audio active”, no metadata)

If Audirvāna runs on the same host:

Detect whether audirvanaStudio holds ALSA devices (e.g., lsof /dev/snd/*)

Monitor PipeWire/Pulse stream state

This gives activity but usually not track metadata.

Audio quality impact of UPnP/OpenHome renderer approach

Key point: UPnP/OpenHome does not inherently reduce audio quality. Quality depends on whether the renderer is bit-perfect and avoids unintended DSP/transcoding.

What changes when Audirvāna runs on another machine

Typical flow:

Audirvāna controls the renderer via UPnP/OpenHome.

It provides a URL to the media.

The renderer (our Pi) buffers + decodes locally, then outputs to DAC via ALSA.

Network jitter is buffered and is not equivalent to DAC clock jitter. Timing is governed by the renderer/DAC, not packet arrival.

Where quality can get worse (gotchas)

Transcoding / re-encoding

Lossy transcodes (FLAC → MP3) = quality loss.

Resampling

Forcing everything to 48 kHz (or a fixed rate) changes the signal.

Software volume / DSP

Applying gain/DSP changes signal; can be optional but must be explicit.

Audio pipeline

PipeWire/Pulse can resample/mix unless configured carefully.

Direct ALSA hw output is simplest for “exclusive/bit-perfect”.

“No-compromise renderer” checklist (bit-perfect mode)

Implement the renderer so it can be genuinely audiophile-safe:

No lossy transcoding by default

Support FLAC + WAV/PCM minimum (extend as needed)

Native sample-rate switching

Open ALSA device at track’s sample rate

Avoid forced resampling

Prefer direct ALSA hw output (no mixing path)

Provide two volume modes:

Bit-perfect mode: fixed gain (ignore UPnP software volume or map to “not supported”)

Convenience mode: optional software volume (clearly labeled)

HTTP streaming must support:

Range requests (206 Partial Content)

Correct Content-Type and Content-Length

Stable buffering

Implementation notes (high level)

Backend: Go modules for:

renderer/ssdp (announce + discovery)

renderer/upnp (SOAP control endpoints)

renderer/httpstream (Range streaming + art)

renderer/audio (decode + ALSA output, rate switching)

renderer/state (transport state + now playing)

Frontend: Svelte component:

Outputs picker + renderer state + Now Playing

### Tidal Integration (Next)
- [ ] Research Tidal API authentication (OAuth, app credentials)
- [ ] Add Tidal backend service (similar to Qobuz)
- [ ] Add Tidal frontend store and settings UI
- [ ] Implement Tidal browsing (albums, artists, playlists, search)
- [ ] Implement Tidal playback with quality selection

## Investigation / Experiments

- [ ] **Audio quality configuration** - Check Volumio3-backend (original) for specific configuration to set/enhance audio quality (resampling, DSD, bit-perfect settings, output format)

## Completed (POC Phase)

- [x] Player controls (play, pause, seek, volume, shuffle, repeat)
- [x] Music library browsing with hierarchical navigation
- [x] Queue management (add, remove, reorder, clear, save to playlist)
- [x] Playlist management (create, delete, add/remove items, play)
- [x] Favorites system (add/remove, play favorites)
- [x] Track info modal
- [x] Responsive layouts (1920x440 LCD + desktop/tablet)
- [x] LCD panel control (standalone service)
- [x] Issue notification system with status drawer
- [x] Toast dedupe and throttle
- [x] Testing infrastructure (Vitest + Svelte Testing Library)
- [x] Store tests (issues, LCD)
- [x] Component tests (Toast, StatusBar)
- [x] Network status indicator (WiFi signal strength, Ethernet icon)
- [x] ON AIR label only shows when music is playing
- [x] Sub-screen back buttons (left side, white, thick, easy to click)
- [x] Improved tile contrast/opacity in sub-screens
- [x] Go backend (Stellar) with Socket.IO, MPD integration, album art endpoint
- [x] Network settings page (connection status, type, WiFi/Ethernet details, hostname, access URLs)
- [x] Audio engine switching with confirmation (prevents race condition between MPD/Audirvana transitions)
