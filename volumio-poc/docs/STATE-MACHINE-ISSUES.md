# Volumio State Machine Issues & Improved Architecture

## Problem Summary

During development, we discovered critical issues with Volumio3-backend's state machine that caused playback to fail silently while reporting success.

## Issue Details

### Symptoms Observed

1. **Play command returns success but no audio plays**
   ```
   curl "http://localhost:3000/api/v1/commands/?cmd=play&N=0"
   {"time":1768996865131,"response":"play Success"}
   ```
   But MPD status shows nothing playing and Volumio reports `status: "stop"`.

2. **State desynchronization between MPD and Volumio**
   - MPD: Playing track #1 at 0:52
   - Volumio: Reports "stop", wrong track, stale seek position

3. **Silent failure in clearAddPlayTracks**
   ```
   ControllerMpd::clearAddPlayTracks INTERNAL/Music/...
   ControllerMpd::sendMpdCommand stop
   [END OF LOGS - no clear, add, or play commands]
   ```

4. **Time/seek data unit mismatch**
   - `seek`: In milliseconds (e.g., 46279 = 46 seconds)
   - `duration`: In seconds (e.g., 344 = 5:44)
   - Progress calculation: `(46279 / 344) * 100 = 13,453%` (broken!)

### Root Cause Analysis

The Volumio3-backend uses a complex state machine (`statemachine.js`, ~1500 lines) with:

1. **Recursive play logic**
   ```javascript
   // First call: play(5)
   if (index !== undefined) {
     return self.stop()
       .then(function () {
         self.currentPosition = index;
         return self.play();  // RECURSIVE - play() with no args
       });
   }
   ```

2. **Multiple state modes**
   - Normal mode: State from MPD
   - Volatile mode: External services (Spotify Connect)
   - Consume mode: UPnP/DLNA playback

3. **Promise chain fragility**
   - `clearAddPlayTracks` uses chained promises: stop → clear → add → play
   - If any step fails silently, the chain breaks
   - No error propagation or recovery

4. **State caching without validation**
   - Volumio caches state separately from MPD
   - Can become stale if MPD state changes externally
   - No periodic reconciliation with MPD

### Triggering Conditions

The state machine corruption was triggered by:
- Direct MPD commands (`mpc play`) bypassing Volumio
- Rapid play/pause commands
- Network interruptions during promise chains
- Race conditions between state updates

### Recovery

Only a full service restart fixed the corrupted state:
```bash
sudo systemctl restart volumio
```

---

## Why This Architecture is Problematic

### 1. Dual Source of Truth

```
┌─────────────┐         ┌─────────────┐
│   Volumio   │   !=    │     MPD     │
│ State Cache │         │ Actual State│
└─────────────┘         └─────────────┘
```

Volumio maintains its own state cache that can diverge from MPD's actual state.

### 2. Complex State Transitions

The state machine handles too many concerns:
- Playback control
- Volatile service management (Spotify)
- Consume mode (UPnP)
- Plugin coordination
- Error recovery (poorly)

### 3. Silent Failures

Promise chains fail silently without proper error handling:
```javascript
return self.sendMpdCommand('stop', [])
  .then(() => self.sendMpdCommand('clear', []))  // If this fails...
  .then(() => self.sendMpdCommand('add', [...]))  // ...this never runs
  .then(() => self.sendMpdCommand('play', []));   // ...neither does this
```

### 4. No State Reconciliation

If state becomes corrupted, there's no mechanism to detect or fix it automatically.

---

## Improved Architecture: MPD as Single Source of Truth

### Design Principles

1. **MPD owns the state** - Never cache state separately
2. **Event-driven updates** - Subscribe to MPD's idle events
3. **Stateless command handling** - Commands go to MPD, responses come back
4. **Fail-fast with recovery** - Errors are detected and handled

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     WebSocket Clients                        │
│              (multiple UIs can connect)                      │
└─────────────────────────────────────────────────────────────┘
                              ↑ pushState broadcasts
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Go Backend                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Event Loop                          │   │
│  │                                                       │   │
│  │  1. MPD idle watcher detects change                  │   │
│  │  2. Fetch fresh state from MPD                       │   │
│  │  3. Broadcast to all WebSocket clients               │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Commands: play/pause/stop/seek → Direct to MPD            │
│            (no state machine, no caching)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         MPD                                  │
│               (Single Source of Truth)                       │
│                                                              │
│  - Maintains actual playback state                          │
│  - Handles all audio playback                               │
│  - Provides idle notification system                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Pattern

```go
// Simple state struct - just a view of MPD state
type PlayerState struct {
    Status     string
    Position   int
    SeekMs     int64  // Always in milliseconds
    DurationMs int64  // Always in milliseconds (consistent units!)
    Title      string
    Artist     string
    // ... other fields
}

// Event-driven state updates
func (s *Service) watchMPD(ctx context.Context) {
    for {
        // Block until MPD reports a change
        subsystems, err := s.mpd.Idle("player", "mixer", "playlist", "options")
        if err != nil {
            s.handleError(err)
            continue
        }

        // Fetch FRESH state from MPD (never use cached values)
        state, err := s.fetchStateFromMPD()
        if err != nil {
            s.handleError(err)
            continue
        }

        // Broadcast to all connected clients
        s.broadcast("pushState", state)
    }
}

// Stateless command handling - just pass through to MPD
func (s *Service) handlePlay(index *int) error {
    if index != nil {
        return s.mpd.Play(*index)
    }
    return s.mpd.Play(-1)
}

// Errors are detected and handled, not silently ignored
func (s *Service) handleError(err error) {
    log.Error().Err(err).Msg("MPD communication error")
    s.broadcast("pushError", map[string]string{"message": err.Error()})

    // Attempt recovery
    s.reconnectMPD()
}
```

### Benefits

| Aspect | Volumio3 State Machine | MPD as Source of Truth |
|--------|------------------------|------------------------|
| Lines of code | ~1500 | ~200 |
| State consistency | Can diverge | Always correct |
| Error handling | Silent failures | Explicit errors |
| Recovery | Manual restart | Automatic reconnect |
| Complexity | High (3 modes) | Low (1 mode) |
| Testing | Difficult | Easy (mock MPD) |

### Consistent Time Units

Always use the same unit for time values:

```go
type PlayerState struct {
    SeekMs     int64 `json:"seek"`     // Milliseconds
    DurationMs int64 `json:"duration"` // Milliseconds
}

// OR convert to seconds consistently
type PlayerState struct {
    SeekSec     float64 `json:"seek"`     // Seconds with decimal
    DurationSec float64 `json:"duration"` // Seconds with decimal
}
```

Never mix units like Volumio does (seek in ms, duration in sec).

---

## Frontend Considerations

### Client-Side Seek Interpolation

Since MPD/backend only pushes state periodically, the frontend should interpolate seek position:

```typescript
// Update seek every second while playing
let seekInterval: number | null = null;

function startSeekInterpolation() {
  if (seekInterval) return;

  seekInterval = setInterval(() => {
    if (isPlaying && seek < duration) {
      seek += 1; // Add 1 second
    }
  }, 1000);
}

function stopSeekInterpolation() {
  if (seekInterval) {
    clearInterval(seekInterval);
    seekInterval = null;
  }
}

// On pushState, reset seek and restart interpolation if playing
function onPushState(state) {
  seek = state.seek / 1000; // Convert ms to seconds
  duration = state.duration;

  if (state.status === 'play') {
    startSeekInterpolation();
  } else {
    stopSeekInterpolation();
  }
}
```

### Optimistic UI Updates

For responsive feel, update UI immediately while waiting for confirmation:

```typescript
function handlePlayPause() {
  if (isPlaying) {
    // Optimistic: show paused immediately
    localStatus = 'pause';
    socket.emit('pause');
  } else {
    // Optimistic: show playing immediately
    localStatus = 'play';
    socket.emit('play');
  }
  // pushState will confirm or correct
}
```

---

## Migration Path

1. **Phase 1**: Fix frontend issues (unit conversion, interpolation) ✓
2. **Phase 2**: Create Go backend with MPD-as-truth pattern
3. **Phase 3**: Run Go backend alongside Volumio for testing
4. **Phase 4**: Switch frontend to Go backend
5. **Phase 5**: Remove Volumio dependency

---

## References

- [Volumio3-backend statemachine.js](https://github.com/volumio/volumio3-backend/blob/master/app/statemachine.js)
- [MPD Protocol Documentation](https://mpd.readthedocs.io/en/latest/protocol.html)
- [MPD Idle Command](https://mpd.readthedocs.io/en/latest/protocol.html#command-idle)
- [Stellar Backend Architecture](../../stellar-volumio-audioplayer-backend/docs/ARCHITECTURE.md)
