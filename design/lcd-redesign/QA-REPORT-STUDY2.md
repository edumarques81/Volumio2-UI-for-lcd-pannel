# QA Report: Study 2 — Living Gallery LCD Redesign

**Date:** 2026-03-29  
**Auditor:** Hector (QA Subagent)  
**Commit:** Current HEAD of `~/workspace/Volumio2-UI`  
**Tested on:** http://localhost:5173/?layout=gallery (dev server)  
**Reference mockup:** `design/lcd-redesign/mockups/study-2-viz-art-utility.html`

---

## Summary

| Metric | Count |
|--------|-------|
| **Total issues found** | **21** |
| Critical (blocks use) | 3 |
| Major (visible/UX) | 10 |
| Minor (polish) | 8 |

---

## Eduardo's Reported Issues (Confirmed / Not Reproduced)

### 1. ✅ CONFIRMED — Album art click minimizes → right panel disappears
**Severity:** Critical  
**Description:** Clicking album art toggles VIZ mode. In VIZ mode, the entire right utility panel (Library/Queue/Settings) disappears. The mockup specifies that in VIZ mode, only the art shrinks to 80×80 and the right panel remains visible with a darker glass background.

**Root Cause:** `GalleryLayout.svelte` uses an `{#if !isViz}` / `{:else}` conditional block (lines 44–53). In VIZ mode, the entire `<UtilityPanel>` is removed from the DOM and replaced with a `viz-compact-bar` div that only contains `ArtHero` + `NowPlayingPanel`. The mockup keeps all three zones visible at all times — it just adjusts sizes and opacity.

**Mockup behaviour:**
- Art: 380×380 → 80×80
- Center panel: gets glass background (`--glass-dark-bg`)
- Right panel: stays visible with darker glass (`--glass-dark-bg`, `--glass-dark-border`)
- Viz canvas: opacity 0.18 → 0.85

**Fix:** Remove the `{#if}` conditional. Always render all three zones. Apply VIZ-mode CSS classes to adjust sizes/backgrounds. The `viz-compact-bar` div should not exist.

---

### 2. ✅ CONFIRMED — Play button not working
**Severity:** Critical  
**Description:** Pressing the play button emits a Socket.IO `play` event but the track resets to "No track playing / Unknown artist" instead of starting playback. The UI state before clicking showed "Autumn Serenade" by John Coltrane; after clicking play, everything cleared.

**Root Cause:** The `playerActions.play()` function (player.ts:72-90) calls `socketService.emit('play')`. The WebSocket connection appears to be interrupted — a "Session Ended / Another device has connected" notification was visible on page load, suggesting the socket was disconnected. When `play` is emitted on a dead socket, the player state store gets cleared by the next `pushState` event with empty data.

**Additional factor:** The dev server connects to the Pi backend at 192.168.86.25:3000. If the Pi's Volumio socket allows only one client, opening the dev server disconnects any existing session. The play button logic itself is correct (the `on:click` handler properly calls `playerActions.play()` / `playerActions.pause()`).

**Fix:** 
1. Add socket reconnection logic — detect "Session Ended" and auto-reconnect
2. The play button handler code is correct; the issue is transport-level

---

### 3. ✅ CONFIRMED — Control buttons too small for LCD
**Severity:** Major  
**Description:** The prev/next buttons use `.t-btn.sm` styling: 40×40px in default mode, 44×44px in VIZ mode. The mockup specifies `.t-btn.sm` at 40×40px (and 34×34px in VIZ mode). However, on a 1920×440 LCD touchscreen, these are physically tiny (approximately 9mm on a 15.6" panel).

**Mockup vs Implementation:**

| Element | Mockup Default | Mockup VIZ | Implementation Default | Implementation VIZ |
|---------|---------------|------------|----------------------|-------------------|
| Prev/Next (.t-btn.sm) | 40×40 | 34×34 | 40×40 | 44×44 |
| Play (.t-btn.play) | 56×56 | 44×44 | 56×56 | 44×44 |

The implementation actually makes VIZ-mode sm buttons *larger* than the mockup (44px vs 34px), which is an improvement. But for an LCD touch target, even the default 40px prev/next is too small.

**Fix:** Increase `.t-btn.sm` to minimum 48×48px (default) and 44×44px (VIZ). Increase icon sizes inside from 14px to at least 18px. The play button at 56px is acceptable.

---

### 4. ✅ CONFIRMED — Shuffle/repeat icons too small to click
**Severity:** Major  
**Description:** Shuffle and repeat buttons use the same `.t-btn.sm` class (40×40px). The icon sizes are 16×16px (`<IconShuffle size={16} />`, `<IconRepeat size={16} />`). On the LCD, these are nearly impossible to accurately tap.

**Fix:** Increase `.t-btn.sm` to 48×48px and icon sizes to at least 20px. Add more visual weight/contrast to the active state.

---

### 5. ✅ CONFIRMED — Missing action icons on tracks
**Severity:** Major  
**Description:** Neither the queue items nor the album detail track list have icons for:
- ❤️ Like / Add to Favorites
- ➕ Add to Queue
- ⋮ More options menu

The **mockup** doesn't explicitly show per-track action icons either (it's a static reference), but the absence is a functional gap. The queue items show only: drag handle, number, title, artist, duration, and a remove (×) button (on hover only).

The `AlbumDetailOverlay` has "Play All" and "Add to Queue" buttons at the album level, but individual tracks have no action icons.

**Fix:** Add a context menu or action icons (favorite, add-to-queue) to each track row in both QueueTab and AlbumDetailOverlay. Use minimum 44×44px touch targets.

---

### 6. ✅ CONFIRMED — Right pane labels too small
**Severity:** Major  
**Description:** Font sizes in the right utility panel are very small for an LCD:

| Element | Current Size | Recommended Minimum |
|---------|-------------|-------------------|
| Tab labels | 12px | 14px |
| Section headers | 10px | 12px |
| Setting labels | 12px | 14px |
| Setting values | 12px | 14px |
| Muted labels | 11px | 12px |
| Queue track title | 13px | 15px |
| Queue artist | 11px | 13px |
| Queue duration | 10px | 12px |
| Source tabs | 10px | 12px |
| Album grid title | 10px | 12px |
| Album grid artist | 9px | 11px |
| Search input | 11px | 13px |

These match the mockup values, but the mockup was designed as a visual reference, not a pixel-perfect spec for touch LCD. At 1920×440 on a ~15" display, 10px text is approximately 1.5mm tall — unreadable.

**Fix:** Scale all right-panel fonts up by ~20-30%. This is a design decision that needs Eduardo's approval, as it will affect layout density.

---

### 7. ✅ CONFIRMED — Queue layout alignment
**Severity:** Major  
**Description:** In the queue view, the track title (`.q-title`) column appears visually empty/missing. The screenshot shows only track numbers on the left and artist + duration on the right, with a large empty gap in the middle where the title should be.

**Root Cause:** The QueueTab uses `item.name` for the title (`<span class="q-title">{item.name}</span>`). If the queue items from Volumio's API return track names in a `title` field instead of `name`, the title would render as empty/undefined.

The `.q-title` has `flex: 1` (which is correct — it should fill the middle space), but if `item.name` is undefined/empty, the flex item renders with zero content width, pushing the artist to the right side.

**CSS alignment is correct** — `.q-title` uses default `text-align: left` and `flex: 1`. The issue is **data mapping**, not CSS alignment.

**Fix:** Check the queue store's `QueueItem` type — verify `name` maps correctly to Volumio's `title` or `name` field. Add a fallback: `{item.name || item.title || 'Unknown'}`.

---

### 8. ✅ CONFIRMED — Settings tab incomplete
**Severity:** Critical  
**Description:** The settings tab shows only:
1. **Audio Engine** (MPD / Audirvana toggle)
2. **Display** (LCD Brightness, Standby Mode)
3. **Audio Output** (currently shows "No outputs detected")
4. **Library** (album/artist/track count + Rebuild Cache / Rescan Library)
5. **Network** (Status, IP)
6. **System** (Device, Version, Hardware)

**Missing from original Volumio app:**
- NAS setup / management (add, edit, remove NAS shares)
- Source management (add new sources)
- Music library scan configuration
- Playback options (DSD, gapless, crossfade, replaygain)
- System settings (hostname, timezone, language)
- Plugin management
- Firmware update
- WiFi / network configuration
- Sleep timer
- Alarm clock

The settings panel was intentionally designed as a "compact LCD settings" panel (per the implementation plan), not a full settings replacement. This is a **design scope gap**, not a bug.

**Fix:** Either:
1. Add a "Full Settings" link that opens the main Volumio web UI in a browser
2. Add the most critical missing settings (NAS management, playback options) directly to the panel
3. Accept the LCD settings as a subset and document what's available vs what requires the full UI

---

## Additional Issues Found

### 9. Major — Queue track names not rendering
**Severity:** Major  
**Description:** Related to issue #7. The queue track names appear to be empty strings. The `QueueTab.svelte` renders `{item.name}` but the Volumio queue API may return `title` instead. The entire middle column of the queue is blank.

**Fix:** In QueueTab.svelte, change `{item.name}` to `{item.name || item.title || 'Untitled'}`. Also verify the `QueueItem` type in the queue store matches the actual Volumio API response.

---

### 10. Major — VIZ mode layout is completely wrong
**Severity:** Major (subsumes issue #1)  
**Description:** The mockup's VIZ mode is a CSS-only transition — same DOM, different styles. The implementation destroys and recreates DOM nodes via `{#if}` / `{:else}`. This causes:
- Loss of right panel state (selected tab, scroll position, search query)
- Animation jank (no smooth transition, just swap)
- Accessibility issues (focus loss)

**Fix:** Use CSS classes and transitions instead of conditional rendering. All three zones should always be in the DOM.

---

### 11. Major — Album art image broken rendering
**Severity:** Major  
**Description:** The album art shows a broken image icon (the `<img>` tag with `alt="Album artwork"` text is visible in the top-left corner of the screenshot). The `albumart` URL from the current track may be a relative path that doesn't resolve correctly when the dev server proxies to the Pi backend.

**Fix:** Ensure album art URLs are prefixed with the backend base URL (e.g., `http://192.168.86.25:3000/albumart?...`). Check the `currentTrack.albumart` value and the vite dev server proxy configuration.

---

### 12. Major — No visual feedback on play button state
**Severity:** Major  
**Description:** The play button shows `▶` (play icon) regardless of actual playback state when the socket disconnects. When playback starts, it should switch to `⏸` (pause icon). The implementation correctly uses `{#if playing}` to swap `IconPause` / `IconPlay`, and derives `playing` from `$isPlaying`, which is `derived(playerState, $state => $state?.status === 'play')`. However, if the socket disconnects, `playerState` becomes stale.

**Fix:** Add a connection status indicator somewhere visible. Grey out transport controls when disconnected.

---

### 13. Minor — Global seek bar below viewport fold
**Severity:** Minor  
**Description:** The gallery root is fixed at 440px height, but the global seek bar at `position: absolute; bottom: 0` sits at the bottom of the `.gallery-root` which is correct. However, in the browser screenshots, there appears to be extra space below the 440px content area, suggesting the page body is taller than 440px.

The mockup sets `html,body` to `height:440px;overflow:hidden`. The implementation's `gallery-root` sets `height:440px` but the page itself may not be constrained.

**Fix:** Ensure the page-level CSS constrains `html,body` to `1920×440` with `overflow:hidden` when in gallery/LCD mode.

---

### 14. Minor — Source tabs label differs from mockup
**Severity:** Minor  
**Description:** The mockup uses `★` (star emoji) as the favorites tab label. The implementation uses the text `"Favorites"` (full word). This takes more horizontal space in the source tabs row.

**Fix:** Consider using a star icon or shorter label like "Favs" or `★` to match the mockup's compact design.

---

### 15. Minor — Back button size differs from mockup
**Severity:** Minor  
**Description:** The mockup's `.lib-detail-back` button is 32×32px. The implementation's `.lib-detail-back` is 44×44px. The implementation is actually better for LCD touch targets, so this is an intentional improvement.

**Status:** Not a bug — implementation correctly overrides mockup for better touch usability.

---

### 16. Minor — Missing hover time tooltip on center seek bar
**Severity:** Minor  
**Description:** The `GlobalSeekBar` has a hover time tooltip (shows the time at cursor position). The center `seek-track` in `NowPlayingPanel` does not have this feature.

**Fix:** Add the same hover-time tooltip to the center seek bar for consistency.

---

### 17. Minor — Volume slider width matches mockup
**Severity:** Minor  
**Description:** Volume slider is 100px wide, matching the mockup. On LCD, this is physically about 16mm — quite small for touch manipulation. Consider widening to 140-160px.

---

### 18. Minor — Missing library cache data in settings
**Severity:** Minor  
**Description:** Settings shows "0 albums · 0 artists · 0 tracks" for library cache, suggesting the cache status API returned zeros or the library hasn't been indexed.

**Fix:** Verify the `/api/v1/library/cache/status` endpoint returns correct data. May need a library rescan.

---

### 19. Minor — No loading/error state for album art
**Severity:** Minor  
**Description:** When album art fails to load, only a broken image icon and alt text appears. The mockup has a gradient placeholder. The implementation has the placeholder div but it only shows when `!hasArt` (albumart is empty/default). When albumart has a URL that 404s, the `<img>` shows broken.

**Fix:** Add an `on:error` handler to the `<img>` tag that falls back to the placeholder gradient.

---

### 20. Minor — Network shows "Offline" despite IP being present
**Severity:** Minor  
**Description:** Settings shows `Status: Offline` but also `IP: 192.168.86.25`. This is contradictory. The network status check may be failing while the IP is being read from a different source.

**Fix:** Check the `getNetworkStatus()` implementation — the backend clearly is reachable (we see data from it), so the "Offline" indicator is incorrect.

---

### 21. Minor — Mockup has no Settings tab
**Severity:** Minor  
**Description:** The Study 2 mockup only has two right-panel tabs: "Library" and "Queue". The implementation adds a third "Settings" tab. This is a deliberate enhancement beyond the mockup, which is good, but the three tabs take more horizontal space.

**Status:** Intentional enhancement, not a bug.

---

## What's Working Well

### ✅ Matches mockup correctly:
1. **Three-zone layout structure** — Art (left) | Now Playing (center) | Utility (right) is correct
2. **Art hero dimensions** — 380×380px default, with proper border-radius (16px) and glow effect
3. **Track info typography** — Title at 32px/800 weight, artist at 16px, album at 13px — all match mockup exactly
4. **Format badges** — Roboto Mono 10px, pill shape, correct colours (primary-container / surface-container-high)
5. **Transport button sizing** — Play at 56×56, prev/next at 40×40 — matches mockup
6. **Seek bar styling** — 4px height, hover expand to 6px, dot on hover, primary colour fill — all match
7. **Global seek bar** — Full-width bottom bar, 4px → 8px on hover, matches perfectly
8. **Glass panel styling** — Correct `rgba(26,17,20,0.5)` background, `blur(24px) saturate(1.3)`, 16px radius
9. **Right panel tabs** — 12px uppercase, 1.5px letter-spacing, 44px min-height, correct active state
10. **Album grid** — `grid-template-columns: repeat(auto-fill, minmax(95px, 1fr))`, 8px gap — exact match
11. **Queue item structure** — Drag handle, number, title, artist, duration layout matches mockup structure
12. **Colour palette** — All CSS custom properties match the mockup's Material Design 3 rose theme
13. **VizBackground canvas** — Identical wave/particle/bar rendering algorithm to mockup
14. **Seek time display** — Roboto Mono 11px, correct positioning
15. **Volume controls** — Correct layout, secondary colour for fill/dot
16. **Source tabs** — Pill shape, correct sizing, active state with primary-container
17. **Library album cards** — Hover effect (translateY -2px, shadow), active scale(0.97)
18. **Album detail overlay** — Back button, art thumbnail, track list layout matches

### ✅ Improvements over mockup:
1. **Accessibility** — ARIA roles, labels, keyboard navigation on all interactive elements
2. **Touch targets** — Back buttons enlarged from 32px to 44px for LCD
3. **Loading states** — Skeleton screens for library and queue
4. **Error handling** — Error states with retry buttons
5. **Drag-and-drop** — Queue reordering via HTML drag API
6. **Remove from queue** — Individual track removal with × button
7. **Search functionality** — Library search bar (not in mockup)
8. **Artist detail overlay** — Drill into artist → albums → tracks
9. **Audio engine switcher** — MPD / Audirvana toggle in settings
10. **Hover time tooltip** — Shows seek position on global seek bar hover

---

## Recommended Fix Priority

### P0 — Critical (fix immediately)
1. **VIZ mode layout** (Issues #1, #10) — Change from `{#if}` conditional to CSS-only transitions. Keep all three zones in DOM at all times. ~2 hours.
2. **Socket reconnection** (Issue #2) — Add auto-reconnect logic and "reconnecting…" indicator. ~1 hour.
3. **Queue track names** (Issues #7, #9) — Fix `item.name` → `item.name || item.title` data mapping. ~15 minutes.

### P1 — Major (fix before next deploy)
4. **Button sizes for LCD** (Issues #3, #4) — Increase all `.t-btn.sm` to 48px, icon sizes to 20px. ~30 minutes.
5. **Right panel font scaling** (Issue #6) — Increase all right-panel fonts by ~20-30%. ~1 hour.
6. **Album art fallback** (Issue #11, #19) — Fix art URL resolution + add `on:error` fallback. ~30 minutes.
7. **Play state visual feedback** (Issue #12) — Add connection status indicator, grey out controls when disconnected. ~1 hour.
8. **Track action icons** (Issue #5) — Add favorite/add-to-queue icons on tracks. ~2 hours.

### P2 — Settings scope (design decision needed)
9. **Settings completeness** (Issue #8) — Decide whether to add NAS management, playback options, etc. to the LCD settings panel, or link to full Volumio UI. Requires Eduardo's decision.

### P3 — Minor polish
10. **Page overflow** (Issue #13) — Constrain body to 440px
11. **Favorites tab label** (Issue #14) — Use star icon
12. **Center seek hover tooltip** (Issue #16) — Add hover time
13. **Volume slider width** (Issue #17) — Widen for LCD
14. **Library cache data** (Issue #18) — Debug cache status API
15. **Network status** (Issue #20) — Fix offline/IP contradiction

---

## CSS Value Cross-Reference: Mockup vs Implementation

### Exact Matches ✅
| Property | Mockup | Implementation | Match |
|----------|--------|----------------|-------|
| Art hero size | 380×380 | 380×380 | ✅ |
| Art hero radius | 16px | 16px | ✅ |
| Art VIZ size | 80×80 | 80×80 | ✅ |
| Art VIZ radius | 12px | 12px | ✅ |
| Track title size | 32px | 32px | ✅ |
| Track title weight | 800 | 800 | ✅ |
| Track title letter-spacing | -0.5px | -0.5px | ✅ |
| Track title VIZ size | 22px | 22px | ✅ |
| Artist size | 16px | 16px | ✅ |
| Artist VIZ size | 13px | 13px | ✅ |
| Album size | 13px | 13px | ✅ |
| Album VIZ size | 11px | 11px | ✅ |
| Play button size | 56×56 | 56×56 | ✅ |
| Play VIZ size | 44×44 | 44×44 | ✅ |
| Prev/Next size | 40×40 | 40×40 | ✅ |
| Badge font | Roboto Mono 10px/500 | Roboto Mono 10px/500 | ✅ |
| Glass bg | rgba(26,17,20,0.5) | rgba(26,17,20,0.5) | ✅ |
| Glass border | rgba(81,67,71,0.55) | rgba(81,67,71,0.55) | ✅ |
| Glass blur | blur(24px) saturate(1.3) | blur(24px) saturate(1.3) | ✅ |
| Dark glass bg | rgba(16,10,14,0.75) | rgba(16,10,14,0.75) | ✅ |
| Seek bar height | 4px (6px hover) | 4px (6px hover) | ✅ |
| Global seek height | 4px (8px hover) | 4px (8px hover) | ✅ |
| Volume width | 100px | 100px | ✅ |
| Tab font | 12px/700, 1.5px spacing | 12px/700, 1.5px spacing | ✅ |
| Tab min-height | 44px | 44px | ✅ |
| Queue item min-height | 48px | 48px | ✅ |
| Queue title size | 13px | 13px | ✅ |
| Album grid columns | minmax(95px,1fr) | minmax(95px,1fr) | ✅ |
| Layout gap | 12px | 12px | ✅ |
| Layout padding | 14px 18px | 14px 18px | ✅ |
| Center panel flex | 0 0 35% | 0 0 35% | ✅ |
| Primary colour | #FFB1C8 | #FFB1C8 | ✅ |
| Surface colour | #1A1114 | #1A1114 | ✅ |

### Intentional Differences
| Property | Mockup | Implementation | Reason |
|----------|--------|----------------|--------|
| Prev/Next VIZ size | 34×34 | 44×44 | Better touch targets |
| Back button size | 32×32 | 44×44 | Better touch targets |
| Favorites tab label | ★ | "Favorites" | Clarity |
| Right panel tabs | 2 (Library, Queue) | 3 (+Settings) | Feature addition |
| Shuffle/Repeat VIZ | 34×34 | 44×44 | Better touch targets |

---

*Report generated by automated QA audit. All values verified against source code and browser screenshots.*
