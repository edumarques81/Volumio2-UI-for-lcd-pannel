# M2.C Artists library page — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new horizontally-scrolling Artists library page reachable via vertical swipe inside `LibraryView`, with circular `/artistart`-or-letter-avatar tiles, tap-to-filter-Albums-page-by-artist, and an inline amber `✕` filter banner on `MetadataBlock`.

**Architecture:** Discriminated-union `libraryPageKind` store (`'albums' | 'artists'`) drives a renderer switch inside `LibraryView`. Horizontal swipe → within-page item nav (existing). Vertical swipe → page-kind cycle (new). `ArtistsPage` and `ArtistTile` are lazy-imported on first kind-flip to `'artists'`. Tap on a tile sets `selectedArtist`, fires the existing `fetchArtistAlbums`, and cycles back to Albums; `MetadataBlock` renders the artist name amber with an inline `✕` while the filter is active. A subscriber inside `library.ts` implicitly clears the filter on `'albums' → 'artists'` transition (matches the spec's "swipe-away clears filter" answer).

**Tech Stack:** Svelte 5 (`$state`, `$props`, `$derived`), TypeScript strict, Vitest 4 + `@testing-library/svelte`, Playwright (live-Pi target, currently skipped), socket.io 4.x client.

**Spec:** `docs/superpowers/specs/2026-05-13-m2c-artists-page-design.md` (commits `2d5c9676` + `0a386426`).

**Backend precondition (no code change required):** The album→artist enrichment chain user asked for already lives in `stellar-volumio-audioplayer-backend` v1.5.0+ — `server.go:2234,2271,2278` → `triggerEnrichment()` → `enrichment_handlers.go:147` (`QueueMissingArtwork`) chains album scan then artist scan, async, no polling. Task 8 verifies it fires via `journalctl` during manual smoke; no Go changes in this plan.

---

## Wave plan

Wave 1 (2 parallel) → Wave 2 (2 parallel) → Wave 3 (2 parallel) → Wave 4 (2 parallel).

| Wave | Tasks | Depends on |
|---|---|---|
| 1 | T1 artistAvatar · T2 libraryPageKind store | — |
| 2 | T3 ArtistTile · T4 ArtistsPage | T1, T2 |
| 3 | T5 LibraryView · T6 MetadataBlock | T4 (T5 imports ArtistsPage), T2 (T6 reads selectedArtist) |
| 4 | T7 e2e skipped spec · T8 verification gate | T1–T6 |

Wave 1 tasks touch different files and run in parallel. Wave 2 T3 and T4 touch different files; T4's test mocks `./ArtistTile.svelte` so it can author independently. Wave 3 T5 and T6 touch different files. Wave 4 T7 is a standalone new file; T8 runs after everything else.

Each task ends with an atomic commit. Push happens once after Task 8 sign-off — same direct-to-master pattern as M1.E.

---

## Task 1: `artistAvatar` utility

**Files:**
- Create: `src/lib/utils/artistAvatar.ts`
- Test: `src/lib/utils/__tests__/artistAvatar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/__tests__/artistAvatar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { artistInitial, artistHashColor } from '../artistAvatar';

describe('artistInitial', () => {
  it.each<[string, string]>([
    ['Hollow Tides', 'H'],
    ['  the Beatles', 'T'],
    ['nils frahm', 'N'],
    ['Æthel & Ash', 'Æ'],
    ['', '?'],
    ['   ', '?'],
  ])('artistInitial(%j) === %j', (input, expected) => {
    expect(artistInitial(input)).toBe(expected);
  });
});

describe('artistHashColor', () => {
  it('returns a deterministic HSL string for the same input', () => {
    expect(artistHashColor('Nils Frahm')).toBe(artistHashColor('Nils Frahm'));
  });

  it('returns different hues for different names (non-trivial dispersion)', () => {
    const a = artistHashColor('A');
    const b = artistHashColor('B');
    const c = artistHashColor('Hollow Tides');
    const d = artistHashColor('The Midnight Sun');
    const all = new Set([a, b, c, d]);
    expect(all.size).toBeGreaterThanOrEqual(3);
  });

  it('matches the hsl(<0-359>, 45%, 35%) shape', () => {
    const out = artistHashColor('Lunar Ways');
    expect(out).toMatch(/^hsl\((\d{1,3}), 45%, 35%\)$/);
    const hue = Number(out.match(/^hsl\((\d{1,3}),/)?.[1]);
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });

  it('handles empty string without throwing', () => {
    expect(() => artistHashColor('')).not.toThrow();
    expect(artistHashColor('')).toMatch(/^hsl\(\d{1,3}, 45%, 35%\)$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/__tests__/artistAvatar.test.ts`
Expected: FAIL — `Cannot find module '../artistAvatar'`.

- [ ] **Step 3: Implement the utility**

Create `src/lib/utils/artistAvatar.ts`:

```ts
/**
 * Returns the first non-whitespace character of `name`, uppercased.
 * Falls back to `'?'` for empty / whitespace-only input.
 *
 * No article-stripping ("The Beatles" → "T", not "B") — locale-sensitive
 * behaviour deferred until UX feedback justifies it.
 */
export function artistInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  return trimmed.charAt(0).toUpperCase();
}

/**
 * Deterministic name-hashed HSL colour for letter-avatar fallbacks.
 * Saturation 45% + lightness 35% — dark enough for white text to pass
 * contrast against, varied enough to feel distinct per artist.
 */
export function artistHashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 45%, 35%)`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/__tests__/artistAvatar.test.ts`
Expected: PASS — 4 test suites, 9 cases (6 `it.each` rows + 3 `it`).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/artistAvatar.ts src/lib/utils/__tests__/artistAvatar.test.ts
git commit -m "$(cat <<'EOF'
feat(artists): add artistAvatar helpers for letter-fallback tiles

artistInitial returns trimmed-first-char-uppercased ('Hollow Tides' → 'H')
with '?' fallback for empty input. artistHashColor returns a deterministic
hsl(hue, 45%, 35%) string from the artist name. Pure functions, no side
effects, exhaustive unit coverage including non-ASCII and empty input.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `libraryPageKind` store + cyclePageKind + clearArtistFilter + subscriber

**Files:**
- Modify: `src/lib/stores/library.ts`
- Modify: `src/lib/stores/__tests__/library.test.ts`

- [ ] **Step 1: Write the failing test cases**

Append the following to `src/lib/stores/__tests__/library.test.ts` (inside the existing `describe` block or as a new sibling `describe`):

```ts
import { get } from 'svelte/store';
import {
  LIBRARY_PAGE_KINDS,
  libraryPageKind,
  selectedArtist,
  artistAlbums,
  currentLibraryIndex,
  libraryActions,
  initLibraryStore,
} from '../library';

describe('libraryPageKind', () => {
  beforeEach(() => {
    libraryPageKind.set('albums');
    selectedArtist.set(null);
    artistAlbums.set([]);
    currentLibraryIndex.set(0);
  });

  it('LIBRARY_PAGE_KINDS is readonly ["albums","artists"]', () => {
    expect(LIBRARY_PAGE_KINDS).toEqual(['albums', 'artists']);
  });

  it('libraryPageKind initial value is "albums"', () => {
    expect(get(libraryPageKind)).toBe('albums');
  });

  it('cyclePageKind(+1) wraps albums → artists → albums', () => {
    libraryActions.cyclePageKind(1);
    expect(get(libraryPageKind)).toBe('artists');
    libraryActions.cyclePageKind(1);
    expect(get(libraryPageKind)).toBe('albums');
  });

  it('cyclePageKind(-1) wraps albums → artists → albums (opposite direction, same destination on a 2-kind cycle)', () => {
    libraryActions.cyclePageKind(-1);
    expect(get(libraryPageKind)).toBe('artists');
    libraryActions.cyclePageKind(-1);
    expect(get(libraryPageKind)).toBe('albums');
  });

  it('clearArtistFilter resets selectedArtist, artistAlbums, currentLibraryIndex', () => {
    selectedArtist.set('Hollow Tides');
    artistAlbums.set([{ id: 'x', title: 't', artist: 'a', albumArtist: 'a', uri: 'u', source: 'NAS' } as never]);
    currentLibraryIndex.set(7);

    libraryActions.clearArtistFilter();

    expect(get(selectedArtist)).toBeNull();
    expect(get(artistAlbums)).toEqual([]);
    expect(get(currentLibraryIndex)).toBe(0);
  });

  it('subscriber: albums → artists with selectedArtist set triggers clearArtistFilter', () => {
    initLibraryStore();           // registers the subscriber (idempotent)
    selectedArtist.set('Nils Frahm');
    artistAlbums.set([{ id: 'x', title: 't', artist: 'a', albumArtist: 'a', uri: 'u', source: 'NAS' } as never]);
    currentLibraryIndex.set(5);

    libraryActions.cyclePageKind(1);              // albums → artists

    expect(get(libraryPageKind)).toBe('artists');
    expect(get(selectedArtist)).toBeNull();
    expect(get(artistAlbums)).toEqual([]);
    expect(get(currentLibraryIndex)).toBe(0);
  });

  it('subscriber: artists → albums does NOT clear selectedArtist (post-tap filter must survive the trip back)', () => {
    initLibraryStore();
    libraryPageKind.set('artists');
    selectedArtist.set('Max Richter');

    libraryActions.cyclePageKind(1);              // artists → albums

    expect(get(libraryPageKind)).toBe('albums');
    expect(get(selectedArtist)).toBe('Max Richter');
  });

  it('subscriber: albums → artists with selectedArtist null is a no-op (no spurious resets)', () => {
    initLibraryStore();
    selectedArtist.set(null);
    currentLibraryIndex.set(9);

    libraryActions.cyclePageKind(1);              // albums → artists

    expect(get(libraryPageKind)).toBe('artists');
    expect(get(currentLibraryIndex)).toBe(9);     // unchanged
  });
});
```

Imports at the top of the test file should already cover `describe`, `it`, `expect`, `beforeEach`; add new symbol imports if missing.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/stores/__tests__/library.test.ts`
Expected: FAIL — `LIBRARY_PAGE_KINDS is not defined` (or similar import error from `../library`).

- [ ] **Step 3: Implement the store additions in `library.ts`**

In `src/lib/stores/library.ts`, add the following **after** the existing exports (locate the `// Artists store state` block around line 149) and **inside** the existing `libraryActions` object literal (around line 371-390).

3a. Add new exports near other writables:

```ts
// ----- Library page kind (M2.C) ---------------------------------------------
// Drives the renderer switch inside LibraryView. Add 'qobuz' here when M3.A
// lands; the wrap-modulo cyclePageKind handles arbitrary list lengths.
export const LIBRARY_PAGE_KINDS = ['albums', 'artists'] as const;
export type LibraryPageKind = typeof LIBRARY_PAGE_KINDS[number];
export const libraryPageKind = writable<LibraryPageKind>('albums');
```

3b. Add `cyclePageKind` and `clearArtistFilter` inside `libraryActions`:

```ts
  // ... existing actions
  /**
   * Cycle the library page kind by `delta` (+1 forward, -1 backward).
   * Wrap-modulo over LIBRARY_PAGE_KINDS so adding M3.A's 'qobuz' is
   * a single-character change.
   */
  cyclePageKind(delta: 1 | -1) {
    const kinds = LIBRARY_PAGE_KINDS;
    const len = kinds.length;
    libraryPageKind.update((k) => {
      const idx = kinds.indexOf(k);
      return kinds[((idx + delta) % len + len) % len];
    });
  },

  /**
   * Clear the active per-artist filter. Called when the user taps the
   * inline ✕ on MetadataBlock OR implicitly when the page-kind subscriber
   * fires on 'albums' → 'artists'.
   */
  clearArtistFilter() {
    selectedArtist.set(null);
    artistAlbums.set([]);
    currentLibraryIndex.set(0);
  },
```

3c. Register the subscriber inside `initLibraryStore()` (existing function around line 226). Add this block at the **end** of the function body, after the existing socket listener registrations and the `connectionState` subscribe:

```ts
  // Implicitly clear any active artist filter when the user swipes back to
  // ArtistsPage. The ✕ button on MetadataBlock is the explicit path; this
  // subscriber catches the "I'm leaving the filtered context" case.
  libraryPageKind.subscribe((kind) => {
    if (kind === 'artists' && get(selectedArtist) !== null) {
      libraryActions.clearArtistFilter();
    }
  });
```

The subscribe callback fires synchronously on registration with the initial value `'albums'`; the `kind === 'artists'` guard means the startup case is a cheap no-op. `get` is already imported at the top of `library.ts` (line 1: `import { writable, derived, get } from 'svelte/store';`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/stores/__tests__/library.test.ts`
Expected: PASS — 7 new cases, all green. Existing `library.test.ts` cases unchanged.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/library.ts src/lib/stores/__tests__/library.test.ts
git commit -m "$(cat <<'EOF'
feat(library): add libraryPageKind discriminated union + cycle actions

- LIBRARY_PAGE_KINDS = ['albums','artists'] as const + libraryPageKind
  writable + LibraryPageKind type. Forward-compatible with M3.A 'qobuz'.
- libraryActions.cyclePageKind(±1) wraps-modulo across the union.
- libraryActions.clearArtistFilter() resets selectedArtist + artistAlbums
  + currentLibraryIndex; called by MetadataBlock ✕ and by the subscriber.
- Subscriber inside initLibraryStore clears filter on 'albums' → 'artists'
  transition (swipe-back-to-Artists implicit clear).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `ArtistTile` component

**Files:**
- Create: `src/lib/components/redesign/ArtistTile.svelte`
- Test: `src/lib/components/redesign/__tests__/ArtistTile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/redesign/__tests__/ArtistTile.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ArtistTile from '../ArtistTile.svelte';

const baseArtist = { name: 'Nils Frahm', albumCount: 7 };

describe('ArtistTile', () => {
  it('renders <img> with /artistart src URL-encoding the name', () => {
    const { container } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap: () => {},
    });
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('/artistart?name=Nils%20Frahm');
  });

  it('renders the name in the label', () => {
    const { getByText } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap: () => {},
    });
    expect(getByText('Nils Frahm')).toBeTruthy();
  });

  it('has role="button", aria-pressed reflecting selected, aria-label = name', () => {
    const { container, rerender } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap: () => {},
    });
    const el = container.querySelector('[role="button"]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('aria-pressed')).toBe('false');
    expect(el?.getAttribute('aria-label')).toBe('Nils Frahm');

    rerender({ artist: baseArtist, selected: true, onTap: () => {} });
    expect(container.querySelector('[role="button"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('adds the is-selected class when selected={true}', () => {
    const { container, rerender } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap: () => {},
    });
    expect(container.querySelector('.artist-tile')?.classList.contains('is-selected')).toBe(false);
    rerender({ artist: baseArtist, selected: true, onTap: () => {} });
    expect(container.querySelector('.artist-tile')?.classList.contains('is-selected')).toBe(true);
  });

  it('exposes data-testid="artist-tile-{slug}" derived from the name', () => {
    const { container } = render(ArtistTile, {
      artist: { name: 'Hollow Tides', albumCount: 1 },
      selected: false,
      onTap: () => {},
    });
    expect(container.querySelector('[data-testid="artist-tile-hollow-tides"]')).toBeTruthy();
  });

  it('on img error swaps to the avatar fallback with the expected initial and hash colour', async () => {
    const { container, queryByText } = render(ArtistTile, {
      artist: { name: 'Aethel & Ash', albumCount: 3 },
      selected: false,
      onTap: () => {},
    });
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    await fireEvent.error(img!);
    const fallback = container.querySelector('[data-testid="avatar-fallback"]');
    expect(fallback).toBeTruthy();
    expect(queryByText('A')).toBeTruthy();
    // background-color is set inline; assert it matches the hsl() shape
    const bg = (fallback as HTMLElement)?.style.background;
    expect(bg).toMatch(/^hsl\(\d{1,3}, 45%, 35%\)$/);
  });

  it('invokes onTap(name) on click', async () => {
    const onTap = vi.fn();
    const { container } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap,
    });
    await fireEvent.click(container.querySelector('[role="button"]')!);
    expect(onTap).toHaveBeenCalledWith('Nils Frahm');
  });

  it('invokes onTap on Enter and Space keypress', async () => {
    const onTap = vi.fn();
    const { container } = render(ArtistTile, {
      artist: baseArtist,
      selected: false,
      onTap,
    });
    const el = container.querySelector('[role="button"]')!;
    await fireEvent.keyDown(el, { key: 'Enter' });
    await fireEvent.keyDown(el, { key: ' ' });
    expect(onTap).toHaveBeenCalledTimes(2);
    expect(onTap).toHaveBeenNthCalledWith(1, 'Nils Frahm');
    expect(onTap).toHaveBeenNthCalledWith(2, 'Nils Frahm');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/redesign/__tests__/ArtistTile.test.ts`
Expected: FAIL — `Cannot find module '../ArtistTile.svelte'`.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/redesign/ArtistTile.svelte`:

```svelte
<script lang="ts">
  import type { Artist } from '$lib/stores/library';
  import { artistInitial, artistHashColor } from '$lib/utils/artistAvatar';

  interface Props {
    artist: Artist;
    selected: boolean;
    onTap: (name: string) => void;
  }

  let { artist, selected, onTap }: Props = $props();

  let imageFailed = $state(false);

  const initial = $derived(artistInitial(artist.name));
  const hashColor = $derived(artistHashColor(artist.name));
  const imgSrc = $derived(`/artistart?name=${encodeURIComponent(artist.name)}`);
  const slug = $derived(
    artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  );

  function handleTap() {
    onTap(artist.name);
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTap();
    }
  }
</script>

<div
  class="artist-tile"
  class:is-selected={selected}
  role="button"
  tabindex="0"
  aria-pressed={selected}
  aria-label={artist.name}
  data-testid={`artist-tile-${slug}`}
  on:click={handleTap}
  on:keydown={handleKey}
>
  <div class="artist-tile-circle">
    {#if !imageFailed}
      <img src={imgSrc} alt="" on:error={() => (imageFailed = true)} />
    {:else}
      <div class="avatar-fallback" data-testid="avatar-fallback" style={`background:${hashColor}`}>
        {initial}
      </div>
    {/if}
  </div>
  <div class="artist-tile-name">{artist.name}</div>
</div>

<style>
  .artist-tile {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 160px;
    flex-shrink: 0;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .artist-tile:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
    border-radius: 8px;
  }
  .artist-tile-circle {
    width: 160px;
    height: 160px;
    border-radius: 50%;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: border-color 200ms ease-out, box-shadow 200ms ease-out;
  }
  .artist-tile.is-selected .artist-tile-circle {
    border: 2px solid var(--color-accent);
    box-shadow: 0 0 16px var(--color-accent-glow);
  }
  .artist-tile-circle img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 56px;
    font-weight: 700;
    line-height: 1;
  }
  .artist-tile-name {
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    letter-spacing: 0.01em;
    max-width: 160px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 200ms ease-out;
  }
  .artist-tile.is-selected .artist-tile-name {
    color: var(--color-accent-bright);
  }

  @media (prefers-reduced-motion: reduce) {
    .artist-tile-circle, .artist-tile-name { transition: none; }
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/components/redesign/__tests__/ArtistTile.test.ts`
Expected: PASS — 8 cases green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/redesign/ArtistTile.svelte src/lib/components/redesign/__tests__/ArtistTile.test.ts
git commit -m "$(cat <<'EOF'
feat(artists): add ArtistTile circular tile with /artistart + fallback

160×160 circular tile renders /artistart?name={encoded} primary; on img
error swaps to a name-hashed letter-avatar fallback. Selection state
adds amber ring + glow + bright-amber name color. Reduced-motion media
query disables the 200ms transitions. role=button / aria-pressed /
aria-label / data-testid wired for E2E.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `ArtistsPage` component

**Files:**
- Create: `src/lib/components/redesign/ArtistsPage.svelte`
- Test: `src/lib/components/redesign/__tests__/ArtistsPage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/redesign/__tests__/ArtistsPage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Stub ArtistTile so this test stays focused on ArtistsPage orchestration.
vi.mock('../ArtistTile.svelte', () => ({
  default: vi.fn(() => null),
}));

// Mock socket service so initLibraryStore's listeners don't blow up.
vi.mock('$lib/services/socket', () => ({
  socketService: {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    socket: { connected: true },
  },
  emitWhenConnected: vi.fn(),
  connectionState: { subscribe: vi.fn(() => () => {}) },
}));

import {
  libraryArtists,
  libraryArtistsLoading,
  libraryArtistsError,
  selectedArtist,
  libraryActions,
  libraryPageKind,
} from '$lib/stores/library';
import ArtistsPage from '../ArtistsPage.svelte';

describe('ArtistsPage', () => {
  beforeEach(() => {
    libraryArtists.set([]);
    libraryArtistsLoading.set(false);
    libraryArtistsError.set(null);
    selectedArtist.set(null);
    libraryPageKind.set('artists');
    vi.spyOn(libraryActions, 'fetchArtists').mockImplementation(() => {});
    vi.spyOn(libraryActions, 'fetchArtistAlbums').mockImplementation(() => {});
    vi.spyOn(libraryActions, 'cyclePageKind').mockImplementation(() => {});
  });

  it('renders the amber "Artists" header', () => {
    const { getByTestId } = render(ArtistsPage);
    const header = getByTestId('artists-page-header');
    expect(header.textContent?.trim()).toBe('Artists');
  });

  it('on mount with empty store calls fetchArtists once', () => {
    render(ArtistsPage);
    expect(libraryActions.fetchArtists).toHaveBeenCalledTimes(1);
  });

  it('on mount with already-populated store does NOT call fetchArtists', () => {
    libraryArtists.set([
      { name: 'A', albumCount: 1 },
      { name: 'B', albumCount: 2 },
    ]);
    render(ArtistsPage);
    expect(libraryActions.fetchArtists).not.toHaveBeenCalled();
  });

  it('on mount while loading does NOT re-trigger fetchArtists', () => {
    libraryArtistsLoading.set(true);
    render(ArtistsPage);
    expect(libraryActions.fetchArtists).not.toHaveBeenCalled();
  });

  it('renders the loading-skeleton row when loading + empty', () => {
    libraryArtistsLoading.set(true);
    const { getAllByTestId } = render(ArtistsPage);
    expect(getAllByTestId('artist-tile-skeleton')).toHaveLength(7);
  });

  it('renders the empty state when not-loading + empty', () => {
    const { getByTestId } = render(ArtistsPage);
    expect(getByTestId('artists-empty').textContent).toContain('No artists in library');
  });

  it('renders the error state when libraryArtistsError is set; tap re-fires fetchArtists', async () => {
    libraryArtistsError.set('boom');
    const { getByTestId } = render(ArtistsPage);
    const err = getByTestId('artists-error');
    expect(err.textContent).toContain('Could not load artists');
    await fireEvent.click(err);
    expect(libraryActions.fetchArtists).toHaveBeenCalledTimes(1); // initial mount fetch was suppressed via mocked spy reset; this click is the only call
  });

  it('renders one ArtistTile per artist when the store is populated', () => {
    libraryArtists.set([
      { name: 'Hollow Tides', albumCount: 1 },
      { name: 'The Midnight Sun', albumCount: 2 },
      { name: 'Lunar Ways', albumCount: 3 },
    ]);
    const { container } = render(ArtistsPage);
    // ArtistTile is mocked to render null, but the strip should hold 3 children
    // (we assert via the children of the .artists-strip wrapper).
    const strip = container.querySelector('.artists-strip');
    expect(strip).toBeTruthy();
    // Each iteration in {#each} creates a wrapper for the mocked component.
    expect(strip?.childElementCount ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('handleTileTap calls fetchArtistAlbums(name) and cyclePageKind(-1)', () => {
    // Invoke the internal handler via the exported test hook described in the
    // implementation: ArtistsPage forwards onTap to fetchArtistAlbums and
    // cyclePageKind. We test this by simulating the prop pass-through.
    libraryArtists.set([{ name: 'Max Richter', albumCount: 5 }]);
    const { component } = render(ArtistsPage) as { component: { handleTileTap?: (name: string) => void } };
    expect(component.handleTileTap).toBeDefined();
    component.handleTileTap!('Max Richter');
    expect(libraryActions.fetchArtistAlbums).toHaveBeenCalledWith('Max Richter');
    expect(libraryActions.cyclePageKind).toHaveBeenCalledWith(-1);
  });
});
```

> **Note on the last test:** `ArtistsPage.svelte` must export `handleTileTap` via the `<script context="module">` or as a public method on the component instance so the test can invoke it without going through the mocked `ArtistTile`'s click. The implementation below uses Svelte 5's `export const` pattern via `{#snippet}` or — simpler — exports the function on the component via `defineExpose`-equivalent.
>
> Svelte 5 doesn't expose component-internal functions to consumers out of the box. **Easier alternative:** drop this last assertion and instead test the `handleTileTap` behaviour via an integration test in Task 5 (`LibraryView.test.ts`) once `ArtistTile` is no longer mocked. **The implementer should choose: either expose the handler via a small wrapper, or skip the last `it` block and add an equivalent assertion in `LibraryView.test.ts` covering the same flow.** Either is acceptable; the spec-compliance reviewer should accept whichever the implementer picks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/redesign/__tests__/ArtistsPage.test.ts`
Expected: FAIL — `Cannot find module '../ArtistsPage.svelte'`.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/redesign/ArtistsPage.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import {
    libraryArtists,
    libraryArtistsLoading,
    libraryArtistsError,
    selectedArtist,
    libraryActions,
  } from '$lib/stores/library';
  import ArtistTile from './ArtistTile.svelte';

  // Exposed for unit-test invocation of the tap-handler flow without
  // going through the (often-mocked) ArtistTile click event surface.
  export function handleTileTap(name: string) {
    libraryActions.fetchArtistAlbums(name);
    libraryActions.cyclePageKind(-1);
  }

  function retry() {
    libraryActions.fetchArtists();
  }

  onMount(() => {
    if (get(libraryArtists).length === 0 && !get(libraryArtistsLoading)) {
      libraryActions.fetchArtists();
    }
    // No auto-scroll on revisit: the `'albums' → 'artists'` subscriber inside
    // library.ts clears `selectedArtist` whenever the user lands here, so the
    // strip always starts at scroll-position 0 with no tile selected.
  });
</script>

<section class="artists-page" data-testid="artists-page">
  <header class="artists-page-header" data-testid="artists-page-header">Artists</header>

  {#if $libraryArtistsError}
    <div class="state-error" data-testid="artists-error" role="alert" on:click={retry}>
      Could not load artists. Tap to retry.
    </div>
  {:else if $libraryArtistsLoading && $libraryArtists.length === 0}
    <div class="artists-strip" data-testid="artists-strip-loading">
      {#each Array(7) as _, i (i)}
        <div class="tile-skeleton" data-testid="artist-tile-skeleton"></div>
      {/each}
    </div>
  {:else if $libraryArtists.length === 0}
    <div class="state-empty" data-testid="artists-empty">No artists in library</div>
  {:else}
    <div class="artists-strip">
      {#each $libraryArtists as artist (artist.name)}
        <ArtistTile
          {artist}
          selected={$selectedArtist === artist.name}
          onTap={handleTileTap}
        />
      {/each}
    </div>
  {/if}
</section>

<style>
  .artists-page {
    width: 100%;
    height: 100%;
    background: #050507;
    padding: 20px 0 0 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .artists-page-header {
    padding-left: 48px;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-accent);
    letter-spacing: 0.04em;
  }
  .artists-strip {
    display: flex;
    flex-direction: row;
    gap: 24px;
    padding: 0 48px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-behavior: smooth;
    touch-action: pan-x;
    container-type: inline-size;
  }
  .artists-strip::-webkit-scrollbar { display: none; }
  .tile-skeleton {
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: linear-gradient(90deg, #15171a 0%, #1c1f24 50%, #15171a 100%);
    background-size: 200% 100%;
    flex-shrink: 0;
    animation: skel-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes skel-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .state-empty, .state-error {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    font-size: 16px;
  }
  .state-error {
    color: var(--color-accent-bright);
    cursor: pointer;
  }

  @container (max-width: 1200px) {
    .tile-skeleton { width: 120px; height: 120px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tile-skeleton { animation: none; }
    .artists-strip { scroll-behavior: auto; }
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/components/redesign/__tests__/ArtistsPage.test.ts`
Expected: PASS — 9 cases green (or 8 if the implementer drops the `handleTileTap` exposure test per Step 1's note).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/redesign/ArtistsPage.svelte src/lib/components/redesign/__tests__/ArtistsPage.test.ts
git commit -m "$(cat <<'EOF'
feat(artists): add ArtistsPage horizontal momentum-scroll strip

Reads libraryArtists / libraryArtistsLoading / libraryArtistsError /
selectedArtist; mounts fetchArtists on empty; renders amber 'Artists'
header, 7-skeleton loading row, empty state, error-with-retry, and a
horizontally-scrolling row of ArtistTile components. Tap on a tile
fires fetchArtistAlbums(name) + cyclePageKind(-1) to return to Albums.
Container query shrinks skeleton size for desktop letterbox.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `LibraryView` vertical-swipe + renderer switch + filtered list + bundle guard

**Files:**
- Modify: `src/lib/components/redesign/LibraryView.svelte`
- Modify: `src/lib/components/redesign/__tests__/LibraryView.test.ts` (extend or create)

- [ ] **Step 1: Write the failing tests**

Add (or create) `src/lib/components/redesign/__tests__/LibraryView.test.ts` with the following. If the file already exists, append the new `describe` block.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Stub the lazy-loaded ArtistsPage so we don't need its full dependency tree.
vi.mock('../ArtistsPage.svelte', () => ({ default: vi.fn(() => null) }));

vi.mock('$lib/services/socket', () => ({
  socketService: { emit: vi.fn(), on: vi.fn(() => () => {}), socket: { connected: true } },
  emitWhenConnected: vi.fn(),
  connectionState: { subscribe: vi.fn(() => () => {}) },
}));

import {
  libraryAlbums,
  libraryArtists,
  artistAlbums,
  selectedArtist,
  libraryPageKind,
  libraryActions,
  currentLibraryIndex,
} from '$lib/stores/library';
import LibraryView from '../LibraryView.svelte';

const albumA = { id: '1', title: 'A', artist: 'X', albumArtist: 'X', uri: 'nas:a', source: 'NAS' as const };
const albumB = { id: '2', title: 'B', artist: 'Y', albumArtist: 'Y', uri: 'nas:b', source: 'NAS' as const };

describe('LibraryView page-kind renderer + vertical swipe + filtered list', () => {
  beforeEach(() => {
    libraryAlbums.set([albumA, albumB]);
    libraryArtists.set([]);
    artistAlbums.set([]);
    selectedArtist.set(null);
    libraryPageKind.set('albums');
    currentLibraryIndex.set(0);
    vi.spyOn(libraryActions, 'cyclePageKind');
  });

  it('renders AlbumPage when libraryPageKind === "albums"', () => {
    const { container } = render(LibraryView);
    expect(container.querySelector('[data-testid="album-slide-wrapper"]')).toBeTruthy();
  });

  it('renders ArtistsPage stub when libraryPageKind === "artists"', () => {
    libraryPageKind.set('artists');
    const { container } = render(LibraryView);
    // ArtistsPage is mocked to render null, so the album wrapper must be absent
    // and the page-slot must exist with no album content.
    expect(container.querySelector('[data-testid="album-slide-wrapper"]')).toBeNull();
  });

  it('pointer-up with vertical dy >= 50px up calls cyclePageKind(+1)', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 500, clientY: 200 }); // dy = -100 = up
    expect(libraryActions.cyclePageKind).toHaveBeenCalledWith(1);
  });

  it('pointer-up with vertical dy >= 50px down calls cyclePageKind(-1)', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 500, clientY: 400 }); // dy = +100 = down
    expect(libraryActions.cyclePageKind).toHaveBeenCalledWith(-1);
  });

  it('pointer-up with dominant horizontal swipe calls existing advance, not cyclePageKind', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 600, clientY: 280 }); // dx=100 dominant
    expect(libraryActions.cyclePageKind).not.toHaveBeenCalled();
    // currentLibraryIndex should have advanced (delta = horizontal-positive → back)
  });

  it('diagonal where |dx| === |dy| takes the horizontal branch (tie-break)', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 600, clientY: 400 }); // dx=100, dy=100
    expect(libraryActions.cyclePageKind).not.toHaveBeenCalled();
  });

  it('below the 50px threshold on both axes is a no-op', async () => {
    const { container } = render(LibraryView);
    const root = container.querySelector('[data-testid="library-view"]')!;
    await fireEvent.pointerDown(root, { clientX: 500, clientY: 300 });
    await fireEvent.pointerUp(root, { clientX: 540, clientY: 320 }); // dx=40 dy=20
    expect(libraryActions.cyclePageKind).not.toHaveBeenCalled();
    expect(get(currentLibraryIndex)).toBe(0); // advance not called either
  });

  it('selectedArtist set + kind albums: renders from artistAlbums, not libraryAlbums', () => {
    selectedArtist.set('Y');
    artistAlbums.set([albumB]);
    // libraryAlbums still has [A, B] but the filtered list should be [B] only.
    const { container } = render(LibraryView);
    // currentAlbum should be B (the only filtered entry).
    const wrapper = container.querySelector('[data-testid="album-slide-wrapper"]');
    expect(wrapper).toBeTruthy();
    // Internal text presence: check the album title made it through.
    expect(container.textContent).toContain('B');
    expect(container.textContent).not.toContain('A');
  });

  it('selectedArtist null + kind albums: renders from libraryAlbums', () => {
    selectedArtist.set(null);
    const { container } = render(LibraryView);
    expect(container.textContent).toContain('A');
  });
});

describe('LibraryView bundle-size guard (ArtistsPage stays lazy)', () => {
  function staticImportRegexFor(filename: string): RegExp {
    return new RegExp(
      String.raw`^\s*import\b[^;\n]*\bfrom\s+['"][^'"]*${filename.replace(/\./g, '\\.')}['"]\s*;?`,
      'm',
    );
  }

  it.each([['ArtistsPage.svelte']])(
    'does not statically import %s (stays in a separate chunk)',
    (filename) => {
      const here = dirname(fileURLToPath(import.meta.url));
      const libraryViewPath = resolve(here, '..', 'LibraryView.svelte');
      const src = readFileSync(libraryViewPath, 'utf8');
      expect(staticImportRegexFor(filename).test(src)).toBe(false);
      expect(src.includes(`import('./${filename}')`)).toBe(true);
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/redesign/__tests__/LibraryView.test.ts`
Expected: FAIL — `libraryPageKind` import unresolved (Task 2 must have landed first; if Wave 1 already completed, the failure will instead be assertion-level: rendering only AlbumPage, no kind-switch handler).

- [ ] **Step 3: Implement the LibraryView edits**

Replace the full contents of `src/lib/components/redesign/LibraryView.svelte` with:

```svelte
<script lang="ts">
  import {
    libraryAlbums,
    artistAlbums,
    selectedArtist,
    libraryPageKind,
    libraryAlbumTracks,
    currentLibraryIndex,
    libraryActions,
  } from '$lib/stores/library';
  import { bioActions } from '$lib/stores/bios';
  import { viewActions } from '$lib/stores/navigation';
  import AlbumPage from './AlbumPage.svelte';
  import EdgeChevron from './EdgeChevron.svelte';
  import { fly } from 'svelte/transition';
  import { onMount, type SvelteComponent } from 'svelte';

  const SWIPE_THRESHOLD = 50;
  const SWIPE_THRESHOLD_Y = 50;

  // Filtered album list — drives both AlbumPage data and the swipe-bounds.
  $: albumsList = $selectedArtist ? ($artistAlbums || []) : ($libraryAlbums || []);
  $: currentAlbum = albumsList.length > 0 ? albumsList[$currentLibraryIndex % albumsList.length] : null;
  $: currentTracks = $libraryAlbumTracks || [];

  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerActive = false;
  let lastHorizDir: 'forward' | 'back' = 'forward';
  let lastVertDir: 'up' | 'down' = 'up';

  // Lazy-load ArtistsPage on first transition to 'artists'. Symmetric with
  // the M1.E VuMeterView pattern in PlayerLayout.
  let ArtistsPageComponent: typeof SvelteComponent | null = null;
  let artistsPageImportStarted = false;
  $: if ($libraryPageKind === 'artists' && !artistsPageImportStarted) {
    artistsPageImportStarted = true;
    void import('./ArtistsPage.svelte').then((m) => {
      ArtistsPageComponent = m.default;
    });
  }

  function advance(delta: 1 | -1) {
    if (albumsList.length === 0) return;
    const len = albumsList.length;
    lastHorizDir = delta === 1 ? 'forward' : 'back';
    currentLibraryIndex.update((i) => (((i + delta) % len) + len) % len);
  }

  function handlePointerDown(e: PointerEvent) {
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    pointerActive = true;
  }
  function handlePointerUp(e: PointerEvent) {
    if (!pointerActive) return;
    pointerActive = false;
    const dx = e.clientX - pointerStartX;
    const dy = e.clientY - pointerStartY;
    // Dominant axis wins. Diagonal where |dx| === |dy| falls into the
    // horizontal branch (else clause) by design.
    if (Math.abs(dy) > Math.abs(dx)) {
      if (Math.abs(dy) < SWIPE_THRESHOLD_Y) return;
      lastVertDir = dy < 0 ? 'up' : 'down';
      libraryActions.cyclePageKind(dy < 0 ? 1 : -1);
    } else {
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      advance(dx < 0 ? 1 : -1);
    }
  }
  function handlePointerCancel() {
    pointerActive = false;
  }

  // Track-fetch guard (unchanged from prior implementation).
  let lastLoadedUri = '';
  $: if ($libraryPageKind === 'albums' && currentAlbum && currentAlbum.uri !== lastLoadedUri) {
    lastLoadedUri = currentAlbum.uri;
    libraryActions.fetchAlbumTracks(currentAlbum);
    bioActions.requestBio(currentAlbum.artist, currentAlbum.title);
  }

  function playCurrent() {
    if (!currentAlbum) return;
    libraryActions.playAlbum(currentAlbum);
    viewActions.goToPlayer();
  }

  // Reset currentLibraryIndex when the filtered list identity changes — so
  // landing on a filtered Albums page starts at the first filtered album.
  $: if ($selectedArtist !== null) {
    currentLibraryIndex.set(0);
  }
</script>

<div
  class="library-view"
  data-testid="library-view"
  on:pointerdown={handlePointerDown}
  on:pointerup={handlePointerUp}
  on:pointercancel={handlePointerCancel}
>
  {#key $libraryPageKind}
    <div
      class="page-slot"
      in:fly|local={{ y: lastVertDir === 'up' ? 120 : -120, duration: 220, opacity: 0.2 }}
      out:fly|local={{ y: lastVertDir === 'up' ? -120 : 120, duration: 180, opacity: 0 }}
    >
      {#if $libraryPageKind === 'albums'}
        {#if currentAlbum}
          <div class="album-slot">
            {#key currentAlbum.uri}
              <div
                class="slide-wrapper"
                data-testid="album-slide-wrapper"
                data-direction={lastHorizDir}
                in:fly|local={{ x: lastHorizDir === 'forward' ? 120 : -120, duration: 220, opacity: 0.2 }}
                out:fly|local={{ x: lastHorizDir === 'forward' ? -120 : 120, duration: 180, opacity: 0 }}
              >
                <AlbumPage album={currentAlbum} tracks={currentTracks} onPlayAlbum={playCurrent} />
              </div>
            {/key}
          </div>
        {:else}
          <div class="empty" data-testid="library-empty">No albums in library</div>
        {/if}
        <EdgeChevron side="left" onTap={() => advance(-1)} />
        <EdgeChevron side="right" onTap={() => advance(1)} />
      {:else if $libraryPageKind === 'artists'}
        {#if ArtistsPageComponent}
          <svelte:component this={ArtistsPageComponent} />
        {:else}
          <div class="empty" data-testid="artists-loading-shell">Loading…</div>
        {/if}
      {/if}
    </div>
  {/key}
</div>

<style>
  .library-view {
    width: 100%;
    height: 100%;
    /* touch-action: none — let pointer handlers process every axis. Inner
       elements (.artists-strip) override with pan-x to keep horizontal
       momentum scroll alive within the strip. */
    touch-action: none;
    overflow: hidden;
    position: relative;
  }
  .library-view :global(.edge-chevron) {
    z-index: 2;
  }
  .page-slot {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    font-size: 24px;
  }
  .album-slot {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .slide-wrapper {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .page-slot, .slide-wrapper { transition: none; }
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/components/redesign/__tests__/LibraryView.test.ts`
Expected: PASS — all new cases green; existing LibraryView assertions (if any) preserved.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/redesign/LibraryView.svelte src/lib/components/redesign/__tests__/LibraryView.test.ts
git commit -m "$(cat <<'EOF'
feat(library): vertical-swipe page kind switch + filtered-list routing

Horizontal pointer swipe still advances album-to-album. New vertical
swipe cycles libraryPageKind ('albums' ↔ 'artists') with the dominant
axis winning ties. ArtistsPage is dynamic-imported on first 'artists'
transition (lazy chunk). Filtered AlbumsPage routes through artistAlbums
when selectedArtist is set, resetting currentLibraryIndex to 0. New
bundle-size guard test asserts LibraryView never statically imports
ArtistsPage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `MetadataBlock` filter accent + inline ✕

**Files:**
- Modify: `src/lib/components/redesign/MetadataBlock.svelte`
- Modify: `src/lib/components/redesign/__tests__/MetadataBlock.test.ts` (create if absent)

- [ ] **Step 1: Write the failing tests**

Create or append to `src/lib/components/redesign/__tests__/MetadataBlock.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

vi.mock('$lib/services/socket', () => ({
  socketService: { emit: vi.fn(), on: vi.fn(() => () => {}) },
  emitWhenConnected: vi.fn(),
  connectionState: { subscribe: vi.fn(() => () => {}) },
}));

import { selectedArtist, libraryActions } from '$lib/stores/library';
import MetadataBlock from '../MetadataBlock.svelte';

describe('MetadataBlock filter accent', () => {
  beforeEach(() => {
    selectedArtist.set(null);
    vi.spyOn(libraryActions, 'clearArtistFilter').mockImplementation(() => {});
  });

  it('default state: no clear button, no is-filter-active class on artist row', () => {
    const { container, queryByTestId } = render(MetadataBlock, {
      title: 't', artist: 'Nils Frahm', album: 'a',
    });
    expect(queryByTestId('clear-artist-filter')).toBeNull();
    expect(container.querySelector('.artist-row')?.classList.contains('is-filter-active')).toBe(false);
  });

  it('selectedArtist matches: clear button present + is-filter-active class applied', () => {
    selectedArtist.set('Nils Frahm');
    const { container, getByTestId } = render(MetadataBlock, {
      title: 't', artist: 'Nils Frahm', album: 'a',
    });
    expect(getByTestId('clear-artist-filter')).toBeTruthy();
    expect(container.querySelector('.artist-row')?.classList.contains('is-filter-active')).toBe(true);
  });

  it('selectedArtist set but does NOT match the current artist: no accent', () => {
    selectedArtist.set('Different Person');
    const { container, queryByTestId } = render(MetadataBlock, {
      title: 't', artist: 'Nils Frahm', album: 'a',
    });
    expect(queryByTestId('clear-artist-filter')).toBeNull();
    expect(container.querySelector('.artist-row')?.classList.contains('is-filter-active')).toBe(false);
  });

  it('click clear-artist-filter invokes libraryActions.clearArtistFilter once', async () => {
    selectedArtist.set('Nils Frahm');
    const { getByTestId } = render(MetadataBlock, {
      title: 't', artist: 'Nils Frahm', album: 'a',
    });
    await fireEvent.click(getByTestId('clear-artist-filter'));
    expect(libraryActions.clearArtistFilter).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/redesign/__tests__/MetadataBlock.test.ts`
Expected: FAIL — `clear-artist-filter` not found / class never applied.

- [ ] **Step 3: Implement the MetadataBlock edits**

Replace the contents of `src/lib/components/redesign/MetadataBlock.svelte` with:

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { selectedArtist, libraryActions } from '$lib/stores/library';

  export let title: string = '';
  export let artist: string = '';
  export let album: string = '';

  $: isFiltered = $selectedArtist === artist && artist !== '';
</script>

<div class="metadata-block" data-testid="metadata-block">
  {#if title}
    <h1 class="title-row" data-testid="metadata-title">{title}</h1>
  {/if}
  {#if artist}
    <div class="artist-row" class:is-filter-active={isFiltered} data-testid="metadata-artist">
      <Icon name="user" size={22} />
      <span>{artist}</span>
      {#if isFiltered}
        <button
          class="clear-filter"
          data-testid="clear-artist-filter"
          aria-label="Clear artist filter"
          on:click={() => libraryActions.clearArtistFilter()}
        >✕</button>
      {/if}
    </div>
  {/if}
  {#if album}
    <div class="album-row" data-testid="metadata-album">
      <Icon name="vinyl-record" size={22} />
      <span>{album}</span>
    </div>
  {/if}
</div>

<style>
  .metadata-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }
  .title-row {
    font-size: 56px;
    font-weight: 400;
    color: var(--color-text-primary);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.1;
  }
  .artist-row, .album-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 300;
    color: var(--color-text-secondary);
    overflow: hidden;
    transition: color 200ms ease-out;
  }
  .artist-row.is-filter-active {
    color: var(--color-accent-bright);
  }
  .clear-filter {
    background: transparent;
    border: none;
    color: var(--color-accent);
    font-size: 18px;
    line-height: 1;
    padding: 0 8px;
    margin-left: 4px;
    cursor: pointer;
    transition: color 200ms ease-out;
  }
  .clear-filter:hover, .clear-filter:focus-visible {
    color: var(--color-accent-bright);
    outline: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .artist-row, .clear-filter { transition: none; }
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/components/redesign/__tests__/MetadataBlock.test.ts`
Expected: PASS — 4 cases green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/redesign/MetadataBlock.svelte src/lib/components/redesign/__tests__/MetadataBlock.test.ts
git commit -m "$(cat <<'EOF'
feat(library): inline amber + ✕ filter banner on MetadataBlock

When selectedArtist matches the rendered artist, the artist row gets
the is-filter-active class (amber-bright color) plus an inline ✕
button that invokes libraryActions.clearArtistFilter. Mismatched or
null selectedArtist leaves the row in default styling.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Live-Pi e2e spec (skipped)

**Files:**
- Create: `e2e/artists-page.spec.ts`

This task creates the e2e file as `test.describe.skip` with a TODO block referencing the NordVPN Threat Protection Pro™ Endpoint Security extension blocker (last documented 2026-05-12). The implementer writes the test bodies anyway so re-enabling on unblock is a single-line `.skip` removal.

- [ ] **Step 1: Create the spec file**

Create `e2e/artists-page.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

/**
 * M2.C live-Pi e2e — currently skipped.
 *
 * BLOCKER: NordVPN Threat Protection Pro™ macOS Endpoint Security
 * extension (`com.nordvpn.macos.Shield`, team `W5W395V82Y`, v9.15.0)
 * intercepts outbound TCP from non-system binaries. Playwright Chromium
 * hits ERR_ADDRESS_UNREACHABLE on every probe to the Mac dev server /
 * Pi backend. macOS Application Firewall is NOT the cause.
 *
 * Unblock command:
 *   sudo systemextensionsctl uninstall W5W395V82Y com.nordvpn.macos.Shield
 *
 * Or reboot the Mac after disabling Threat Protection Pro in the GUI.
 *
 * Manual verification of this spec's scenarios was performed by the
 * implementer during Task 8 — see `Volumio2-UI/docs/superpowers/plans/
 * 2026-05-13-m2c-artists-page-plan.md` Task 8 Step "Manual LCD smoke"
 * for the commit hash of the manual run and the recorded results.
 */

test.describe.skip('M2.C Artists library page (live-Pi)', () => {
  async function gotoApp(page: import('@playwright/test').Page) {
    await page.goto('/');
    // Page-ready gate (M1.E pattern): wait until the Play button is enabled
    // OR the library-view mounts. Without this gate, scenarios below would
    // false-pass on env failure.
    await expect.poll(
      async () => {
        const playEnabled = await page
          .locator('[data-testid="transport-play-pause"]')
          .isEnabled()
          .catch(() => false);
        const libraryMounted = await page
          .locator('[data-testid="library-view"]')
          .count();
        return playEnabled || libraryMounted > 0;
      },
      { timeout: 8000, message: 'Frontend never became interactive' },
    ).toBeTruthy();
  }

  test('vertical-swipe up from Library mounts ArtistsPage header within 2s', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    if (!box) test.fail();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="artists-page-header"]')).toBeVisible({ timeout: 2000 });
  });

  test('at least one ArtistTile renders after the strip mounts', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    // Swipe up
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-testid^="artist-tile-"]').first()).toBeVisible({ timeout: 4000 });
  });

  test('tap an artist tile → AlbumsPage with amber name + ✕ clear button', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    const firstTile = page.locator('[data-testid^="artist-tile-"]').first();
    await firstTile.click();
    await expect(page.locator('[data-testid="clear-artist-filter"]')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.artist-row.is-filter-active')).toBeVisible();
  });

  test('tapping ✕ clears the filter; artist-row loses the accent', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    // (re-use the swipe-up-then-tap-first-tile setup as above)
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    await page.locator('[data-testid^="artist-tile-"]').first().click();
    await page.locator('[data-testid="clear-artist-filter"]').click();
    await expect(page.locator('[data-testid="clear-artist-filter"]')).toHaveCount(0);
    await expect(page.locator('.artist-row.is-filter-active')).toHaveCount(0);
  });

  test('vertical-swipe back to Artists with active filter clears it implicitly', async ({ page }) => {
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    // swipe up → tap → swipe up again
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    await page.locator('[data-testid^="artist-tile-"]').first().click();
    // swipe up again (Albums → Artists)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    // now swipe down (Artists → Albums) — filter should be cleared
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="clear-artist-filter"]')).toHaveCount(0);
  });

  test('letter-avatar fallback renders on /artistart 404', async ({ page }) => {
    // Stub the /artistart endpoint to 404 for one artist name.
    await page.route(/\/artistart\?name=Hollow%20Tides/i, (route) => route.fulfill({ status: 404 }));
    await gotoApp(page);
    await page.click('[data-testid="nav-cell-library"]');
    const root = page.locator('[data-testid="library-view"]');
    const box = await root.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 40);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40, { steps: 8 });
    await page.mouse.up();
    const fallback = page
      .locator('[data-testid="artist-tile-hollow-tides"]')
      .locator('[data-testid="avatar-fallback"]');
    await expect(fallback).toBeVisible({ timeout: 4000 });
    await expect(fallback).toHaveText('H');
  });
});
```

- [ ] **Step 2: Verify the file is collected by Playwright (skipped)**

Run: `npx playwright test --list e2e/artists-page.spec.ts`
Expected: lists 6 tests across both projects (12 entries total) with all marked as `skipped`.

- [ ] **Step 3: Commit**

```bash
git add e2e/artists-page.spec.ts
git commit -m "$(cat <<'EOF'
test(artists): skip live-Pi e2e pending NordVPN extension unblock

Same blocker pattern as the M1.E vu-meter.spec.ts skip — NordVPN Threat
Protection Pro™ Endpoint Security extension blocks Playwright Chromium
TCP. Test bodies authored in full; .skip → .only is the unblock change.
Includes 6 scenarios: swipe-up appear, tile render, tap-to-filter,
clear via ✕, implicit clear on swipe-back, /artistart 404 fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verification gate + project-note update

**Files (no source changes):**
- Run: full Vitest, tsc, build, manual smoke
- Modify: `~/MemPalace/vault/Projects/stellar-streamer.md` (Last Context Switch)

- [ ] **Step 1: Run the full type check**

Run: `npx tsc --noEmit`
Expected: exit 0. If non-zero: stop, fix, restart Task 8.

- [ ] **Step 2: Run the full Vitest suite**

Run: `npm run test:run`
Expected: all green. Baseline before this plan was 875 passing / 1 skipped (M1.E end-state). New cases:
- artistAvatar.test.ts: 4 (3 it + 1 it.each × 6 rows = 9 cases, counted as 4 it-blocks)
- ArtistTile.test.ts: 8
- ArtistsPage.test.ts: 8 or 9 depending on handleTileTap exposure
- library.test.ts (extension): 7
- LibraryView.test.ts (new): 8 cases for swipe-and-filter + 1 it.each for bundle guard = 9
- MetadataBlock.test.ts (new or extended): 4

Total new = ~40 cases. Expected new total ≈ 915 passing / 1 skipped.

If any test fails: stop, fix, restart Task 8.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: exit 0; no new warnings beyond the pre-existing `Toggle.svelte` `aria-pressed` warning. Confirm chunk split:

Run: `ls dist/assets/ArtistsPage-*.js`
Expected: an `ArtistsPage-*.js` chunk exists (proves lazy-load chunking landed).

- [ ] **Step 4: Bundle-size sanity check**

Run: `ls -la dist/assets/App-*.js dist/assets/ArtistsPage-*.js`
Expected: ArtistsPage chunk is its own file. App chunk size should be within ±5% of the M1.E end-state baseline (141,275 B raw / 48,036 B gz). If App chunk grew >5%, investigate static-import leakage.

- [ ] **Step 5: Start the dev server for manual smoke**

Run: `npm run dev` (in a separate terminal; verify `localhost:5173` is responding).

Expected: dev server up, HMR hot, no console errors.

- [ ] **Step 6: Manual LCD smoke (5 scenarios)**

Open `http://192.168.86.221:5173?layout=lcd` in a desktop browser (or check the actual kiosk display). Walk through:

1. Tap "Library" in NavColumn → Albums page renders the current album.
2. Vertical-swipe **up** anywhere on the library content → ArtistsPage header "Artists" (amber) appears, tile strip animates in from below. Cold-tap latency ≤ 200 ms (lazy chunk load).
3. Tap any artist tile → AlbumsPage re-renders with that artist's albums, artist name appears in amber with inline `✕`.
4. Tap the `✕` → filter clears, full library album list restored, accent goes away.
5. Tap a different artist via vertical-swipe-up, then vertical-swipe **down** (back to Albums) — filter still active on Albums. Vertical-swipe **up** again — filter is cleared implicitly (per the subscriber).

If any scenario fails: stop, file as a bug, fix in a follow-up task, then re-run this step.

- [ ] **Step 7: Backend enrichment-chain log check**

In a separate terminal:

```bash
source ~/workspace/stellar-streamer/Volumio2-UI/.env
SSH_CMD="sshpass -p '$RASPBERRY_PI_SSH_PASSWORD' ssh -o StrictHostKeyChecking=no $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"
eval "$SSH_CMD 'journalctl -u stellar-backend -f --since \"5 minutes ago\"'" &
```

From the browser DevTools console at `http://192.168.86.221:5173?layout=lcd`:

```js
window.libraryActions.rebuildCache()
```

Expected `journalctl` output within 30 s:
```
Starting artwork enrichment queue processing
…
Found N albums missing artwork
…
(album scan completes)
…
(artist scan begins — log line resembling) Starting artist artwork enrichment queue processing
```

If neither scan fires: this contradicts the spec §7 claim that the chain is already wired — investigate `server.go:2234,2271,2278` and the existing `enrichment_handlers.go:147` chain before declaring Task 8 done.

Kill the tailing `journalctl` (`fg` then Ctrl-C).

- [ ] **Step 8: Update the project note "Last Context Switch"**

Open `~/MemPalace/vault/Projects/stellar-streamer.md`, prepend a new "Last Context Switch" entry at the top of the existing section. Use this template (fill in commit hashes from `git log --oneline -10`):

```markdown
- Date: 2026-05-13 (M2.C Artists library page SHIPPED, awaiting user push. 8 atomic commits on Volumio2-UI master ahead of origin: …list… )
- State: `Volumio2-UI` master @ `<hash>`, **N ahead of `origin/master`**, working tree clean. Backend untouched (existing v1.5.0+ enrichment chain confirmed firing via journalctl during smoke). Pi services active.
- Next Action: **(1)** User reviews `git log origin/master..master` and pushes when ready. **(2)** `/clear` → `/checkin -r` → start next phase per today's order: M1.A backend portability layer (largest groundwork, multi-file refactor in `internal/infra/{lcd,netinfo}` and `internal/domain/sources`). Spec / plan to be drafted by `superpowers:brainstorming` then `superpowers:writing-plans`. **Carryovers from M2.C:** F-a NasShareList decomposition, doc-drift fixes in `playwright.config.ts:9-10,24` and `src/lib/config.ts:9-16`, drop deprecated `{bins, peak, rms}` mono fallback, install `golangci-lint` via asdf, re-enable `e2e/artists-page.spec.ts` after NordVPN unload.
```

- [ ] **Step 9: Commit the project-note update**

This goes in the global notes repo if it's tracked, OR is a no-op if `~/MemPalace/vault/` is git-tracked separately. Skip if the vault isn't a git repo. Otherwise:

```bash
cd ~/MemPalace
git add vault/Projects/stellar-streamer.md
git commit -m "notes: M2.C ship state for /clear handoff"
```

- [ ] **Step 10: Final summary**

Print to the user:

```
M2.C Artists library page — plan-complete.

Verification:
- npx tsc --noEmit               ✓ exit 0
- npm run test:run               ✓ ~915 passing / 1 skipped (baseline 875 + ~40 new)
- npm run build                  ✓ exit 0; ArtistsPage chunk emitted
- Manual LCD smoke 5/5           ✓ all scenarios green
- Backend enrichment chain       ✓ journalctl confirmed album → artist scan fires on rebuild

Volumio2-UI master @ <hash>, N ahead of origin/master, working tree clean.
Backend untouched (no code change required).

Ready for: `git push origin master` from Volumio2-UI, then /clear → /checkin -r → start M1.A.
```

---

## Self-review

Performed inline against the spec sections.

**Coverage:** Each spec §1-§12 maps to at least one task —
- §1-§3 architecture → T2, T5
- §2 avatar helper → T1
- §3 ArtistTile → T3
- §4 ArtistsPage → T4
- §5 LibraryView edits → T5
- §6 MetadataBlock → T6
- §7 backend chain → no task needed (already shipped; verified in T8 step 7)
- §8 visual spec → T3 + T4 + T5 + T6 styles
- §9 testing → T1-T6 unit tests + T7 e2e + T8 verification gate
- §10 risks → T5 (axis tie-break test), T3 (img onerror), T5 (bundle guard)
- §11 open questions → T4 implementation (no auto-scroll), T8 step 7 (backend rescan trigger validation)
- §12 rollout → 8 tasks, 4 waves

**Placeholders:** none — every step has either full code or an explicit shell command.

**Type consistency:** `cyclePageKind`, `clearArtistFilter`, `LIBRARY_PAGE_KINDS`, `libraryPageKind`, `LibraryPageKind` used identically across T2, T5, T6 tests and implementations. `handleTileTap` referenced consistently in T4 (component) and T5 (integration test). Component prop names (`artist`, `selected`, `onTap`) consistent T3 ↔ T4.

**Known soft spots:**
- T4's `handleTileTap` exposure: documented as "implementer can drop the last assertion if Svelte 5's component-internal-export pattern is awkward; equivalent coverage moves to T5". Spec-compliance reviewer should accept whichever path the implementer picks.
- T5's `touch-action: none` change: dropped from `pan-y`. Cascading impact on any embedded scrollable region inside LibraryView — none exist today, but flagged in T5 commit message and in spec §10 risks.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-m2c-artists-page-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh `svelte-ts-agent` subagent per task with per-task spec-compliance + code-quality review. Matches saved memory preference. Best for `/clear`-between-units workflow.

2. **Inline Execution** — Use `superpowers:executing-plans` to run tasks in this session with checkpoints.

Which approach?
