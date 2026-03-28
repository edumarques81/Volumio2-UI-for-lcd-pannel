# LCD Redesign Mockup Review
## Reviewed by Diomedes ⚔️ | 2026-03-28

---

## Mockups Reviewed

| Approach | File | Status |
|----------|------|--------|
| A — The Vinyl Groove | approach-a.html | ✅ Reviewed |
| B — Command Deck | approach-b.html | ✅ Reviewed |
| C — Cinematic Strip | approach-c.html | ❌ Not yet built |
| D — The Jukebox | approach-d.html | ❌ Not yet built |
| E — Spectrum | approach-e.html | ✅ Reviewed (built by Diomedes) |

---

## Approach A: "The Vinyl Groove" 🎵

**Concept:** Album art hero on the left (480px zone), track info + controls + queue strip on the right. Library accessible via art tap overlay.

### Strengths
- **Album art presence is commanding** — the 440×440 art fills the left panel beautifully and gives the display a premium, audiophile feel
- **Queue strip at the bottom** is a smart use of horizontal space — feels natural to swipe through
- **Library overlay** is well-implemented with a 16-tile grid, clean transitions, and a clear close button
- **Format badges** are properly styled with Roboto Mono — legible and unobtrusive
- **Seek bar thumb** appears on hover — nice progressive disclosure

### Weaknesses
- **Vinyl shadow/ring effects** are extremely subtle — almost invisible. The vinyl metaphor promised in the name doesn't come through strongly
- **Queue items are min-width:220px** — on 1920px with a 480px art zone, you only see ~6 items. Could be tighter
- **Volume bar is only 100px wide** with no label — hard to know exact volume at a glance
- **Track title at 36px** is fine but the info zone feels slightly top-heavy with vertical spacing

### Rating

| Criterion | Score | Notes |
|-----------|-------|-------|
| MD3 Compliance | ⭐⭐⭐⭐ | Good token usage for colours, shapes, typography. Missing MD3 elevation/tonal system |
| Touch Targets | ⭐⭐⭐⭐ | Transport buttons are 48×48 (good), play is 56×56. Shuffle/repeat at 40×40 — just under 44px minimum |
| Visual Hierarchy | ⭐⭐⭐⭐⭐ | Excellent. Art dominates, title is clear, metadata cascades down properly |
| Interaction Quality | ⭐⭐⭐⭐ | Smooth transitions (0.3s, 0.2s). Library overlay has backdrop blur. Seek thumb reveal is polished |
| 440px Height Usage | ⭐⭐⭐⭐ | Art fills full height perfectly. Right panel uses space well with queue strip at bottom |
| Wow Factor | ⭐⭐⭐ | Clean and competent but safe. The vinyl metaphor could be pushed much further |

**Overall: 24/30** — Solid, audiophile-friendly design. A reliable choice but doesn't take risks.

---

## Approach B: "Command Deck" 🚀

**Concept:** Three equal vertical panels — Now Playing / Queue / Library — all visible simultaneously. Bloomberg Terminal for music.

### Strengths
- **Everything visible at once** — no navigation needed for the three most common tasks. This is genuinely useful for active listening sessions
- **Queue panel with drag handles** (⠿) signals reorderability — good affordance
- **Library "Added" feedback** — clicking an album shows a "✓ Added" overlay and actually appends to the queue list. Real interactive demo, not just visual mockup
- **Tab system in Library** (All/NAS/Local/Radio) — proper source filtering, very functional
- **Zone headers** at 40px with uppercase labels — clear information architecture

### Weaknesses
- **Art is only 120×120** — in a 640×440 zone, this feels cramped. The art is the emotional anchor of music playback and it's been squeezed
- **Typography is compressed** — title at 22px, artist at 15px. Readable but doesn't feel like a "now playing" hero display
- **The 1px gap between zones** using `background: var(--outline-variant)` on the grid is a bit harsh — could use a subtler divider or none at all
- **Queue drag handles** don't actually work (no drag implementation) — sets an expectation it doesn't meet
- **Feels utilitarian** — this is the Bloomberg Terminal comparison taken too literally. Missing warmth and emotion

### Rating

| Criterion | Score | Notes |
|-----------|-------|-------|
| MD3 Compliance | ⭐⭐⭐⭐ | Correct tokens. Tab pills use shape-full. Good badge styling |
| Touch Targets | ⭐⭐⭐⭐ | Transport at 44×44, play at 50×50. Queue items min-height 52px. All pass minimum |
| Visual Hierarchy | ⭐⭐⭐ | Information is organized but nothing "pops". All three zones compete for attention equally |
| Interaction Quality | ⭐⭐⭐⭐ | Tab switching, queue addition, seek/volume all work. The "Added" animation is a nice touch |
| 440px Height Usage | ⭐⭐⭐⭐⭐ | Every pixel is used. Three full zones, scrollable queue, two-row library grid. Maximum density |
| Wow Factor | ⭐⭐ | Functional but dry. This is the accountant of music players — everything adds up, nothing moves you |

**Overall: 22/30** — Most functional of the three, but sacrifices soul for utility. Best for power users who browse while listening.

---

## Approach E: "Spectrum" 📊

**Concept:** Full-screen canvas-based audio visualization with hidden controls that appear on tap. Three visualization modes (frequency bars, waveform, radial spectrum).

### Strengths
- **Visually arresting** — 96 frequency bars with purple-to-pink-to-cyan gradients and glow effects create a genuinely stunning display. This would stop people in their tracks
- **Three visualization modes** cycling on double-click (bars → waveform → radial) gives variety and replayability
- **Smart progressive disclosure** — the visualization IS the idle state. Controls only appear when needed. This is the correct UX philosophy for a display that's mostly watched, not touched
- **Persistent info pill** in bottom-right ensures you always know what's playing without summoning the overlay
- **Smooth physics-based animation** — bars use velocity + damping for natural motion, not linear interpolation. The fake audio data uses layered sine waves + noise for realistic spectrum shapes
- **Overlay design** is excellent — backdrop-filter blur, centered layout, volume on right edge. Appears/disappears with 0.5s ease transitions
- **Radial mode** has side-panel decorative bars to fill the ultrawide aspect ratio — smart use of the 1920px width
- **Auto-hide after 4 seconds** with mode indicator that fades after 2 seconds — no persistent UI clutter

### Weaknesses
- **No album art anywhere** — even as a small thumbnail when controls are shown, there's no visual reference to the album. The overlay could include a small art thumbnail
- **No queue access** — there's no way to see what's coming next. A swipe gesture or secondary panel would help
- **No shuffle/repeat controls** — the overlay only has prev/play/next, seek, and volume. Missing secondary transport controls
- **Double-click to change mode** isn't discoverable — no visual hint that this interaction exists. A small mode switcher icon would help
- **Pi performance concern** — 96 bars with glow effects (shadowBlur) at 60fps may be heavy on a Raspberry Pi 4. Could need a quality fallback
- **Waveform mode is less visually interesting** than bars or radial — the three layers help but it feels like a screensaver rather than an audio display
- **Volume slider is vertical** — works in the overlay context but unusual for horizontal displays

### Rating

| Criterion | Score | Notes |
|-----------|-------|-------|
| MD3 Compliance | ⭐⭐⭐ | Correct colour tokens on overlay and pill. Canvas visuals are custom (expected). Typography matches MD3 scale |
| Touch Targets | ⭐⭐⭐⭐⭐ | Transport buttons 56-72px. Seek bar has 44px click zone. Volume slider is 44px wide. Full-canvas tap target for reveal |
| Visual Hierarchy | ⭐⭐⭐⭐ | When overlay is hidden: visualization dominates with info pill as anchor. When overlay is visible: track info → transport → seek flows naturally |
| Interaction Quality | ⭐⭐⭐⭐⭐ | Physics-based bar animation, smooth overlay transitions, seek bar with appearing thumb, volume with appearing dot. Everything feels alive |
| 440px Height Usage | ⭐⭐⭐⭐ | Full canvas uses every pixel. Overlay centers content vertically. Slight concern: overlay content cluster is vertically compact, leaving margins |
| Wow Factor | ⭐⭐⭐⭐⭐ | This is the one that makes you say "what IS that?" from across the room. The radial mode is particularly striking |

**Overall: 26/30** — The most visually ambitious and emotionally impactful design. Sacrifices some functionality for pure visual spectacle, but that's the point — this is a display, not a workstation.

---

## Comparative Summary

| Criterion | A: Vinyl Groove | B: Command Deck | E: Spectrum |
|-----------|:-:|:-:|:-:|
| MD3 Compliance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Touch Targets | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Visual Hierarchy | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Interaction Quality | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 440px Height Usage | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Wow Factor | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **TOTAL** | **24/30** | **22/30** | **26/30** |

---

## Final Recommendation

### 🏆 Winner: Approach E — "Spectrum"

**Why:** For a dedicated LCD display in an audio room, the primary job is to look incredible while music plays. Approach E nails this. The canvas visualizations are genuinely mesmerising, the hidden-controls pattern is the right UX for a mostly-watched display, and the three visualization modes provide variety.

### 🥈 Runner-up: Approach A — "The Vinyl Groove"

**Why:** If Eduardo wants a more traditional "now playing" display that prioritises album art and track info, A is the strongest conventional choice. It's polished and audiophile-friendly.

### Suggested Hybrid

The ideal final design might combine elements:
- **E's visualization as a background layer** (always animating behind everything)
- **A's album art + metadata layout** as the overlay content (instead of E's minimal overlay)
- **B's queue visibility** as a secondary panel accessible via swipe/tap

This would give you the spectacle of E, the soul of A, and the utility of B.

### Gaps to Fill (for all approaches)
1. **No standby mode** demonstrated in any mockup
2. **No settings panel** shown
3. **No search UI** implemented
4. **Source selection** only exists in B (via library tabs)
5. **Audirvana integration** view not shown in any approach

### Performance Note for Approach E
The `shadowBlur` property on canvas is GPU-intensive. On Raspberry Pi 4/5, consider:
- Reducing to 48 bars instead of 96
- Removing shadowBlur and using pre-rendered glow textures
- Capping animation at 30fps with a frame skip (`requestAnimationFrame` + timestamp delta check)
- Testing with `OffscreenCanvas` and web workers if available

---

*Review complete. Awaiting C and D mockups for a full 5-way comparison.*
