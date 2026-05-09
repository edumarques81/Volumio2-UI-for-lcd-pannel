# E2E Test Issues Report

**Test Run:** 2026-01-21
**Results:** 21 passed, 34 failed (38% pass rate)

> **Status (2026-05-09):** the 38% baseline above predates the Settings v2 redesign and Cycle 4's spec rewrites. Cycle 4 deleted 2 stale failing specs (`settings.spec.ts`, `audio-output.spec.ts`) and added 3 new specs (`settings-v2.spec.ts`, `audio-output-v2.spec.ts`, `settings-nas.spec.ts`) totaling 10 cases × 2 Playwright projects = 20 passing tests against the live Mac dev server. A full-suite re-run + headline refresh is deferred to a future Cycle 5 task. See the Cycle 4 section below for what shipped.

---

## 2026-05-09 — Cycle 4 / Task T2: Settings v2 + audio-output rewrite

### Specs added

- **`e2e/settings-v2.spec.ts`** — replaces stale `e2e/settings.spec.ts`. Five
  cases: column render after NavColumn → Settings, Library-scope NAS
  round-trip with localStorage persistence across reload, Reboot Cancel (no
  emit), Reboot Confirm (emits `reboot`), NavColumn back to Player.
- **`e2e/audio-output-v2.spec.ts`** — replaces stale `e2e/audio-output.spec.ts`.
  Three cases: both devices render in the SelectField, picking the second
  device emits `setPlaybackSettings { output_device }` and a success ack
  updates the bound select, and an error ack leaves the canonical state
  intact + a recovery selection round-trips end-to-end.
- **`e2e/settings-nas.spec.ts`** — new. Two cases: manual-add fills every
  testid, captures `addNasShare` payload, and renders `nas-result-strip`
  after a `pushNasShareResult` + `pushListNasShares` ack pair; discover →
  device → browse → "Use this" path drives `discoverNasDevices` →
  `pushNasDevices` → `browseNasShares` → `pushBrowseNasShares` →
  `addNasShare` → `pushListNasShares` → `mountNasShare`.

### Specs deleted

- `e2e/settings.spec.ts` — targeted v1 selectors (`[data-view="settings"]`,
  `.category-card`, `.background-selector`) that no longer exist after the
  Settings v2 redesign.
- `e2e/audio-output.spec.ts` — mixed v1 selectors and v2 testids; gated
  behavior on the optional `__testAudioDevices` window hook rather than a
  real socket mock.

### Mock harness

- New: `tests/e2e/fixtures/mockSocket.ts`. Boots a real `socket.io@4` server
  with EIO3 compat (matches the Pi backend's v3 server) on `127.0.0.1` /
  ephemeral port, routes `/config.json` per page, captures every client emit
  (including ack callbacks), and exposes `send(event, payload)`,
  `waitForEmit(event, opts)`, `getEmits(event)`, and `waitForClient()`.
- Per-test isolation via Playwright's `test.extend` fixture. New
  devDependency: `socket.io@4`.
- See the file's header comment for full API + usage example.

### Reconciliations / surprises

- **System power events:** the C4 plan referred to `system:action:reboot` and
  `system:action:shutdown`. The actual code in `settingsActions` (settings.ts:288, 296)
  emits `reboot` and `shutdown`. The new specs assert the actual event names.
- **NAS push event names:** the C4 plan said `pushDiscoveredNasDevices` and
  `pushBrowsedNasShares`. The store at `src/lib/stores/sources.ts` actually
  listens for `pushNasDevices` and `pushBrowseNasShares`. The new specs use
  the actual names.
- **NAS testids keyed by id, not name:** per-share testids
  (`nas-share-{id}`, `nas-share-mount-{id}`, etc.) are keyed by `share.id`,
  NOT `share.name`. Verified in `NasShareList.svelte:112`.

### Newly observed product gap (NOT yet filed)

- **Audio output error path has no visible rollback.** When
  `setPlaybackSettings` returns `{ success: false }`, `audioDevices.setOutput`
  (audioDevices.ts:172) only `console.error`s — no toast surfaces and the
  store value is not touched. Because `SelectField` renders an uncontrolled
  native `<select>` and the bound `value` prop doesn't change in this path,
  the user-picked option stays visible in the DOM. The C4 plan asked for
  "error toast appears, selection rolls back" — neither happens today. The
  spec asserts the testable parts (correct emit payload, error doesn't
  crash, recovery selection still works) and documents the gap here.

## Summary of Issues

### Category 1: Navigation Selectors Not Found
**Affected Tests:** 6 tests
**Root Cause:** Navigation selectors (`nav-browse`, `nav-queue`, `nav-settings`, `.nav-item`) don't match actual app structure.

**Failed Tests:**
- `should navigate to Browse view`
- `should navigate to Queue view`
- `should navigate to Settings view`
- All Browse View tests (can't navigate there)
- All Queue View tests (can't navigate there)
- All Settings View tests (can't navigate there)

**Fix Required:** Update tests to use correct navigation selectors or add `data-testid` attributes to navigation components.

---

### Category 2: Player Control Selectors Not Found
**Affected Tests:** 7 tests
**Root Cause:** Player control selectors (`.player-controls`, previous/next buttons, volume, shuffle, repeat, seek bar) don't match actual component structure.

**Failed Tests:**
- `should display player controls`
- `should have previous track button`
- `should have next track button`
- `should have volume control`
- `should have shuffle button`
- `should have repeat button`
- `should display seek bar`

**Fix Required:** Update player component with `data-testid` attributes or update test selectors.

---

### Category 3: Status Drawer Not Found
**Affected Tests:** 2 tests
**Root Cause:** `.status-drawer` selector not found after clicking status badge.

**Failed Tests:**
- `should open status drawer when status badge is clicked`
- `should close status drawer when clicking outside`

**Fix Required:** Verify StatusDrawer component renders correctly and has proper class names.

---

### Category 4: Toast Test Helpers Not Working
**Affected Tests:** 4 tests
**Root Cause:** `window.testToast` helper may not be exposed or toasts not rendering as expected.

**Failed Tests:**
- `should display toast when triggered via test helper`
- `should auto-dismiss toast after duration`
- `should dismiss toast when close button clicked`
- `should show error toast with correct styling`

**Fix Required:** Verify testToast helper is exposed on window and toasts have expected CSS classes.

---

### Category 5: Context Menu Not Found
**Affected Tests:** 3 tests
**Root Cause:** Context menu doesn't appear on right-click or selectors don't match.

**Failed Tests:**
- `should show context menu on long press`
- `should show context menu with expected options`
- `should close context menu when clicking outside`

**Fix Required:** Context menu may require touch/long-press simulation instead of right-click.

---

## Passing Tests (21)

The following functionality works correctly:

1. **Basic App Loading**
   - Home screen loads
   - Status bar displays
   - Time displays in status bar

2. **Status Bar**
   - Status badge visible
   - Status dot with color
   - LCD toggle button
   - Toggle LCD state

3. **Player (Partial)**
   - Play/pause button visible and clickable
   - Album art/placeholder visible
   - Track info visible
   - Volume slider adjustable

4. **Responsive Layout**
   - LCD viewport adaptation
   - Desktop viewport adaptation
   - Touch-friendly target sizes

5. **Modals**
   - Track info modal (when button found)
   - Modal close behavior

---

## Recommended Fixes

### Priority 1: Add data-testid Attributes
Add `data-testid` attributes to key components for reliable test selection:

```svelte
<!-- NavBar.svelte -->
<button data-testid="nav-browse">Browse</button>
<button data-testid="nav-queue">Queue</button>
<button data-testid="nav-settings">Settings</button>

<!-- PlayerControls.svelte -->
<button data-testid="btn-prev">...</button>
<button data-testid="btn-play-pause">...</button>
<button data-testid="btn-next">...</button>
<button data-testid="btn-shuffle">...</button>
<button data-testid="btn-repeat">...</button>
<input data-testid="seek-bar" type="range" />
<input data-testid="volume-slider" type="range" />

<!-- StatusDrawer.svelte -->
<div class="status-drawer" data-testid="status-drawer">...</div>
```

### Priority 2: Fix View Container Classes
Ensure views have consistent class names:
- `.browse-view` or `[data-view="browse"]`
- `.queue-view` or `[data-view="queue"]`
- `.settings-view` or `[data-view="settings"]`

### Priority 3: Verify Toast Exposure
Ensure `window.testToast` is accessible and toasts have correct classes:
- `.toast--error`, `.toast--warning`, `.toast--success`, `.toast--info`

### Priority 4: Context Menu Touch Support
Implement proper touch/long-press handling for context menu tests.

---

## Performance Notes

All tests ran within acceptable timeouts when selectors were found. No performance issues observed with the Raspberry Pi backend response times.
