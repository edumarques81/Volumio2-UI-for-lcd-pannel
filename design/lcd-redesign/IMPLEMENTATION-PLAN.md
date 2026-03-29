# Stellar LCD Redesign — "Living Gallery" Implementation Plan
## Approved by Eduardo 2026-03-28

---

## Philosophy
The display is a **gallery for album art** with a **living visualisation** background. Album artwork is the emotional anchor — big, prominent, always present. The viz subtly breathes behind everything. Utility panels (library, queue) live in a tabbed right panel. The three-zone layout gives you everything at a glance.

## Architecture: What Changes vs What Stays

### ✅ STAYS UNTOUCHED (zero changes)
- All stores: player.ts, queue.ts, browse.ts, library.ts, playlist.ts, lcd.ts, settings.ts, favorites.ts, audioEngine.ts
- All services: socket.ts, sourceClassifier.ts
- Backend: Go + Socket.IO (zero changes)
- Types, utils, config
- MobileLayout, DesktopLayout (only LCD layout changes)
- StandbyOverlay (standby system unchanged)
- E2E and unit test infrastructure

### 🔄 MODIFIED (refactored, not rewritten)
- `LCDLayout.svelte` — new three-zone layout with viz background
- `navigation.ts` — simplified view types (many views collapse into panel states)

### 🆕 NEW COMPONENTS
```
src/lib/components/
├── gallery/                        # New "Living Gallery" layout system
│   ├── GalleryLayout.svelte        # Master layout: viz bg + 3 zones + seek bar
│   ├── VizBackground.svelte        # Canvas visualisation (always-on, variable opacity)
│   ├── ArtHero.svelte              # 380×380 album art with glow + VIZ mode toggle
│   ├── NowPlayingPanel.svelte      # Center zone: track info + controls
│   ├── UtilityPanel.svelte         # Right zone: tabbed Library/Queue/Settings
│   ├── GlassPanel.svelte           # Reusable glassmorphism container
│   └── GlobalSeekBar.svelte        # Full-width 1920px bottom seek bar
├── utility/                        # Content for the right panel tabs
│   ├── LibraryTab.svelte           # Album grid + source tabs + search
│   ├── QueueTab.svelte             # Queue list + drag reorder
│   ├── SettingsTab.svelte          # Compact settings (LCD, audio, network)
│   ├── AlbumDetailOverlay.svelte   # Track list when album is selected
│   ├── ArtistDetailOverlay.svelte  # Artist albums drill-down
│   └── SourceTabs.svelte           # NAS/Local/Playlists/Radio/Favorites/Audirvana
├── visualisation/
│   └── WasmVisualiser.svelte       # Already built by Hector (WASM + JS fallback)
```

### 🗑️ REPLACED (old components no longer used in LCD layout)
These files stay in the repo (for Mobile/Desktop layouts) but are no longer used by LCDLayout:
- HomeScreen.svelte → replaced by GalleryLayout
- AppLauncher.svelte → sources move to SourceTabs inside UtilityPanel
- DockedMiniPlayer.svelte → replaced by ArtHero + NowPlayingPanel
- MiniPlayerQueueStrip.svelte → queue is now a full tab
- PlayerView.svelte → no separate player view; it's the default state
- Individual view files (AllAlbumsView, NASAlbumsView, ArtistsView, etc.) → content moves into LibraryTab

---

## Screen States (LCD Layout)

The "Living Gallery" is NOT a multi-page app. It's a **single persistent layout with state changes**:

### State 1: DEFAULT (Now Playing + Library)
```
[ART 380×380] [Track Info + Controls] [Library Tab (albums grid)]
[======================== Seek Bar ========================]
```
- Viz background at 18% opacity
- Art hero full size
- Library tab showing album grid with source tabs

### State 2: QUEUE VIEW
```
[ART 380×380] [Track Info + Controls] [Queue Tab (track list)]
[======================== Seek Bar ========================]
```
- Same layout, right panel switches to Queue tab

### State 3: SETTINGS VIEW
```
[ART 380×380] [Track Info + Controls] [Settings Tab (config)]
[======================== Seek Bar ========================]
```
- Right panel switches to Settings tab

### State 4: ALBUM DETAIL
```
[ART 380×380] [Track Info + Controls] [Album: track list overlay]
[======================== Seek Bar ========================]
```
- Library tab replaced by album track list
- Back button returns to album grid

### State 5: VIZ MODE (full spectrum)
```
[art 80×80] [Track · Artist] [▶ ◀◀ ▶▶] [━━━━●━━━] [🔊] [VIZ]
[============= FULL CANVAS VISUALISATION (360px) ==========]
[======================== Seek Bar ========================]
```
- Art shrinks to 80×80 thumbnail
- All panels collapse to slim 80px bar
- Viz ramps to 85% opacity, fills 360px
- Tap viz or VIZ pill to return to default

### State 6: AUDIRVANA ACTIVE
```
[Audirvana Logo] [Track Info (from Audirvana)] [Queue/Library]
[======================== Seek Bar ========================]
```
- Art hero shows Audirvana branding when audirvana engine is active
- Track info comes from pushAudirvanaStatus
- Same three-zone layout

---

## Implementation Phases

### Phase 1: Foundation (Hector)
**New components, no existing code modified yet**
1. GlassPanel.svelte — reusable glassmorphism container
2. VizBackground.svelte — canvas viz (integrate stellar-viz WASM module)
3. GlobalSeekBar.svelte — full-width seek bar
4. ArtHero.svelte — album art hero with VIZ mode toggle
5. NowPlayingPanel.svelte — track info + transport controls
6. GalleryLayout.svelte — master layout wiring everything together

**Test:** Mount GalleryLayout alongside existing LCDLayout (toggle via URL param `?layout=gallery`)

### Phase 2: Utility Panel (Odysseus)
**Right panel with all tabs**
1. SourceTabs.svelte — source filter tabs
2. LibraryTab.svelte — album grid, uses existing library store
3. QueueTab.svelte — queue list, uses existing queue store
4. SettingsTab.svelte — compact settings, uses existing settings store
5. AlbumDetailOverlay.svelte — track list drill-down
6. ArtistDetailOverlay.svelte — artist albums
7. UtilityPanel.svelte — tab switching container

**Test:** All tabs functional, connected to real stores, all existing Socket.IO events still working

### Phase 3: Integration & Switchover (Hector)
1. Wire GalleryLayout into LCDLayout.svelte as the new default
2. Update navigation.ts — simplify view types for panel-based navigation
3. Keep old HomeScreen accessible via `?layout=classic`
4. Verify ALL existing functionality works: playback, queue, browse, playlists, favorites, radio, settings, audirvana, standby, LCD control

### Phase 4: Polish & Test (Diomedes reviews, all agents fix)
1. Diomedes reviews pixel-perfect match to Study 2 mockup
2. Performance testing on Pi (FPS, memory, CPU)
3. E2E test updates
4. Touch interaction testing at 1920×440

---

## Testing Strategy

### Before ANY code is merged:
1. `npm run test:run` — all existing unit tests pass
2. `npx tsc --noEmit` — TypeScript clean
3. All existing Socket.IO events still fire correctly
4. Playback controls work (play/pause/next/prev/seek/volume/shuffle/repeat)
5. Queue management works (add/remove/reorder)
6. Library browsing works (all sources)
7. Settings work (LCD brightness, standby, audio output)
8. Audirvana integration works
9. Mobile/Desktop layouts unaffected

### New tests to add:
- GalleryLayout render test
- Panel tab switching test
- VIZ mode toggle test
- Art hero interaction test
- Glass panel accessibility test

---

## Design Requirements — NON-NEGOTIABLE

### Pixel-Perfect Match to Study 2
The implementation MUST match `study-2-viz-art-utility.html` exactly. Spacing, proportions, typography sizes, glassmorphism opacity, border radii, colour values, animation timing — all must match the mockup. Diomedes will do a pixel-by-pixel review in Phase 4.

### Custom SVG Icons — NO EMOJIS
All player controls, navigation icons, and UI icons must be **custom-made SVG icons** designed for the Living Gallery theme. No emoji characters (🎵, ▶, ⏮, etc.) anywhere in the UI.

Icon set to create (`src/lib/components/icons/`):
- **Transport:** play, pause, next, previous, stop
- **Controls:** shuffle, repeat, repeat-one, volume-high, volume-low, volume-mute
- **Navigation:** library, queue, settings, search, back, close, expand, collapse, chevron-down, chevron-right
- **Content:** album, artist, playlist, radio, favorite, favorite-filled, music-note
- **System:** standby, audirvana, nas, usb, local, qobuz
- **Actions:** add-to-queue, play-next, drag-handle, more (3-dots), delete

Style: Thin stroke (1.5-2px), rounded line caps, consistent 24×24 viewBox. Designed to look elegant on dark glassmorphism backgrounds. Colour: `currentColor` (inherits from CSS, typically `var(--md-on-surface)` or `var(--md-primary)` for active states).

Each icon must be a standalone `.svelte` component that accepts `size` and optional `color` props.

---

## Risk Mitigation
- **Feature flag:** `?layout=gallery` enables new layout, `?layout=classic` keeps old one
- **No store changes:** All data flow stays identical
- **No backend changes:** Zero Socket.IO event modifications
- **Incremental:** Phase 1-2 can be tested independently before Phase 3 switchover
- **Rollback:** One-line change in LCDLayout.svelte reverts to classic layout
