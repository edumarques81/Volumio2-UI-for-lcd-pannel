# Stellar LCD Layout Redesign — Research Document
## Prepared by Nestor (Deep Research) 🦉 | 2026-03-28

---

## Display Constraints

- **Resolution:** 1920 × 440 pixels
- **Aspect Ratio:** 4.36:1 (ultrawide bar)
- **Touch:** Capacitive touchscreen
- **Hardware:** Raspberry Pi 4/5 running Chromium kiosk
- **Similar displays:** 8.8" automotive bar displays (1920×480), 11.3" stretched bar panels (1920×440)

## Functional Requirements

The streamer frontend + backend must provide:

1. **Playback Control** — play/pause, next/prev, seek, volume, shuffle, repeat
2. **Now Playing** — album art, track title, artist, album name, format badges (FLAC, DSD, sample rate, bit depth)
3. **Library Browsing** — albums, artists, playlists, favorites, radio stations
4. **Queue Management** — view queue, reorder, remove tracks
5. **Source Selection** — NAS, Local, USB, Qobuz, Tidal, Audirvana, Web Radio
6. **Settings** — system config, LCD brightness, standby, network
7. **Standby** — hardware LCD on/off control
8. **Search** — find music across all sources
9. **Audirvana Integration** — dedicated view when Audirvana engine is active
10. **Real-time Updates** — Socket.IO push state, reactive UI

## Key Design Principles for Ultrawide Bar Displays

### From Automotive UX Research:
- **Single-glance readability** — key info must be absorbed in <1 second
- **Large touch targets** — minimum 44×44px (WCAG), preferred 48×48px for moving contexts
- **Horizontal zones** — natural reading flow left-to-right for Latin scripts
- **Depth over breadth** — fewer items visible, but clear drill-down paths
- **Persistent controls** — playback controls should never be more than one tap away

### From MD3 (Material Design 3):
- **Dynamic colour** — seed colour from album art, tonal palettes
- **Expressive typography** — display/headline for hero content, body for metadata
- **Shape system** — rounded corners (extra-large 28dp for containers, medium 12dp for buttons)
- **Elevation** — surface tonal colour + shadow for layering
- **Motion** — emphasised easing for transitions (400ms), standard for micro-interactions (200ms)

### Unique Challenges of 440px Height:
- Only ~5-6 touch targets can stack vertically
- Album art cannot be displayed at typical square sizes without dominating the entire height
- Navigation hierarchy must be flatter than traditional UIs
- Scrolling should primarily be horizontal, not vertical
- Every pixel of vertical space is premium real estate

---

## 5 Design Approaches

### Approach A: "The Vinyl Groove" 🎵
**Concept:** Album art as the hero. The display is essentially a digital album cover showcase with integrated controls.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ [ALBUM ART  ] │ Track Title                    │ ◀◀  ▶  ▶▶  │
│ [  400×400  ] │ Artist — Album                 │ ━━━━●━━━━━━ │
│ [ (scaled   ] │ FLAC · 96kHz · 24bit           │ 2:34 / 5:12 │
│ [  to 440h) ] │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │  🔀  🔁  🔊 │
│               │ [Queue strip → → → → → → → → ] │             │
└─────────────────────────────────────────────────────────────────┘
```

**Philosophy:** The album cover IS the interface. Largest possible artwork fills the left panel. Track info and controls occupy the remaining space. The queue is a horizontal filmstrip below track metadata.

**Navigation:** Tap artwork to browse library. Swipe right panel to access different sections. Bottom edge swipe for settings.

**Inspiration:** Roon's "Now Playing" display, vinyl record player aesthetics, high-end DAP interfaces.

**Strengths:** Visually stunning, art-forward, audiophile-friendly
**Weaknesses:** Less space for browsing, may feel constrained for library navigation

---

### Approach B: "Command Deck" 🚀
**Concept:** Information density maximised. Three equal horizontal zones show everything at once — no navigation needed for the most common tasks.

**Layout:**
```
┌────────────────────┬─────────────────────┬───────────────────┐
│  NOW PLAYING       │  UP NEXT (Queue)    │  LIBRARY          │
│ ┌──┐ Title         │ 1. Next Track       │ [Albums] [Artists]│
│ │🎵│ Artist        │ 2. After That       │ [Playlists] [Radio│
│ └──┘ ◀◀ ▶ ▶▶     │ 3. Third Song       │ [Favorites] [NAS] │
│ ━━━━●━━━━ 2:34    │ 4. Fourth Song      │ ┌──┐┌──┐┌──┐┌──┐ │
│ 🔊━━━━━  🔀 🔁    │ 5. Fifth Song       │ │  ││  ││  ││  │ │
└────────────────────┴─────────────────────┴───────────────────┘
```

**Philosophy:** Like a flight deck — all critical information visible simultaneously. No context switching needed. The three panels update independently in real-time.

**Navigation:** Each zone is independently scrollable. Tap items in Library to play. Drag queue items to reorder. Tap zone headers to expand a zone to full-width.

**Inspiration:** Bloomberg Terminal, flight cockpit displays, Tesla Model S instrument cluster.

**Strengths:** Maximum information density, no navigation overhead, always-visible queue
**Weaknesses:** Can feel busy, smaller album art, requires careful typography to avoid clutter

---

### Approach C: "Cinematic Strip" 🎬
**Concept:** Full-width immersive experience. Blurred album art spans the entire 1920px background. A floating glass card with controls sits center-stage.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░ BLURRED ALBUM ART BACKGROUND ░░░░░░░░░░░░░│
│░░░░  ┌─────────────────────────────────────────┐  ░░░░░░░░░░░░│
│░░░░  │  🎵 Track Title — Artist                │  ░░░░░░░░░░░░│
│░░░░  │  ◀◀   ▶   ▶▶    ━━━━━●━━━━━  2:34/5:12 │  ░░░░░░░░░░░░│
│░░░░  └─────────────────────────────────────────┘  ░░░░░░░░░░░░│
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
└─────────────────────────────────────────────────────────────────┘
```

**Philosophy:** The music IS the atmosphere. The entire display becomes an ambient artwork that changes with each track. Controls are minimal and float on a glassmorphism card. An edge-to-edge seek bar spans the bottom.

**Navigation:** Swipe up from bottom for queue. Swipe down from top for library/sources. Two-finger pinch for settings. The home state is deliberately minimal.

**Inspiration:** Apple Music's full-screen player, Spotify's Canvas, macOS desktop widgets, glassmorphism UI trend.

**Strengths:** Most visually immersive, ambient room display, conversation piece
**Weaknesses:** Least functional in static view, requires gestures for navigation, not great for active browsing sessions

---

### Approach D: "The Jukebox" 🎰
**Concept:** Browse-first design. A horizontal carousel of album covers spans the full width, with a persistent slim player bar. The focus is on discovery and selection.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ [My Music ▼] ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ← → │
│              │ 🎵│ │ 🎵│ │ 🎵│ │ 🎵│ │ 🎵│ │ 🎵│ │ 🎵│      │
│  [Search 🔍] │   │ │   │ │   │ │ ★ │ │   │ │   │ │   │      │
│              └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘      │
│──────────────────────────────────────────────────────────────── │
│ ▶ Track Title — Artist   ━━●━━━━  2:34  🔊━━  [◀◀] [▶] [▶▶] │
└─────────────────────────────────────────────────────────────────┘
```

**Philosophy:** Like a classic jukebox — the joy is in choosing what to play next. Album covers are the primary interface element, displayed as a touch-swipeable horizontal filmstrip. The player bar is compact and always present.

**Navigation:** Source selector dropdown (top-left). Horizontal swipe through albums. Tap album for track list overlay. Tap track to play. The player bar is always 80px at bottom.

**Inspiration:** Classic jukeboxes, Netflix horizontal browse, Apple TV music app, Plex media player.

**Strengths:** Browse-centric, great for large libraries, tactile/fun interaction
**Weaknesses:** Now-playing is secondary, less audiophile-focused, album art smaller individually

---

### Approach E: "Spectrum" 📊
**Concept:** Audio-reactive display as the hero element. Real-time frequency visualization fills the background. Controls float as translucent overlays that fade in/out on touch.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█ │
│ ▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇ │
│ ▃▅▇█▇▅▃▂▁▂▃▅▇█ [ ▶ Track — Artist ] █▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅│
│ ▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂│
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
└─────────────────────────────────────────────────────────────────┘
```

**Philosophy:** The display is a living artwork that responds to the music. When idle, it shows elegant geometric patterns. During playback, frequency bars, waveforms, or particle systems dance to the audio. Controls appear on touch and auto-hide after 3 seconds.

**Navigation:** Tap anywhere to reveal controls. Swipe left/right for prev/next view (Visualizer → Library → Queue → Settings). Controls auto-dismiss. Album art appears as a floating thumbnail in corner when controls are visible.

**Inspiration:** Winamp visualizations, milkdrop, WaveForm by Woojer, Teenage Engineering OP-1 display, screensaver-as-interface.

**Strengths:** Stunning visual showcase, makes the Pi a conversation piece, differentiator from all other music players
**Weaknesses:** Functional density sacrificed for aesthetics, not ideal for active library management, visualization performance on Pi needs testing

---

## WebAssembly Strategy — Hybrid Approach

### Decision: Svelte 5 UI + Rust/WASM Visualisation Layer

**Keep Svelte 5 for all UI components** — navigation, library, queue, controls, settings. Svelte's compiler produces extremely lean JS and is already optimal for DOM-based interfaces on the Pi's Chromium kiosk.

**Use Rust → WebAssembly ONLY for compute-heavy visualisation** — frequency analysis, particle systems, waveform generation, audio-reactive canvas math. The WASM module renders to an OffscreenCanvas, keeping the main UI thread free.

### Why Hybrid (Not Full WASM Rewrite)
- On Raspberry Pi 4/5 (ARM Cortex-A72), benchmarks show WASM can run *slower* than V8-JIT'd JavaScript for general tasks
- WASM cannot touch the DOM directly — all rendering goes through a JS bridge, so standard UI components gain nothing
- Svelte 5 is already one of the most performant web frameworks available
- Full WASM rewrite would add Rust cross-compilation complexity on top of the Go backend toolchain
- Leptos/Dioxus (Rust WASM frameworks) are near vanilla-JS DOM performance but don't *beat* Svelte for UI work

### Where WASM Wins (2-6× speedup)
- Canvas frequency bar calculations (FFT-style math)
- Particle system physics (thousands of particles per frame)
- Waveform generation and smoothing algorithms
- Colour palette computation from album art pixels
- Any tight numeric loop running at 30-60fps

### Implementation Plan
1. **Rust crate:** `stellar-viz` — standalone WASM module for visualisation math
2. **Build:** `wasm-pack build --target web` → produces .wasm + JS glue
3. **Integration:** Svelte component imports WASM module, feeds it canvas context via OffscreenCanvas
4. **Fallback:** Pure JS visualisation as fallback if WASM fails to load (graceful degradation)
5. **Testing:** Automated benchmarks comparing JS vs WASM render paths on Pi hardware
6. **Cross-compile:** GitHub Actions or local `wasm-pack` (no Pi-specific cross-compile needed — WASM is platform-agnostic)

### Candidate Rust Libraries
- `wasm-bindgen` — JS/WASM interop
- `web-sys` — Canvas2D API bindings
- `js-sys` — requestAnimationFrame, performance.now()
- `rustfft` — if real FFT needed (currently simulated)

---

## Recommendation for Mockup Phase

All 5 approaches should be built as interactive HTML/CSS/JS mockups at exactly 1920×440. Each mockup should:

1. Show the "Now Playing" state with real album art
2. Demonstrate at least one navigation transition (e.g., home → library)
3. Include touch interaction (hover states become touch states)
4. Use MD3 token values (colours, typography, shapes)
5. Include a dark theme (primary use case for an audio room)
6. Be responsive to the exact 1920×440 viewport

The mockups will be served locally for Eduardo to interact with and evaluate.
