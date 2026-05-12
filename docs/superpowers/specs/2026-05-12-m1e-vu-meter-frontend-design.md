# M1.E — VU meter frontend (design)

**Date:** 2026-05-12
**Initiative:** `we-are-going-to-linear-blanket` (M1)
**Parent plan:** `~/.claude/plans/we-are-going-to-linear-blanket.md` §M1.E
**Predecessor:** M1.B (Pi-side `stellar-spectrum` daemon, shipped 2026-05-12, pushes `binsL/binsR/peakL/peakR/rmsL/rmsR` at 20 fps).

## Context

M1.B is live on the Pi: a separate `stellar-spectrum` daemon reads the MPD spectrum FIFO, computes per-channel L/R RMS + peak + log-binned magnitudes, and pushes a `pushSpectrum` event at 20 fps. Mac backend re-broadcasts it to all connected frontends. Tier-1 smoke verified `rmsL ≠ rmsR` on stereo content.

The frontend has not yet consumed the new payload. The `NavColumn` redesign already has a "VU Meter" cell at position 3 (`audio-lines` icon) wired to `viewActions.tapVuMeter`, which today is a silent no-op (`navigation.ts:159`).

M1.E wires that cell to a real view that reads the L/R spectrum stream.

## User-locked decisions (this brainstorm)

1. **Meter character:** Classic analog VU.
   - Bar = RMS, ~300 ms integration time (broadcast-VU spec).
   - **No** separate peak-hold marker.
   - Single warm amber color (no green/yellow/red gradient).
2. **Background:** Plain dark backdrop (`#050507`, matching `PlayerLayout`). No album-art bleed-through, no gold frame.
3. **Exit gesture:** Nav cell only. The persistent `NavColumn` is the single source of return. No tap-handler on the VU content area.

## Architecture

Three new files, two edits.

| File | Action |
|---|---|
| `src/lib/stores/spectrum.ts` | NEW — store + dB transform + idempotent init |
| `src/lib/components/redesign/VuMeterView.svelte` | NEW — 2 stacked horizontal segmented bars, RAF smoothing, reduced-motion fallback |
| `src/lib/stores/__tests__/spectrum.test.ts` | NEW — unit tests for transform + init + frame replacement |
| `src/lib/components/redesign/__tests__/VuMeterView.test.ts` | NEW — segment count, reduced-motion fallback, smoothing monotonicity |
| `e2e/vu-meter.spec.ts` | NEW — Playwright tap→appear→signal→exit |
| `src/lib/stores/navigation.ts` | EDIT — extend `ViewType`; replace `tapVuMeter` no-op |
| `src/lib/components/redesign/NavColumn.svelte` | EDIT — extend local `Cell.activeWhen`; add `activeWhen` to VU cell |
| `src/lib/components/redesign/PlayerLayout.svelte` | EDIT — symmetric lazy-import for `VuMeterView`; rename `importStarted` flag |
| `src/App.svelte` | EDIT — call `initSpectrumStore()` in `onMount` |
| Bundle-size guard test (existing C6 file) | EDIT — assert App chunk does not statically import `VuMeterView`; widen regex if narrow |

## Section 1 — Store (`src/lib/stores/spectrum.ts`)

```ts
export interface SpectrumFrame {
  binsL: number[];   // 64 log-binned FFT magnitudes
  binsR: number[];
  peakL: number;     // 0..1 linear
  peakR: number;
  rmsL: number;      // 0..1 linear  ← what M1.E consumes
  rmsR: number;
  sampleRate: number;
  ts: number;        // backend ms
}

export const spectrumFrame = writable<SpectrumFrame | null>(null);
export const vuLevelL = derived(spectrumFrame, $f => rmsToBarFill($f?.rmsL));
export const vuLevelR = derived(spectrumFrame, $f => rmsToBarFill($f?.rmsR));

export function rmsToBarFill(rms: number | undefined): number {
  if (!rms || rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  const FLOOR_DB = -60;
  if (db <= FLOOR_DB) return 0;
  return Math.min(1, (db - FLOOR_DB) / -FLOOR_DB);
}

let initialized = false;
export function initSpectrumStore() {
  if (initialized) return;
  initialized = true;
  socketService.on<SpectrumFrame>('pushSpectrum', (frame) => {
    spectrumFrame.set(frame);
  });
}
```

**Decisions baked in:**

- Single object writable + two `derived` stores. Future spectrum analyzer reads `binsL/binsR` off the same writable; no second listener.
- dB conversion is pure and exported for unit test. `−60 dB` floor, linear-on-dB scale to `0 dB`.
- **No** `console.log` in the handler — `pushSpectrum` at 20 fps × broadcast-to-all is hot-path (per `Volumio2-UI/CLAUDE.md` performance section).
- Smoothing lives in the view (next section), not the store. Store stays side-effect-free.
- Mono fallback (`{bins, peak, rms}`) not handled. M1.B already broadcasts the L/R shape; the deprecated mono payload is scheduled for removal in the next phase. If a mono frame did arrive, `rmsL`/`rmsR` are `undefined` → bars sit at 0.
- `initSpectrumStore()` called from `App.svelte:onMount` alongside the existing `init*` calls. Listener is always-on; cost-when-idle is one `writable.set()` per 50 ms.

## Section 2 — View (`src/lib/components/redesign/VuMeterView.svelte`)

**Layout (1680 × 440 content area):**

- Section root: `<section data-testid="vu-meter-view" aria-label="VU meter">`.
- Section is `display: flex; flex-direction: column; justify-content: center` so the two bars vertically center inside the 440 px panel — exact pixel heights are responsive to the actual content area, not pinned.
- Target dimensions on the LCD: each bar ~168 px tall, ~40 px gap between bars, free vertical slack absorbed as outer padding by flex centering.
- Each bar = 28 px L/R label + 16 px left pad + 40 segments + 16 px right pad. Segment ≈ 38 px wide, 2 px inter-segment gap.
- Background: `#050507`.
- Segment color: single warm amber (one CSS variable, derived from existing `--color-accent` gold). Lit = full color; dim = same color at 8% opacity.

**Smoothing (300 ms time-constant exponential):**

```ts
let displayedL = $state(0);
let displayedR = $state(0);
const TAU_MS = 300;
const SEGMENT_COUNT = 40;

let raf = 0;
let lastT = 0;
function tick(t: number) {
  raf = requestAnimationFrame(tick);
  const dt = lastT ? t - lastT : 16;
  lastT = t;
  const alpha = 1 - Math.exp(-dt / TAU_MS);
  displayedL += ($vuLevelL - displayedL) * alpha;
  displayedR += ($vuLevelR - displayedR) * alpha;
}

onMount(() => {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    raf = requestAnimationFrame(tick);
  }
});
onDestroy(() => { if (raf) cancelAnimationFrame(raf); });
```

**Reduced motion:** RAF skipped; segments react directly off `$vuLevelL` / `$vuLevelR` at the 20 fps push cadence. No animation.

**Segment lighting:**

```svelte
{#each Array(SEGMENT_COUNT) as _, i}
  <div class="segment" class:lit={i / SEGMENT_COUNT < displayedL}
       data-testid="vu-meter-l-segment-{i}"></div>
{/each}
```

(Same block for R with `displayedR` and `vu-meter-r-segment-{i}`.)

**Test-IDs:**

- `vu-meter-view` on root section.
- `vu-meter-l` / `vu-meter-r` on bar wrappers.
- `vu-meter-l-segment-{i}` / `vu-meter-r-segment-{i}` for i in 0..39 — Playwright counts these.

**Accessibility:**

- Each bar: `role="meter" aria-label="Left/Right channel level" aria-valuemin="0" aria-valuemax="1" aria-valuenow={displayed*}`.
- Reduced-motion respected as above.

**Not present (intentional):**

- No numerical dB scale markings.
- No track/title overlay.
- No peak-hold marker.
- No green/yellow/red gradient.
- No tap-to-exit handler on the content area.

## Section 3 — Navigation wiring

**`src/lib/stores/navigation.ts`:**

```ts
export type ViewType = 'player' | 'library' | 'queue' | 'settings' | 'vu-meter';

// in viewActions:
tapVuMeter: () => currentView.set('vu-meter'),
```

**`src/lib/components/redesign/NavColumn.svelte`:**

```ts
type Cell = {
  icon: string;
  label: string;
  activeWhen?: 'player' | 'library' | 'settings' | 'vu-meter';
  onTap: () => void;
};

// in cells array:
{ icon: 'audio-lines', label: 'VU Meter', activeWhen: 'vu-meter', onTap: viewActions.tapVuMeter },
```

`data-testid="nav-cell-vu-meter"` is already generated by the existing label-to-id expression.

## Section 4 — Lazy-load (`PlayerLayout.svelte`)

Symmetric extension of the existing Settings lazy-load pattern.

```svelte
let SettingsView = $state<Component | null>(null);
let VuMeterView = $state<Component | null>(null);
let settingsImportStarted = false;
let vuMeterImportStarted = false;

const unsubscribeView = currentView.subscribe((view) => {
  if (view === 'settings' && !settingsImportStarted) {
    settingsImportStarted = true;
    void import('./SettingsView.svelte').then((m) => {
      SettingsView = m.default as Component;
    });
  }
  if (view === 'vu-meter' && !vuMeterImportStarted) {
    vuMeterImportStarted = true;
    void import('./VuMeterView.svelte').then((m) => {
      VuMeterView = m.default as Component;
    });
  }
});
$effect(() => () => unsubscribeView());
```

Render block:

```svelte
{#if $currentView === 'player'}
  <PlayerView />
{:else if $currentView === 'settings'}
  {#if SettingsView}<SettingsView />{/if}
{:else if $currentView === 'vu-meter'}
  {#if VuMeterView}<VuMeterView />{/if}
{:else}
  <LibraryView />
{/if}
```

**Notes:**

- `importStarted` is renamed to `settingsImportStarted` to disambiguate. One rename, zero behavior change.
- A new `VuMeterView-<hash>.js` chunk emits, mirroring `SettingsView-<hash>.js`.
- A `Record<ViewType, Component | null>` refactor would be tidier but is out of scope for M1.E.

## Section 5 — Testing

**Vitest unit (`src/lib/stores/__tests__/spectrum.test.ts`):**

1. `rmsToBarFill` table — `0`, `undefined`, negative, `0.001` (≈ −60 dB), `0.01` (−40 dB), `0.1` (−20 dB), `1.0` (0 dB), `2.0` (clamp).
2. `initSpectrumStore()` is idempotent — twice → one listener registered.
3. End-to-end through the store: mocked `socketService` captures the handler; invoke with a `SpectrumFrame`; assert `get(spectrumFrame)`, `get(vuLevelL)`, `get(vuLevelR)`.
4. Frame replacement: second handler call updates the derived levels.

**Vitest unit (`src/lib/stores/__tests__/navigation.test.ts`):**

5. `viewActions.tapVuMeter()` sets `currentView` to `'vu-meter'`.

**Vitest unit (`src/lib/components/redesign/__tests__/VuMeterView.test.ts`):**

6. Renders with `vu-meter-view`, `vu-meter-l`, `vu-meter-r` test-IDs.
7. Renders exactly 40 segments per bar.
8. With `matchMedia('(prefers-reduced-motion: reduce)')` mocked to `matches=true`: emitting `rmsL=1.0` → all 40 L segments `.lit` synchronously. `rmsL=0` → zero `.lit`.
9. Without reduced motion: sustained `rmsL=1.0` + fake-RAF a handful of frames → lit-segment count increases monotonically.

**Vitest unit (existing bundle-size guard):**

10. Assert App chunk does NOT statically import `VuMeterView`. Same pattern as the existing SettingsView guard. If the existing guard's regex is the "too-narrow" one flagged by C6 reviewers, widen it as part of this change.

**Playwright E2E (`e2e/vu-meter.spec.ts`):**

11. With MPD paused or stopped: tap `[data-testid="nav-cell-vu-meter"]`; within ≤ 2 s assert `vu-meter-view`, `vu-meter-l`, `vu-meter-r` visible; lit-segment count on both bars = `0`. The 2 s budget covers first-tap lazy-chunk load.
12. Trigger playback by tapping `[data-testid="nav-cell-player"]` to return to PlayerView, clicking `[data-testid="btn-play-pause"]`, then tapping `[data-testid="nav-cell-vu-meter"]` again. Within ≤ 3 s assert lit-segment count > 0 on both bars. **Precondition:** the Pi's MPD queue must contain a stereo track (test-environment setup; matches the M1.B smoke-test setup, which used "Anomalie - Fin" 44.1 kHz/16-bit/stereo). The test hard-fails if no audio is reachable — silent skip would hide regressions.
13. Tap `[data-testid="nav-cell-player"]`; assert `[data-testid="player-layout"]` content shows PlayerView and `[data-testid="vu-meter-view"]` is gone from the DOM.
14. Cross-browser per existing `playwright.config.ts` (chromium + firefox projects).

**Not tested:**

- Pixel snapshots (brittle).
- Exact RAF timing (CI is noisy; monotonicity is enough).
- Backend ingest (covered by M1.B's shipped tests).

## Non-goals

- **No** spectrum analyzer view in M1.E. The store carries `binsL/binsR` so a future analyzer can read them without a second listener, but no analyzer renderer ships in this phase.
- **No** peak-hold marker, no two-tone (green/red) palette, no scale markings.
- **No** album-art background.
- **No** tap-to-exit on the content area.
- **No** mono-fallback handling for the deprecated `{bins, peak, rms}` payload.
- **No** PlayerLayout refactor beyond the lazy-load extension and the `importStarted` rename.
- **No** removal of the deprecated mono payload from the backend (scheduled for the next phase).
- **No** golangci-lint reinstatement (carryover from M1.B).

## Verification gate

M1.E exits when all of the following pass:

- `npx tsc --noEmit` clean.
- `npm run test:run` clean (existing suite + new spectrum/navigation/view unit tests).
- `npm run test:e2e -- e2e/vu-meter.spec.ts` clean on chromium + firefox.
- Bundle-size guard test asserts the App chunk does not statically import `VuMeterView`.
- Manual smoke on the LCD kiosk: tap VU Meter cell → bars appear within ~250 ms of first tap (lazy chunk load) and instantly on subsequent taps; bars dance with `rmsL ≠ rmsR` on stereo content; tap Player cell returns cleanly.
- No regression in `Volumio2-UI/E2E-TEST-ISSUES.md` pass rate (currently 38%).

## Out-of-scope reminders (carried into the next phase)

- Remove the deprecated `{bins, peak, rms}` mono fallback from the backend payload — moves to the next phase after M1.E consumes the L/R fields.
- Install `golangci-lint` via asdf to reinstate the backend lint gate.
- Pending input still: artists-view mockup for M2.C (unrelated to M1.E; tracked separately).
