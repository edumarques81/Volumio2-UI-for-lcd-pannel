# M1.E VU meter frontend — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing no-op VU Meter nav cell to a real classic-analog-VU view that consumes the L/R `pushSpectrum` stream M1.B already broadcasts.

**Architecture:** Single-object `spectrumFrame` writable + two derived `vuLevel*` stores apply a dB transform; `VuMeterView.svelte` renders two stacked segmented bars, smoothing the value with a 300 ms exponential RAF loop (synchronous off-frame in reduced-motion mode); `PlayerLayout.svelte` lazy-imports the view symmetrically with its existing `SettingsView` pattern; navigation wired through `viewActions.tapVuMeter`.

**Tech Stack:** Svelte 5 (`$state`, `$effect`, `$derived`), TypeScript strict, Vitest 4 + `@testing-library/svelte`, Playwright (live-Pi target), socket.io 4.x client.

**Spec:** `docs/superpowers/specs/2026-05-12-m1e-vu-meter-frontend-design.md` (commit `01a1b883`).

---

## Wave plan

Wave 1 (3 parallel) → Wave 2 (2 parallel) → Wave 3 (2 parallel) → Wave 4 → Wave 5.

| Wave | Tasks | Depends on |
|---|---|---|
| 1 | T1 store · T2 navigation · T3 NavColumn | — |
| 2 | T4 VuMeterView · T5 App init | T1 |
| 3 | T6 PlayerLayout lazy-load · T7 PlayerLayout bundle guard | T4 |
| 4 | T8 e2e spec | T1–T7 |
| 5 | T9 verification gate | T1–T8 |

All Wave-1 tasks touch different files and can be dispatched in parallel. Wave 3 is two separate test/source files so T6 and T7 can also run in parallel.

---

## Task 1: Spectrum store

**Files:**
- Create: `src/lib/stores/spectrum.ts`
- Test: `src/lib/stores/__tests__/spectrum.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/stores/__tests__/spectrum.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Mock socket service before importing the store.
const onMock = vi.fn(() => () => {});
vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: onMock,
  },
}));

import {
  rmsToBarFill,
  spectrumFrame,
  vuLevelL,
  vuLevelR,
  initSpectrumStore,
  type SpectrumFrame,
} from '../spectrum';

describe('rmsToBarFill', () => {
  it.each([
    [0, 0],
    [undefined, 0],
    [-0.1, 0],          // defensive — RMS must never be negative
    [0.001, 0],         // exactly at the −60 dB floor → clamps to 0
    [0.01, 1 / 3],      // −40 dB → 20/60 from the floor
    [0.1, 2 / 3],       // −20 dB → 40/60 from the floor
    [1.0, 1],           // 0 dBFS → full scale
    [2.0, 1],           // impossible but clamps high
  ])('rmsToBarFill(%s) ≈ %s', (rms, expected) => {
    const got = rmsToBarFill(rms as number | undefined);
    expect(got).toBeCloseTo(expected, 4);
  });
});

describe('initSpectrumStore', () => {
  beforeEach(() => {
    onMock.mockClear();
  });

  it('registers a single pushSpectrum listener and is idempotent on second call', () => {
    initSpectrumStore();
    initSpectrumStore();
    const pushCalls = onMock.mock.calls.filter(([event]) => event === 'pushSpectrum');
    expect(pushCalls).toHaveLength(1);
  });
});

describe('spectrum store frame handling', () => {
  it('sets spectrumFrame and updates derived vuLevelL/R when a frame arrives', () => {
    initSpectrumStore();
    const pushHandler = onMock.mock.calls.find(([event]) => event === 'pushSpectrum')?.[1] as
      | ((frame: SpectrumFrame) => void)
      | undefined;
    expect(pushHandler).toBeTypeOf('function');

    const frame: SpectrumFrame = {
      binsL: new Array(64).fill(0),
      binsR: new Array(64).fill(0),
      peakL: 0.6,
      peakR: 0.2,
      rmsL: 0.5,
      rmsR: 0.1,
      sampleRate: 44100,
      ts: Date.now(),
    };
    pushHandler!(frame);

    expect(get(spectrumFrame)).toEqual(frame);
    expect(get(vuLevelL)).toBeCloseTo(rmsToBarFill(0.5), 4);
    expect(get(vuLevelR)).toBeCloseTo(rmsToBarFill(0.1), 4);
  });

  it('replaces the frame on a second push', () => {
    initSpectrumStore();
    const pushHandler = onMock.mock.calls.find(([event]) => event === 'pushSpectrum')?.[1] as
      ((frame: SpectrumFrame) => void);

    pushHandler({
      binsL: [], binsR: [], peakL: 0, peakR: 0, rmsL: 0.5, rmsR: 0.5, sampleRate: 44100, ts: 1,
    } as unknown as SpectrumFrame);
    pushHandler({
      binsL: [], binsR: [], peakL: 0, peakR: 0, rmsL: 0.01, rmsR: 1.0, sampleRate: 44100, ts: 2,
    } as unknown as SpectrumFrame);

    expect(get(vuLevelL)).toBeCloseTo(rmsToBarFill(0.01), 4);
    expect(get(vuLevelR)).toBeCloseTo(rmsToBarFill(1.0), 4);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npm run test:run -- src/lib/stores/__tests__/spectrum.test.ts
```

Expected: FAIL — `Cannot find module '../spectrum'`.

- [ ] **Step 3: Implement the store**

Create `src/lib/stores/spectrum.ts`:

```ts
import { writable, derived } from 'svelte/store';
import { socketService } from '$lib/services/socket';

/**
 * Per-frame audio analysis payload pushed by the Pi-side `stellar-spectrum`
 * daemon (M1.B) at 20 fps. M1.E consumes only `rmsL` and `rmsR`; the bin
 * arrays are carried for a future spectrum analyzer view (no second listener).
 */
export interface SpectrumFrame {
  binsL: number[];   // 64 log-binned FFT magnitudes
  binsR: number[];
  peakL: number;     // 0..1 linear
  peakR: number;
  rmsL: number;      // 0..1 linear  ← M1.E
  rmsR: number;
  sampleRate: number;
  ts: number;        // backend ms
}

/** Latest pushSpectrum frame, or null if none has arrived yet. */
export const spectrumFrame = writable<SpectrumFrame | null>(null);

/**
 * Maps a 0..1 linear RMS amplitude to a 0..1 bar fill on a dBFS scale.
 * Floor at −60 dB → 0, full-scale (0 dB) → 1. Linear-on-dB between.
 *
 * Pure function, exported for unit test.
 */
export function rmsToBarFill(rms: number | undefined): number {
  if (!rms || rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  const FLOOR_DB = -60;
  if (db <= FLOOR_DB) return 0;
  return Math.min(1, (db - FLOOR_DB) / -FLOOR_DB);
}

export const vuLevelL = derived(spectrumFrame, ($f) => rmsToBarFill($f?.rmsL));
export const vuLevelR = derived(spectrumFrame, ($f) => rmsToBarFill($f?.rmsR));

let initialized = false;

/**
 * Wires the `pushSpectrum` Socket.IO listener. Idempotent — second call is a
 * no-op. Called from App.svelte:onMount alongside the other init* stores.
 *
 * No console.log in the handler: `pushSpectrum` at 20 fps × broadcast-to-all
 * is hot-path (see Volumio2-UI/CLAUDE.md "Socket.IO Performance Optimization").
 */
export function initSpectrumStore() {
  if (initialized) return;
  initialized = true;
  socketService.on<SpectrumFrame>('pushSpectrum', (frame) => {
    spectrumFrame.set(frame);
  });
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npm run test:run -- src/lib/stores/__tests__/spectrum.test.ts
```

Expected: PASS — all tests green (rmsToBarFill table × 8 cases, init idempotent, frame handling × 2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/spectrum.ts src/lib/stores/__tests__/spectrum.test.ts
git commit -m "feat(vu-meter): add spectrum store with dB-mapped derived levels

M1.E foundation: single-object pushSpectrum writable + rmsToBarFill
pure transform + two derived vuLevelL/R bar-fill stores. Listener is
idempotent and silent (no console.log on the 20 fps hot path).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Navigation ViewType + tapVuMeter wiring

**Files:**
- Modify: `src/lib/stores/navigation.ts:6` (ViewType union) and `:159` (tapVuMeter body)
- Test: `src/lib/stores/__tests__/navigation.test.ts` (extend existing)

- [ ] **Step 1: Add the failing test**

Open `src/lib/stores/__tests__/navigation.test.ts` and append the following test block at the end of the file (inside the outermost `describe` if one exists, or as a new `describe`):

```ts
import { get } from 'svelte/store';
import { currentView, viewActions } from '../navigation';

describe('viewActions.tapVuMeter', () => {
  it('routes currentView to vu-meter', () => {
    currentView.set('player');
    viewActions.tapVuMeter();
    expect(get(currentView)).toBe('vu-meter');
  });
});
```

If `currentView` and `viewActions` are already imported at the top of the file, do not duplicate the import — only add the `describe` block. Also confirm `get` from `svelte/store` is imported.

- [ ] **Step 2: Run the test, verify it fails**

```bash
npm run test:run -- src/lib/stores/__tests__/navigation.test.ts
```

Expected: FAIL — either a TypeScript error ("not assignable to ViewType") or an assertion failure (`currentView` stays `'player'` because the current body is a silent no-op).

- [ ] **Step 3: Extend the ViewType union and replace the tapVuMeter body**

Edit `src/lib/stores/navigation.ts`:

```ts
// Line 6 — before:
//   export type ViewType = 'player' | 'library' | 'queue' | 'settings';
// After:
export type ViewType = 'player' | 'library' | 'queue' | 'settings' | 'vu-meter';

// Line 159 — before:
//   tapVuMeter: () => { /* silent no-op v1 */ },
// After:
tapVuMeter: () => currentView.set('vu-meter'),
```

The comment at lines 122-126 mentions VU Meter as a silent no-op; update it to reflect the new behavior:

```ts
/**
 * High-level intent dispatch for the redesign's NavColumn.
 * VU Meter routes to the VU view via currentView (M1.E).
 * Settings (v2, 2026-05-09) routes to the Settings view via currentView.
 * Refresh and Power callbacks are owned by Plan 5; default to no-op here
 * and overridable via `setViewActionHandlers`.
 */
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npm run test:run -- src/lib/stores/__tests__/navigation.test.ts
npx tsc --noEmit
```

Expected: PASS on Vitest, no TypeScript errors. (The `tsc` check confirms the `ViewType` widening doesn't break callers like `PlayerLayout.svelte` or `NavColumn.svelte` — note Task 3 widens NavColumn's local `Cell` type to match.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/navigation.ts src/lib/stores/__tests__/navigation.test.ts
git commit -m "feat(vu-meter): route tapVuMeter to vu-meter view

Extend ViewType union with 'vu-meter' and replace the silent no-op
at navigation.ts:159 with currentView.set('vu-meter'). NavColumn cell
already calls viewActions.tapVuMeter — no nav UI change here.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: NavColumn Cell type + activeWhen

**Files:**
- Modify: `src/lib/components/redesign/NavColumn.svelte:8` (Cell.activeWhen union), `:15` (VU cell entry)

This task has no new tests — it's a type widening + a single-property addition to an existing cell entry. The transition from no-active-highlight to active-highlight is covered by the e2e test in Task 8.

- [ ] **Step 1: Type-check the current file as the baseline**

```bash
npx tsc --noEmit
```

Expected: PASS (baseline).

- [ ] **Step 2: Widen the Cell.activeWhen union**

Edit `src/lib/components/redesign/NavColumn.svelte`, line 8:

```ts
// Before:
//   activeWhen?: 'player' | 'library' | 'settings';
// After:
activeWhen?: 'player' | 'library' | 'settings' | 'vu-meter';
```

- [ ] **Step 3: Add activeWhen to the VU Meter cell entry**

Edit `src/lib/components/redesign/NavColumn.svelte`, line 15:

```ts
// Before:
//   { icon: 'audio-lines', label: 'VU Meter',                          onTap: viewActions.tapVuMeter },
// After:
{ icon: 'audio-lines', label: 'VU Meter', activeWhen: 'vu-meter',        onTap: viewActions.tapVuMeter },
```

- [ ] **Step 4: Verify type-check and existing NavColumn tests still pass**

```bash
npx tsc --noEmit
npm run test:run -- src/lib/components/redesign/__tests__/
```

Expected: PASS — no type errors, no broken existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/redesign/NavColumn.svelte
git commit -m "feat(vu-meter): highlight VU Meter nav cell when active

Widen NavColumn's local Cell.activeWhen union to include 'vu-meter'
and gate the existing audio-lines cell on it, mirroring Player /
Library / Settings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: VuMeterView component

**Files:**
- Create: `src/lib/components/redesign/VuMeterView.svelte`
- Test: `src/lib/components/redesign/__tests__/VuMeterView.test.ts`

Depends on Task 1 (uses `vuLevelL` / `vuLevelR` from `$lib/stores/spectrum`).

- [ ] **Step 1: Write the failing component test**

Create `src/lib/components/redesign/__tests__/VuMeterView.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';

// Mock the spectrum store before importing the view.
const mocks = await vi.hoisted(async () => {
  const { writable } = await import('svelte/store');
  return {
    vuLevelL: writable(0),
    vuLevelR: writable(0),
  };
});

vi.mock('$lib/stores/spectrum', () => ({
  vuLevelL: mocks.vuLevelL,
  vuLevelR: mocks.vuLevelR,
}));

import VuMeterView from '../VuMeterView.svelte';

// RAF shim — capture callbacks and let tests flush them on demand.
let rafCallbacks: FrameRequestCallback[] = [];
let rafTime = 0;
function flushRAF(advanceMs = 16) {
  rafTime += advanceMs;
  const due = rafCallbacks;
  rafCallbacks = [];
  due.forEach((cb) => cb(rafTime));
}

beforeEach(() => {
  rafCallbacks = [];
  rafTime = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  mocks.vuLevelL.set(0);
  mocks.vuLevelR.set(0);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

describe('VuMeterView', () => {
  it('renders root, L, and R test-ids', () => {
    mockReducedMotion(true);
    const { getByTestId } = render(VuMeterView);
    expect(getByTestId('vu-meter-view')).toBeTruthy();
    expect(getByTestId('vu-meter-l')).toBeTruthy();
    expect(getByTestId('vu-meter-r')).toBeTruthy();
  });

  it('renders exactly 40 segments per bar', () => {
    mockReducedMotion(true);
    const { container } = render(VuMeterView);
    const lSegments = container.querySelectorAll('[data-testid^="vu-meter-l-segment-"]');
    const rSegments = container.querySelectorAll('[data-testid^="vu-meter-r-segment-"]');
    expect(lSegments).toHaveLength(40);
    expect(rSegments).toHaveLength(40);
  });

  describe('reduced motion (synchronous off-frame)', () => {
    beforeEach(() => mockReducedMotion(true));

    it('lights all L segments when vuLevelL = 1.0', async () => {
      const { container } = render(VuMeterView);
      mocks.vuLevelL.set(1.0);
      await tick();
      const lit = container.querySelectorAll('[data-testid^="vu-meter-l-segment-"].lit');
      expect(lit).toHaveLength(40);
    });

    it('lights zero L segments when vuLevelL = 0', async () => {
      const { container } = render(VuMeterView);
      mocks.vuLevelL.set(0);
      await tick();
      const lit = container.querySelectorAll('[data-testid^="vu-meter-l-segment-"].lit');
      expect(lit).toHaveLength(0);
    });

    it('lights ~half of R segments when vuLevelR = 0.5', async () => {
      const { container } = render(VuMeterView);
      mocks.vuLevelR.set(0.5);
      await tick();
      const lit = container.querySelectorAll('[data-testid^="vu-meter-r-segment-"].lit');
      // 40 segments, i/40 < 0.5 → i in 0..19 → 20 lit
      expect(lit).toHaveLength(20);
    });
  });

  describe('animated mode (RAF smoothing)', () => {
    beforeEach(() => mockReducedMotion(false));

    it('lit-segment count increases monotonically as RAF advances toward target', async () => {
      const { container } = render(VuMeterView);
      mocks.vuLevelL.set(1.0);
      await tick();

      const counts: number[] = [];
      for (let i = 0; i < 8; i++) {
        flushRAF(16);
        await tick();
        counts.push(
          container.querySelectorAll('[data-testid^="vu-meter-l-segment-"].lit').length,
        );
      }
      // Smoothing approaches 1.0 — each successive sample is ≥ the previous,
      // and the final value is strictly greater than the first.
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
      }
      expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
    });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npm run test:run -- src/lib/components/redesign/__tests__/VuMeterView.test.ts
```

Expected: FAIL — `Cannot find module '../VuMeterView.svelte'`.

- [ ] **Step 3: Implement the view**

Create `src/lib/components/redesign/VuMeterView.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { vuLevelL, vuLevelR } from '$lib/stores/spectrum';

  const SEGMENT_COUNT = 40;
  const TAU_MS = 300;  // RMS integration time-constant (classic-VU spec)

  let displayedL = $state(0);
  let displayedR = $state(0);

  let raf = 0;
  let lastT = 0;
  // $state so $effect tracks the flip in onMount and re-runs.
  let reducedMotion = $state(false);

  function tick(t: number) {
    raf = requestAnimationFrame(tick);
    const dt = lastT ? t - lastT : 16;
    lastT = t;
    const alpha = 1 - Math.exp(-dt / TAU_MS);
    displayedL += ($vuLevelL - displayedL) * alpha;
    displayedR += ($vuLevelR - displayedR) * alpha;
  }

  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      raf = requestAnimationFrame(tick);
    }
  });

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
  });

  // In reduced-motion mode the RAF loop is skipped; the bars react
  // directly off the store at the 20 fps push cadence. reducedMotion is
  // $state so this effect re-runs when onMount flips it.
  $effect(() => {
    if (reducedMotion) {
      displayedL = $vuLevelL;
      displayedR = $vuLevelR;
    }
  });
</script>

<section class="vu-meter-view" data-testid="vu-meter-view" aria-label="VU meter">
  <div
    class="vu-bar"
    data-testid="vu-meter-l"
    role="meter"
    aria-label="Left channel level"
    aria-valuemin="0"
    aria-valuemax="1"
    aria-valuenow={displayedL}
  >
    <span class="label">L</span>
    <div class="segments">
      {#each Array(SEGMENT_COUNT) as _, i}
        <div
          class="segment"
          class:lit={i / SEGMENT_COUNT < displayedL}
          data-testid="vu-meter-l-segment-{i}"
        ></div>
      {/each}
    </div>
  </div>

  <div
    class="vu-bar"
    data-testid="vu-meter-r"
    role="meter"
    aria-label="Right channel level"
    aria-valuemin="0"
    aria-valuemax="1"
    aria-valuenow={displayedR}
  >
    <span class="label">R</span>
    <div class="segments">
      {#each Array(SEGMENT_COUNT) as _, i}
        <div
          class="segment"
          class:lit={i / SEGMENT_COUNT < displayedR}
          data-testid="vu-meter-r-segment-{i}"
        ></div>
      {/each}
    </div>
  </div>
</section>

<style>
  .vu-meter-view {
    width: 100%;
    height: 100%;
    background: #050507;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 40px;
    padding: 16px;
    box-sizing: border-box;
  }

  .vu-bar {
    display: flex;
    align-items: center;
    height: 168px;
    gap: 16px;
  }

  .label {
    width: 28px;
    text-align: center;
    font-size: 24px;
    font-weight: 600;
    color: var(--color-accent);
    letter-spacing: 0.05em;
  }

  .segments {
    flex: 1;
    display: flex;
    align-items: stretch;
    gap: 2px;
    height: 100%;
  }

  .segment {
    flex: 1;
    background: var(--color-accent);
    opacity: 0.08;
    border-radius: 2px;
    transition: opacity 50ms linear;
  }

  .segment.lit {
    opacity: 1;
  }
</style>
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npm run test:run -- src/lib/components/redesign/__tests__/VuMeterView.test.ts
```

Expected: PASS — all 5 cases green (root testids, segment counts, reduced-motion lighting at 1.0/0/0.5, animated-mode monotonic increase).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/redesign/VuMeterView.svelte src/lib/components/redesign/__tests__/VuMeterView.test.ts
git commit -m "feat(vu-meter): add classic-VU view with 40-segment L/R bars

300 ms RAF exponential smoothing; reduced-motion fallback bypasses
RAF and reacts directly off the store. Single warm amber, plain dark
backdrop, no peak-hold marker (locked decisions in the design spec).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: App.svelte init

**Files:**
- Modify: `src/App.svelte` (add import + onMount call)

Depends on Task 1.

- [ ] **Step 1: Type-check the baseline**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 2: Add the import statement**

Edit `src/App.svelte`. After line 16 (`import { initBiosStore, ...`), add:

```ts
import { initSpectrumStore } from '$lib/stores/spectrum';
```

Keep the existing imports alphabetically grouped or in the order they appear — this addition fits naturally after `initBiosStore` and before `initAudioEngineStore` since `initSpectrumStore` is the new entry.

- [ ] **Step 3: Add the call inside `onMount`**

Edit `src/App.svelte`. After line 63 (`initBiosStore();`), add:

```ts
    initSpectrumStore();
```

The order matches the surrounding `init*` calls. No cleanup function is needed — the store listener is always-on for the app's lifetime, and the socket disconnect at line 302 tears down all listeners transitively.

- [ ] **Step 4: Verify type-check and full unit test suite**

```bash
npx tsc --noEmit
npm run test:run
```

Expected: PASS on both. The full suite confirms App.svelte hasn't drifted.

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte
git commit -m "feat(vu-meter): wire initSpectrumStore in App.onMount

Listener is always-on; cost-when-idle is one writable.set() per 50 ms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: PlayerLayout lazy-load extension

**Files:**
- Modify: `src/lib/components/redesign/PlayerLayout.svelte`

Depends on Task 4 (`./VuMeterView.svelte` must exist for the dynamic import to resolve at runtime).

- [ ] **Step 1: Type-check the baseline**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 2: Replace the script block**

Edit `src/lib/components/redesign/PlayerLayout.svelte`. Replace the `<script lang="ts">` block (lines 1–29) with:

```svelte
<script lang="ts">
  import { currentView } from '$lib/stores/navigation';
  import PlayerView from './PlayerView.svelte';
  import LibraryView from './LibraryView.svelte';
  import NavColumn from './NavColumn.svelte';
  import type { Component } from 'svelte';

  // Lazy-load rare-path views so they don't ship in the initial App chunk.
  // Settings: snug-summit C6 (heavy children include NasShareList).
  // VuMeter:  M1.E (its own chunk; bundle guard in PlayerLayout.test.ts).
  let SettingsView = $state<Component | null>(null);
  let VuMeterView = $state<Component | null>(null);
  let settingsImportStarted = false;
  let vuMeterImportStarted = false;

  // Subscribe directly to the navigation store so the lazy-load fires on the
  // first transition into the target view. ($effect on a $-store read worked
  // in dev but proved unreliable in jsdom test runs; an explicit subscription
  // is the simplest reactive primitive that's portable across both runtimes.)
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
  // Clean up on component teardown so the subscription doesn't leak.
  $effect(() => () => unsubscribeView());
</script>
```

- [ ] **Step 3: Add the vu-meter render branch**

Edit the same file, the render block (lines 31–44). Replace:

```svelte
<div class="player-layout" data-testid="player-layout">
  <div class="content">
    {#if $currentView === 'player'}
      <PlayerView />
    {:else if $currentView === 'settings'}
      {#if SettingsView}
        <SettingsView />
      {/if}
    {:else}
      <LibraryView />
    {/if}
  </div>
  <NavColumn />
</div>
```

With:

```svelte
<div class="player-layout" data-testid="player-layout">
  <div class="content">
    {#if $currentView === 'player'}
      <PlayerView />
    {:else if $currentView === 'settings'}
      {#if SettingsView}
        <SettingsView />
      {/if}
    {:else if $currentView === 'vu-meter'}
      {#if VuMeterView}
        <VuMeterView />
      {/if}
    {:else}
      <LibraryView />
    {/if}
  </div>
  <NavColumn />
</div>
```

- [ ] **Step 4: Type-check and run all PlayerLayout-related tests**

```bash
npx tsc --noEmit
npm run test:run -- src/lib/components/redesign/__tests__/PlayerLayout.test.ts
```

Expected: PASS on both. Task 7 will widen the bundle guard and add the VuMeterView assertion; this task only changes source.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/redesign/PlayerLayout.svelte
git commit -m "feat(vu-meter): lazy-import VuMeterView in PlayerLayout

Symmetric extension of the C6 SettingsView pattern: one extra
\$state cell, one extra branch in the currentView subscribe, one
extra render arm. importStarted renamed to settingsImportStarted
to disambiguate (no behavior change).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: PlayerLayout bundle guard — widen + assert VuMeterView lazy

**Files:**
- Modify: `src/lib/components/redesign/__tests__/PlayerLayout.test.ts:124-133`

Depends on Task 6 (PlayerLayout.svelte must already have the dynamic import in place for the new assertion to pass).

- [ ] **Step 1: Read the existing guard and confirm baseline**

```bash
npm run test:run -- src/lib/components/redesign/__tests__/PlayerLayout.test.ts -t "does not statically import SettingsView"
```

Expected: PASS — the C6 guard is currently green.

- [ ] **Step 2: Write the failing extended test**

Edit `src/lib/components/redesign/__tests__/PlayerLayout.test.ts`. Replace the existing bundle-guard test (lines 124–133) with:

```ts
// ---------------------------------------------------------------------------
// Bundle-size guard (plan §C6.1 + M1.E)
//
// Rare-path views must not be transitively loaded at module-load time when
// the user is idle on the player view — they ship in their own Vite chunks.
// We assert this at the source level: PlayerLayout must NOT contain a
// static `import` statement for these views; they must be pulled in via
// dynamic `import()` so Rollup can split them out. (A mock-based assertion
// is unreliable here — Vitest's `vi.mock` does not consistently intercept
// dynamic `import()` of .svelte files when the real Vite-Svelte plugin is
// in the resolver chain — so we guard the chunking intent at the source
// level instead.)
//
// Regex shape (M1.E widening — C6 reviewers flagged the original \\w+ form
// as too narrow): matches `import X from`, `import { X } from`,
// `import * as X from`, `import type X from`, and combinations with
// destructured siblings. Source must NOT contain such a static import for
// the lazy views; source MUST contain the dynamic-import call site.
// ---------------------------------------------------------------------------
function staticImportRegexFor(filename: string): RegExp {
  // [^;\n]* between `import` and `from` covers every import shape Vite/Rollup
  // would treat as a static import; the trailing path arm ensures we only
  // catch imports of THIS file.
  return new RegExp(
    String.raw`^\s*import\b[^;\n]*\bfrom\s+['"][^'"]*${filename.replace(/\./g, '\\.')}['"]\s*;?`,
    'm',
  );
}

it.each([
  ['SettingsView.svelte'],
  ['VuMeterView.svelte'],
])('does not statically import %s (so it stays in a separate chunk)', (filename) => {
  const here = dirname(fileURLToPath(import.meta.url));
  const playerLayoutPath = resolve(here, '..', 'PlayerLayout.svelte');
  const src = readFileSync(playerLayoutPath, 'utf8');
  expect(staticImportRegexFor(filename).test(src)).toBe(false);
  // And confirm the lazy hookup is in place (dynamic-import call site).
  expect(src.includes(`import('./${filename}')`)).toBe(true);
});
```

The imports at the top of the file (`readFileSync`, `fileURLToPath`, `dirname`, `resolve`) are already present from the C6 guard — leave them in place.

- [ ] **Step 3: Run the test, verify both rows pass**

```bash
npm run test:run -- src/lib/components/redesign/__tests__/PlayerLayout.test.ts
```

Expected: PASS — both parametrized rows green. The SettingsView row continues to assert the C6 guarantee; the VuMeterView row asserts Task 6's lazy hookup.

If the VuMeterView row fails, Task 6's `import('./VuMeterView.svelte')` literal isn't present in the source — re-check the script-block replacement in Task 6 Step 2.

- [ ] **Step 4: Run the wider PlayerLayout suite to confirm no regressions**

```bash
npm run test:run -- src/lib/components/redesign/__tests__/PlayerLayout.test.ts
```

Expected: PASS on every test in the file (rendering tests + parametrized bundle guard).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/redesign/__tests__/PlayerLayout.test.ts
git commit -m "test(vu-meter): widen bundle guard and assert VuMeterView lazy

Parametrize the C6 source-level static-import guard with [...filename]
rows; widen the regex to match all import shapes (destructured, type,
namespace, default) per C6 reviewer feedback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Playwright E2E spec

**Files:**
- Create: `e2e/vu-meter.spec.ts`

Depends on Tasks 1–7. Runs against the live Pi (Mac Vite + Pi backend per `playwright.config.ts`).

**Preconditions for the test environment** (document at the top of the spec):
- Mac Vite dev server up at `192.168.86.221:5173` (per `playwright.config.ts`).
- Pi backend reachable; `stellar-spectrum` daemon not required for steps 1+3 (paused asserts zero lit segments) but required for step 2 (playback asserts > 0 lit). For the playback step, MPD on the Pi must have a stereo track in queue (the M1.B smoke ran on "Anomalie - Fin" 44.1 kHz/16-bit stereo).

- [ ] **Step 1: Write the e2e spec**

Create `e2e/vu-meter.spec.ts`:

```ts
import { test, expect, Page } from '@playwright/test';

/**
 * M1.E — VU meter frontend
 *
 * Lives behind the existing Mac-Vite + Pi-backend e2e topology (per
 * playwright.config.ts baseURL). The playback step requires a stereo
 * track in the Pi's MPD queue; if no audio is reachable the assertion
 * hard-fails — silent skip would hide regressions.
 */

const VU_VIEW = '[data-testid="vu-meter-view"]';
const VU_L = '[data-testid="vu-meter-l"]';
const VU_R = '[data-testid="vu-meter-r"]';
const L_SEGMENTS = '[data-testid^="vu-meter-l-segment-"].lit';
const R_SEGMENTS = '[data-testid^="vu-meter-r-segment-"].lit';
const NAV_VU = '[data-testid="nav-cell-vu-meter"]';
const NAV_PLAYER = '[data-testid="nav-cell-player"]';
const PLAY_PAUSE = '[data-testid="btn-play-pause"]';
const PLAYER_LAYOUT = '[data-testid="player-layout"]';

async function gotoApp(page: Page) {
  await page.goto('/');
  await page.waitForSelector(PLAYER_LAYOUT, { timeout: 10000 });
}

test.describe('VU meter view', () => {
  test('appears within 2s on first VU cell tap and shows zero lit segments when MPD is stopped', async ({ page }) => {
    await gotoApp(page);

    // Test-environment precondition: MPD on the Pi is stopped or paused at
    // the start of this spec. The 600ms settle below would still show lit
    // segments if audio were actually playing, so this assertion is the
    // canary for that precondition as well as for the zero-lit baseline.
    await page.click(NAV_VU);
    await expect(page.locator(VU_VIEW)).toBeVisible({ timeout: 2000 });
    await expect(page.locator(VU_L)).toBeVisible();
    await expect(page.locator(VU_R)).toBeVisible();

    // Allow a settling window (RAF smoothing decays); then assert zero lit.
    await page.waitForTimeout(600);
    expect(await page.locator(L_SEGMENTS).count()).toBe(0);
    expect(await page.locator(R_SEGMENTS).count()).toBe(0);
  });

  test('lit segments become > 0 within 3s of starting playback (stereo track required)', async ({ page }) => {
    await gotoApp(page);

    // Return to player to access the play button, click play, then back to VU.
    await page.click(NAV_PLAYER);
    await page.waitForSelector(PLAY_PAUSE, { timeout: 5000 });
    await page.click(PLAY_PAUSE);

    await page.click(NAV_VU);
    await expect(page.locator(VU_VIEW)).toBeVisible({ timeout: 2000 });

    // Poll for lit segments — RAF smoothing + ~50 ms push cadence means
    // we should see lit segments within ~500 ms of audio actually starting,
    // but allow up to 3 s for the play action to take effect end-to-end.
    await expect
      .poll(async () => page.locator(L_SEGMENTS).count(), { timeout: 3000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => page.locator(R_SEGMENTS).count(), { timeout: 3000 })
      .toBeGreaterThan(0);

    // Cleanup — pause so the next test starts from a known state.
    await page.click(NAV_PLAYER);
    await page.click(PLAY_PAUSE);
  });

  test('returns to PlayerView and unmounts the VU view on nav-cell-player tap', async ({ page }) => {
    await gotoApp(page);

    await page.click(NAV_VU);
    await expect(page.locator(VU_VIEW)).toBeVisible({ timeout: 2000 });

    await page.click(NAV_PLAYER);
    await expect(page.locator(VU_VIEW)).toBeHidden();
    // Player layout root stays; VU view is gone from the DOM.
    await expect(page.locator(PLAYER_LAYOUT)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Before running, confirm Mac Vite is serving (the dev server is the test target):

```bash
# In a separate terminal, leave this running:
npm run dev
```

Then run the new spec:

```bash
npm run test:e2e -- e2e/vu-meter.spec.ts
```

Expected:
- All 3 tests pass on both chromium and firefox (6 results total per `playwright.config.ts`).
- If the playback test fails because no stereo track is loaded, set up the MPD queue first (the M1.B smoke used "Anomalie - Fin") and rerun.

If any test fails, inspect the Playwright HTML report (`playwright-report/index.html`) and the trace from the first retry (`trace: 'on-first-retry'` per config).

- [ ] **Step 3: Commit**

```bash
git add e2e/vu-meter.spec.ts
git commit -m "test(vu-meter): add live-Pi e2e for VU view appear/signal/exit

Three scenarios: cold tap shows view within 2 s + zero lit at rest;
playback drives lit > 0 on both bars within 3 s (stereo track
precondition); nav-cell-player unmounts the view.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Verification gate

This task runs the full verification gate from the spec and produces a manual-smoke checklist for the LCD kiosk.

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit
```

Expected: clean exit (status 0).

- [ ] **Step 2: Full Vitest suite**

```bash
npm run test:run
```

Expected: all suites pass. Note baseline counts before this phase (snug-summit C7 was at 857 passing / 1 skipped); record the new total after M1.E — it should be 857 + new tests. New tests added by this plan:
- `spectrum.test.ts`: 8 `rmsToBarFill` cases + 1 idempotency + 2 frame-handling = **11 tests**
- `navigation.test.ts`: 1 `tapVuMeter` route = **1 test**
- `VuMeterView.test.ts`: 2 structural + 3 reduced-motion + 1 animated monotonic = **6 tests**
- `PlayerLayout.test.ts`: bundle guard changes from 1 test to a parametrized × 2 = **+1 test net**

Expected post-M1.E total: ~876 passing (depending on whether any other tests landed between snug-summit C7 and now).

- [ ] **Step 3: E2E suite (live Pi)**

```bash
npm run test:e2e -- e2e/vu-meter.spec.ts
```

Expected: 6 results (3 tests × chromium + firefox) all green. Requires a stereo track queued on the Pi for the playback case.

- [ ] **Step 4: Manual smoke on the LCD kiosk**

With Mac Vite serving and the Pi backend `active`:

- [ ] Open `http://192.168.86.221:5173?layout=lcd` in a desktop browser (mirrors the LCD's view).
- [ ] Tap the "VU Meter" cell in NavColumn (third from top, `audio-lines` icon). The view should appear within ~250 ms — the lazy chunk load is the only delay on first tap.
- [ ] Tap "Player" then "VU Meter" again — second tap should be instant (chunk now cached).
- [ ] Start playback of a stereo track. Both bars should dance, with `displayedL ≠ displayedR` visible on stereo content (`rmsL ≠ rmsR` from the wire).
- [ ] Tap "Player" — VU view should disappear; PlayerView reappears intact.
- [ ] Test reduced motion (DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce` → reload). Bars should still react to signal but with no animation between frames.
- [ ] Browser console: confirm no spectrum-handler log noise during playback. (`pushSpectrum` is hot-path; no log was added in Task 1.)

- [ ] **Step 5: Confirm no regression in E2E pass rate**

```bash
npm run test:e2e
```

Expected: total pass rate ≥ the 38% recorded in `E2E-TEST-ISSUES.md` at start of M1.E. The new `vu-meter.spec.ts` should add 6 passing rows; nothing else should change.

If pass rate drops, investigate the failing spec and either fix it (if M1.E caused it) or roll back the offending change.

- [ ] **Step 6: Final summary commit (optional)**

If the verification gate passes cleanly and no fixes were needed, no further commit is required — the per-task commits already cover everything.

If small fixes were needed during verification (e.g. a tweak to a selector, a CSS adjustment after manual smoke), commit them with a scope-appropriate message:

```bash
git add <files>
git commit -m "<type>(vu-meter): <one-line summary of the fix>

<one paragraph explaining the fix and why>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Branch state report**

Print final state for the handoff:

```bash
git log --oneline -10
git status
```

Expected output: 8–10 new commits since `6e56fccb` (the last M1.B commit), working tree clean, branch ahead of `origin/master`. User pushes when ready (established direct-to-master pattern; do not push without explicit user instruction).

---

## Out-of-scope reminders (deferred, not in this plan)

- Remove the deprecated `{bins, peak, rms}` mono fallback from the backend payload. Schedule for the phase after M1.E.
- Install `golangci-lint` via asdf to reinstate the backend lint gate. Carryover from M1.B.
- Artists-view mockup for M2.C. Pending user attach; unrelated to M1.E.
- Doc drift on `?layout=lcd` (CLAUDE.md / config.ts / kiosk script). Tracked in memory; out of scope here.
