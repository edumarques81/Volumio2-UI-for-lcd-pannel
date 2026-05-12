# M2.C — Artists library page (design)

**Date:** 2026-05-13
**Initiative:** `we-are-going-to-linear-blanket` (M2)
**Parent plan:** `~/.claude/plans/we-are-going-to-linear-blanket.md` §M2.C
**Predecessors:**
- v1.5.0+ artist artwork enrichment (Fanart.tv → Deezer → first-album fallback) — the `/artistart` HTTP endpoint, `enrichment:artists:queue` Socket.IO event, and `artists.artwork_id` SQLite column are already live on the Pi.
- Backend `library:artists:list` → `pushLibraryArtists` Socket.IO wire (live), with paginated `Artist { name, albumCount, albumArt? }` payload.
- Frontend `libraryArtists`, `libraryArtistsLoading`, `libraryArtistsError`, `libraryArtistsPagination`, `selectedArtist`, `artistAlbums`, `libraryActions.fetchArtists`, `libraryActions.fetchArtistAlbums` (all live in `src/lib/stores/library.ts`).

## Context

The library currently offers a single page kind: an album-by-album swipe browser (`AlbumPage.svelte` rendered inside `LibraryView.svelte`, indexed by `currentLibraryIndex`, wrapped modulo `libraryAlbums.length`). Artists are listed nowhere in the redesign UI even though the backend has shipped the full `library:artists:list` request/response cycle plus dedicated `/artistart` image endpoint.

M2.C adds a second library page kind that surfaces a horizontal carousel of circular artist tiles, with a tap-to-filter-albums interaction that funnels the user back into the existing Albums page filtered to that artist's catalogue. M3.A (Qobuz iframe) is planned as a third kind, so the page-kind state is structured as a discriminated union from day one.

## User-locked decisions (this brainstorm)

1. **Page model:** Artists is a new page kind inside `LibraryView`, not a sibling top-level view in `NavColumn`.
2. **Page-switch gesture:** Vertical swipe inside `LibraryView`. Horizontal swipe stays scoped to within-page item navigation. The two axes share a 50 px threshold; the dominant axis wins.
3. **Tile scroll mechanism:** Native horizontal momentum scroll. Tap a tile to focus + select. No per-tile swipe gestures.
4. **Image source priority:** `/artistart?name={encoded}` first; on 404 / error, render a name-hashed letter avatar. Never use `albumArt` on an artist tile (album cover ≠ artist photo).
5. **Letter-avatar fallback:** Single uppercase first letter, colour deterministically hashed from the artist name (HSL with fixed saturation/lightness).
6. **Filter banner on AlbumsPage:** Inline amber accent on the artist name inside `MetadataBlock` with an inline `✕` button. Vertical-swipe-away to ArtistsPage also clears.
7. **Genres section:** Removed (was in the mockup; explicitly out of scope).
8. **Search input:** Deferred. Out of scope for this unit.
9. **View-all link / down chevron:** Removed (mockup carry-overs not adopted).
10. **Page-kind structure:** Discriminated-union store + renderer switch. Forward-compatible with M3.A's `'qobuz'` kind.
11. **Backend rescan hook:** Per user direction, artist metadata should be fetched after every library rescan as an async job. **This behavior already exists in v1.5.0+ and requires no code change for M2.C.** `stellar-volumio-audioplayer-backend/internal/transport/socketio/server.go:2234,2271,2278` (`triggerEnrichment`) is invoked after every cache rebuild (MPD database event), initial-empty-cache build, and on-disk cache load. It calls `enrichment_handlers.go:147` (`QueueMissingArtwork`), which sequentially chains album-scan → `QueueMissingArtistImages` → coordinator's artist scan, all async in goroutines. Documented here as a hard precondition; M2.C ships frontend-only.

## Out of scope

- Search-as-you-type filter
- Genres carousel
- M2.A's broader `artist_metadata` table additions (summary, tags, mbid, expires_at) — bios remain in the existing `bios.ts` store path, untouched here.
- Tile drag-to-reorder, favourites, long-press menu
- Multi-select / batch operations

## Architecture

Three new frontend files plus tests, three frontend edits, one backend edit plus a Go test.

| File | Action |
|---|---|
| `src/lib/utils/artistAvatar.ts` | NEW — pure helpers: `artistInitial(name)`, `artistHashColor(name)` |
| `src/lib/utils/__tests__/artistAvatar.test.ts` | NEW — determinism, edge cases, HSL format guard |
| `src/lib/components/redesign/ArtistTile.svelte` | NEW — circular tile, `/artistart` img + onerror fallback, selection ring |
| `src/lib/components/redesign/ArtistsPage.svelte` | NEW — horizontal momentum scroll strip, header label, loading/empty/error states |
| `src/lib/components/redesign/__tests__/ArtistTile.test.ts` | NEW — image src, fallback swap, selected state, ARIA, tap handler |
| `src/lib/components/redesign/__tests__/ArtistsPage.test.ts` | NEW — mount fetch, state branches, tap → fetchArtistAlbums + cyclePageKind |
| `e2e/artists-page.spec.ts` | NEW — Playwright vertical-swipe → tiles → tap → filter → clear (initially `test.describe.skip`, NordVPN block) |
| `src/lib/stores/library.ts` | EDIT — `LIBRARY_PAGE_KINDS`, `libraryPageKind` writable, `cyclePageKind`, `clearArtistFilter`; subscriber that auto-clears filter on `'albums' → 'artists'` transition |
| `src/lib/stores/__tests__/library.test.ts` | EDIT — page-kind cycle wraparound, filter clear on transition, explicit `clearArtistFilter` |
| `src/lib/components/redesign/LibraryView.svelte` | EDIT — vertical-swipe handler, renderer switch by page kind, filtered-album-list routing |
| `src/lib/components/redesign/__tests__/LibraryView.test.ts` | EDIT — renderer selection, axis-dominant swipe gate, filtered list routing |
| `src/lib/components/redesign/MetadataBlock.svelte` | EDIT — amber artist name + inline `✕` when `$selectedArtist === currentAlbum.artist` |
| `src/lib/components/redesign/__tests__/MetadataBlock.test.ts` | EDIT — accent + button presence, click → `clearArtistFilter`, default styling when filter null |
| Bundle-size guard test (existing M1.E file at `src/lib/components/redesign/__tests__/PlayerLayout.test.ts`) | EDIT — extend assertion: `LibraryView` chunk does not statically import `ArtistsPage` / `ArtistTile` |

## Section 1 — Store extension (`src/lib/stores/library.ts`)

```ts
// New additions, appended to existing exports
export const LIBRARY_PAGE_KINDS = ['albums', 'artists'] as const;
export type LibraryPageKind = typeof LIBRARY_PAGE_KINDS[number];

export const libraryPageKind = writable<LibraryPageKind>('albums');

// Action helpers
export const libraryActions = {
  // ...existing actions
  cyclePageKind(delta: 1 | -1) {
    const kinds = LIBRARY_PAGE_KINDS;
    const len = kinds.length;
    libraryPageKind.update(k => {
      const idx = kinds.indexOf(k);
      return kinds[((idx + delta) % len + len) % len];
    });
  },
  clearArtistFilter() {
    selectedArtist.set(null);
    artistAlbums.set([]);
    currentLibraryIndex.set(0);
  },
};

// Subscriber: clear filter implicitly when leaving Albums for Artists.
// Registered inside initLibraryStore() alongside the other socket listeners.
libraryPageKind.subscribe(kind => {
  if (kind === 'artists' && get(selectedArtist) !== null) {
    libraryActions.clearArtistFilter();
  }
});
```

The subscriber is registered inside `initLibraryStore()` so it runs exactly once per app lifetime. The `subscribe` callback fires synchronously on registration with the initial value `'albums'`; the `kind === 'artists'` guard short-circuits the no-op startup case.

## Section 2 — Avatar helper (`src/lib/utils/artistAvatar.ts`)

```ts
export function artistInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export function artistHashColor(name: string): string {
  // Deterministic, salt-free string hash → hue in [0, 360).
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 45%, 35%)`;
}
```

Saturation `45%` + lightness `35%` keeps the fallback tiles dark enough to read white text against and consistent with the redesign's muted palette. Article-strip ("The Beatles" → "B") is deferred — adds locale complexity and the user-facing impact is minimal.

## Section 3 — ArtistTile component

```svelte
<!-- src/lib/components/redesign/ArtistTile.svelte -->
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
  const initial = artistInitial(artist.name);
  const hashColor = artistHashColor(artist.name);
  const imgSrc = `/artistart?name=${encodeURIComponent(artist.name)}`;
  const slug = artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
```

Styles per the visual spec in Section 6. The `slug` derivation handles non-ASCII and punctuation defensively for the testid.

## Section 4 — ArtistsPage component

```svelte
<!-- src/lib/components/redesign/ArtistsPage.svelte -->
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

  onMount(() => {
    if (get(libraryArtists).length === 0 && !get(libraryArtistsLoading)) {
      libraryActions.fetchArtists();
    }
    // No auto-scroll on revisit: the `'albums' → 'artists'` subscriber inside
    // `library.ts` clears `selectedArtist` whenever the user lands on this page,
    // so the strip always starts at scroll-position 0 with no tile selected.
  });

  function handleTileTap(name: string) {
    selectedArtist.set(name);
    libraryActions.fetchArtistAlbums(name);
    libraryActions.cyclePageKind(-1); // back to Albums
  }

  function retry() {
    libraryActions.fetchArtists();
  }
</script>

<section class="artists-page" data-testid="artists-page">
  <header class="artists-page-header" data-testid="artists-page-header">Artists</header>

  {#if $libraryArtistsError}
    <div class="state-error" data-testid="artists-error" role="alert" on:click={retry}>
      Could not load artists. Tap to retry.
    </div>
  {:else if $libraryArtistsLoading && $libraryArtists.length === 0}
    <div class="artists-strip" data-testid="artists-strip-loading">
      {#each Array(7) as _, i}
        <div class="tile-skeleton" data-testid="artist-tile-skeleton" />
      {/each}
    </div>
  {:else if $libraryArtists.length === 0}
    <div class="state-empty" data-testid="artists-empty">No artists in library</div>
  {:else}
    <div class="artists-strip" bind:this={stripEl}>
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
```

The keyed `{#each ... (artist.name)}` ensures Svelte preserves tile DOM identity across store updates (so the image-failed-fallback state isn't lost when `libraryArtists` is reshuffled by a re-fetch).

## Section 5 — LibraryView edits

Add vertical-swipe handling alongside the existing horizontal pointer logic, route the rendered album list through the filter, and conditionally render `ArtistsPage` instead of `AlbumPage` based on `libraryPageKind`.

```svelte
<!-- inside LibraryView.svelte <script> -->
const SWIPE_THRESHOLD = 50;            // existing
const SWIPE_THRESHOLD_Y = 50;          // new
let pointerStartY = 0;                 // new

function handlePointerDown(e: PointerEvent) {
  pointerStartX = e.clientX;
  pointerStartY = e.clientY;           // new
  pointerActive = true;
}

function handlePointerUp(e: PointerEvent) {
  if (!pointerActive) return;
  pointerActive = false;
  const dx = e.clientX - pointerStartX;
  const dy = e.clientY - pointerStartY;
  if (Math.abs(dy) > Math.abs(dx)) {
    if (Math.abs(dy) < SWIPE_THRESHOLD_Y) return;
    libraryActions.cyclePageKind(dy < 0 ? +1 : -1);  // swipe-up = +1
  } else {
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    advance(dx < 0 ? 1 : -1);
  }
}

// Filtered list selection
$: albumsList = $selectedArtist ? ($artistAlbums || []) : ($libraryAlbums || []);
```

Renderer switch with vertical fly animation:

```svelte
{#key $libraryPageKind}
  <div
    class="page-slot"
    in:fly|local={{ y: lastVertDir === 'up' ? 120 : -120, duration: 220, opacity: 0.2 }}
    out:fly|local={{ y: lastVertDir === 'up' ? -120 : 120, duration: 180, opacity: 0 }}
  >
    {#if $libraryPageKind === 'albums'}
      {#key currentAlbum?.uri ?? 'empty'}
        <AlbumPage album={currentAlbum} tracks={currentTracks} onPlayAlbum={playCurrent} />
      {/key}
    {:else if $libraryPageKind === 'artists'}
      <ArtistsPage />
    {/if}
  </div>
{/key}
```

`ArtistsPage` is imported via dynamic `import()` inside an `onMount`-guarded `$state` flag (`artistsPageImportStarted`), symmetric with the M1.E `VuMeterView` lazy-load pattern. Loaded only when `libraryPageKind` first flips to `'artists'`.

## Section 6 — MetadataBlock edits

```svelte
<!-- inside MetadataBlock.svelte -->
<script>
  import { selectedArtist, libraryActions } from '$lib/stores/library';
  // ...existing imports
  $: isFiltered = $selectedArtist === artist;
</script>

<span class="artist-name" class:is-filter-active={isFiltered}>{artist}</span>
{#if isFiltered}
  <button
    class="clear-filter"
    data-testid="clear-artist-filter"
    aria-label="Clear artist filter"
    on:click={libraryActions.clearArtistFilter}
  >✕</button>
{/if}
```

The amber colour is applied via `.is-filter-active { color: var(--color-accent-bright); }`. The button is inline-flush with the name; hit area widens via padding (32 × 32 effective) per the visual spec.

## Section 7 — Backend coordinator chain (already shipped)

No backend code change required. The chain the user asked for already lives in v1.5.0+:

- `internal/transport/socketio/server.go:2234,2271,2278` — `s.triggerEnrichment()` is invoked after every MPD-driven cache rebuild, after the empty-cache initial build, and after a successful on-disk cache load on boot.
- `internal/transport/socketio/server.go:2282-2287` — `triggerEnrichment()` delegates to `s.enrichmentHandlers.QueueMissingArtwork()`.
- `internal/transport/socketio/enrichment_handlers.go:143-155` — `QueueMissingArtwork()` runs in a goroutine: first invokes the coordinator's album scan, then calls `QueueMissingArtistImages()` which spawns its own goroutine for the coordinator's artist scan.
- Net effect: album-scan completes → artist-scan begins, both async, both rate-limited at the upstream MusicBrainz / Fanart.tv / Deezer clients.

Verification step for the executor (Task 9 manual smoke): trigger a cache rebuild via the browser console (`window.libraryActions.rebuildCache()`) and watch `journalctl -u stellar-backend -f` for the log lines "Starting artwork enrichment queue processing" followed shortly after by similar artist-scan lines. No new test, no new code.

## Section 8 — Visual spec (LCD 1920×440, content area 1680×440)

| Element | Specification |
|---|---|
| Page background | `#050507` (matches `PlayerLayout`) |
| Top padding | 20 px |
| "Artists" header | 18 px / 600 weight, `color: var(--color-accent)`, `letter-spacing: 0.04em`, 48 px left padding |
| Header → strip gap | 16 px |
| Tile circle | 160 × 160 px, `border-radius: 50%` |
| Tile image | `<img>` filling circle, `object-fit: cover`, 1 px subtle border `rgba(255,255,255,0.08)` when image present |
| Avatar fallback | `<div>` filled with hashColor, centred uppercase initial in white, 56 px / 700 weight |
| Tile → name gap | 12 px |
| Name (default) | 14 px / 500 weight, `#fff`, `letter-spacing: 0.01em`, single line, ellipsis at 160 px max-width |
| Name (selected) | `color: var(--color-accent-bright)` |
| Selection ring | `2 px solid var(--color-accent)` + `box-shadow: 0 0 16px var(--color-accent-glow)` |
| Tile horizontal gap | 24 px |
| Strip overflow | `overflow-x: auto`, `overscroll-behavior-x: contain`, native momentum; scrollbar hidden in WebKit |
| Strip `touch-action` | `pan-x` (frees `LibraryView` to capture vertical swipe) |
| Container query | `@container (max-width: 1200px)` shrinks circle to 120 px, name to 12 px (desktop letterbox) |

Animations:
- Page-switch fly: 220 ms in / 180 ms out, `y: ±120 px`, opacity dip. Direction follows last vertical-swipe direction.
- Tile selection transition: 200 ms `ease-out` on `box-shadow`, `border-color`, `color`.
- `prefers-reduced-motion: reduce`: skip page fly + tile transition. Mirrors M1.E `reducedMotion` `$state` pattern.

Filter banner additions to `MetadataBlock`:
- Artist name: `color: #fff` → `color: var(--color-accent-bright)` when filter active.
- `✕` button: 16 px square text, `color: var(--color-accent)`, `background: transparent`, `border: none`, `padding: 0 4px`. Hover/focus: `color: var(--color-accent-bright)`. Effective hit target ≥ 32 × 32 px (composite with adjacent metadata block).

## Section 9 — Testing strategy

Discipline: TDD per task — failing test first, then implementation. Each task gates on Vitest green + spec-compliance review + code-quality review per the saved subagent-driven preference.

### Unit (Vitest)

**`utils/__tests__/artistAvatar.test.ts`** (~40 L)
- `artistInitial('Hollow Tides')` → `'H'`
- `artistInitial('  the Beatles')` → `'T'` (no article-strip)
- `artistInitial('')` → `'?'`
- `artistHashColor('Nils Frahm')` deterministic on repeat call
- `artistHashColor('A') !== artistHashColor('B')`
- Regex guard: returns `hsl(<0-359>, 45%, 35%)`

**`components/redesign/__tests__/ArtistTile.test.ts`** (~80 L)
- `<img>` `src` matches `/artistart?name={encoded}`
- `error` event on `<img>` swaps in `data-testid="avatar-fallback"` with the expected initial + inline background-color
- `selected={true}` adds `is-selected` class; `selected={false}` removes it
- Click + `Enter` + `Space` all invoke `onTap` with `artist.name`
- ARIA: `role="button"`, `aria-pressed={selected}`, `aria-label={name}`
- `data-testid="artist-tile-{slug}"` for slug derivation

**`components/redesign/__tests__/ArtistsPage.test.ts`** (~120 L)
- Mounts with empty store → calls `fetchArtists` once, sets loading true
- Mounts with populated store → does NOT call `fetchArtists`
- Renders one `ArtistTile` per element
- Loading state: 7 `data-testid="artist-tile-skeleton"` when loading + empty
- Empty state: `data-testid="artists-empty"` when not loading + empty
- Error state: `data-testid="artists-error"`; click re-fires `fetchArtists`
- Tap tile: sets `selectedArtist`, calls `fetchArtistAlbums(name)`, calls `cyclePageKind(-1)`
- Header `data-testid="artists-page-header"` text `"Artists"`

**`stores/__tests__/library.test.ts`** (+~60 L)
- `LIBRARY_PAGE_KINDS` is `readonly ['albums', 'artists']`
- `libraryPageKind` initial value `'albums'`
- `cyclePageKind(1)`: `'albums' → 'artists'` → `'albums'` (wrap)
- `cyclePageKind(-1)`: `'albums' → 'artists'` → `'albums'` (wrap, opposite direction)
- Transition `'albums' → 'artists'` while `selectedArtist` set: triggers `clearArtistFilter`
- Transition while `selectedArtist === null`: no-op (no spurious state reset)
- Explicit `clearArtistFilter()`: nulls `selectedArtist`, empties `artistAlbums`, zeroes `currentLibraryIndex`

**`components/redesign/__tests__/LibraryView.test.ts`** (+~50 L)
- Renders `AlbumPage` when `libraryPageKind === 'albums'`, `ArtistsPage` when `'artists'`
- Pointer vertical up delta ≥ 50 px: `cyclePageKind(+1)`
- Pointer vertical down delta ≥ 50 px: `cyclePageKind(-1)`
- Horizontal swipe (dominant X axis) calls `advance`, not `cyclePageKind`
- Diagonal where `|dx| === |dy|`: horizontal branch (else clause)
- Below threshold on either axis: no action
- `selectedArtist` set + kind `'albums'`: renders from `artistAlbums`, not `libraryAlbums`
- `selectedArtist` null + kind `'albums'`: renders from `libraryAlbums`

**`components/redesign/__tests__/MetadataBlock.test.ts`** (+~30 L)
- `$selectedArtist === currentAlbum.artist`: artist name has class `is-filter-active`, `data-testid="clear-artist-filter"` present
- Click `clear-artist-filter` invokes `libraryActions.clearArtistFilter`
- `$selectedArtist === null`: button absent, name default

### Type-safety guard

Every test task includes `npx tsc --noEmit` exit 0 as part of its verification gate (memory: spec reviewers must run `tsc` on test files with complex generics). Mocks for `socketService.on<T>(...)` use explicit type annotations. `it.each<[Input, Expected]>` typed. `vi.hoisted` only when needed and with explicit return type.

### Playwright e2e (`e2e/artists-page.spec.ts`)

Marked `test.describe.skip` with TODO referencing the NordVPN unblock command (`sudo systemextensionsctl uninstall W5W395V82Y com.nordvpn.macos.Shield`) and the manual-verification commit hash that will be filled in by the executor.

Scenarios when unblocked:
1. From `?layout=lcd`, navigate to Library, vertical-swipe up → `artists-page-header` visible within 2 s.
2. With `libraryArtists` populated via socket mock → ≥ 1 `[data-testid^="artist-tile-"]` rendered.
3. Tap a tile → `clear-artist-filter` appears on the AlbumsPage; artist name has `is-filter-active` class.
4. Tap `clear-artist-filter` → filter accent + button disappear, album list reverts to full library.
5. Vertical-swipe down (back to Artists) while a filter is active → filter clears implicitly.
6. Letter-avatar fallback: stub `/artistart` to 404 for one artist → that tile renders `avatar-fallback` with expected initial.

`gotoApp()` includes the M1.E page-ready gate (`Play button enabled OR library-view mounted`) to prevent false-pass on env failure.

### Backend

No new Go tests. The chain is shipped and exercised by the existing v1.5.0+ test suite. Manual smoke (Task 9) confirms it fires on cache rebuild.

### Final verification gate (T8)

- `npx tsc --noEmit` exit 0
- `npm run test:run` all green; baseline + ~30 new cases
- `npm run build` exit 0 (no new warnings beyond the pre-existing Toggle aria-pressed warning)
- Backend `make test` + `make test-race` green
- Bundle guard: `ArtistsPage` not statically imported by `LibraryView` chunk
- Manual LCD smoke (recorded with commit hashes for the e2e TODO):
  1. Load `http://192.168.86.221:5173?layout=lcd`, navigate to Library
  2. Vertical-swipe up → tile strip appears within ~200 ms (cold lazy-load latency acceptable)
  3. Tap a tile → AlbumsPage renders filtered album, artist name amber, `✕` visible
  4. Tap `✕` → filter clears, full library restored
  5. Tap a different tile → swipe down → no filter active on revisit

## Section 10 — Risks & mitigations

| Risk | Mitigation |
|---|---|
| Vertical vs horizontal swipe ambiguity on diagonal drag | Dominant axis wins (`Math.abs(dy) > Math.abs(dx)`). Diagonal-input unit test pins the tie-break. |
| Drag-to-scroll triggering accidental tap on release | Pointer-up handler additionally requires `|dx| < 5` and `|dy| < 5` to count as tap (not a scroll). |
| Bundle size growth | `ArtistsPage` + `ArtistTile` dynamic-imported via the M1.E lazy-load pattern in `LibraryView`. Bundle-guard regex (widened in M1.E) catches accidental static imports. |
| `/artistart` 302 redirect to Deezer hotlinks blocked by browser CORS | Standard `<img>` requests follow 302s without CORS preflight (no `crossorigin` attribute set). If a fallback is needed, `onerror` retries with `?id=` form. |
| Filter clear on swipe-away surprises users | Explicit `✕` is the primary control; the implicit clear-on-leave is a fallback for users who never tap `✕`. If feedback flags it, the subscriber inside `library.ts` is removed in a one-line change. |
| `/artistart` request burst on first ArtistsPage entry | Pi backend cache + upstream rate-limits absorb the burst. First visit only — subsequent images are SQLite-served and instant. |

## Section 11 — Open questions (default chosen, easy to reverse)

1. **Focused-tile persistence across visits.** Default: no — the `'albums' → 'artists'` subscriber clears `selectedArtist` whenever the user enters ArtistsPage, so the strip always reopens at scroll-position 0 with no tile selected. The amber selection ring is therefore strictly transient: visible only between tap-tile and the immediate navigation back to ArtistsPage (~one frame). If "where did I leave off" memory becomes a felt need, the spec adds a separate `lastSelectedArtistName` writable that persists across the filter clear — a small extension, not a refactor.
2. **`/artistart` 404 vs 302 behaviour.** Assumption: 302 redirects to Deezer hotlinks load transparently. Validated in manual LCD smoke; fallback retry-with-`?id=` is the documented escape hatch.
3. **Backend rescan trigger scope.** Default: artist-enrichment runs after every cache rebuild, including boot. Idempotent + rate-limited; warming on boot is net positive.

## Section 12 — Rollout (5 waves, subagent-driven)

Per saved memory preference (subagent-driven for multi-plan work, `/clear` between units).

- **Wave 1 (2 parallel tasks):**
  - T1: `artistAvatar.ts` utility + `artistAvatar.test.ts`
  - T2: `libraryPageKind` store + `cyclePageKind` + `clearArtistFilter` + subscriber + extend `library.test.ts`
- **Wave 2 (2 parallel tasks, depends on Wave 1):**
  - T3: `ArtistTile.svelte` + `ArtistTile.test.ts`
  - T4: `ArtistsPage.svelte` (uses ArtistTile) + `ArtistsPage.test.ts`
- **Wave 3 (2 parallel tasks, depends on Wave 2):**
  - T5: `LibraryView.svelte` vertical-swipe + renderer switch + filtered-list routing + extend `LibraryView.test.ts` + bundle-guard regex update
  - T6: `MetadataBlock.svelte` filter accent + `✕` button + extend `MetadataBlock.test.ts`
- **Wave 4 (2 tasks, after Wave 3):**
  - T7: `e2e/artists-page.spec.ts` skipped placeholder + TODO block
  - T8: Final verification gate (tsc, full Vitest, build, manual LCD smoke incl. backend enrichment-chain log check, project-note update)

### Definition of done

- All Vitest tests green (baseline + ~30 new cases)
- `npx tsc --noEmit` exit 0
- `npm run build` exit 0
- Bundle-size guard green (`ArtistsPage` lazy-loaded only)
- Manual LCD smoke completes the 5-step sequence
- Backend enrichment chain log check (existing v1.5.0+ wiring) confirmed via `journalctl -u stellar-backend` during smoke
- ≥ 8 atomic commits on `Volumio2-UI` master (one per task); zero backend commits
- Project note `Last Context Switch` updated with the resume hook before `/clear`

### Follow-ups deferred (not in this unit of work)

- Search-as-you-type on ArtistsPage
- Genres carousel
- M2.A's broader `artist_metadata` table (summary, tags, mbid, expires_at) — bios stay in the existing `bios.ts` path
- Re-enable `e2e/artists-page.spec.ts` after NordVPN unload
- Drop deprecated `{bins, peak, rms}` mono-fallback in backend (M1.E carryover; not M2.C scope)

## Appendix — Reference paths

| Reference | Path |
|---|---|
| Plan | `~/.claude/plans/we-are-going-to-linear-blanket.md` §M2.C |
| Frontend store | `Volumio2-UI/src/lib/stores/library.ts` |
| LibraryView | `Volumio2-UI/src/lib/components/redesign/LibraryView.svelte` |
| AlbumPage | `Volumio2-UI/src/lib/components/redesign/AlbumPage.svelte` |
| MetadataBlock | `Volumio2-UI/src/lib/components/redesign/MetadataBlock.svelte` |
| Backend coordinator | `stellar-volumio-audioplayer-backend/internal/infra/enrichment/coordinator.go` |
| Existing artist enrichment doc | `Volumio2-UI/CLAUDE.md` § Artist Artwork Enrichment (v1.5.0+) |
| Predecessor spec format | `Volumio2-UI/docs/superpowers/specs/2026-05-12-m1e-vu-meter-frontend-design.md` |
