# Settings screen — v1 plan

**Status:** Plan only. No implementation lands in this commit.
**Author:** 2026-05-09 session.
**Predecessor:** library-screen-redesign-2026-05-08 (separators + bg system established here).

## Goal

Wake up the Settings nav slot — currently a no-op (`NavColumn.svelte:150`) — with the smallest viable surface that meaningfully helps a kiosk user. Surface what's already persisted; do not invent new state. Inherit the redesign's visual language and the perf budget (see `frontend-perf-budget.md`).

## Non-goals (explicit deferrals)

| Deferred to | Why |
|---|---|
| Audio engine toggle (MPD ↔ Audirvana) | Mutex-y switch with playback-disrupting side effects in `audioEngine.ts`; deserves its own plan with UAT, not a checkbox in v1. |
| Volume default / DSD mode / mixer mode | Backend-display-only today (`audio.ts` is read-only); flipping requires backend wiring. |
| Theme picker / wallpaper / spectrum / VU | Spectrum subscription is dead on the frontend (see perf budget §3.1); re-enabling needs a separate plan with FPS-cap + measurement. |
| Network/NAS configuration | Touched by backend NAS resilience work (v2.2.0); a settings UI for NAS is its own plan. |
| Power-button auth controls | Now backend-driven via `STELLAR_POWER_TRUSTED_REMOTES` env var (added 2026-05-09). User-facing UI for that is operator territory. |

## v1 scope — three sections

All three sections expose state that is **already persisted today**. v1 introduces no new localStorage keys.

### Section 1 — Display

| Control | Type | Wired to | Persistence |
|---|---|---|---|
| LCD brightness | Slider 0–100 | `stores/lcd.ts` `brightness` writable | Backend (existing socket emits); slider must debounce ≥200 ms (perf budget §3.2 rule 4). |
| LCD standby mode | Radio (`css` \| `hardware`) | `stores/settings.ts` `lcdStandbyMode` writable | Existing key `stellar-volumio-lcd-standby-mode` (`settings.ts:138`). |

Note: The "Stand By Tile" and StandbyOverlay logic do NOT change. Settings just exposes what those already persist.

### Section 2 — Library

| Control | Type | Wired to | Persistence |
|---|---|---|---|
| Library scope | Segmented (`all` \| `nas` \| `local` \| `usb`) | `stores/library.ts` `libraryScope` | Existing key `libraryScope`. |
| Library sort | Segmented (`alphabetical` \| `by_artist` \| `recently_added` \| `year`) | `stores/library.ts` `librarySort` | Existing key `librarySort`. |
| Rebuild library cache | Button | `library:cache:rebuild` socket emit (mirrors NavColumn 4th icon) | n/a (one-shot action). |

The NavColumn refresh icon stays — Settings just gives the same action a discoverable home.

### Section 3 — About / system

Read-only block. No interactive controls. v1 surfaces:

- **Backend URL**: `getVolumioHost()` from `config.ts`.
- **Frontend version**: from `package.json` (Vite-injected at build via `import.meta.env`).
- **Pi hostname**: pulled from existing `pushNetworkStatus` socket event (already plumbed). Falls back to `—` if not present.
- **Library cache stats** (compact): album / artist / track counts from `pushLibraryCacheStatus` (already received; just rendered).

## Layout

- New file: `src/lib/components/redesign/SettingsView.svelte`.
- Renders inside the existing `PlayerLayout` shell (1920×440 LCD). `PlayerLayout` already owns the bloom-gradient bg + sheen overlay + NavColumn + TransportColumn. SettingsView contributes only its own column block.
- Composition: vertical-scroll list of sections is the safe default given the LCD's narrow height (440px). If horizontal three-column reads better against the LCD aspect, switch during implementation — decide by sketching, not in advance.
- Separators between sections use the redesign's gradient-white pattern (`linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%)`); never gold.
- Controls use existing tokens: `--color-text-primary`, `--color-accent-glow`, `--color-bg-base`. No new CSS variables.
- No new `backdrop-filter`, no `box-shadow` glows beyond what's already present, no continuous animations (perf budget §3.2 rules 1, 2, 6).

## Routing wiring (file-by-file)

1. `src/lib/stores/navigation.ts:6,24` — extend `currentView` union: `'player' | 'library' | 'queue' | 'settings'`.
2. `src/lib/stores/navigation.ts:44` — add a `goto('settings')` arm in `navigationActions`.
3. `src/lib/stores/navigation.ts:151` — wire `viewActions.tapSettings` to call `navigationActions.goto('settings')` (replaces the no-op).
4. `src/App.svelte` — add a SettingsView render branch in the view-router. Lazy-import to keep the initial bundle slim.
5. `src/lib/components/redesign/NavColumn.svelte:150` — `tapSettings` already delegates via `viewActions`; no NavColumn diff is required if step 3 is done.

## Test list (TDD)

| Layer | Test | File |
|---|---|---|
| Store | `navigationActions.goto('settings')` flips `currentView` | `stores/__tests__/navigation.test.ts` |
| Component | SettingsView renders Display / Library / About sections | `components/redesign/__tests__/SettingsView.test.ts` (new) |
| Behavior | Brightness slider debounces socket emit (≥200 ms) | `components/redesign/__tests__/SettingsView.test.ts` |
| Visual | Snapshot at 1920×440 viewport | same file |
| Integration | Tapping NavColumn Settings icon switches view | extend `NavColumn.test.ts` if it exists |

Existing test count baseline: 566 / 1 skipped. Target after Settings v1 lands: ~574–580 (range allows for a couple of dropped redundant cases during implementation).

## Out-of-scope cleanups (do NOT do during v1)

The following are real codebase debts but **stay parked** so v1 stays small:

- `stores/settings.ts` background-picker leftovers (`selectedBackground`, `availableBackgrounds`, `getBackgrounds`/`setBackground`/`clearBackground`, `pushBackgrounds` listener) — flagged in project-note Open Issues. Leave for a dedicated cleanup commit.
- `browse.ts` partial-orphan — types still imported by `favorites.ts` + `ui.ts`. Out of scope.
- `formatStripHelpers.ts` vs `FormatStrip.svelte` inline-helpers duplication. Out of scope.
- Renaming `bioActions` (singular/plural mismatch from Plan 4 Minor 8). Out of scope.

## Acceptance checklist for v1

- [ ] NavColumn Settings icon switches the view (no longer a silent no-op).
- [ ] Display / Library / About sections render at the LCD viewport.
- [ ] Brightness slider drags don't storm the backend (debounce verified by latency stats).
- [ ] Library scope/sort changes update existing localStorage keys (no new keys introduced).
- [ ] About block shows backend URL, frontend version, and at least the connected Pi hostname.
- [ ] Test count ≥570; tsc clean; build clean.
- [ ] LCD smoke: open Settings → tap each section → return to Player. Bg + separators unchanged.
- [ ] FPS overlay (`window.__performance.toggle()`) shows ≥55 FPS during section navigation.

## What this plan deliberately does not answer

- **Vertical vs horizontal layout** — decide during implementation by mocking against the 1920×440 viewport.
- **Whether Library section's rebuild button needs a confirmation** — try without first; add one only if accidental rebuilds become a real failure mode.
- **About's source for "Pi hostname"** — `pushNetworkStatus` is the obvious place; if it doesn't carry hostname today, decision deferred to implementation (either extend the payload backend-side or fetch separately).

These are deliberate "decide-when-you-build" decisions, not gaps. Locking them now would be premature.
