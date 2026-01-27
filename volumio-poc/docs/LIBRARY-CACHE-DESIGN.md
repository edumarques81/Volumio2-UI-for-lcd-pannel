# MPD Library Cache Design Document

## 1. Research Findings

### 1.1 MPD Database Characteristics

**Location & Format:**
- Database stored at path specified by `db_file` or `database { }` block in `mpd.conf`
- Common locations: `/var/lib/mpd/mpd.db`, `~/.config/mpd/database`
- Format is intentionally undocumented (changes frequently)
- **Critical insight:** MPD loads database entirely into memory on startup - queries are fast

**Update Detection:**
- `idle database` - fires when database is modified after an update
- `idle update` - fires when update starts/finishes
- MPD 0.24+ adds `added` timestamp for recently added tracks

### 1.2 Efficient MPD Commands

| Command | Use Case | Performance |
|---------|----------|-------------|
| `list album group albumartist` | Get unique albums | Single query, very fast |
| `list albumartist` | Get unique artists | Single query, very fast |
| `find "(album == X)"` | Get album tracks | Single query |
| `search base <path>` | Filter by storage | Scans base path only |
| `... window 0:50` | Pagination | Server-side limit |
| `... sort -added` | Recently added (0.24+) | Sorted result |

**Commands to AVOID:**
- `listall` - returns all file paths, slow
- `listallinfo` - returns all metadata, extremely slow

### 1.3 Artwork Commands (MPD 0.21+)

| Command | MPD Version | Description |
|---------|-------------|-------------|
| `albumart <uri>` | 0.21+ | Folder-based art (cover.jpg, folder.jpg) |
| `readpicture <uri>` | 0.22+ | Embedded art from audio file tags |

### 1.4 Current Performance Issues

**Backend N+1 Query Problems:**
1. `GetArtists()` - queries albums for each artist to get album count
2. `GetRadioStations()` - queries playlist info for each radio playlist
3. `GetAlbumDetails()` - full database scan per base path, uncached

**No Caching:**
- Backend: No result caching between requests
- Frontend: No client-side caching, every mount triggers fetch

### 1.5 Metadata Enrichment Services

| Service | Rate Limit | API Key | Best For |
|---------|------------|---------|----------|
| Cover Art Archive | No limit | None | Album covers (via MusicBrainz ID) |
| MusicBrainz | 1 req/sec | None (user-agent required) | Album/artist metadata |
| Last.fm | ~1 req/sec | Required (free) | Artist images |
| fanart.tv | Unlimited (mostly) | Required | High-quality artist art |
| TheAudioDB | 2 req/sec | Optional | Mixed metadata |

**Recommendation:** Start with Cover Art Archive (free, no rate limits) for album art.

---

## 2. Architecture Decision

### 2.1 Design Principles

1. **MPD remains the canonical source** - we cache, not replace
2. **Cache invalidation via idle events** - subscribe to `idle database`
3. **Graceful degradation** - if cache miss, query MPD directly then backfill
4. **Progressive enhancement** - show cached data immediately, enrich later

### 2.2 Cache Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (Svelte)                          │
│  ┌─────────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│  │  Library Store  │   │ In-Memory Cache │   │ LocalStorage   │  │
│  │  (Reactive)     │◄──│ (LRU, 5min TTL) │   │ (Preferences)  │  │
│  └────────┬────────┘   └────────┬────────┘   └────────────────┘  │
│           │                     │                                 │
│           ▼                     ▼                                 │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              Socket.IO Client                                 ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                              │ WebSocket
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Backend (Go/Stellar)                         │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                  Socket.IO Server                             ││
│  └──────────────────────────────────────────────────────────────┘│
│           │                                                       │
│           ▼                                                       │
│  ┌─────────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│  │ Library Service │◄──│  Cache Service  │◄──│ SQLite DB      │  │
│  │ (Business Logic)│   │  (Query Cache)  │   │ (Persistent)   │  │
│  └────────┬────────┘   └────────┬────────┘   └────────────────┘  │
│           │                     │                                 │
│           ▼                     ▼                                 │
│  ┌─────────────────┐   ┌─────────────────┐   ┌────────────────┐  │
│  │   MPD Client    │   │ Artwork Service │   │ Disk Cache     │  │
│  │ (Protocol)      │   │ (Resolver)      │   │ (Images)       │  │
│  └─────────────────┘   └─────────────────┘   └────────────────┘  │
│           │                     │                                 │
│           ▼                     ▼                                 │
│  ┌─────────────────┐   ┌─────────────────┐                       │
│  │      MPD        │   │ External APIs   │                       │
│  │  (localhost:6600)│  │ (MusicBrainz)   │                       │
│  └─────────────────┘   └─────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Cache Layers

**Layer 1: SQLite Database (Backend)**
- Persistent across restarts
- Stores: albums, artists, tracks, artwork metadata
- Indexed for fast queries
- Updated via MPD idle events

**Layer 2: In-Memory LRU (Backend)**
- Hot path optimization
- Stores: recent query results
- TTL: 5 minutes
- Evicted on memory pressure or idle database event

**Layer 3: In-Memory Cache (Frontend)**
- Stores: last N pages of results per view
- TTL: 2 minutes
- Evicted on library:cache:updated event

---

## 3. Socket.IO / WebSocket Contracts

### 3.1 Existing Events (No Changes)

| Event | Direction | Payload |
|-------|-----------|---------|
| `library:albums:list` | Client→Server | `{ scope, sort, query, page, limit }` |
| `pushLibraryAlbums` | Server→Client | `{ albums[], pagination }` |
| `library:artists:list` | Client→Server | `{ query, page, limit }` |
| `pushLibraryArtists` | Server→Client | `{ artists[], pagination }` |
| `library:artist:albums` | Client→Server | `{ artist, sort, page, limit }` |
| `pushLibraryArtistAlbums` | Server→Client | `{ artist, albums[], pagination }` |
| `library:album:tracks` | Client→Server | `{ album, albumArtist }` |
| `pushLibraryAlbumTracks` | Server→Client | `{ tracks[], totalDuration }` |
| `library:radio:list` | Client→Server | `{ query, page, limit }` |
| `pushLibraryRadio` | Server→Client | `{ stations[], pagination }` |

### 3.2 New Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `library:cache:updated` | Server→Client | `{ timestamp, albumCount, artistCount, updateDuration }` | Fired after cache rebuild |
| `library:cache:status` | Client→Server | `{}` | Request cache status |
| `pushLibraryCacheStatus` | Server→Client | `{ lastUpdated, albumCount, artistCount, artworkCached, isBuilding }` | Cache statistics |
| `library:cache:rebuild` | Client→Server | `{}` | Force cache rebuild |
| `library:artwork:get` | Client→Server | `{ albumId }` | Request artwork URL |
| `pushLibraryArtwork` | Server→Client | `{ albumId, url, width, height, source }` | Artwork metadata |

### 3.3 Enhanced Payloads

**Album (enhanced):**
```typescript
interface Album {
  id: string;           // MD5(albumArtist + album)
  title: string;
  artist: string;       // Album artist
  uri: string;          // Directory path
  albumArt: string;     // Cached artwork URL
  albumArtSource: 'cache' | 'mpd' | 'web' | 'placeholder';
  trackCount: number;
  totalDuration: number; // seconds
  source: 'local' | 'usb' | 'nas' | 'streaming';
  year?: number;
  addedAt?: string;     // ISO timestamp
  lastPlayed?: string;  // ISO timestamp
}
```

**CacheStatus:**
```typescript
interface CacheStatus {
  lastUpdated: string;  // ISO timestamp
  albumCount: number;
  artistCount: number;
  trackCount: number;
  artworkCached: number;
  artworkMissing: number;
  isBuilding: boolean;
  buildProgress?: number; // 0-100
}
```

---

## 4. Database Schema (SQLite)

### 4.1 Tables

```sql
-- Albums table
CREATE TABLE albums (
    id TEXT PRIMARY KEY,           -- MD5(album_artist || album)
    title TEXT NOT NULL,
    album_artist TEXT NOT NULL,
    uri TEXT NOT NULL,             -- Directory path
    track_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0, -- seconds
    source TEXT NOT NULL,          -- 'local', 'usb', 'nas', 'streaming'
    year INTEGER,
    added_at TEXT,                 -- ISO timestamp from MPD or file mtime
    last_played TEXT,
    artwork_id TEXT,               -- FK to artwork
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Artists table
CREATE TABLE artists (
    id TEXT PRIMARY KEY,           -- MD5(name)
    name TEXT NOT NULL UNIQUE,
    album_count INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    artwork_id TEXT,               -- FK to artwork (artist image)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tracks table (for quick album track lookup)
CREATE TABLE tracks (
    id TEXT PRIMARY KEY,           -- MD5(uri)
    album_id TEXT NOT NULL,        -- FK to albums
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    uri TEXT NOT NULL UNIQUE,      -- File path
    track_number INTEGER,
    disc_number INTEGER DEFAULT 1,
    duration INTEGER DEFAULT 0,    -- seconds
    source TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- Artwork cache metadata
CREATE TABLE artwork (
    id TEXT PRIMARY KEY,           -- MD5(album_artist || album || type)
    album_id TEXT,                 -- NULL for artist images
    artist_id TEXT,                -- NULL for album art
    type TEXT NOT NULL,            -- 'album', 'artist'
    file_path TEXT,                -- Local cache path
    source TEXT NOT NULL,          -- 'mpd', 'embedded', 'folder', 'musicbrainz', 'lastfm'
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    checksum TEXT,                 -- MD5 of image data
    fetched_at TEXT,
    expires_at TEXT,               -- For web-fetched images
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Radio stations
CREATE TABLE radio_stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    uri TEXT NOT NULL,             -- Stream URL
    icon TEXT,
    genre TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Cache metadata
CREATE TABLE cache_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Indexes

```sql
-- Album queries
CREATE INDEX idx_albums_artist ON albums(album_artist);
CREATE INDEX idx_albums_source ON albums(source);
CREATE INDEX idx_albums_year ON albums(year);
CREATE INDEX idx_albums_added ON albums(added_at DESC);
CREATE INDEX idx_albums_title ON albums(title COLLATE NOCASE);

-- Artist queries
CREATE INDEX idx_artists_name ON artists(name COLLATE NOCASE);

-- Track queries
CREATE INDEX idx_tracks_album ON tracks(album_id);
CREATE INDEX idx_tracks_artist ON tracks(artist COLLATE NOCASE);

-- Artwork queries
CREATE INDEX idx_artwork_album ON artwork(album_id);
CREATE INDEX idx_artwork_artist ON artwork(artist_id);
CREATE INDEX idx_artwork_expires ON artwork(expires_at);
```

### 4.3 Schema Version

```sql
INSERT INTO cache_meta (key, value) VALUES ('schema_version', '1');
INSERT INTO cache_meta (key, value) VALUES ('last_full_build', NULL);
INSERT INTO cache_meta (key, value) VALUES ('mpd_db_updated', NULL);
```

---

## 5. Artwork + Enrichment Strategy

### 5.1 Artwork Resolution Order

1. **Check cache** - artwork table + file on disk
2. **MPD albumart** - `albumart <first_track_uri>` (folder-based: cover.jpg, etc.)
3. **MPD readpicture** - `readpicture <first_track_uri>` (embedded in audio file)
4. **MusicBrainz/CAA** - If MBID available in tags, fetch from Cover Art Archive
5. **Placeholder** - Return placeholder image URL

### 5.2 Artwork Caching

**Cache Directory:** `$DATA_DIR/cache/artwork/`
- Albums: `albums/<album_id>.jpg`
- Artists: `artists/<artist_id>.jpg`
- Thumbnails: `thumbs/<id>_<size>.jpg` (150px, 300px)

**Cache TTL:**
- Local sources (MPD, folder): Never expires
- Web sources (CAA, Last.fm): 30 days

### 5.3 Enrichment Subsystem

**Configuration:**
```yaml
enrichment:
  enabled: false  # Disabled by default
  providers:
    cover_art_archive:
      enabled: true
      rate_limit: 1  # req/sec
    lastfm:
      enabled: false
      api_key: ""
      rate_limit: 1  # req/sec
  background_worker:
    enabled: true
    batch_size: 10
    interval: 60  # seconds between batches
```

**Job Queue:**
- Priority: missing album art > missing artist images
- Retry: 3 attempts with exponential backoff
- Failure: mark as "fetch_failed", retry after 24h

---

## 6. TDD Task Breakdown

### M1: MPD Capability Detection (Backend)

**Tests First:**
1. `TestMPDClient_DetectAlbumArtSupport` - mock MPD response
2. `TestMPDClient_DetectReadPictureSupport` - mock MPD response
3. `TestMPDClient_IdleSubscription` - verify idle event handling
4. `TestMPDClient_ListAlbumsGrouped` - verify efficient query

**Implementation:**
1. Add `DetectCapabilities()` method to MPD client
2. Add `SubscribeIdle(subsystems ...string)` method
3. Optimize `ListAlbums()` to use `list album group albumartist`

### M2: SQLite Cache (Backend)

**Tests First:**
1. `TestCacheDB_CreateSchema` - schema creation
2. `TestCacheDB_MigrateSchema` - version upgrades
3. `TestCacheDAO_InsertAlbum` - CRUD operations
4. `TestCacheDAO_QueryAlbums` - filtering + pagination
5. `TestCacheBuilder_FullBuild` - sync from MPD
6. `TestCacheBuilder_IncrementalUpdate` - partial sync

**Implementation:**
1. Create `internal/infra/cache/sqlite.go`
2. Create `internal/infra/cache/dao.go`
3. Create `internal/domain/library/cache_builder.go`

### M3: Artwork Pipeline (Backend)

**Tests First:**
1. `TestArtworkResolver_CacheHit` - return cached
2. `TestArtworkResolver_MPDAlbumArt` - fetch from MPD
3. `TestArtworkResolver_MPDReadPicture` - fetch embedded
4. `TestArtworkResolver_SaveToCache` - write to disk
5. `TestArtworkResolver_Thumbnail` - generate thumbnail

**Implementation:**
1. Create `internal/domain/artwork/resolver.go`
2. Create `internal/domain/artwork/cache.go`
3. Create `internal/domain/artwork/thumbnail.go`

### M4: Web Enrichment (Backend)

**Tests First:**
1. `TestCAA_FetchAlbumArt` - mock HTTP, verify request format
2. `TestCAA_RateLimiting` - verify 1 req/sec limit
3. `TestEnrichmentWorker_ProcessQueue` - batch processing
4. `TestEnrichmentWorker_Retry` - exponential backoff

**Implementation:**
1. Create `internal/infra/enrichment/caa.go`
2. Create `internal/infra/enrichment/worker.go`
3. Create `internal/infra/enrichment/queue.go`

### M5: Frontend Integration

**Tests First:**
1. `library.test.ts` - cache hit/miss behavior
2. `library.test.ts` - cache invalidation on event
3. `library.test.ts` - progressive artwork loading

**Implementation:**
1. Add `LibraryCache` class with LRU + TTL
2. Update `libraryActions` to check cache first
3. Add `library:cache:updated` listener

### M6: Functional Tests

**Tests:**
1. `e2e/library-cache.spec.ts` - full flow test
2. `e2e/library-performance.spec.ts` - timing assertions
3. Integration test: MPD update → cache rebuild → UI update

---

## 7. Functional Test Plan

### 7.1 Local Tests (Mac/CI)

```bash
# Unit tests
cd stellar-volumio-audioplayer-backend
go test ./internal/infra/cache/... -v
go test ./internal/domain/artwork/... -v
go test ./internal/domain/library/... -v

# Frontend unit tests
cd volumio-poc
npm run test:run src/lib/stores/__tests__/library.test.ts
```

### 7.2 Pi Integration Tests

```bash
# SSH into Pi
source .env && eval "$SSH_CMD"

# Check cache database
sqlite3 /home/volumio/stellar-backend/data/library.db ".tables"
sqlite3 /home/volumio/stellar-backend/data/library.db "SELECT COUNT(*) FROM albums"

# Check artwork cache
ls -la /home/volumio/stellar-backend/data/cache/artwork/albums/ | wc -l

# Trigger cache rebuild and measure time
curl -X POST http://localhost:3000/api/library/cache/rebuild
time curl http://localhost:3000/api/library/albums?limit=50

# Verify idle event subscription
journalctl -u stellar-backend -f | grep -i "idle\|database"
# Then run: mpc update
```

### 7.3 Performance Assertions

| Metric | Target | Measurement |
|--------|--------|-------------|
| Album list (cached, 50 items) | < 50ms | Socket.IO roundtrip |
| Album list (cold, 50 items) | < 500ms | First load after restart |
| Full cache rebuild (1000 albums) | < 10s | Background task |
| Artwork resolve (cached) | < 10ms | File read |
| Artwork resolve (MPD) | < 200ms | MPD command |

---

## 8. Pi Setup/Boot Changes

### 8.1 New Dependencies

```bash
# No new apt packages - Go's SQLite uses CGO with embedded SQLite
# But ensure CGO is enabled for Pi build

# Build command (cross-compile)
CGO_ENABLED=1 CC=aarch64-linux-gnu-gcc GOOS=linux GOARCH=arm64 \
  go build -o stellar-arm64 ./cmd/stellar
```

### 8.2 Directory Structure

```bash
# Add to scripts/pi-setup/create-directories.sh
mkdir -p /home/volumio/stellar-backend/data/cache/artwork/albums
mkdir -p /home/volumio/stellar-backend/data/cache/artwork/artists
mkdir -p /home/volumio/stellar-backend/data/cache/artwork/thumbs
chown -R volumio:volumio /home/volumio/stellar-backend/data
```

### 8.3 Configuration

```yaml
# Add to configs/stellar.yaml
library_cache:
  enabled: true
  db_path: "/home/volumio/stellar-backend/data/library.db"
  artwork_cache_dir: "/home/volumio/stellar-backend/data/cache/artwork"
  rebuild_on_startup: true
  rebuild_on_mpd_update: true

enrichment:
  enabled: false  # User can enable if desired
```

### 8.4 Systemd Service (No Changes Needed)

The existing `stellar-backend.service` will work as-is. The cache is initialized on startup.

---

## 9. Documentation Updates

### 9.1 CLAUDE.md Additions

Add to "Socket.IO Events (Stellar Backend)" section:
- New cache events
- Enhanced Album type

Add new section "Library Cache System":
- Architecture overview
- Cache invalidation strategy
- Artwork resolution order
- How to rebuild cache manually

### 9.2 README.md Additions

Add to "Features":
- Persistent library cache for fast browsing
- Automatic artwork caching
- Optional web metadata enrichment

Add "Configuration" section:
- Cache settings in stellar.yaml
- Enrichment provider setup (if enabled)

---

## 10. Version Bump + Commit Plan

### Version: 1.2.0 → 1.3.0 (MINOR)

**Rationale:** New feature (library cache) that is backward compatible. No breaking changes to existing Socket.IO contracts.

### Commits

**Backend commits (stellar-volumio-audioplayer-backend):**
1. `feat(cache): add SQLite library cache infrastructure`
2. `feat(cache): implement cache builder from MPD`
3. `feat(artwork): add artwork resolver with multi-source fallback`
4. `feat(enrichment): add Cover Art Archive provider`
5. `feat(library): integrate cache into library service`
6. `test(cache): add unit and integration tests`
7. `docs: update configuration and deployment docs`
8. `chore(release): bump version to 1.3.0`

**Frontend commits (Volumio2-UI):**
1. `feat(library): add client-side cache layer`
2. `feat(library): add cache status indicators`
3. `feat(library): handle cache update events`
4. `test(library): add cache integration tests`
5. `docs: update CLAUDE.md with cache architecture`
6. `chore(release): bump version to 1.3.0`

### CHANGELOG Entry

```markdown
## [1.3.0] - 2026-01-27

### Added
- Persistent SQLite cache for library metadata (albums, artists, tracks)
- Automatic artwork caching with multi-source resolution
- MPD idle event subscription for automatic cache invalidation
- Optional web metadata enrichment via Cover Art Archive
- New Socket.IO events: library:cache:updated, library:cache:status
- Client-side LRU cache for faster UI rendering

### Changed
- Library queries now served from cache (10x faster for large libraries)
- Album artwork served from disk cache instead of re-querying MPD

### Performance
- Album list load time: ~500ms → ~50ms (cached)
- Artist list load time: ~2s → ~100ms (N+1 query eliminated)
- Full cache rebuild: <10s for 1000 albums
```
