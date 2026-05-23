# M2.C Artists-Page Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three regressions surfaced by manual LCD smoke after M2.C shipped — missing artist images, missing album cover when filtering by artist, wrong album playing when tapping play in the filtered view — plus an artist-name centering nit.

**Architecture:** Three independent surgical fixes. Two distinct root causes:
1. **Backend** (`internal/domain/library/service.go:341-406`): `GetArtistAlbums` returns Album records with empty `URI`, `AlbumArt`, `TrackCount`, `Quality`, `TrackType`, `Genre`. Fix by iterating MPD base paths via the rich `GetAlbumDetails` call (same path `GetAlbums` already uses), filtering by `AlbumArtist == req.Artist`, and emitting fully-populated Album records. Caused symptoms 2 (no cover) and 3 (Jacob Collier loop — empty `uri` means `replaceAndPlay` falls through to whatever MPD already had queued).
2. **Frontend Vite dev-server** (`vite.config.ts`): no `server.proxy` for `/artistart` (or `/albumart`). Relative URLs from `ArtistTile.svelte` resolve to Vite's SPA fallback (HTML 200), browser fails to decode HTML as an image. Album-art is unaffected only because `library.ts:fixAlbumArt` rewrites to absolute `<PI_IP>:3000` URLs.
3. **Frontend CSS** (`ArtistTile.svelte`): artist name label not optically centered. Make `.artist-tile-name` a flex container with `align-items: center` and `line-height: 1`.

**Tech Stack:** Go 1.25, modernc/sqlite, zishang520 socket.io v3 (backend); Svelte 5, TypeScript, Vite 7, Vitest 4 (frontend).

**Scope guard:** This plan **only** addresses the four user-reported regressions. Out of scope: caching `GetArtistAlbums` results (perf), broader CachedService override, refactoring `getAlbumsFromBasePath` for full DRY (would touch the working code path). One commit per task.

---

## File Structure

| File | Role | Action |
|---|---|---|
| `stellar-volumio-audioplayer-backend/internal/domain/library/service.go` | Library service — `GetArtistAlbums` builds full Album records | Modify lines 340-406 |
| `stellar-volumio-audioplayer-backend/internal/domain/library/service_test.go` | Backend unit tests | Add `TestService_GetArtistAlbums_PopulatesFullFields` |
| `Volumio2-UI/vite.config.ts` | Vite dev-server config | Add `server.proxy` entries for `/artistart` + `/albumart` |
| `Volumio2-UI/src/lib/components/redesign/ArtistTile.svelte` | Tile CSS | Modify `.artist-tile-name` rule |

---

## Task 1: Backend — `GetArtistAlbums` populates URI + AlbumArt + quality fields

**Why first:** This is the only task that requires a real test. Fix it before the Vite proxy so the user can verify covers + correct playback as soon as the backend redeploy lands.

**Files:**
- Modify: `stellar-volumio-audioplayer-backend/internal/domain/library/service.go:340-406`
- Test: `stellar-volumio-audioplayer-backend/internal/domain/library/service_test.go` (extend / add)

### Steps

- [ ] **Step 1.1: Add failing test asserting full Album fields**

Append to `internal/domain/library/service_test.go` (after the existing `TestService_GetArtistAlbums_WithAlbums` block ending around line 569):

```go
func TestService_GetArtistAlbums_PopulatesFullFields(t *testing.T) {
	// Two albums by the same artist, spread across INTERNAL and NAS base
	// paths, so we also verify multi-source scoping. A third album by a
	// different artist exists in USB and must NOT appear in the result.
	mockMPD := &MockMPDClient{
		GetAlbumDetailsResp: map[string][]AlbumDetails{
			"INTERNAL": {
				{
					Album:       "In Rainbows",
					AlbumArtist: "Radiohead",
					TrackCount:  10,
					FirstTrack:  "INTERNAL/Radiohead/In Rainbows/01 - 15 Step.flac",
					Format:      "44100:16:2",
				},
			},
			"USB": {
				{
					Album:       "Some Other Album",
					AlbumArtist: "Other Artist",
					TrackCount:  5,
					FirstTrack:  "USB/Other/track.flac",
					Format:      "44100:16:2",
				},
			},
			"NAS": {
				{
					Album:       "OK Computer",
					AlbumArtist: "Radiohead",
					TrackCount:  12,
					FirstTrack:  "NAS/Radiohead/OK Computer/01 - Airbag.flac",
					Format:      "96000:24:2",
				},
			},
		},
	}

	service := NewService(mockMPD, &MockPathClassifier{})

	resp := service.GetArtistAlbums(GetArtistAlbumsRequest{
		Artist: "Radiohead",
		Sort:   SortAlphabetical,
	})

	if resp.Artist != "Radiohead" {
		t.Fatalf("Expected artist 'Radiohead', got %q", resp.Artist)
	}
	if len(resp.Albums) != 2 {
		t.Fatalf("Expected 2 Radiohead albums (across INTERNAL + NAS), got %d", len(resp.Albums))
	}

	// Alphabetical sort: "In Rainbows" before "OK Computer"
	inRainbows := resp.Albums[0]
	okComputer := resp.Albums[1]

	if inRainbows.Title != "In Rainbows" {
		t.Errorf("Expected first album 'In Rainbows', got %q", inRainbows.Title)
	}
	if inRainbows.URI != "INTERNAL/Radiohead/In Rainbows" {
		t.Errorf("Expected URI 'INTERNAL/Radiohead/In Rainbows', got %q", inRainbows.URI)
	}
	if inRainbows.AlbumArt != "/albumart?path=INTERNAL/Radiohead/In Rainbows/01 - 15 Step.flac" {
		t.Errorf("Expected AlbumArt to point at first track, got %q", inRainbows.AlbumArt)
	}
	if inRainbows.TrackCount != 10 {
		t.Errorf("Expected TrackCount 10, got %d", inRainbows.TrackCount)
	}
	if inRainbows.TrackType != "flac" {
		t.Errorf("Expected TrackType 'flac', got %q", inRainbows.TrackType)
	}
	if inRainbows.Source != SourceLocal {
		t.Errorf("Expected Source SourceLocal for INTERNAL, got %q", inRainbows.Source)
	}

	if okComputer.URI != "NAS/Radiohead/OK Computer" {
		t.Errorf("Expected NAS URI, got %q", okComputer.URI)
	}
	if okComputer.AlbumArt == "" {
		t.Errorf("Expected non-empty AlbumArt on NAS album")
	}
	if okComputer.Source != SourceNAS {
		t.Errorf("Expected Source SourceNAS, got %q", okComputer.Source)
	}

	// Negative case: the USB album by 'Other Artist' must not leak in.
	for _, a := range resp.Albums {
		if a.Artist != "Radiohead" {
			t.Errorf("Unexpected non-Radiohead album in response: %+v", a)
		}
	}
}
```

- [ ] **Step 1.2: Run the new test — expect FAIL**

```bash
cd stellar-volumio-audioplayer-backend
go test ./internal/domain/library/ -run TestService_GetArtistAlbums_PopulatesFullFields -v
```

Expected output: `--- FAIL` with one or more of:
- `Expected 2 Radiohead albums (across INTERNAL + NAS), got 0` (current impl iterates `FindAlbumsByArtist`, not `GetAlbumDetails`, and the mock has no `FindAlbumsByArtistResp` for "Radiohead", so albums is empty)
- OR `Expected URI '...', got ""` once we fix the iteration

This proves the test is sensitive to the bug.

- [ ] **Step 1.3: Refactor `GetArtistAlbums` to use the rich path**

Replace the entire `GetArtistAlbums` function (`internal/domain/library/service.go:340-406`) with:

```go
// GetArtistAlbums returns albums by a specific artist with fully-populated
// URI / AlbumArt / quality fields. Mirrors GetAlbums's data-flow
// (iterate base paths via GetAlbumDetails) but filters by AlbumArtist so
// every Album record returned is the same shape downstream consumers get
// from `library:albums:list` — which means `playAlbum(album)` works and
// album covers render.
func (s *Service) GetArtistAlbums(req GetArtistAlbumsRequest) ArtistAlbumsResponse {
	albums := make([]Album, 0)

	// Scope to all sources — artist filtering at this layer is by name only.
	basePaths := s.getBasePathsForScope(ScopeAll)

	for _, basePath := range basePaths {
		sourceType := s.sourceTypeForBasePath(basePath)
		albumDetails, err := s.mpd.GetAlbumDetails(basePath)
		if err != nil {
			log.Debug().Err(err).Str("path", basePath).Msg("Failed to get albums from database")
			continue
		}

		for _, details := range albumDetails {
			// Case-insensitive AlbumArtist match — MPD tag casing is unreliable.
			if !strings.EqualFold(details.AlbumArtist, req.Artist) {
				continue
			}

			// Derive URI from the first track's directory.
			uri := ""
			if details.FirstTrack != "" {
				uri = path.Dir(details.FirstTrack)
			}

			albumID := generateID(details.Album + "\x00" + details.AlbumArtist + "\x00" + uri)

			albumArt := ""
			if details.FirstTrack != "" {
				albumArt = "/albumart?path=" + details.FirstTrack
			}

			// Parse audio format and detect track type (same logic as GetAlbums).
			var sampleRate, bitDepth int
			if details.Format != "" {
				parts := strings.Split(details.Format, ":")
				if len(parts) >= 2 {
					sampleRate, _ = strconv.Atoi(parts[0])
					bitDepth, _ = strconv.Atoi(parts[1])
				}
			}
			trackType := ""
			if details.FirstTrack != "" {
				if idx := strings.LastIndex(details.FirstTrack, "."); idx >= 0 {
					trackType = strings.ToLower(details.FirstTrack[idx+1:])
				}
			}
			quality := formatQualityLabel(sampleRate, bitDepth, trackType)

			albums = append(albums, Album{
				ID:         albumID,
				Title:      details.Album,
				Artist:     details.AlbumArtist,
				URI:        uri,
				AlbumArt:   albumArt,
				TrackCount: details.TrackCount,
				Source:     sourceType,
				Quality:    quality,
				TrackType:  trackType,
				Genre:      details.Genre,
			})
		}
	}

	s.sortAlbums(albums, req.Sort)

	// Pagination (same shape as before).
	total := len(albums)
	page := req.Page
	limit := req.Limit
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > MaxLimit {
		limit = DefaultLimit
	}

	start := (page - 1) * limit
	end := start + limit
	if start > len(albums) {
		start = len(albums)
	}
	if end > len(albums) {
		end = len(albums)
	}

	return ArtistAlbumsResponse{
		Artist: req.Artist,
		Albums: albums[start:end],
		Pagination: Pagination{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasMore: end < total,
		},
	}
}
```

Notes:
- This intentionally duplicates the field-population logic from `getAlbumsFromBasePath`. Extracting a shared `buildAlbum` helper would be the right cleanup but is **out of scope** here — it touches working code and risks breaking the album-list path.
- The pre-existing `TestService_GetArtistAlbums_WithAlbums` (line 540) and `TestService_GetArtistAlbums_Empty` (line 519) seed `FindAlbumsByArtistResp` instead of `GetAlbumDetailsResp` — they'll now return 0 albums. That's fine semantically (the new implementation no longer uses `FindAlbumsByArtist`), but the existing assertions will fail. Update them in the next step.

- [ ] **Step 1.4: Update the two existing GetArtistAlbums tests to use `GetAlbumDetailsResp`**

In `service_test.go`, replace `TestService_GetArtistAlbums_Empty` (lines 519-538) with:

```go
func TestService_GetArtistAlbums_Empty(t *testing.T) {
	// No album details anywhere -> empty response.
	mockMPD := &MockMPDClient{
		GetAlbumDetailsResp: map[string][]AlbumDetails{},
	}

	service := NewService(mockMPD, &MockPathClassifier{})

	resp := service.GetArtistAlbums(GetArtistAlbumsRequest{
		Artist: "Unknown Artist",
	})

	if len(resp.Albums) != 0 {
		t.Errorf("Expected 0 albums, got %d", len(resp.Albums))
	}
	if resp.Artist != "Unknown Artist" {
		t.Errorf("Expected artist 'Unknown Artist', got %s", resp.Artist)
	}
}
```

And replace `TestService_GetArtistAlbums_WithAlbums` (lines 540-569) with:

```go
func TestService_GetArtistAlbums_WithAlbums(t *testing.T) {
	mockMPD := &MockMPDClient{
		GetAlbumDetailsResp: map[string][]AlbumDetails{
			"INTERNAL": {
				{Album: "Album 1", AlbumArtist: "Test Artist", TrackCount: 10, FirstTrack: "INTERNAL/Album1/track.flac"},
				{Album: "Album 2", AlbumArtist: "Test Artist", TrackCount: 8, FirstTrack: "INTERNAL/Album2/track.flac"},
			},
		},
	}

	service := NewService(mockMPD, &MockPathClassifier{})

	resp := service.GetArtistAlbums(GetArtistAlbumsRequest{
		Artist: "Test Artist",
		Sort:   SortAlphabetical,
	})

	if len(resp.Albums) != 2 {
		t.Errorf("Expected 2 albums, got %d", len(resp.Albums))
	}
	if resp.Artist != "Test Artist" {
		t.Errorf("Expected artist 'Test Artist', got %s", resp.Artist)
	}
}
```

- [ ] **Step 1.5: Run the full library package tests — expect PASS**

```bash
cd stellar-volumio-audioplayer-backend
go test ./internal/domain/library/ -v
```

Expected: all tests pass, including the new `TestService_GetArtistAlbums_PopulatesFullFields` and both updated tests. No other tests in this package should break — `Service.GetArtists` (which still uses `FindAlbumsByArtist` for `albumCount`) is untouched.

- [ ] **Step 1.6: Run the full backend test suite to catch regressions**

```bash
cd stellar-volumio-audioplayer-backend
make test
```

Expected: `ok` on all packages. If `internal/transport/socketio/library_handlers_test.go` or `internal/domain/library/cached_service_test.go` fail because their fixtures used `FindAlbumsByArtistResp`, update their mocks the same way (switch to `GetAlbumDetailsResp` keyed by base path).

- [ ] **Step 1.7: Commit**

```bash
cd stellar-volumio-audioplayer-backend
git add internal/domain/library/service.go internal/domain/library/service_test.go
git commit -m "$(cat <<'EOF'
fix(library): GetArtistAlbums returns full Album records (URI, AlbumArt, quality)

The previous implementation built Album records with only ID/Title/Artist/Source,
leaving URI and AlbumArt empty. Two downstream consequences:

1. AlbumPage in Volumio2-UI renders <AlbumCover src=""> when drilling into
   an artist -> blank cover.
2. playAlbum() emits replaceAndPlay{ uri: "" } -> MPD has no folder to load,
   falls through to whatever was already queued -> the last-played album
   loops regardless of which filtered tile the user tapped.

Mirror GetAlbums's data path: iterate scope-ALL base paths via
GetAlbumDetails, filter by AlbumArtist (case-insensitive), populate URI
from path.Dir(FirstTrack), AlbumArt from /albumart?path=FirstTrack, plus
quality / trackType / source fields. Same field shape as library:albums:list
responses, so the filtered AlbumsPage gets cover + correct playback wiring
for free.

Adds TestService_GetArtistAlbums_PopulatesFullFields and updates the two
existing GetArtistAlbums tests whose mocks were seeded against the
no-longer-used FindAlbumsByArtist path.

Caught by T8 manual LCD smoke (deferred during M2.C ship); automated
checks passed because frontend unit tests use synthesized artistAlbums
fixtures that include URI/AlbumArt.
EOF
)"
```

- [ ] **Step 1.8: Deploy backend to the Pi**

```bash
cd Volumio2-UI
source .env
SSH_CMD="sshpass -p '$RASPBERRY_PI_SSH_PASSWORD' ssh -o StrictHostKeyChecking=no $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"

# Stop, build, copy, start
eval "$SSH_CMD 'sudo systemctl stop stellar-backend'"
cd "$STELLAR_BACKEND_FOLDER"
CGO_ENABLED=1 CC=aarch64-linux-musl-gcc GOOS=linux GOARCH=arm64 \
  go build -ldflags='-linkmode external -extldflags "-static"' -o stellar-arm64 ./cmd/stellar
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" scp stellar-arm64 "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-backend/stellar"
eval "$SSH_CMD 'chmod +x ~/stellar-backend/stellar && sudo systemctl start stellar-backend'"

# Watch logs for clean start
eval "$SSH_CMD 'sudo systemctl status stellar-backend --no-pager | head -20'"
```

Expected: backend `active (running)`.

- [ ] **Step 1.9: Re-run the DevTools confirmation snippet**

Open DevTools on the kiosk URL (`http://192.168.86.221:5173?layout=lcd`), paste:

```js
const m = await import('/src/lib/services/socket.ts');
m.socketService.on('pushLibraryArtistAlbums', (d) =>
  console.table(d.albums.map(a => ({ title: a.title, uri: a.uri, albumArt: a.albumArt })))
);
```

Then swipe up to ArtistsPage and tap any artist. The table should now show **non-empty** `uri` (e.g. `NAS/<Artist>/<Album>`) and **non-empty** `albumArt` (e.g. `/albumart?path=...`) for every row. If still empty: stop, return to Phase 1 of systematic-debugging.

- [ ] **Step 1.10: Manual visual verify on the LCD**

1. Swipe up to ArtistsPage.
2. Tap an artist (any) → AlbumsPage shows the **correct cover** for that artist's first album.
3. Tap play → the **right album** starts playing (not Jacob Collier's _The Light For Days_).
4. Tap ✕ to clear the filter → back to full Albums list.

If any step fails, capture the symptom and stop — bugs 2/3 are not fully fixed yet.

---

## Task 2: Frontend — Vite proxy for `/artistart` and `/albumart`

**Files:**
- Modify: `Volumio2-UI/vite.config.ts`

### Steps

- [ ] **Step 2.1: Verify the bug with curl (failing-test substitute)**

With `npm run dev` running:

```bash
curl -s "http://localhost:5173/artistart?name=test" | head -c 200
```

Expected (current behavior, bug): `<!doctype html><html lang="en">...` — Vite's SPA fallback HTML.

```bash
curl -sI "http://localhost:5173/artistart?name=test" | grep -i content-type
```

Expected (current behavior, bug): `content-type: text/html`.

Record this — it's the failing baseline that the fix must flip to `image/...` or a proxied response from the Pi backend.

- [ ] **Step 2.2: Add proxy config to vite.config.ts**

In `vite.config.ts`, modify the `server` block (currently lines 77-84) to:

```ts
import { defineConfig, loadEnv, type Plugin } from 'vite';
```

(Add `loadEnv` to the existing import on line 1.)

Wrap the config in a function so `loadEnv` is available, replacing the `export default defineConfig({...})` block (lines 66-85) with:

```ts
export default defineConfig(({ mode }) => {
  // Read RASPBERRY_PI_API_ADDRESS from .env so the dev server proxies
  // /artistart and /albumart to the Pi backend instead of serving the
  // SPA fallback HTML (which the browser then fails to decode as an
  // image). Same env var used by scripts/* for deploy.
  const env = loadEnv(mode, process.cwd(), '');
  const piHost = env.RASPBERRY_PI_API_ADDRESS || '192.168.86.221';
  const piBackend = `http://${piHost}:3000`;

  return {
    plugins: [svelte(), cspMetaTagPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    resolve: {
      alias: {
        '$lib': path.resolve('./src/lib'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      // Proxy backend asset endpoints to the Pi. Without this, relative
      // URLs like ArtistTile's /artistart?name=... resolve to Vite's SPA
      // fallback (200 HTML), and the browser errors out on the <img>.
      // /albumart is already routed via absolute URLs by fixVolumioAssetUrl,
      // but proxy it too so relative usage works as a fallback.
      proxy: {
        '/artistart': { target: piBackend, changeOrigin: true },
        '/albumart':  { target: piBackend, changeOrigin: true },
      },
      headers: {
        // Dev-mode CSP with unsafe-eval for Vite HMR
        'Content-Security-Policy': buildCspString(true),
      },
    },
  };
});
```

- [ ] **Step 2.3: Restart Vite dev server**

Stop the running `npm run dev` (Ctrl-C) and start it again:

```bash
cd Volumio2-UI
npm run dev
```

Vite config changes require a restart — HMR does not pick them up.

- [ ] **Step 2.4: Re-run the curl test — expect PASS**

```bash
curl -sI "http://localhost:5173/artistart?name=Jacob%20Collier" | head -5
```

Expected: response from the Pi backend — either `200` with `content-type: image/jpeg` (cached image), `302` (redirect to Deezer hotlink), or `404` (no image for this artist). Anything but `content-type: text/html` means the proxy is working.

```bash
curl -s "http://localhost:5173/artistart?name=Jacob%20Collier" -o /tmp/jc.bin
file /tmp/jc.bin
```

Expected: `JPEG image data` or similar (not `HTML document`).

- [ ] **Step 2.5: Manual visual verify on the LCD**

Reload the kiosk (`http://192.168.86.221:5173?layout=lcd`). Swipe up to ArtistsPage. Expected: **real artist images** in the tile circles for any artist the backend has enriched. Artists with no backend image still fall back to the letter avatar — that's correct behavior.

- [ ] **Step 2.6: Commit**

```bash
cd Volumio2-UI
git add vite.config.ts
git commit -m "$(cat <<'EOF'
fix(frontend): proxy /artistart and /albumart to Pi backend in dev server

ArtistTile.svelte builds a relative /artistart?name=... URL. Without a
Vite proxy, this resolves against the dev server, which returns the SPA's
index.html as 200/text-html for unknown routes. The browser then fires
the <img> error event for every tile -> imageFailed flips true -> every
artist falls back to its letter avatar, even when the backend has the
real image cached.

Add server.proxy for /artistart and /albumart, sourcing the Pi host from
RASPBERRY_PI_API_ADDRESS (already used by scripts/* for deploy). Falls
back to the hardcoded kiosk IP 192.168.86.221 when the env var is unset.

curl proof:
  before: content-type: text/html  (SPA fallback, breaks <img>)
  after:  content-type: image/jpeg (proxied through to Pi :3000)
EOF
)"
```

---

## Task 3: Frontend — ArtistsPage vertical centering on the LCD page

**Mid-execution re-scope (2026-05-13 evening, after Task 1 visual verify):** The original Task 3 targeted the artist-name label within each tile. The actual visible issue is page-level: on the 1920×440 LCD, `.artists-page` uses `padding: 20px 0 0 0` with no flex `justify-content`, so the header + strip stack against the top of the screen with empty space below. The within-tile name centering is no longer in scope.

User intent: vertically center the [header + tile strip] pair within the page so it sits in the middle of the LCD viewport.

**Files:**
- Modify: `Volumio2-UI/src/lib/components/redesign/ArtistsPage.svelte` (`.artists-page` CSS rule, ~line 63)

### Steps

- [ ] **Step 3.1: Update `.artists-page` CSS to vertically center its children**

In `Volumio2-UI/src/lib/components/redesign/ArtistsPage.svelte`, replace the `.artists-page` rule (lines 63-72) with:

```css
.artists-page {
    width: 100%;
    height: 100%;
    background: #050507;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    /* Vertically center the [header + strip] pair within the LCD viewport.
       Previously the page used padding: 20px 0 0 0 with no justify-content,
       so the strip stacked against the top of the 1920x440 LCD leaving
       most of the height empty below it. */
    justify-content: center;
    gap: 16px;
    padding: 0;
}
```

Leave `.artists-page-header`, `.artists-strip`, and the rest of the styles in `ArtistsPage.svelte` untouched.

- [ ] **Step 3.2: Run the ArtistsPage / LibraryView unit tests**

```bash
cd Volumio2-UI
npm run test:run src/lib/components/redesign/__tests__/ArtistsPage.test.ts src/lib/components/redesign/__tests__/LibraryView.test.ts
```

Expected: all tests pass. Existing assertions cover behavior (fetch + state branches + tap handler) not layout — the CSS change is invisible to them.

- [ ] **Step 3.3: Run the full test suite + type check**

```bash
cd Volumio2-UI
npx tsc --noEmit && npm run test:run
```

Expected: tsc exits 0; vitest reports 925 passed / 1 skipped (M2.C baseline).

- [ ] **Step 3.4: Manual visual verify on the LCD**

Reload the kiosk. Swipe up to ArtistsPage. The tile strip should now sit in the vertical middle of the LCD — no longer pinned to the top edge.

- [ ] **Step 3.5: Commit**

```bash
cd Volumio2-UI
git add src/lib/components/redesign/ArtistsPage.svelte
git commit -m "$(cat <<'EOF'
style(ArtistsPage): vertically center tile strip on the LCD viewport

.artists-page used padding: 20px 0 0 0 with no flex justify-content, so
on the 1920x440 LCD the header + tile strip stacked against the top edge
with most of the height empty below. Switch to justify-content: center
so the pair sits in the vertical middle of the page.

Caught by manual LCD smoke after Task 1 backend deploy.
EOF
)"
```

---

## Task 4: Frontend — Remove the artist-filter ✕ button from MetadataBlock

**Mid-execution addition (2026-05-13 evening):** Manual LCD smoke after Task 1 surfaced that the `.clear-filter` ✕ button on `MetadataBlock` leaks visually into `PlayerView` after the user plays a filtered album. Root cause: `MetadataBlock` is shared between `AlbumPage` (Library context) and `PlayerView`. It computes `isFiltered = $selectedArtist === artist` with no context-discrimination, so once an artist filter is active, every render of MetadataBlock that matches the current artist shows the ✕.

User direction: the ✕ is not needed anywhere — vertical-swipe-up to ArtistsPage already clears the filter (implicit `'albums' → 'artists'` subscriber in `library.ts`). Remove the ✕ entirely. The amber `is-filter-active` accent on the artist name stays as the visual filter signal.

**Files:**
- Modify: `Volumio2-UI/src/lib/components/redesign/MetadataBlock.svelte`
- Modify: `Volumio2-UI/src/lib/components/redesign/__tests__/MetadataBlock.test.ts`

### Steps

- [ ] **Step 4.1: Update failing tests first — remove ✕-button assertions**

In `MetadataBlock.test.ts`, find any test that asserts the presence, click behavior, or `clearArtistFilter` invocation of `data-testid="clear-artist-filter"` (or the `.clear-filter` selector). Either:
- Delete the test outright if it solely verifies ✕ behavior.
- Strip the ✕ assertions from a test that also covers other behavior.

Keep the test that asserts `.is-filter-active` amber accent is applied when `selectedArtist === artist` — that behavior is preserved.

- [ ] **Step 4.2: Run the test file to confirm it still passes pre-implementation**

```bash
cd Volumio2-UI
npm run test:run src/lib/components/redesign/__tests__/MetadataBlock.test.ts
```

Expected: PASS. The tests no longer reference the soon-to-be-deleted button.

- [ ] **Step 4.3: Remove the ✕ button + clear-filter import from MetadataBlock**

In `MetadataBlock.svelte`:
1. Delete the entire `{#if isFiltered}<button class="clear-filter" ...>✕</button>{/if}` block from the template.
2. Remove the now-unused `libraryActions` import if it's only used for `clearArtistFilter()`. Inspect the script section: if `libraryActions` has other usages, leave the import; otherwise remove it.
3. Remove the `.clear-filter` and `.clear-filter:hover, .clear-filter:focus-visible` CSS rules from `<style>`. Also remove any `@media (prefers-reduced-motion: reduce)` reference to `.clear-filter`.
4. Keep `.is-filter-active` (amber accent on the artist name) — that's the visual signal users still see.

Verify the template no longer contains the string `clear-filter` or the ✕ character via:
```bash
grep -n "clear-filter\|✕" src/lib/components/redesign/MetadataBlock.svelte
```
Expected: no matches.

- [ ] **Step 4.4: Run tests + type check**

```bash
cd Volumio2-UI
npx tsc --noEmit && npm run test:run
```

Expected: tsc exits 0; vitest reports 925 passed / 1 skipped (or fewer if you deleted a test outright in Step 4.1 — note the new total in the commit).

- [ ] **Step 4.5: Manual visual verify on the LCD**

1. Swipe up to ArtistsPage → tap an artist → AlbumsPage shows the filtered list with the artist name in **amber** (filter signal intact, no ✕).
2. Tap play → PlayerView shows the album metadata with **no ✕** anywhere.
3. Swipe up again from anywhere in Library → returns to ArtistsPage, filter implicitly cleared (existing behavior).

- [ ] **Step 4.6: Commit**

```bash
cd Volumio2-UI
git add src/lib/components/redesign/MetadataBlock.svelte src/lib/components/redesign/__tests__/MetadataBlock.test.ts
git commit -m "$(cat <<'EOF'
fix(MetadataBlock): remove artist-filter clear button to stop leak into PlayerView

MetadataBlock is shared between AlbumPage (Library context) and
PlayerView. The .clear-filter ✕ button rendered whenever
$selectedArtist === artist, with no context-discrimination — so playing
a filtered album surfaced the ✕ in PlayerView too.

Per user direction the ✕ is unnecessary anywhere: vertical-swipe-up to
ArtistsPage already clears the filter via the implicit
'albums' -> 'artists' subscriber in library.ts. The amber
.is-filter-active accent on the artist name stays as the visual filter
indicator.

Removes the button, its styles, and the corresponding ✕-button tests.

Caught by manual LCD smoke after Task 1 backend deploy.
EOF
)"
```

---

## Task 5: Backend — Stop wiping `artwork` table on cache rebuild + persist Fanart.tv saves

**Discovered mid-execution (2026-05-13 late evening, after Task 2 verify) via systematic-debugging.** Bug #1 ("artist images don't load") was originally diagnosed as a single root cause (Vite proxy missing). Task 2 fixed the frontend wiring; manual LCD verify then surfaced that the Pi backend was still returning 404 for every artist. The deeper cause is **three backend bugs working together:**

1. **`internal/infra/cache/sqlite.go:430`** — `Clear()` wipes the `artwork` table alongside MPD-derived tables on every cache rebuild, destroying all enrichment data.
2. **`internal/infra/enrichment/coordinator.go:CreateArtistSaveFunc` (~line 374)** — Fanart.tv save path writes the file to disk and calls `UpdateArtistArtwork(artistID, artworkID)` (which sets `artists.artwork_id`, a column that ALSO gets wiped by bug #1) but NEVER inserts into the `artwork` table.
3. (Deezer save path uses `UpdateArtistArtworkURL` which DOES insert into the `artwork` table, but bug #1 wipes those rows on the next cache rebuild.)

**Evidence captured during investigation:**
- 41 artist enrichment jobs marked `completed` in `enrichment_jobs`.
- 23 artist `.jpg` files in `~/stellar-backend/data/cache/artwork/artists/`.
- `SELECT COUNT(*) FROM artwork` returns **0**.
- `SELECT SUM(artwork_id != "") FROM artists` returns **0**.
- `GetArtworkByArtist` (`server.go:2365`) queries `artwork.artist_id` → empty result → 404.

**Why album covers DO work today (architectural gotcha):** the `/albumart?path=<track>` HTTP endpoint reads embedded art from MPD directly. It bypasses the `artwork` table entirely. Albums show fine in the UI even though the same wipe-on-rebuild bug affects them. Artists have no `path=` equivalent — the lookup MUST go through `artwork.artist_id`.

**Scope guard — explicitly NOT in this task:**
- Album parallel of bug #2 (`CreateSaveFunc` also doesn't insert artwork rows). Albums work in UI via the path-based bypass; symmetric fix is future cleanup.
- `artists.artwork_id` column maintenance. Not used by `GetArtworkByArtist`. Future cleanup.
- Orphan-artwork garbage collection (when an artist is renamed/removed from MPD, the artwork row referencing the old ID becomes orphan). Acceptable disk waste until GC is added.

**Files:**
- Modify: `stellar-volumio-audioplayer-backend/internal/infra/cache/sqlite.go:430`
- Modify: `stellar-volumio-audioplayer-backend/internal/infra/enrichment/coordinator.go` (`CreateArtistSaveFunc`, ~lines 374-379)
- Test: `stellar-volumio-audioplayer-backend/internal/infra/cache/sqlite_test.go` (add new test alongside existing `TestDBClear`)
- Test: `stellar-volumio-audioplayer-backend/internal/infra/enrichment/coordinator_test.go` (or appropriate location)
- One-time backfill via SSH (NOT committed)

### Steps

- [ ] **Step 5.1: Add failing test — `Clear()` preserves the `artwork` table**

In `internal/infra/cache/sqlite_test.go`, add after the existing `TestDBClear`:

```go
func TestDBClear_PreservesArtwork(t *testing.T) {
	db, cleanup := newTestDB(t)
	defer cleanup()

	dao := NewDAO(db)

	// Seed an artist + an artwork row.
	if err := dao.InsertArtist(&CachedArtist{ID: "artist1", Name: "Test Artist"}); err != nil {
		t.Fatalf("InsertArtist: %v", err)
	}
	if err := dao.InsertArtwork(&CachedArtwork{
		ID: "art1", ArtistID: "artist1", Type: "artist",
		FilePath: "/tmp/test.jpg", Source: "fanarttv",
	}); err != nil {
		t.Fatalf("InsertArtwork: %v", err)
	}

	if err := db.Clear(); err != nil {
		t.Fatalf("Clear: %v", err)
	}

	// Artists are MPD-derived and should be wiped (existing TestDBClear covers this).
	// Artwork is enrichment data and must survive.
	art, err := dao.GetArtworkByArtist("artist1")
	if err != nil {
		t.Fatalf("GetArtworkByArtist: %v", err)
	}
	if art == nil {
		t.Fatal("Artwork row was wiped by Clear() — should have been preserved (enrichment data, not MPD-derived)")
	}
	if art.FilePath != "/tmp/test.jpg" {
		t.Errorf("Artwork FilePath = %q, want /tmp/test.jpg", art.FilePath)
	}
}
```

Run: `cd stellar-volumio-audioplayer-backend && go test ./internal/infra/cache/ -run TestDBClear_PreservesArtwork -v`. Expected: **FAIL** with "Artwork row was wiped by Clear()…".

- [ ] **Step 5.2: Fix `sqlite.go:430` to exclude `artwork` from `Clear()`**

In `internal/infra/cache/sqlite.go`, replace the `tables` declaration in `Clear()`:

```go
tables := []string{"tracks", "albums", "artists", "artwork", "radio_stations"}
```

with:

```go
// Note: "artwork" is intentionally excluded — it's enrichment data
// (Fanart.tv / Deezer / Cover Art Archive), slow to rebuild and not
// derivable from MPD. Artist/album IDs are deterministic so artwork
// rows still resolve correctly after rebuild repopulates artists+albums.
// Orphan artwork rows (artist renamed/removed) are acceptable disk
// waste until GC is added separately.
tables := []string{"tracks", "albums", "artists", "radio_stations"}
```

Run: `go test ./internal/infra/cache/ -run TestDBClear -v`. Expected: both the original `TestDBClear` and the new `TestDBClear_PreservesArtwork` **PASS**.

- [ ] **Step 5.3: Add failing test — Fanart.tv save path inserts into artwork table**

The test exercises `CreateArtistSaveFunc` with a mock `ArtistProvider` and asserts `UpdateArtistArtworkURL` is called with the file path as the URL argument.

Find or create an appropriate `_test.go` file under `internal/infra/enrichment/`. If there's no existing mock for `ArtistProvider`, define a minimal one inline:

```go
type mockArtistProvider struct {
	updateArtworkURL func(artistID, url, source string) error
}

func (m *mockArtistProvider) GetArtistsWithoutArtwork() ([]Artist, error) { return nil, nil }
func (m *mockArtistProvider) UpdateArtistArtwork(artistID, artworkID string) error { return nil }
func (m *mockArtistProvider) UpdateArtistArtworkURL(artistID, url, source string) error {
	return m.updateArtworkURL(artistID, url, source)
}
func (m *mockArtistProvider) GetFirstAlbumArtwork(artistName string) (string, error) { return "", nil }

func TestCreateArtistSaveFunc_InsertsArtworkRecord(t *testing.T) {
	var capturedArtistID, capturedURL, capturedSource string
	mock := &mockArtistProvider{
		updateArtworkURL: func(artistID, url, source string) error {
			capturedArtistID, capturedURL, capturedSource = artistID, url, source
			return nil
		},
	}

	coord := &Coordinator{
		artistProvider: mock,
		cacheDir:       t.TempDir(),
	}

	saveFunc := coord.CreateArtistSaveFunc()
	if err := saveFunc("artist-id-123", &FetchResult{
		Data:     []byte("fake jpeg bytes"),
		MimeType: "image/jpeg",
	}); err != nil {
		t.Fatalf("saveFunc: %v", err)
	}

	if capturedArtistID != "artist-id-123" {
		t.Errorf("artistID = %q, want artist-id-123", capturedArtistID)
	}
	if !strings.HasSuffix(capturedURL, "/artwork/artists/artist-id-123.jpg") {
		t.Errorf("URL = %q, want suffix /artwork/artists/artist-id-123.jpg", capturedURL)
	}
	if capturedSource != "fanarttv" {
		t.Errorf("source = %q, want fanarttv", capturedSource)
	}
}
```

Run: `go test ./internal/infra/enrichment/ -run TestCreateArtistSaveFunc_InsertsArtworkRecord -v`. Expected: **FAIL** — current `CreateArtistSaveFunc` calls `UpdateArtistArtwork` (no -URL suffix) so `updateArtworkURL` is never invoked.

- [ ] **Step 5.4: Fix `CreateArtistSaveFunc` to use `UpdateArtistArtworkURL`**

In `internal/infra/enrichment/coordinator.go`, in `CreateArtistSaveFunc` (~line 374-379), replace:

```go
// Generate artwork ID and update artist
artworkID := generateArtworkID(artistID, "artist")
if c.artistProvider != nil {
	if err := c.artistProvider.UpdateArtistArtwork(artistID, artworkID); err != nil {
		log.Warn().Err(err).Str("artistID", artistID).Msg("Failed to update artist artwork")
	}
}
```

With:

```go
// Insert the artwork row in the cache so GetArtworkByArtist can find
// it. Reuse UpdateArtistArtworkURL — its name says "URL" but the schema
// stores the value in artwork.file_path, and the HTTP /artistart handler
// (server.go:GetArtistArtwork ~line 2385) reads either a URL (if
// file_path starts with "http") or a local file. Pass the absolute file
// path; the handler's prefix check routes to the file-read branch.
if c.artistProvider != nil {
	if err := c.artistProvider.UpdateArtistArtworkURL(artistID, filePath, "fanarttv"); err != nil {
		log.Warn().Err(err).Str("artistID", artistID).Msg("Failed to insert artist artwork record")
	}
}
```

Note the deliberate drop of the prior `UpdateArtistArtwork(artistID, artworkID)` call: it set `artists.artwork_id` to a deterministic hash but that column is (a) wiped by every cache rebuild and (b) not consulted by the HTTP lookup (`GetArtworkByArtist` queries `artwork.artist_id` directly). Keeping it would be dead writes.

Run: `go test ./internal/infra/enrichment/ -run TestCreateArtistSaveFunc_InsertsArtworkRecord -v`. Expected: **PASS**.

- [ ] **Step 5.5: Run full backend test suite for regressions**

```bash
cd /Users/eduardomarques/workspace/stellar-streamer/stellar-volumio-audioplayer-backend
make test
```

Expected: `ok` across all packages. Watch for any test that depends on `artists.artwork_id` being set — those would fail after step 5.4. If any do, decide whether to (a) restore the dropped `UpdateArtistArtwork` call alongside the new `UpdateArtistArtworkURL` call (cheap), or (b) update the test to assert the new contract (preferred).

- [ ] **Step 5.6: Commit**

```bash
cd /Users/eduardomarques/workspace/stellar-streamer/stellar-volumio-audioplayer-backend
git add internal/infra/cache/sqlite.go internal/infra/cache/sqlite_test.go internal/infra/enrichment/coordinator.go internal/infra/enrichment/coordinator_test.go
git commit -m "$(cat <<'EOF'
fix(enrichment): persist artwork across cache rebuilds + Fanart.tv saves

The artwork table is enrichment data (Fanart.tv / Deezer / Cover Art
Archive), slow to rebuild and not derivable from MPD. Two bugs were
working together to make artist images never appear in the UI:

1. cache.DB.Clear() listed "artwork" alongside MPD-derived tables
   (tracks, albums, artists, radio_stations), so every cache rebuild
   destroyed all enrichment data. Removed "artwork" from the wipe list.
   Artist/album IDs are deterministic, so artwork rows still resolve
   after rebuild repopulates artists+albums.

2. CreateArtistSaveFunc (Fanart.tv save path) wrote the .jpg to disk
   and updated artists.artwork_id but never inserted a row into the
   artwork table. The Deezer save path used UpdateArtistArtworkURL
   which DOES insert, but bug #1 wiped those rows on next rebuild.
   Replace the artists.artwork_id update with UpdateArtistArtworkURL
   (passing the absolute file path — the lookup at server.go:2385
   handles both http URLs and file paths).

GetArtworkByArtist queries artwork.artist_id directly, not
artists.artwork_id, so dropping the column-update has no functional
impact on the lookup path. artists.artwork_id maintenance is a separate
cleanup.

The album parallel of bug #2 (CreateSaveFunc not inserting artwork
rows) is left in place: /albumart?path=<track> reads MPD directly and
bypasses the artwork table, so album covers display correctly in the UI
today via that path. Symmetric fix for albums is future cleanup.

Caught by manual LCD smoke during the M2.C fix pass after Task 2
(Vite proxy) revealed the proxy wasn't the only thing breaking artist
images.
EOF
)"
```

- [ ] **Step 5.7: Backfill existing files on the Pi into the `artwork` table**

The 23 `.jpg` files already on disk need rows in the `artwork` table; otherwise nothing displays until each artist re-enriches (slow — rate-limited by MusicBrainz). One-time backfill via SSH:

```bash
cd /Users/eduardomarques/workspace/stellar-streamer/Volumio2-UI
source .env
SSH_CMD="sshpass -p '$RASPBERRY_PI_SSH_PASSWORD' ssh -o StrictHostKeyChecking=no $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"

# Stop backend first so no enrichment writes race with the backfill.
eval "$SSH_CMD 'sudo systemctl stop stellar-backend'"

# For each artist .jpg on disk, insert an artwork row. Filename (minus .jpg) IS the artist ID.
eval "$SSH_CMD 'cd ~/stellar-backend/data/cache/artwork/artists && for f in *.jpg; do
  artist_id=\"\${f%.jpg}\"
  sqlite3 ~/stellar-backend/data/library.db \"INSERT INTO artwork (id, artist_id, type, file_path, source, created_at) VALUES (\\\"\${artist_id}_artwork\\\", \\\"\${artist_id}\\\", \\\"artist\\\", \\\"/home/eduardo/stellar-backend/data/cache/artwork/artists/\${f}\\\", \\\"backfill\\\", datetime(\\\"now\\\")) ON CONFLICT(id) DO NOTHING;\"
done'"

# Verify count
eval "$SSH_CMD 'sqlite3 ~/stellar-backend/data/library.db \"SELECT COUNT(*) FROM artwork;\"'"
```

Expected output: ~23 (one row per file on disk). The backend will get restarted in Step 5.8.

- [ ] **Step 5.8: Build + deploy backend to Pi**

**Note the `.env` workaround:** `STELLAR_BACKEND_FOLDER` in `Volumio2-UI/.env` is stale (points to the pre-reorg location `~/workspace/stellar-volumio-audioplayer-backend/`). Override locally:

```bash
cd /Users/eduardomarques/workspace/stellar-streamer/Volumio2-UI
source .env
STELLAR_BACKEND_FOLDER=/Users/eduardomarques/workspace/stellar-streamer/stellar-volumio-audioplayer-backend
SSH_CMD="sshpass -p '$RASPBERRY_PI_SSH_PASSWORD' ssh -o StrictHostKeyChecking=no $RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS"

cd "$STELLAR_BACKEND_FOLDER"
CGO_ENABLED=1 CC=aarch64-linux-musl-gcc GOOS=linux GOARCH=arm64 \
  go build -ldflags='-linkmode external -extldflags "-static"' -o stellar-arm64 ./cmd/stellar
sshpass -p "$RASPBERRY_PI_SSH_PASSWORD" scp stellar-arm64 "$RASPBERRY_PI_SSH_USERNAME@$RASPBERRY_PI_API_ADDRESS:~/stellar-backend/stellar"
eval "$SSH_CMD 'chmod +x ~/stellar-backend/stellar && sudo systemctl start stellar-backend'"
sleep 3
eval "$SSH_CMD 'sudo systemctl status stellar-backend --no-pager | head -10'"
```

- [ ] **Step 5.9: Manual visual verify on the LCD**

1. Reload the kiosk (`http://192.168.86.221:5173?layout=lcd`).
2. Swipe up to ArtistsPage.
3. **Expected**: ~23 tiles show real artist images (the ones whose files were on disk before the backfill). The rest still show letter avatars (no image was ever fetched for them; the backend will retry on next enrichment cycle).
4. Trigger a fresh cache rebuild from DevTools: `window.libraryActions.rebuildCache()`.
5. Wait for the rebuild to complete (watch backend logs for "Cache build complete").
6. Re-check `SELECT COUNT(*) FROM artwork` via SSH — should still be ~23 (NOT 0).
7. Reload kiosk. **Expected**: the same tiles still show real images.

If the count drops to 0 after rebuild, Step 5.2 didn't take effect → re-investigate.

---

## Wrap-up

- [ ] **Final: Push all commits**

Three commits expected:
- 1 on `stellar-volumio-audioplayer-backend/main` (Task 1)
- 2 on `Volumio2-UI/master` (Tasks 2 + 3)

```bash
cd stellar-volumio-audioplayer-backend && git push origin main
cd ../Volumio2-UI                       && git push origin master
```

- [ ] **Final: Update project memory**

Append to `~/MemPalace/vault/Projects/stellar-streamer.md` Last Context Switch:
- Today: M2.C three-bug fix pass (artist images / filtered cover / wrong-album play / name centering). Backend `GetArtistAlbums` now returns full Album records; Vite proxies `/artistart` + `/albumart`; ArtistTile name vertically centered.
- Next: M1.A backend portability layer.

---

## Self-Review

**Spec coverage:**
- Symptom 1 (no artist images) → Task 2 ✓
- Symptom 2 (no album cover when filtering) → Task 1 ✓
- Symptom 3 (wrong album plays) → Task 1 (same root cause as #2) ✓
- Symptom 4 (name centering) → Task 3 ✓

**Placeholder scan:** No TODOs, no "implement later", no vague "add validation" — every code block is concrete and copy-pasteable.

**Type consistency:** `Album` struct fields used in Task 1 match types.go:38-51 exactly (`URI`, `AlbumArt`, `TrackCount`, `Quality`, `TrackType`, `Genre`, `Source` of type `SourceType`). No naming drift.

**Risks:**
- Task 1 step 1.6 may surface mock-shape failures in other test files (e.g. `cached_service_test.go`, `library_handlers_test.go`). The plan notes how to patch them on the fly. If many tests break, that's a signal the original implementation's API contract was weaker than callers assumed — fix the mocks, don't roll back.
- Task 2's `loadEnv` requires Vite ≥ 2.0 (we're on 7). Safe.
- Task 3's `min-height: 20px` could clip a 14px label on systems with weird font-metrics; if so, drop it and accept variable row heights.
