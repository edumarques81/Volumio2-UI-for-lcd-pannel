# Library screen redesign — pixel-perfect target

**Branch:** `library-redesign-pixel-perfect-2026-05-08`
**Design source:** `library-screen-target-2026-05-08.png` (2590×1196 PNG, sibling file in this directory)
**Target surface:** LCD layout (1920×440), `LibraryView` + `AlbumPage` and friends in `src/lib/components/redesign/`
**Status:** Brief only — planning happens in the **next session** after `/clear → /checkin -r → /checkin` (full).

## What the user asked for

> "Get the library screen and implement a pixel-perfect copy of the image I sent with the functionality implemented. The design you generated so far resembles what I want, but what I really want is that image implemented perfectly and functional."

Not a fresh build. The current `AlbumPage` already has the right primitives (cover, title, artist, track list, format strip, bio, Play Album button). The redesign reshapes them into the 3-column composition shown in the mock and tightens type, color, and spacing to match.

## Layout (read off the mock)

Three columns inside the existing LCD inner rect. Background: pure black (`#000` or near-black).

| Column | Approx width | Contents (top → bottom) |
|---|---|---|
| **Cover** | ~40% | Square album art, no border-radius (or very small), fills the column height. |
| **Info** | ~32% | "ALBUM" eyebrow (gold uppercase tracked), title (very large white sans), artist row (gold person glyph + gold artist), meta strip ("12 songs • 48:37 • 2023 • Ambient / Post-Rock", muted gray with bullet separators), Play Album CTA + circular more-button, description paragraph (multi-line white with italic emphasis on album name), thin gold rule, Hi-Res Audio strip. |
| **Track list** | ~28% | Plain rows. `01..NN` track number in gold, title in white, duration on the right in gold/white. No backgrounds, no borders — just type. |

**Edge controls:** thin outlined chevrons `‹` and `›` flush to the left and right edges of the screen, vertically centered. Need user to confirm whether interactive (see Q2 below).

**Bottom center:** five pagination dots, first selected (brighter/larger), others dim. See Q1 — semantics are unclear.

## Element-by-element notes

### Cover column
- Square. The mock cover bleeds artwork to the edges of the column box.
- No drop shadow visible.
- Existing `AlbumCover.svelte` already takes `src/alt/size/onTap` — keep tapping the cover as a "play album" trigger? Tied to Q2 / chevrons.

### Info column

**"ALBUM" eyebrow** — accent gold (`var(--color-accent)`), uppercase, letter-spaced, small (looks ~14–16px). Not currently in `AlbumPage`.

**Title** — very large sans, white, weight 400-ish, single line, ellipsis on overflow. Mock line height looks tight. Existing AlbumPage title is 56px; this looks bigger (~72–88px relative to the column height). Need to measure once on the LCD to land it.

**Artist row** — gold person glyph + gold "Hollow Tides" text, ~22–26px, weight 400. **Currently the artist text is `var(--color-text-secondary)` (gray) — change to gold.**

**Meta strip** — "12 songs • 48:37 • 2023 • Ambient / Post-Rock" in a muted gray, bullet (•) separators with even spacing. New — does not exist today.
- `12 songs` ← `album.trackCount`
- `48:37` ← sum of track durations (already computed as `libraryAlbumTotalDuration`)
- `2023` ← `album.year`
- `Ambient / Post-Rock` ← genre (NOT on the `Album` type today — see Q5).

**Play Album button** — much larger and more prominent than the current subtle pill. Gold border, gold play triangle icon, gold "Play Album" label, generous horizontal padding (~30px each side). The current `PlayAlbumButton.svelte` is the right component but needs an oversized variant — likely a prop or a new dedicated visual size.

**More "..." button** — circular outlined, same gold border weight as Play Album, sits inline next to it with ~16px gap. Tapping opens a context menu (Q3 — which menu?).

**Description** — multi-line paragraph, white, regular weight, ~17–19px. Album name appears in italics inside the body. Source: `currentAlbumBio.summary` is the most likely fit (already wired in `LibraryView`). The italic-album-name treatment can be done client-side by replacing matches of the album title with `<em>` (Q4 — confirm).

**Gold rule** — single thin (1px-ish) gold horizontal line, low opacity, full info-column width. Just below description, just above Hi-Res strip.

**Hi-Res Audio strip** — left-to-right:
- gold equalizer-bars glyph
- "Hi-Res Audio" gold label
- vertical pipe separator (faint)
- 2-line stacked badge `[HI-RES \n 96kHz]` with gold border, small text
- vertical pipe separator
- "24-bit / 96 kHz" muted gray
- vertical pipe separator
- "FLAC" muted gray

The existing `FormatStrip.svelte` shows codec/bit/rate but its visual is different. Q6: does the new design mean we keep `FormatStrip` and add a Hi-Res Audio outer wrapper, or rebuild the strip from scratch matching the mock exactly? The latter is cleaner.

### Track list column

- Plain text, no row backgrounds, no separators.
- Track number — `01..12` zero-padded, in gold, monospaced or tabular-figure sans.
- Title — white, regular weight, single line ellipsis.
- Duration — right-aligned, gold (or off-white — hard to tell from the mock alone; defaulting to gold based on the eye).
- 12 rows fit visibly in the mock. The first track is "Beneath the Silver Sky 4:12"; tracks line up on a clean baseline. Generous row height (~36–40px on a 1920×440 LCD).
- No play/more-buttons per row in this mock. Tap behavior on the track row is also unclear (Q7).

### Edge chevrons + pagination dots

- Chevrons are visually outlined (stroke-only) `‹` and `›`. Centered vertically. Right at the edge of the screen.
- Pagination dots: 5 dots, first active. Centered horizontally, ~24px above the bottom of the screen.

## Open disambiguation questions (priority-ordered)

**Resolve before planning** — answers fork the implementation. Each links to the on-screen element it refers to.

1. **Pagination dots semantics** (bottom-center, 5 dots, first selected). Library can have hundreds of albums. Are the dots:
   - (a) **decorative-only** — a stylistic flourish; the existing one-album-at-a-time swipe is unchanged and the dots just sit there, OR
   - (b) **literal pages** — N albums per page (need N), 5 dots = 5 pages with overflow handling, OR
   - (c) **window indicator** — show position-in-library as 5 buckets, recompute as you swipe?
   
   Default if unspecified: (a) decorative-only, sticking with current per-album infinite swipe.

2. **Edge chevrons** (thin `‹` / `›` flush to the screen edges). Are they:
   - (a) interactive buttons (tap to advance ±1 album), in addition to the current swipe, OR
   - (b) purely visual hints showing swipe affordance?
   
   Default: (a) interactive, since that's what's expected on touch + they're load-bearing for users who don't realize the screen is swipeable.

3. **More "..." button** (circular gold outline, sits next to Play Album). What does it open?
   - (a) the existing `LibraryContextMenu` (Play Now / Play Next / Add to Queue / Add to Playlist) for the current album,
   - (b) a different menu (settings? a new "About this album" sheet?),
   - (c) something new to be designed.
   
   Default: (a). It matches the existing context-menu pattern in the rest of the app.

4. **Description source + italic emphasis**. The body text reads "A journey through moonlit landscapes ... *Midnight Shores* blends ambient textures ...". Source:
   - (a) `currentAlbumBio.summary` (already wired in `LibraryView`),
   - (b) artist bio,
   - (c) a new `album.description` field requiring a backend addition.
   
   The italic on the album name — can the frontend italicize matches of the album title at render time, or does the backend need to ship marked-up text?
   
   Default: (a) `currentAlbumBio.summary`, frontend italicizes album-title matches via a small renderer.

5. **Genre source** ("Ambient / Post-Rock"). Not on the `Album` type today. Options:
   - (a) skip the genre segment for now; show only `12 songs • 48:37 • 2023`,
   - (b) add `genre?: string` to `Album` and backfill from MPD's `genre` tag (backend change),
   - (c) derive it from the bio response if present.
   
   Default: (a) skip for the first pass; add behind a backend ticket if you want it later.

6. **Hi-Res strip rebuild** — replace `FormatStrip.svelte` for the Library view, or wrap it? Default: replace with a new `HiResAudioStrip.svelte` matching the mock exactly. Keep the old `FormatStrip` for any other surface that still uses it (currently only `AlbumPage` itself, so this is effectively a swap).

7. **Track row tap behavior** — the mock doesn't show row controls. On tap of a track row, do we:
   - (a) `replaceAndPlay` that single track (current `playTrack` action),
   - (b) `replaceAndPlay` the album then `seek` to that track index,
   - (c) nothing — track list is read-only display?
   
   Default: (a) `playTrack` for that uri. Matches the existing Library behavior.

8. **Long albums** — image shows 12 tracks fitting cleanly. For 30-track albums:
   - (a) internal scroll inside the right column,
   - (b) shrink row height to fit,
   - (c) pagination within the column (separate dots).
   
   Default: (a) internal scroll with `scrollbar-gutter: stable` + the same gutter trick already used in `AlbumTrackList`.

## Implementation pointers (for the planning session)

Files most likely to change. Don't pre-decide structure here — list is for navigation, not the plan.

- `src/lib/components/redesign/LibraryView.svelte` — outer 3-column layout, edge chevrons, pagination dots, swipe wiring already in place.
- `src/lib/components/redesign/AlbumPage.svelte` — currently 2-column grid (cover | info-zone with track list inside). Needs to split track list out into its own column. Possibly absorb the column responsibility into LibraryView and demote AlbumPage to "info column" only — that'd be cleaner.
- `src/lib/components/redesign/AlbumTrackList.svelte` — visual update (gold numbers, no backgrounds), keep the existing scroll-gutter behavior.
- `src/lib/components/redesign/PlayAlbumButton.svelte` — needs a larger, more prominent variant. Decide: prop `size?: 'subtle' | 'prominent'` vs new component.
- `src/lib/components/redesign/FormatStrip.svelte` → likely replaced for Library by `HiResAudioStrip.svelte`.
- New: `MoreButton.svelte` (circular gold outline, opens `LibraryContextMenu`) — or reuse an existing button primitive.
- New: `LibraryPaginationDots.svelte` — small, unless decided as decorative-only and inlined.
- New: `EdgeChevron.svelte` — left/right variant.

## Out of scope for this branch

- Backend changes (genre field, etc.) unless Q5 lands at (b).
- Mobile/desktop layouts. This is **LCD only** for now. (`MobileLayout` and `DesktopLayout` use different views entirely; redesigning those is a separate ticket.)
- Player view, queue view, settings, AppLauncher. Library only.
- Touching `replaceQueueAndPlay` or any other store internals — already fixed in `e1a68336`.

## Verification plan (high-level — to be expanded in PLAN.md)

- Pixel diff against the screenshot at LCD aspect ratio. Capture before/after with the same seed album.
- Component unit tests for the new compositions.
- LCD smoke after deploy (the kiosk loads from Mac Vite — see workspace `CLAUDE.md`, project note).
- Hi-Res strip with three test albums: `24/96 FLAC`, `16/44.1 FLAC`, `MP3` — confirm the badge / spec text adapts cleanly.
- 30-track album test for the track-list scroll behavior.

## Test baseline

`npm run test:run`: 519 passing / 1 skipped (520 total) at branch start. Maintain or grow.

## Workflow note

Per the user's standing pattern (saved feedback memory): subagent-driven execution preferred. The plan that emerges from the next session should be split into independent task units that can each spawn an implementer + reviewer subagent. The user will `/clear` between phases.
