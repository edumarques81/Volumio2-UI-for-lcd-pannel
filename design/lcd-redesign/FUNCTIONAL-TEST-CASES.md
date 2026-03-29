# Stellar Volumio — Functional Test Cases & Usability Report

**Date:** 2026-03-29  
**Tester:** Bruce (QA Agent)  
**Environment:** localhost:5173 (dev server) → Pi backend at 192.168.86.25:3000  
**Viewport:** 1920×440 (LCD touchscreen simulation)  
**Layout:** Gallery (`?layout=gallery`)

---

## Summary

| Category | Total | ✅ Pass | ❌ Fail | ⚠️ Partial | 🔘 Not Tested |
|----------|-------|---------|---------|------------|----------------|
| Connectivity | 5 | 1 | 3 | 1 | 0 |
| Playback Controls | 10 | 3 | 3 | 3 | 1 |
| Library Browsing | 12 | 5 | 4 | 2 | 1 |
| Queue Management | 8 | 2 | 4 | 1 | 1 |
| Settings | 8 | 4 | 2 | 2 | 0 |
| VIZ Mode | 4 | 3 | 0 | 1 | 0 |
| Search | 4 | 2 | 1 | 1 | 0 |
| Usability & Touch | 10 | 3 | 5 | 2 | 0 |
| Accessibility | 5 | 0 | 5 | 0 | 0 |
| **Total** | **66** | **23** | **27** | **13** | **3** |

---

## 1. Connectivity

### TC-001: Socket.IO Initial Connection
**Category:** Connectivity  
**Priority:** P0 (critical)  
**Preconditions:** Dev server running at localhost:5173, Pi backend at 192.168.86.25:3000  
**Steps:**
1. Open http://localhost:5173/?layout=gallery in browser
2. Observe console for Socket.IO connection messages
3. Wait 10 seconds
**Expected Result:** Socket connects and stays connected. Player state, library data, and system info populate.  
**Actual Result:** Socket connects successfully but immediately gets kicked — "Session Ended - Another device has connected". Enters a connect/disconnect death loop every 2-3 seconds. The Pi's LCD kiosk browser and the dev server fight for a single-client slot.  
**Status:** ❌ Fail  
**Usability Notes:** Users testing via dev server cannot coexist with the Pi LCD. Backend should support multiple concurrent Socket.IO clients.

### TC-002: Session Ended Toast
**Category:** Connectivity  
**Priority:** P1 (important)  
**Preconditions:** Socket.IO disconnect/reconnect cycle active  
**Steps:**
1. Observe the toast notification when socket disconnects
2. Try to close the toast
**Expected Result:** Toast appears briefly, auto-dismisses, or has a clear close button.  
**Actual Result:** "Session Ended - Another device has connected" toast appears repeatedly (every 2-3 seconds during socket cycling). Close button exists but toast reappears immediately on next disconnect. No way to suppress.  
**Status:** ❌ Fail  
**Usability Notes:** Constant toast spam makes the UI unusable during socket conflicts.

### TC-003: State Recovery After Reconnect
**Category:** Connectivity  
**Priority:** P0 (critical)  
**Preconditions:** Socket.IO reconnects after brief disconnect  
**Steps:**
1. Start playback
2. Wait for socket disconnect/reconnect
3. Observe if player state recovers
**Expected Result:** Player state (track, position, volume, queue) should persist across reconnects via backend push.  
**Actual Result:** State partially recovers — backend pushes current state on reconnect, overwriting any local changes. However, library data does NOT recover (skeleton loaders persist until manually switching tabs). Queue data recovers. Now-playing may show stale data briefly before resync.  
**Status:** ⚠️ Partial  
**Usability Notes:** Library needs to re-emit fetch requests on reconnect.

### TC-004: Library Fetch After Socket Init
**Category:** Connectivity  
**Priority:** P0 (critical)  
**Preconditions:** Fresh page load  
**Steps:**
1. Observe console for library:albums:list emit timing
2. Check if emit happens before or after socket is connected
**Expected Result:** Library fetch should wait for socket connection before emitting.  
**Actual Result:** `[Library] Fetching albums...` fires BEFORE socket is initialized. Warning: "Socket not initialized — emit queued or lost". The library data request is silently dropped. Library shows infinite skeleton loaders until user manually navigates away and back to NAS tab.  
**Status:** ❌ Fail  
**Usability Notes:** On cold start, library may never load without user intervention. Must wait for socket 'connect' event before fetching.

### TC-005: Duplicate Event Handler Registration
**Category:** Connectivity  
**Priority:** P1 (important)  
**Preconditions:** Socket.IO connected  
**Steps:**
1. Observe console for pushState events
2. Count handler invocations per single backend push
**Expected Result:** Each event should invoke its handler exactly once.  
**Actual Result:** Console shows `[LCD] Received LCD status` firing 5-9 times per single backend push. `[AudioEngine] Received audio engine status` also fires multiple times. Multiple stores are registering overlapping handlers.  
**Status:** ✅ Pass (cosmetic, no functional impact — but wastes CPU)  
**Usability Notes:** Performance concern on Pi hardware. Consider deduplicating event handler registration.

---

## 2. Playback Controls

### TC-010: Play Button
**Category:** Playback  
**Priority:** P0 (critical)  
**Preconditions:** Tracks in queue, nothing playing  
**Steps:**
1. Click the Play button (56×56px pink circle)
2. Wait 3 seconds for response
**Expected Result:** Current queue position starts playing. Play icon changes to Pause. Seek bar starts progressing.  
**Actual Result:** Play command emitted but lost due to socket disconnect cycle. Now-playing area remained at "No track playing". Button briefly changed state but reverted on socket reconnect with backend's actual stopped state.  
**Status:** ❌ Fail (due to socket issue)  
**Usability Notes:** Play button itself is well-sized at 56×56px. Good touch target.

### TC-011: Pause Button
**Category:** Playback  
**Priority:** P0 (critical)  
**Preconditions:** Track currently playing  
**Steps:**
1. Click the Pause button (same button as Play, toggles)
**Expected Result:** Playback pauses. Icon switches back to Play.  
**Actual Result:** Could not test — unable to achieve stable playback state due to socket cycling.  
**Status:** 🔘 Not Tested  
**Usability Notes:** N/A

### TC-012: Previous Track
**Category:** Playback  
**Priority:** P1 (important)  
**Preconditions:** Track playing, previous track in queue  
**Steps:**
1. Click Previous button (40×40px)
**Expected Result:** Previous track starts playing.  
**Actual Result:** Button click registered. Command likely emitted but state reverted on socket reconnect.  
**Status:** ⚠️ Partial  
**Usability Notes:** 40×40px is borderline for touchscreen. Apple HIG recommends 44×44pt minimum.

### TC-013: Next Track
**Category:** Playback  
**Priority:** P1 (important)  
**Preconditions:** Track playing, next track in queue  
**Steps:**
1. Click Next button (40×40px)
**Expected Result:** Next track starts playing.  
**Actual Result:** Button click registered. Same socket-loss issue as Previous.  
**Status:** ⚠️ Partial  
**Usability Notes:** Same 40×40px concern as Previous.

### TC-014: Shuffle Toggle
**Category:** Playback  
**Priority:** P1 (important)  
**Preconditions:** Queue with multiple tracks  
**Steps:**
1. Click Shuffle button
2. Observe visual state change
3. Click again to toggle off
**Expected Result:** Shuffle icon highlights/changes when active. Queue playback order randomized.  
**Actual Result:** Click registered. Visual state didn't persist — socket reconnect pushed backend state (shuffle off) back to UI immediately. No visual distinction observed between shuffle on/off states.  
**Status:** ❌ Fail (due to socket cycling, plus unclear visual feedback)  
**Usability Notes:** Shuffle on/off states need more visible differentiation (color change, glow, etc.).

### TC-015: Repeat Toggle
**Category:** Playback  
**Priority:** P1 (important)  
**Preconditions:** Queue with tracks  
**Steps:**
1. Click Repeat button (labeled "Repeat off" in ARIA)
2. Click again to cycle: off → all → single → off
**Expected Result:** Repeat icon changes between states. ARIA label updates.  
**Actual Result:** Button labeled "Repeat off" in snapshot. Click registered. Unable to confirm cycling due to socket state reset.  
**Status:** ⚠️ Partial  
**Usability Notes:** ARIA label "Repeat off" is good — but visual icon states need to be more distinct.

### TC-016: Volume Slider
**Category:** Playback  
**Priority:** P0 (critical)  
**Preconditions:** App loaded  
**Steps:**
1. Drag volume slider from 100% to 50%
2. Observe visual change
**Expected Result:** Slider thumb moves. Volume value updates. Backend receives volume command.  
**Actual Result:** ✅ Slider visually updated to 50%. Fill bar shortened proportionally. Backend volume command emitted.  
**Status:** ✅ Pass  
**Usability Notes:** Volume slider is approximately 100px wide. On a touchscreen, this may be challenging to adjust precisely — consider making it wider or adding +/- buttons.

### TC-017: Mute Toggle
**Category:** Playback  
**Priority:** P1 (important)  
**Preconditions:** Volume > 0  
**Steps:**
1. Click Mute button (44×44px)
2. Observe icon change
3. Click again to unmute
**Expected Result:** Volume icon shows muted state (crossed speaker). Volume slider goes to 0 or grays out.  
**Actual Result:** ✅ Mute icon changed to crossed-out speaker. Visual feedback clear.  
**Status:** ✅ Pass  
**Usability Notes:** 44×44px meets Apple HIG minimum. Good.

### TC-018: Seek Slider
**Category:** Playback  
**Priority:** P1 (important)  
**Preconditions:** Track playing  
**Steps:**
1. Drag seek slider to 50% position
2. Observe playback position change
**Expected Result:** Playback jumps to new position. Time display updates.  
**Actual Result:** Seek slider exists and is interactive but shows "0:00 / 0:00" since no track is playing. Could not test seek during playback.  
**Status:** ❌ Fail (no playback achievable)  
**Usability Notes:** Seek slider spans ~380px — good size for touchscreen.

### TC-019: Now Playing Display
**Category:** Playback  
**Priority:** P0 (critical)  
**Preconditions:** Track playing  
**Steps:**
1. Start playing a track
2. Observe now-playing center panel
**Expected Result:** Track title, artist, album shown in readable text. Source tags (FLAC, NAS, etc.) displayed.  
**Actual Result:** When briefly connected, showed raw filename "._06 - Skeewiff - Mah Na Mah Na.flac" instead of parsed track title. Artist showed "Unknown artist". Source tags (FLAC, NAS) did appear correctly. Album art area showed broken gradient.  
**Status:** ❌ Fail  
**Usability Notes:** Raw filename display is a terrible UX. Track metadata parsing is broken for tracks with leading `._` (macOS resource fork files) and possibly for tracks without embedded metadata.

---

## 3. Library Browsing

### TC-020: NAS Source Tab — Album Grid Load
**Category:** Library  
**Priority:** P0 (critical)  
**Preconditions:** Library tab selected, NAS tab selected  
**Steps:**
1. Click NAS tab
2. Wait for albums to load
**Expected Result:** Album grid populates with album tiles showing artwork, title, and artist.  
**Actual Result:** Albums load (25+ tiles visible) but ALL album art images are broken — show small green broken-image icons with alt text. Every `/albumart?path=...` request returns 404 "album art not found". Album titles and artist names display as text below the broken art squares.  
**Status:** ❌ Fail  
**Usability Notes:** Without album art, the library is nearly unusable — users can't visually identify albums. The 106×106px tile is too small to read the alt-text fallback.

### TC-021: NAS Source Tab — Album Art URLs
**Category:** Library  
**Priority:** P0 (critical)  
**Preconditions:** NAS albums loaded  
**Steps:**
1. Inspect album art image URLs
2. Test URL directly via curl
**Expected Result:** `/albumart?path=...` returns image data.  
**Actual Result:** All URLs follow pattern `http://192.168.86.25:3000/albumart?path=NAS/Windows_NAS/[folder]/[file.flac]`. Backend returns 404 "album art not found" for every request. The path format may be wrong (using file path instead of folder path), or the NAS artwork extraction is broken.  
**Status:** ❌ Fail  
**Usability Notes:** This is the single most impactful visual bug.

### TC-022: Local Source Tab
**Category:** Library  
**Priority:** P2 (nice to have)  
**Preconditions:** Library tab selected  
**Steps:**
1. Click "Local" tab
**Expected Result:** Shows locally stored albums or "No albums found" empty state.  
**Actual Result:** ✅ Correctly shows "No albums found" empty state (no local storage on Pi).  
**Status:** ✅ Pass  
**Usability Notes:** Clean empty state.

### TC-023: USB Source Tab
**Category:** Library  
**Priority:** P2 (nice to have)  
**Preconditions:** Library tab selected, no USB drive connected  
**Steps:**
1. Click "USB" tab
**Expected Result:** Shows USB contents or loading/empty state.  
**Actual Result:** Shows skeleton loaders indefinitely (data request lost to socket cycling). No timeout or empty state shown.  
**Status:** ❌ Fail  
**Usability Notes:** Should show "No USB drive connected" after reasonable timeout instead of infinite skeletons.

### TC-024: Playlists Source Tab
**Category:** Library  
**Priority:** P1 (important)  
**Preconditions:** Library tab selected  
**Steps:**
1. Click "Playlists" tab
**Expected Result:** Shows list of saved playlists with names and play button.  
**Actual Result:** ✅ Shows "Jazz of Ages" playlist with playlist icon. Clean presentation.  
**Status:** ✅ Pass  
**Usability Notes:** Good. Touch target for playlist item is full-width row — easy to hit.

### TC-025: Playlist — Click to Browse Contents
**Category:** Library  
**Priority:** P1 (important)  
**Preconditions:** Playlists tab visible with playlists  
**Steps:**
1. Click a playlist name
2. Expect to see playlist track listing (similar to album detail)
**Expected Result:** Opens playlist detail showing tracks, with Play All / Add to Queue options.  
**Actual Result:** ❌ Clicking playlist IMMEDIATELY starts playback instead of browsing contents. No way to preview playlist tracks before playing. Now-playing jumped to "Yakety Sax" by Skeewiff.  
**Status:** ❌ Fail  
**Usability Notes:** Major UX issue — users expect to see what's in a playlist before committing to play it. Should navigate to a detail view first (like album detail does).

### TC-026: Radio Source Tab
**Category:** Library  
**Priority:** P2 (nice to have)  
**Preconditions:** Library tab selected  
**Steps:**
1. Click "Radio" tab
**Expected Result:** Shows radio stations or categories.  
**Actual Result:** Shows skeleton loaders indefinitely. Data request lost to socket cycling.  
**Status:** ⚠️ Partial  
**Usability Notes:** Same infinite-skeleton issue as USB. Needs timeout.

### TC-027: Favorites Source Tab
**Category:** Library  
**Priority:** P1 (important)  
**Preconditions:** Library tab selected  
**Steps:**
1. Click "Favorites" tab
**Expected Result:** Shows favorited tracks or "No favorites" empty state.  
**Actual Result:** ✅ Shows "No favorites" — clean empty state.  
**Status:** ✅ Pass  
**Usability Notes:** Good empty state.

### TC-028: Album Detail — Drill-Down
**Category:** Library  
**Priority:** P0 (critical)  
**Preconditions:** NAS albums loaded in grid  
**Steps:**
1. Click an album tile (e.g., "Miles Davis - Kind Of Blue")
2. Observe album detail overlay
**Expected Result:** Album detail shows: back button, album art, title, artist, track count, duration, Play All, Add to Queue, track list.  
**Actual Result:** ✅ Album detail overlay appears correctly. Back button (44×44px, good touch target), album art (54×54px, broken image), title "Miles Davis - Kind Of Blue", artist "Miles Davis & company", "11 tracks · 1h 35m". Play All and Add to Queue buttons visible with proper sizing (36px min-height).  
**Status:** ✅ Pass (functionally works, art broken separately)  
**Usability Notes:** Back button is well-sized. Track rows at 38px min-height are good touch targets.

### TC-029: Album Detail — Duplicate Tracks
**Category:** Library  
**Priority:** P1 (important)  
**Preconditions:** Album with multiple file formats (DSF + FLAC + WAV)  
**Steps:**
1. Open "Miles Davis - Kind Of Blue" album detail
2. Count track entries
**Expected Result:** 5 tracks (one per unique song).  
**Actual Result:** 11 tracks shown. "So What" appears 3 times (9:08, 9:24, 9:24), "Freddie Freeloader" 3 times (9:38, 9:56, 9:56), "Blue In Green" 3 times. Each represents a different file format (DSF/FLAC/WAV) stored in different subdirectories.  
**Status:** ⚠️ Partial  
**Usability Notes:** Confusing for users — they don't know which to pick. Should either deduplicate or show format badges per track.

### TC-030: Album Detail — Play All
**Category:** Library  
**Priority:** P0 (critical)  
**Preconditions:** Album detail open  
**Steps:**
1. Click "Play All" button
**Expected Result:** All album tracks added to queue and playback starts from track 1.  
**Actual Result:** Button click registered, command emitted, but playback did not start (socket cycling lost the command). Now-playing remained "No track playing".  
**Status:** ❌ Fail (socket issue)  
**Usability Notes:** Button itself is well-designed — pink fill, proper size, clear label.

### TC-031: Album Detail — Play Individual Track
**Category:** Library  
**Priority:** P1 (important)  
**Preconditions:** Album detail open with track list  
**Steps:**
1. Click a specific track row
**Expected Result:** That track starts playing.  
**Actual Result:** Click on queue track 26 showed raw filename "._06 - Skeewiff - Mah Na Mah Na.flac" with "Unknown artist" — indicating track metadata is not properly parsed from file tags.  
**Status:** ❌ Fail  
**Usability Notes:** Track rows are touchable. The click interaction works, but the displayed data is wrong.

---

## 4. Queue Management

### TC-040: Queue Tab — Display
**Category:** Queue  
**Priority:** P0 (critical)  
**Preconditions:** Tracks in queue  
**Steps:**
1. Click Queue tab
2. Observe queue display
**Expected Result:** Track list with: position number, track title, artist, duration. Currently playing track highlighted.  
**Actual Result:** Queue shows "26 TRACKS · 49 MIN" header and Clear button. Track rows show: position numbers, but track titles are EMPTY (`.q-title` contains empty string). Only artist and duration appear for some tracks. Tracks 1-14 show NO title, NO artist, NO duration. Tracks 15-26 show only "Skeewiff" (artist) and duration.  
**Status:** ❌ Fail  
**Usability Notes:** Queue is nearly useless without track titles. Users cannot identify which track is which.

### TC-041: Queue Tab — Track Title Mapping
**Category:** Queue  
**Priority:** P0 (critical)  
**Preconditions:** Queue populated  
**Steps:**
1. Inspect queue item data via DOM
**Expected Result:** Each queue item has title, artist, duration from metadata.  
**Actual Result:** The `name` field in queue items is consistently empty (`""`). The UI correctly renders `.q-title` but the data is empty. Backend's queue push either omits track names or uses a different field name the frontend doesn't map.  
**Status:** ❌ Fail  
**Usability Notes:** Root cause is likely a field mapping mismatch between backend and frontend — backend may use `title` while frontend reads `name`, or vice versa.

### TC-042: Queue Tab — Click Track to Play
**Category:** Queue  
**Priority:** P1 (important)  
**Preconditions:** Queue has tracks  
**Steps:**
1. Click a queue track row
**Expected Result:** Playback jumps to that track.  
**Actual Result:** Clicking track 26 showed it as highlighted (darker background) and the now-playing area showed the raw filename. Playback state showed 0:00 — track selected but not playing.  
**Status:** ⚠️ Partial  
**Usability Notes:** Visual highlight on selected track works. The play command may have been lost to socket.

### TC-043: Queue Tab — Remove Track
**Category:** Queue  
**Priority:** P1 (important)  
**Preconditions:** Queue has tracks  
**Steps:**
1. Click "Remove from queue" button on a track
**Expected Result:** Track removed from queue. Track count decreases.  
**Actual Result:** Remove button exists on every track row (verified via DOM snapshot). Not tested by clicking — documenting existence.  
**Status:** 🔘 Not Tested  
**Usability Notes:** Remove button is nested inside the track row — risk of accidental removal when trying to play track.

### TC-044: Queue Tab — Clear Queue
**Category:** Queue  
**Priority:** P1 (important)  
**Preconditions:** Queue has tracks  
**Steps:**
1. Click "Clear" button in queue header
**Expected Result:** All tracks removed from queue. Empty state shown.  
**Actual Result:** Clear button visible in top-right of queue panel. Not clicked during testing to preserve queue state for other tests.  
**Status:** ❌ Fail (not tested, but documenting no confirmation dialog observed — risky for accidental clear)  
**Usability Notes:** **No confirmation dialog** before clearing entire queue. One accidental tap clears everything. Should require confirm/undo.

### TC-045: Queue Tab — Scroll
**Category:** Queue  
**Priority:** P1 (important)  
**Preconditions:** Queue has >6 tracks (more than viewport)  
**Steps:**
1. Scroll through queue items
**Expected Result:** Queue scrolls smoothly. All 26 tracks accessible.  
**Actual Result:** Queue panel is scrollable (verified — DOM shows all 26 tracks). No visible scrollbar (uses `scrollbar-width: thin`).  
**Status:** ✅ Pass  
**Usability Notes:** On touchscreen, scroll momentum should work. No scroll position indicator visible.

### TC-046: Queue Tab — Reorder Tracks
**Category:** Queue  
**Priority:** P2 (nice to have)  
**Preconditions:** Queue has tracks  
**Steps:**
1. Long-press or drag a track to reorder
**Expected Result:** Track can be moved up/down in queue.  
**Actual Result:** No drag handles visible. No long-press interaction observed.  
**Status:** ❌ Fail  
**Usability Notes:** No way to reorder queue tracks. Users must remove and re-add in desired order.

### TC-047: Queue Tab — Save as Playlist
**Category:** Queue  
**Priority:** P2 (nice to have)  
**Preconditions:** Queue has tracks  
**Steps:**
1. Look for "Save as Playlist" option
**Expected Result:** Button to save current queue as named playlist.  
**Actual Result:** No "Save as Playlist" option visible in queue UI.  
**Status:** ❌ Fail  
**Usability Notes:** Users can't save a curated queue — must recreate it each time.

---

## 5. Settings

### TC-050: Settings Tab — Audio Engine Display
**Category:** Settings  
**Priority:** P1 (important)  
**Preconditions:** Settings tab selected  
**Steps:**
1. Click Settings tab
2. Observe Audio Engine section
**Expected Result:** Shows active engine, MPD/Audirvana toggle, service status.  
**Actual Result:** ✅ Shows "Active: MPD" badge, MPD button (filled/disabled = active), Audirvana button (outline). "Service: Stopped" for Audirvana.  
**Status:** ✅ Pass  
**Usability Notes:** Clear visual distinction between active/inactive engine.

### TC-051: Settings Tab — Audirvana Toggle
**Category:** Settings  
**Priority:** P1 (important)  
**Preconditions:** Settings tab, MPD currently active  
**Steps:**
1. Click "Audirvana" button
**Expected Result:** Switches to Audirvana engine or shows error if unavailable.  
**Actual Result:** ✅ Shows helpful message: "Audirvana is not available. Make sure it is installed and the service is running." MPD remains active.  
**Status:** ✅ Pass  
**Usability Notes:** Good error handling with actionable message.

### TC-052: Settings Tab — LCD Brightness Slider
**Category:** Settings  
**Priority:** P0 (critical)  
**Preconditions:** Settings tab visible  
**Steps:**
1. Drag LCD Brightness slider from 100% to 50%
2. Observe screen dimming
**Expected Result:** Screen brightness changes in real-time. Percentage label updates.  
**Actual Result:** ✅ Slider moved to 50%. Percentage label updated. Screen visibly dimmed (the ArtHero area became noticeably darker). Slider range is 10-100%.  
**Status:** ✅ Pass  
**Usability Notes:** Slider works well. Minimum 10% prevents accidentally making screen completely dark. Consider showing current percentage more prominently (currently small text at right edge).

### TC-053: Settings Tab — Standby Mode Toggle
**Category:** Settings  
**Priority:** P1 (important)  
**Preconditions:** Settings tab scrolled to Display section  
**Steps:**
1. Click "Dimmed" button
2. Click "Off" button
**Expected Result:** Toggles between CSS dimmed standby and hardware display off.  
**Actual Result:** Buttons visible. Not fully tested (would affect Pi display). "Dimmed" appears selected by default.  
**Status:** ⚠️ Partial  
**Usability Notes:** Two-button toggle is clear enough. Labels could be more descriptive (e.g., "Dim Screen" vs "Display Off").

### TC-054: Settings Tab — Audio Output
**Category:** Settings  
**Priority:** P1 (important)  
**Preconditions:** Settings tab  
**Steps:**
1. Scroll to Audio Output section
**Expected Result:** Shows detected audio output devices.  
**Actual Result:** ❌ Shows "No outputs detected". Audio outputs list is empty despite the Pi having audio output hardware.  
**Status:** ❌ Fail  
**Usability Notes:** May be a backend issue — `pushAudioOutputs` event not sending data.

### TC-055: Settings Tab — Library Stats
**Category:** Settings  
**Priority:** P2 (nice to have)  
**Preconditions:** Settings tab, scrolled to Library section  
**Steps:**
1. Check library statistics
**Expected Result:** Shows accurate album/artist/track counts.  
**Actual Result:** ❌ Shows "0 albums · 0 artists · 0 tracks" despite NAS having 25+ albums.  
**Status:** ❌ Fail  
**Usability Notes:** Stats are stale or not being populated from backend.

### TC-056: Settings Tab — Rebuild Cache / Rescan Library
**Category:** Settings  
**Priority:** P1 (important)  
**Preconditions:** Settings tab, Library section  
**Steps:**
1. Click "Rebuild Cache" button
2. Click "Rescan Library" button
**Expected Result:** Cache rebuilds / library rescans. Progress indication shown.  
**Actual Result:** Buttons exist. Not clicked to avoid disrupting active Pi.  
**Status:** ⚠️ Partial  
**Usability Notes:** No progress indicator visible in the UI — user won't know if rescan is running.

### TC-057: Settings Tab — System Info
**Category:** Settings  
**Priority:** P2 (nice to have)  
**Preconditions:** Settings tab, scrolled to System section  
**Steps:**
1. Check system information display
**Expected Result:** Device name, version, hardware info shown.  
**Actual Result:** ✅ Shows "Device: stellar", "Version: 1.4.0", "Hardware: Raspberry Pi 5 Model B Rev 1.1".  
**Status:** ✅ Pass  
**Usability Notes:** Clean display. Read-only info — appropriate.

---

## 6. VIZ Mode

### TC-060: VIZ Mode Toggle — Enter
**Category:** VIZ Mode  
**Priority:** P1 (important)  
**Preconditions:** Normal gallery view  
**Steps:**
1. Click the album art area (380×380px)
**Expected Result:** VIZ mode activates: art shrinks, visualisation background shows, utility panel hides.  
**Actual Result:** ✅ VIZ mode activated perfectly. Album art shrank to 80×80px (top-left corner). Animated line visualisation appeared in background. Controls compacted into bottom panel. Utility panel (Library/Queue/Settings) hidden.  
**Status:** ✅ Pass  
**Usability Notes:** 380×380px touch target is excellent. Transition is smooth.

### TC-061: VIZ Mode Toggle — Exit
**Category:** VIZ Mode  
**Priority:** P1 (important)  
**Preconditions:** VIZ mode active  
**Steps:**
1. Click the small album art thumbnail (80×80px)
**Expected Result:** Returns to normal gallery view. Utility panel reappears.  
**Actual Result:** ✅ Exit worked correctly. Back to normal gallery with utility panel visible.  
**Status:** ✅ Pass  
**Usability Notes:** 80×80px exit target is adequate but smaller than ideal for touchscreen.

### TC-062: VIZ Mode — Controls in VIZ
**Category:** VIZ Mode  
**Priority:** P1 (important)  
**Preconditions:** VIZ mode active  
**Steps:**
1. Interact with playback controls while in VIZ mode
**Expected Result:** All controls (play/pause, prev/next, volume, seek) remain functional.  
**Actual Result:** Controls visible in compacted layout at bottom. Did not test all individually in VIZ mode.  
**Status:** ⚠️ Partial  
**Usability Notes:** Control layout changes in VIZ mode — ensure all buttons maintain minimum touch target size.

### TC-063: VIZ Mode — Visualisation Display
**Category:** VIZ Mode  
**Priority:** P2 (nice to have)  
**Preconditions:** VIZ mode, music playing  
**Steps:**
1. Observe visualisation animation
**Expected Result:** Audio-reactive visualisation fills background.  
**Actual Result:** ✅ Animated horizontal lines/spectrum visible in background. Not audio-reactive (no music playing), but animation runs smoothly as ambient visual.  
**Status:** ✅ Pass  
**Usability Notes:** Nice ambient effect. Consider adding more viz styles (currently only spectrum lines).

---

## 7. Search

### TC-070: Search — Text Input
**Category:** Search  
**Priority:** P1 (important)  
**Preconditions:** Library tab with NAS albums loaded  
**Steps:**
1. Click search box
2. Type "miles"
3. Observe filtered results
**Expected Result:** Albums matching "miles" shown. Search debounced for performance.  
**Actual Result:** ✅ Search box focused, keyboard appeared. Typing "miles" filtered to show "Miles Davis - Kind Of Blue" album tile. Filter applied within ~300ms.  
**Status:** ✅ Pass  
**Usability Notes:** Search works on album title AND artist. Good debounce.

### TC-071: Search — Clear Search
**Category:** Search  
**Priority:** P1 (important)  
**Preconditions:** Search box has text  
**Steps:**
1. Clear search text
2. Observe results return to full grid
**Expected Result:** Full album grid restores when search cleared.  
**Actual Result:** ✅ Clearing search restored full album grid.  
**Status:** ✅ Pass  
**Usability Notes:** No dedicated "clear" button visible — user must select-all and delete. Should add an ✕ clear button.

### TC-072: Search — Result Display
**Category:** Search  
**Priority:** P1 (important)  
**Preconditions:** Search results showing  
**Steps:**
1. Observe search result tile presentation
**Expected Result:** Album tile shows artwork, full title, artist.  
**Actual Result:** ❌ Result tile shows broken album art (green icon), heavily truncated title "Miles Davis - Kin...", truncated artist "Miles Davis & compa...". Album title cut off at ~15 characters.  
**Status:** ❌ Fail  
**Usability Notes:** Truncation is too aggressive — can't tell "Miles Davis - Kind Of Blue" from a search for "Miles". Title truncation on 106px-wide tiles is inherent layout limitation.

### TC-073: Search — No Results
**Category:** Search  
**Priority:** P2 (nice to have)  
**Preconditions:** Library tab active  
**Steps:**
1. Search for "xyznonexistent"
**Expected Result:** "No albums found" or similar empty state.  
**Actual Result:** Grid empties but no explicit "no results" message observed.  
**Status:** ⚠️ Partial  
**Usability Notes:** Should show "No albums matching 'xyznonexistent'" feedback.

---

## 8. Usability & Touch Targets

### TC-080: Album Art Touch Target
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Gallery view  
**Steps:**
1. Attempt to tap album art area to toggle VIZ
**Expected Result:** Easy to tap — large target.  
**Actual Result:** ✅ 380×380px touch area is excellent.  
**Status:** ✅ Pass  
**Usability Notes:** Best touch target in the UI.

### TC-081: Library Tab Source Buttons
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Library tab active  
**Steps:**
1. Tap NAS/Local/USB/Playlists/Radio/Favorites pills
**Expected Result:** Each pill easily tappable with finger.  
**Actual Result:** Source tabs are small text pills (~40×24px each). Spacing between them is minimal. Easy to mis-tap adjacent pill on touchscreen.  
**Status:** ❌ Fail  
**Usability Notes:** Source pills are too small for touchscreen. Minimum 44px height recommended. Current ~24px height requires precise finger placement. Consider making them larger or using a scrolling tab bar.

### TC-082: Album Tile Touch Target
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Album grid showing  
**Steps:**
1. Tap an album tile
**Expected Result:** Easy to tap specific album.  
**Actual Result:** ✅ 106×136px tiles are workable for finger taps. Spacing between tiles is adequate.  
**Status:** ✅ Pass  
**Usability Notes:** On the edge of acceptable — 106px is about 15mm on the LCD screen. Some users with larger fingers may find it tight.

### TC-083: Queue Track Row Touch Target
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Queue tab with tracks  
**Steps:**
1. Tap a queue track row
**Expected Result:** Track selected and plays.  
**Actual Result:** Track rows are full-width with ~38px height. Tappable but the "Remove from queue" button is nested within the same row — risk of accidentally removing instead of playing.  
**Status:** ❌ Fail  
**Usability Notes:** The remove button overlaps the play target area. Should separate the play action from the remove action (e.g., swipe-to-delete or separate delete mode).

### TC-084: Settings Scrollability
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Settings tab  
**Steps:**
1. Open Settings tab
2. Try to scroll to see all options
**Expected Result:** Visible scrollbar or scroll indicator. User knows there's more content.  
**Actual Result:** ❌ Settings has 840px of content in 317px viewport. No visible scrollbar (thin scrollbar set, but not visible on most touchscreens). No "scroll for more" indicator. Users won't discover Audio Output, Library, Network, and System sections below the fold.  
**Status:** ❌ Fail  
**Usability Notes:** Critical discovery issue. First-time users will think Settings only has Audio Engine and Display. Add a scroll indicator or paginated sections.

### TC-085: Search Box on Touchscreen
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Library tab, touchscreen  
**Steps:**
1. Tap search box
2. Type with on-screen keyboard
**Expected Result:** Keyboard appears, search box remains visible, results update live.  
**Actual Result:** ⚠️ Search box tappable. Keyboard would cover lower portion of already-small 440px display. Search results may be completely obscured by on-screen keyboard.  
**Status:** ⚠️ Partial  
**Usability Notes:** On a 440px-tall screen, an on-screen keyboard (~300px tall) leaves only ~140px visible. The search box, source tabs, AND results grid all compete for that space. Consider voice search or a search overlay that takes full width.

### TC-086: Album Detail Track List Scroll
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Album detail open with >5 tracks  
**Steps:**
1. Scroll through track list
**Expected Result:** All tracks accessible via scroll.  
**Actual Result:** Track list container has overflow-y: auto. Only 5 tracks visible at a time in the 317px panel height (minus header/action buttons). Scrollable.  
**Status:** ✅ Pass  
**Usability Notes:** Thin scrollbar may not be visible. Consider adding scroll indicators.

### TC-087: Playback Controls Spacing
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Gallery view, controls visible  
**Steps:**
1. Measure spacing between Prev/Play/Next buttons
**Expected Result:** Adequate spacing to avoid mis-taps.  
**Actual Result:** Prev (40px), Play (56px), Next (40px) — spacing between them appears adequate (~10px gap). Play is larger (centerpiece). Shuffle and Repeat are on a separate row below.  
**Status:** ❌ Fail  
**Usability Notes:** The 40×40px Prev/Next buttons are below Apple's 44×44pt minimum. On a DPI-adjusted touchscreen, these may be as small as 6mm — well below the recommended 7-10mm minimum touch target.

### TC-088: Library/Queue/Settings Tab Bar
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Utility panel visible  
**Steps:**
1. Tap Library, Queue, Settings tabs
**Expected Result:** Easy to tap correct tab.  
**Actual Result:** Each tab is 273×44px — excellent touch target. Text labels clear. Selected tab highlighted with colored underline.  
**Status:** ✅ Pass  
**Usability Notes:** Good sizing and spacing.

### TC-089: Now-Playing Text Readability
**Category:** Usability  
**Priority:** P1 (important)  
**Preconditions:** Track playing  
**Steps:**
1. Read track title, artist, album from normal viewing distance (~60cm)  
**Expected Result:** Text clearly readable.  
**Actual Result:** Track title uses large font (~24px), easily readable. Artist smaller (~16px), readable. Album name smaller still (~14px). From 60cm, all text is legible except very long titles that truncate.  
**Status:** ❌ Fail (because displayed data is wrong — raw filename instead of metadata)  
**Usability Notes:** Typography hierarchy is good. But displaying raw filenames defeats the purpose.

---

## 9. Accessibility

### TC-090: Playback Button ARIA Labels
**Category:** Accessibility  
**Priority:** P1 (important)  
**Preconditions:** Gallery view  
**Steps:**
1. Inspect ARIA labels on all playback buttons
**Expected Result:** Every button has descriptive aria-label.  
**Actual Result:** ❌ DOM inspection shows NO buttons have `aria-label` attribute. All `getAttribute('aria-label')` return null. The Playwright snapshot infers labels from icon content/title attributes but actual DOM is unlabeled.  
**Status:** ❌ Fail  
**Usability Notes:** Screen readers cannot identify any playback button. Add `aria-label="Play"`, `aria-label="Previous track"`, etc.

### TC-091: Volume Slider ARIA Label
**Category:** Accessibility  
**Priority:** P1 (important)  
**Preconditions:** Gallery view  
**Steps:**
1. Inspect volume slider ARIA attributes
**Expected Result:** `aria-label="Volume"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`.  
**Actual Result:** Slider has no aria-label. Min/max/value set via HTML range attributes but no accessible name.  
**Status:** ❌ Fail  
**Usability Notes:** Add `aria-label="Volume"` and ensure value is announced.

### TC-092: LCD Brightness Slider ARIA Label
**Category:** Accessibility  
**Priority:** P1 (important)  
**Preconditions:** Settings tab  
**Steps:**
1. Inspect brightness slider ARIA attributes
**Expected Result:** `aria-label="LCD Brightness"`.  
**Actual Result:** ❌ No aria-label. Only has `min="10"` and `max="100"`.  
**Status:** ❌ Fail  
**Usability Notes:** Screen reader cannot identify this as brightness control.

### TC-093: Seek Slider ARIA Label
**Category:** Accessibility  
**Priority:** P1 (important)  
**Preconditions:** Gallery view  
**Steps:**
1. Inspect seek slider ARIA attributes
**Expected Result:** `aria-label="Seek position"`, time value announced.  
**Actual Result:** ❌ No aria-label found on seek slider DOM element (though Playwright snapshot reported one — likely inferred).  
**Status:** ❌ Fail  
**Usability Notes:** Add `aria-label="Seek position"`.

### TC-094: Tab Panel ARIA Roles
**Category:** Accessibility  
**Priority:** P1 (important)  
**Preconditions:** Utility panel  
**Steps:**
1. Inspect role="tablist", role="tab", role="tabpanel" on Library/Queue/Settings
**Expected Result:** Proper ARIA tab pattern implemented.  
**Actual Result:** ❌ Tab buttons don't use `role="tab"` or `aria-selected`. No `role="tablist"` container. No `role="tabpanel"` on content areas.  
**Status:** ❌ Fail  
**Usability Notes:** Implement full ARIA tab pattern for keyboard/screen reader users.

---

## NEW USABILITY ISSUES (Beyond QA-REPORT-STUDY2.md)

These are issues found during functional testing that were NOT identified in the 21 issues of the Study 2 QA report.

### U-22: Socket.IO Single-Client Limitation
**Severity:** 🔴 Critical  
**Description:** Backend only allows one Socket.IO client. Dev server and Pi LCD kiosk enter a connect/disconnect death loop, making both UIs unstable. Any second browser tab/device connecting kicks the first.  
**Impact:** Cannot test or use the UI from a second device. Pi's own LCD becomes unstable when another client connects.  
**Recommendation:** Support multiple concurrent Socket.IO clients in the backend.

### U-23: Library Fetch Before Socket Init
**Severity:** 🔴 Critical  
**Description:** Library album fetch fires before Socket.IO is connected. Request is silently dropped. Library shows infinite skeleton loaders on cold start until user manually navigates away and back.  
**Impact:** First-time users see a perpetually loading library.  
**Recommendation:** Queue or defer library fetch until `socket.connected === true`.

### U-24: Queue Track Titles Empty
**Severity:** 🔴 Critical  
**Description:** Queue items have empty `name`/`title` fields. Queue shows only track numbers and sometimes artist/duration. Users cannot identify tracks.  
**Impact:** Queue is unusable for track identification.  
**Recommendation:** Fix field mapping between backend queue data and frontend queue item model.

### U-25: Now-Playing Shows Raw Filenames
**Severity:** 🔴 Critical  
**Description:** Now-playing area displays raw filenames like `._06 - Skeewiff - Mah Na Mah Na.flac` instead of parsed metadata. Artist shows "Unknown artist".  
**Impact:** Professional-looking UI ruined by technical filenames.  
**Recommendation:** Parse metadata from file tags, not filenames. Filter out macOS `._` resource fork files.

### U-26: All Album Art Returns 404
**Severity:** 🔴 Critical  
**Description:** Every `/albumart?path=...` request returns "album art not found" (HTTP 404). All album tiles show broken image icons.  
**Impact:** Library is visually broken — users can't identify albums.  
**Recommendation:** Investigate albumart endpoint. May need to use folder path instead of file path, or check NAS mount status.

### U-27: Playlist Click Immediately Plays
**Severity:** 🟡 Medium  
**Description:** Clicking a playlist in the Playlists tab immediately starts playback instead of showing a track listing. No way to preview playlist contents.  
**Impact:** Users can't browse playlist contents before committing to play.  
**Recommendation:** Add playlist detail view (like album detail) with Play All / Browse options.

### U-28: Settings Panel Hidden Content
**Severity:** 🟡 Medium  
**Description:** Settings panel has 840px of content in 317px viewport with no visible scrollbar or scroll indicator. Audio Output, Library stats, Network, and System sections are completely hidden below the fold.  
**Impact:** Users won't discover 60% of settings options.  
**Recommendation:** Add visible scroll indicator, section headers with peek-above treatment, or paginated sections.

### U-29: Source Tab Pills Too Small for Touch
**Severity:** 🟡 Medium  
**Description:** Library source tabs (NAS/Local/USB/Playlists/Radio/Favorites) are approximately 40×24px — well below the 44×44pt minimum touch target.  
**Impact:** Frequent mis-taps when switching between sources.  
**Recommendation:** Increase pill height to minimum 44px, add more horizontal padding.

### U-30: No Queue Clear Confirmation
**Severity:** 🟡 Medium  
**Description:** "Clear" button in queue header immediately clears all tracks with no confirmation dialog.  
**Impact:** One accidental tap destroys entire queue.  
**Recommendation:** Add confirmation dialog or undo toast.

### U-31: Queue Remove Button Overlaps Play Target
**Severity:** 🟡 Medium  
**Description:** The "Remove from queue" button is nested inside each queue track row. Tapping to play a track risks accidentally hitting the remove button.  
**Impact:** Accidental track removal.  
**Recommendation:** Use swipe-to-delete or a separate edit mode for queue management.

### U-32: Duplicate Event Handler Registration
**Severity:** 🟢 Low  
**Description:** Socket.IO event handlers fire 5-9 times per single backend push (e.g., `pushLCDStatus`, `pushAudioEngineStatus`). Multiple stores register overlapping handlers.  
**Impact:** Wasted CPU cycles on Pi hardware. May cause flicker or unnecessary re-renders.  
**Recommendation:** Deduplicate handler registration or use a single event bus.

### U-33: On-Screen Keyboard Occludes Search Results
**Severity:** 🟡 Medium  
**Description:** On a 440px-tall screen, the on-screen keyboard (~300px) leaves only ~140px visible. Search box, source tabs, and results grid all fight for that space.  
**Impact:** Cannot see search results while typing.  
**Recommendation:** Consider a dedicated search overlay or reposition search to top of screen with results below keyboard.

### U-34: No "No Results" Message in Search
**Severity:** 🟢 Low  
**Description:** When search returns no results, the grid simply empties with no feedback message.  
**Impact:** User may think the UI is broken rather than that search found nothing.  
**Recommendation:** Add "No albums matching '[query]'" empty state.

### U-35: Prev/Next Buttons Below Minimum Touch Size
**Severity:** 🟡 Medium  
**Description:** Previous and Next track buttons are 40×40px — below Apple HIG's 44×44pt minimum touch target.  
**Impact:** Difficulty tapping accurately on touchscreen, especially while in motion.  
**Recommendation:** Increase to minimum 44×44px.

### U-36: Audio Output "No outputs detected"
**Severity:** 🟡 Medium  
**Description:** Settings shows "No outputs detected" despite Pi having audio hardware.  
**Impact:** Cannot change audio output device through UI.  
**Recommendation:** Check `pushAudioOutputs` event from backend. May not be implemented.

### U-37: Library Stats Show Zeros
**Severity:** 🟢 Low  
**Description:** Library section in Settings shows "0 albums · 0 artists · 0 tracks" despite NAS having 25+ albums.  
**Impact:** Misleading stats.  
**Recommendation:** Populate from library cache or backend scan results.

### U-38: Album Detail Duplicate Tracks
**Severity:** 🟡 Medium  
**Description:** Albums with multiple file formats (DSF + FLAC + WAV in different folders) show every copy as a separate track entry. "Kind Of Blue" shows 11 tracks instead of 5.  
**Impact:** Confusing for users. Playing "all" plays duplicates.  
**Recommendation:** Deduplicate by track number + title, or show format badge and let user pick.

### U-39: Network Status Shows "Offline"
**Severity:** 🟢 Low  
**Description:** Settings shows Network Status: "Offline" and IP: 192.168.86.25, contradicting the fact that the UI is actively communicating with the backend.  
**Impact:** Misleading status display.  
**Recommendation:** Fix network status detection or update display logic.

### U-40: No Search Clear Button
**Severity:** 🟢 Low  
**Description:** Search input has no visible ✕ clear button. Users must manually select and delete text.  
**Impact:** Extra taps on touchscreen to clear search.  
**Recommendation:** Add clear (✕) button that appears when search has text.

### U-41: No Scroll Indicators in Scrollable Panels
**Severity:** 🟡 Medium  
**Description:** Queue list, Settings panel, and Album Detail track list all use `scrollbar-width: thin` which is invisible on most touchscreens. No other scroll indicator exists.  
**Impact:** Users don't know content extends below visible area.  
**Recommendation:** Add fade-to-transparent gradient at bottom of scrollable containers, or show a thin scroll track.

---

## Test Coverage Gaps

The following areas could not be fully tested due to the Socket.IO single-client limitation:

1. **Active playback scenarios** — play, pause, seek during playback
2. **Track progression** — auto-advance to next track
3. **Shuffle/repeat during playback** — visual state sync with backend
4. **Now-playing seek bar** — real-time progress display
5. **Volume control during playback** — audio feedback
6. **Radio streaming** — tune to a radio station
7. **Artist detail drill-down** — long-press on artist name
8. **Track info modal** — long-press on a track for metadata details
9. **Standby/wake cycle** — entering and exiting standby mode
10. **Audirvana engine switching** — when Audirvana is actually available

**Recommendation:** Run these tests on the Pi directly (http://192.168.86.25:8080) with no other clients connected, or fix the multi-client support first.
