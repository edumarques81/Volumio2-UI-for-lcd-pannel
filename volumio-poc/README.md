# Volumio POC - Svelte Edition

Proof-of-concept for Volumio2-UI using Svelte, optimized for 1920x440 LCD touchscreen displays.

## Features

- ⚡ **Svelte 5** - Lightning-fast reactive framework
- 🎨 **iOS 26-Inspired Design** - Modern, clean interface with slim headers (52px)
- 📐 **1920x440 Layout** - Single horizontal bar optimized for LCD panels
- 👆 **Touch-Optimized** - 44x44px minimum touch targets
- 🔌 **Socket.io Integration** - Real-time communication with Volumio backend
- 📝 **TypeScript** - Full type safety

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend Connection

Edit `src/lib/services/socket.ts` and update the default host:

```typescript
const defaultHost = 'http://YOUR_VOLUMIO_IP:3000';
```

Or create `src/lib/local-config.json`:

```json
{
  "volumioBackend": "http://192.168.31.234:3000"
}
```

### 3. Start Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Layout Structure (1920x440)

```
┌────────────────────────────────────────────────────────────┐
│ [☰] [Album Art]  │  Track Info  │  Controls  │  Volume [⚙] │
│     (340px)      │           (1000px)         │   (580px)   │
└────────────────────────────────────────────────────────────┘
```

### Left Section (340px)
- Menu button (56x56px)
- Album artwork (320x320px)

### Center Section (1000px)
- Track title, artist, album
- Play/pause, skip, shuffle, repeat controls
- Seek bar with time display

### Right Section (580px)
- Volume slider with mute button
- Volume percentage display
- Settings button (56x56px)

## Typography

- **Base font**: Inter (18px)
- **Title**: 24px, weight 600
- **Metadata**: 18px, weight 400
- **Quality info**: 16px, weight 500

All fonts are large and readable for LCD viewing distance.

## Touch Targets

All interactive elements meet the iOS standard of **44x44px minimum touch target**.

## Browser Testing

For best results, test at actual display resolution:

1. Open Chrome DevTools (F12)
2. Click "Toggle Device Toolbar" (Cmd+Shift+M / Ctrl+Shift+M)
3. Select "Responsive" and set to 1920x440
4. Test touch interactions

## Project Structure

```
volumio-poc/
├── src/
│   ├── lib/
│   │   ├── components/      # Svelte components
│   │   │   ├── PlayerBar.svelte
│   │   │   ├── AlbumArt.svelte
│   │   │   ├── TrackInfo.svelte
│   │   │   ├── PlayerControls.svelte
│   │   │   ├── SeekBar.svelte
│   │   │   ├── VolumeControl.svelte
│   │   │   └── Icon.svelte
│   │   ├── services/        # Business logic
│   │   │   └── socket.ts
│   │   ├── stores/          # State management
│   │   │   └── player.ts
│   │   └── types/           # TypeScript types
│   │       └── index.ts
│   ├── App.svelte           # Root component
│   ├── main.ts              # Entry point
│   └── app.css              # Global styles
├── public/                  # Static assets
├── index.html               # HTML entry
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript config
└── package.json
```

## Volumio Backend API

The POC uses Socket.io to communicate with Volumio backend. Key events:

### Emitting to Backend
- `getState` - Request current player state
- `play` - Start playback
- `pause` - Pause playback
- `stop` - Stop playback
- `prev` - Previous track
- `next` - Next track
- `volume` - Set volume (0-100)
- `mute` / `unmute` - Toggle mute
- `setRandom` - Toggle shuffle
- `setRepeat` - Toggle repeat
- `seek` - Seek to position (seconds)

### Receiving from Backend
- `pushState` - Player state updates
- `pushQueue` - Queue updates
- `pushToastMessage` - Toast notifications
- `pushLcdStatus` - LCD panel state updates

### LCD Control

The UI includes a complete LCD standby system for touchscreen displays:

**Standby Modes (Settings → Appearance):**
- **CSS Dimmed (default)** - Dims to 20% brightness via CSS overlay. Instant wake, reliable touch-to-wake.
- **Hardware Off** - Uses wlr-randr to power off display. Slower wake, touch may be unreliable.

**Browser Console:**
```javascript
lcdActions.standby()    // Enter CSS dimmed standby (20% brightness)
lcdActions.wake()       // Wake from standby (restore brightness)
lcdActions.toggle()     // Toggle based on current mode setting
lcdActions.setBrightness(50)  // Set brightness (0-100)
```

**Note:** The standby overlay only appears on the physical LCD panel (URL with `?layout=lcd`).

### Streaming Services (Planned)

| Service | Events | Description |
|---------|--------|-------------|
| Qobuz | `qobuzLogin`, `qobuzLogout`, `getQobuzStatus` | Hi-Res streaming (24-bit/192kHz) |
| Tidal | `tidalLogin`, `tidalLogout`, `getTidalStatus` | Hi-Res streaming |

Browse streaming content via standard `browseLibrary` event with service-specific URIs:
- `qobuz://` - Qobuz root menu
- `qobuz://myalbums` - User's albums
- `qobuz://album/{id}` - Album tracks
- `tidal://` - Tidal root menu (planned)

See [STREAMING-SERVICES.md](../docs/STREAMING-SERVICES.md) in the backend repo for full documentation.

See [Volumio WebSocket API](https://github.com/volumio/Volumio2/wiki/WebSockets-API-Reference) for complete API documentation.

## Development Notes

### Mock Mode

If you don't have a Volumio backend running, you can enable mock mode by uncommenting the mock data in `src/lib/stores/player.ts`.

### Hot Module Replacement

Vite HMR is enabled - changes to `.svelte` files will hot-reload instantly.

### Browser Console

All Socket.io events are logged to console with emoji prefixes:
- `→` Emitting to backend
- `←` Receiving from backend
- `▶` Play action
- `⏸` Pause action
- `🔊` Volume change

## Next Steps

This POC demonstrates:
1. ✅ Svelte + TypeScript setup
2. ✅ Socket.io integration
3. ✅ Reactive state management with stores
4. ✅ 1920x440 optimized layout
5. ✅ iOS 26-inspired design system
6. ✅ Touch-friendly controls (44x44px)
7. ✅ Full player controls (play, pause, skip, volume, seek)

For full production migration, see `MIGRATION_PLAN.md` in the parent directory.

## Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

## Performance

Tested on Raspberry Pi 5:
- Initial load: ~0.5s
- Bundle size: ~150KB (gzipped)
- Frame rate: 60fps
- Memory usage: ~25MB

## License

Same as Volumio2
