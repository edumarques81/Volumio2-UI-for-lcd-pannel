# Living Gallery — Smoke Test Checklist

## Phase 3 Integration — 2026-03-28

### Prerequisites
- Dev server running: `npm run dev`
- Open `localhost:5173?layout=gallery` (Living Gallery)
- Open `localhost:5173` (Classic LCD — should be unchanged)

---

### 1. Feature Flag Routing
| # | Test | Expected | Status |
|---|------|----------|--------|
| 1.1 | `?layout=gallery` | Renders GalleryLayout (three-zone + viz bg) | ✅ |
| 1.2 | No param | Renders classic LCDLayout | ✅ |
| 1.3 | `?layout=classic` | Renders classic LCDLayout | ✅ |

### 2. Layout & Zones (Gallery Mode)
| # | Test | Expected | Status |
|---|------|----------|--------|
| 2.1 | Three zones visible | Art (left ~380px), NowPlaying (center ~35%), Utility (right ~43%) | ⬜ |
| 2.2 | VizBackground canvas renders | Low-opacity animated waves behind all zones | ⬜ |
| 2.3 | GlobalSeekBar at bottom | 4px bar across full width, expands on hover | ⬜ |
| 2.4 | StandbyOverlay present | Brightness/standby overlay layer exists | ⬜ |
| 2.5 | 1920×440 viewport | Layout fills exactly 1920×440, no scrollbars | ⬜ |

### 3. ArtHero (Left Zone)
| # | Test | Expected | Status |
|---|------|----------|--------|
| 3.1 | Album art displays | Current track's art shown at 380×380 | ⬜ |
| 3.2 | Placeholder gradient | Shows when no art available | ⬜ |
| 3.3 | Glow effect | Radial pink glow behind art | ⬜ |
| 3.4 | Tap toggles VIZ mode | Art shrinks to 80×80, panels collapse | ⬜ |
| 3.5 | Tap again exits VIZ | Returns to full three-zone layout | ⬜ |

### 4. NowPlayingPanel (Center Zone)
| # | Test | Expected | Status |
|---|------|----------|--------|
| 4.1 | Track title | Shows current track name, 32px bold | ⬜ |
| 4.2 | Artist name | Shows below title, 16px, muted colour | ⬜ |
| 4.3 | Album name | Shows below artist, 13px, outline colour | ⬜ |
| 4.4 | Format badges | FLAC/96kHz/24bit/NAS pills display correctly | ⬜ |
| 4.5 | Play/Pause | Custom SVG icon toggles, sends play/pause | ⬜ |
| 4.6 | Previous | Custom SVG icon, sends prev command | ⬜ |
| 4.7 | Next | Custom SVG icon, sends next command | ⬜ |
| 4.8 | Shuffle toggle | Highlights when active (pink), sends toggle | ⬜ |
| 4.9 | Repeat cycle | Off → All → One → Off, correct icon per state | ⬜ |
| 4.10 | Volume slider | Drag to change, sends setVolume | ⬜ |
| 4.11 | Mute toggle | Icon switches (VolumeHigh ↔ VolumeMute) | ⬜ |
| 4.12 | Seek bar (panel) | Drag to seek, progress tracks playback | ⬜ |
| 4.13 | Time display | Current/total time in mm:ss format | ⬜ |

### 5. UtilityPanel (Right Zone)
| # | Test | Expected | Status |
|---|------|----------|--------|
| 5.1 | Three tabs | Library / Queue / Settings tabs visible | ⬜ |
| 5.2 | Tab switching | Click tab → content switches, underline moves | ⬜ |
| 5.3 | Active tab highlight | Active tab shows pink text + bottom border | ⬜ |
| 5.4 | Glassmorphism | Panel has blur/transparency matching mockup | ⬜ |

### 6. Library Tab
| # | Test | Expected | Status |
|---|------|----------|--------|
| 6.1 | Source tabs | NAS / Local / USB / Playlists / Radio / Favorites | ⬜ |
| 6.2 | Album grid | Album cards in responsive grid | ⬜ |
| 6.3 | Album hover | Play icon overlay on hover | ⬜ |
| 6.4 | Search bar | Filters as you type (with search icon) | ⬜ |
| 6.5 | Album click → detail | Opens AlbumDetailOverlay with tracks | ⬜ |
| 6.6 | Album detail: back | Returns to album grid | ⬜ |
| 6.7 | Album detail: Play All | Plays entire album | ⬜ |
| 6.8 | Album detail: Add to Queue | Adds album to queue | ⬜ |
| 6.9 | Playlist source | Shows playlist names with playlist icon | ⬜ |
| 6.10 | Radio source | Shows stations with radio icon | ⬜ |
| 6.11 | Favorites source | Shows favorites with filled star icon | ⬜ |

### 7. Queue Tab
| # | Test | Expected | Status |
|---|------|----------|--------|
| 7.1 | Queue list | Shows all queued tracks | ⬜ |
| 7.2 | Current track | Highlighted with pink background | ⬜ |
| 7.3 | Play indicator | Playing track shows play icon instead of number | ⬜ |
| 7.4 | Click to play | Tapping a track plays it | ⬜ |
| 7.5 | Remove button | X button on hover, removes track | ⬜ |
| 7.6 | Drag handle | Visible on hover, drag to reorder | ⬜ |
| 7.7 | Clear queue | Button clears all tracks | ⬜ |
| 7.8 | Empty state | Shows queue icon + "Queue empty" message | ⬜ |
| 7.9 | Track count/duration | Header shows "N tracks · Xh Ym" | ⬜ |

### 8. Settings Tab
| # | Test | Expected | Status |
|---|------|----------|--------|
| 8.1 | LCD Brightness | Slider 10-100%, applies CSS filter | ⬜ |
| 8.2 | Standby mode | Dimmed / Off toggle | ⬜ |
| 8.3 | Audio outputs | Lists available outputs with checkmark | ⬜ |
| 8.4 | Library stats | Album/artist/track count | ⬜ |
| 8.5 | Rebuild / Rescan | Buttons trigger actions | ⬜ |
| 8.6 | Network status | Shows online/offline + IP | ⬜ |
| 8.7 | System info | Device name, version, hardware | ⬜ |

### 9. VIZ Mode
| # | Test | Expected | Status |
|---|------|----------|--------|
| 9.1 | Enter VIZ | Tap ArtHero → art shrinks, panels collapse | ⬜ |
| 9.2 | VizBackground opacity | Ramps from 0.18 → 0.85 | ⬜ |
| 9.3 | Compact bar | Art 80×80 + NowPlayingPanel in compact layout | ⬜ |
| 9.4 | UtilityPanel hides | Right panel not shown in VIZ mode | ⬜ |
| 9.5 | GlobalSeekBar | Still visible at bottom in VIZ mode | ⬜ |
| 9.6 | Exit VIZ | Tap ArtHero again → full layout restored | ⬜ |
| 9.7 | Animation timing | All transitions 400ms cubic-bezier | ⬜ |

### 10. Navigation Integration
| # | Test | Expected | Status |
|---|------|----------|--------|
| 10.1 | `navigationActions.goToQueue()` | Switches to Queue tab | ⬜ |
| 10.2 | `navigationActions.goToSettings()` | Switches to Settings tab | ⬜ |
| 10.3 | `navigationActions.goHome()` | Switches to Library tab | ⬜ |
| 10.4 | `navigationActions.goToPlayer()` | Keeps current tab (gallery IS player) | ⬜ |
| 10.5 | `navigationActions.goToAllAlbums()` | Switches to Library tab | ⬜ |
| 10.6 | Tab state preserved across nav | Manual tab choice overrides nav-driven | ⬜ |

### 11. Custom SVG Icons
| # | Test | Expected | Status |
|---|------|----------|--------|
| 11.1 | No emoji anywhere | All controls use custom SVG icon components | ✅ |
| 11.2 | Transport icons | Play/Pause/Next/Previous render correctly | ⬜ |
| 11.3 | Control icons | Shuffle/Repeat/RepeatOne/Volume variants | ⬜ |
| 11.4 | Navigation icons | Back/Close/ChevronRight in overlays | ⬜ |
| 11.5 | Content icons | Playlist/Radio/Favorite/Play in library | ⬜ |
| 11.6 | Action icons | DragHandle/Delete/AddToQueue in queue/detail | ⬜ |
| 11.7 | Icon sizing | Standard (24), primary (32), compact (20) | ⬜ |
| 11.8 | Colour inheritance | All icons use currentColor by default | ⬜ |

### 12. Classic Layout Regression
| # | Test | Expected | Status |
|---|------|----------|--------|
| 12.1 | Classic renders | `localhost:5173` shows LCDLayout as before | ✅ |
| 12.2 | Playback works | Play/pause/seek in classic mode | ⬜ |
| 12.3 | Mobile/Desktop | Non-LCD layouts unaffected | ⬜ |

---

### Issues Found During Integration

1. **QueueTab: button nesting** — `<button>` inside `<button>` caused Svelte build error. Fixed by changing outer to `<div role="button">`.
2. **UtilityPanel: unused GlassPanel import** — removed dead import.
3. **LibraryTab: search input missing `id`** — failed accessibility test. Added `id="library-search"`.
4. **Pre-existing test failures** — `localMusic.test.ts` and `sources.test.ts` fail independently of our changes (localStorage mock issue).

### Build Verification
- `npx tsc --noEmit` — ✅ Clean
- `npm run build` — ✅ Success (1.75s)
- `npm run test:run` — ✅ 702/702 passed (2 pre-existing file-level failures unrelated)

---

### Phase 4 Polish Items (for Diomedes review)
- Pixel-perfect spacing audit vs Study 2 mockup
- VIZ mode compact bar exact positioning
- Touch interaction testing at 1920×440
- Performance profiling on Raspberry Pi (FPS, CPU, memory)
- Animation timing curves match mockup
- Scrollbar styling consistency
- Skeleton loading states polish
