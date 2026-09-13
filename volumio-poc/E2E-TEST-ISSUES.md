# E2E Test Issues Report

**Test Run:** 2026-01-21
**Results:** 21 passed, 34 failed (38% pass rate)

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
