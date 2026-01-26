# Volumio LCD UI - TODO

## Future Improvements (Production Implementation)

Items to implement when moving from POC to production:

- [ ] **Display control via backend** - Move LCD standby/wake functionality to Volumio backend service instead of separate HTTP server (currently using standalone Node.js server on port 8081)
- [ ] **Backend socket events for display** - Add `displayStandby` and `displayWake` socket events to Volumio backend
- [ ] **Screen timeout settings** - Add configurable auto-standby timeout in settings
- [ ] **Wake on touch** - Implement touch-to-wake when display is in standby

## Streaming Services

### Tidal Integration (Next)
- [ ] Research Tidal API authentication (OAuth, app credentials)
- [ ] Add Tidal backend service (similar to Qobuz)
- [ ] Add Tidal frontend store and settings UI
- [ ] Implement Tidal browsing (albums, artists, playlists, search)
- [ ] Implement Tidal playback with quality selection

### Audirvana Integration (Later)
- [ ] Research Audirvana debian package installation
- [ ] Investigate integration approach

## Investigation / Experiments

- [ ] **WebSocket communication** - Investigate and experiment using WebSockets for all communication between Go backend and JS frontend (instead of Socket.IO)
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
