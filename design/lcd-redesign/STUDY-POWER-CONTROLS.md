# Study: Pi Shutdown & LCD Off Controls

**Date:** 2026-03-29  
**Status:** Research complete — ready to implement  
**Requested by:** Eduardo  

---

## Requirements

1. **Shutdown Pi** — safely power off the Raspberry Pi from the streamer UI
2. **Turn off LCD** — turn off the LCD backlight/display while Pi keeps running (music continues)
3. **Turn LCD back on** — since touch won't work with backlight off, need a button on the **mobile frontend** to wake the display remotely

---

## Current State (What Already Exists)

### Backend (Go) — `lcd.go`
Already has full LCD power control with 4 fallback methods:
1. **DRM DPMS sysfs** — `/sys/class/drm/card{0,1}-HDMI-A-{1,2}/dpms` (preferred — keeps display connected)
2. **vcgencmd** — `vcgencmd display_power {0|1}` (older Pi models)
3. **wlr-randr** — `wlr-randr --output HDMI-A-1 --off/--on` (Wayland/Cage — last resort, disconnects display)
4. **xset/xrandr** — X11 fallback

Socket events already registered in `server.go`:
| Frontend Event | Backend Handler | What It Does |
|---|---|---|
| `getLcdStatus` | Reads display state | Returns `{isOn: bool}` |
| `lcdStandby` | `SetLCDPower(false)` | Turns LCD off via best available method |
| `lcdWake` | `SetLCDPower(true)` | Turns LCD back on |
| Response: `pushLcdStatus` | Broadcast | `{isOn: bool}` to all clients |

### Backend — Missing
- **No `shutdown` event handler** — frontend emits `shutdown` but backend doesn't listen for it
- **No `reboot` event handler** — same situation

### Frontend — `lcd.ts` Store
Full LCD control store already exists:
- `lcdActions.turnOff()` → emits `lcdStandby`
- `lcdActions.turnOn()` → emits `lcdWake`
- `lcdActions.toggle()` → toggles based on current state
- `lcdActions.standby()` → CSS-only full black overlay (touch-to-wake works)
- `lcdActions.wake()` → restore from CSS standby
- Brightness control (CSS overlay, 0-100)
- `pushLcdStatus` listener for state sync

### Frontend — `settings.ts` Store
- `settingsActions.shutdown()` → emits `shutdown` (no backend handler yet)
- `settingsActions.restart()` → emits `reboot` (no backend handler yet)

### Gallery SettingsTab
- Has System section (device info, version, hardware)
- **No shutdown/power buttons** in gallery view
- **No LCD off button** in gallery view

### Mobile Frontend
- Has a SettingsView with shutdown button
- **No "wake LCD" remote control button**

---

## Implementation Plan

### 1. Backend: Add Shutdown & Reboot Handlers

**File:** `server.go`  
**Effort:** ~30 min

```go
client.On("shutdown", func(args ...any) {
    log.Info().Str("id", clientID).Msg("shutdown requested")
    // Broadcast to all clients that shutdown is happening
    s.io.Emit("pushShutdownNotice", map[string]any{
        "action":  "shutdown",
        "message": "Shutting down in 3 seconds...",
    })
    // Delay to let the notice propagate, then execute
    go func() {
        time.Sleep(3 * time.Second)
        cmd := exec.Command("sudo", "shutdown", "-h", "now")
        if err := cmd.Run(); err != nil {
            log.Error().Err(err).Msg("shutdown failed")
        }
    }()
})

client.On("reboot", func(args ...any) {
    log.Info().Str("id", clientID).Msg("reboot requested")
    s.io.Emit("pushShutdownNotice", map[string]any{
        "action":  "reboot",
        "message": "Rebooting in 3 seconds...",
    })
    go func() {
        time.Sleep(3 * time.Second)
        cmd := exec.Command("sudo", "reboot")
        if err := cmd.Run(); err != nil {
            log.Error().Err(err).Msg("reboot failed")
        }
    }()
})
```

**Prerequisite:** The `eduardo` user needs passwordless sudo for shutdown/reboot:
```bash
# /etc/sudoers.d/stellar-power
eduardo ALL=(ALL) NOPASSWD: /sbin/shutdown, /sbin/reboot
```

### 2. Gallery SettingsTab: Add Power Controls

**File:** `SettingsTab.svelte`  
**Effort:** ~30 min

Add a "Power" section at the bottom of Settings with 3 buttons:

```
┌─────────────────────────────────────────┐
│  ⚡ Power                                │
│                                          │
│  [🌙 LCD Off]   [🔄 Restart]   [⏻ Shutdown] │
│                                          │
│  LCD off turns off the display.          │
│  Use the mobile app to turn it back on.  │
└─────────────────────────────────────────┘
```

- **LCD Off** — calls `lcdActions.turnOff()`, already wired
- **Restart** — calls `settingsActions.restart()` with confirmation dialog
- **Shutdown** — calls `settingsActions.shutdown()` with confirmation dialog ("Are you sure? You'll need physical access to turn back on.")

Confirmation UX: inline state change on the button (like the queue clear confirm), not a modal. Tap once → button turns red with "Confirm?", tap again → executes, 3s timeout reverts.

### 3. Mobile Frontend: "Wake LCD" Button

**File:** New component or add to MobilePlayerView/MobileMiniPlayer  
**Effort:** ~45 min

This is the key piece Eduardo identified. When the LCD is off, touch on the LCD itself won't work (no backlight = no touch digitizer, or at minimum no visual feedback). The mobile phone connected to the same Socket.IO backend can send the wake command.

**Option A: Persistent floating button (recommended)**
- When `pushLcdStatus` reports `{isOn: false}`, show a floating "💡 Wake Display" button on the mobile UI
- Tapping it emits `lcdWake`
- Button disappears when `pushLcdStatus` comes back with `{isOn: true}`
- Position: bottom of screen, above mini player

**Option B: In mobile settings**
- Add LCD On/Off toggle in the mobile Settings page
- Less discoverable but cleaner

**Recommendation:** Option A — a floating button is immediately visible and discoverable. Eduardo shouldn't have to dig into settings to wake the LCD.

**Implementation:**
```svelte
<!-- LcdWakeButton.svelte -->
{#if !$isLcdOn && $lcdState !== 'unknown'}
  <button class="lcd-wake-fab" on:click={lcdActions.turnOn}>
    💡 Wake Display
  </button>
{/if}
```

Place in `MobilePlayerView.svelte` or `App.svelte` (mobile layout only).

### 4. Touch-to-Wake Consideration

Eduardo's intuition is correct: **if the LCD backlight is fully off, touch events won't register** on most HDMI LCD panels (the touch controller may still work but there's no visual feedback).

However, the backend uses **DRM DPMS as first choice**, which on many panels only turns off the backlight but keeps the HDMI signal active. Some panels' touch controllers remain powered via USB even when DPMS is off.

**Recommendation:** 
- Test on the actual LCD panel whether touch events still arrive when DPMS is "Off"
- If touch still works → we can add a "tap anywhere to wake" overlay on the gallery UI that listens for any touch and calls `lcdWake`
- If touch doesn't work → mobile wake button is the only path (Option A above)

Either way, the mobile wake button should exist as a reliable fallback.

### 5. LCD Auto-Standby (Already Exists, Bonus)

The `lcd.ts` store already has CSS-based standby (`lcdActions.standby()`) which dims to full black via CSS overlay. Touch-to-wake **always works** with this approach because the display hardware stays on.

Could wire this to the Settings UI as a softer "dim" option vs hardware off:
- **Dim Display** — CSS black overlay, touch to wake (instant, always works)
- **LCD Off** — Hardware DPMS off, need mobile to wake (saves power/backlight life)

---

## Summary of Changes Needed

| What | Where | Effort | Dependencies |
|---|---|---|---|
| Shutdown/reboot handlers | `server.go` | 30 min | sudoers config on Pi |
| Power section in Settings | `SettingsTab.svelte` | 30 min | Backend handlers |
| Mobile wake button | `MobilePlayerView.svelte` | 45 min | None (lcd.ts already works) |
| Sudoers config | Pi `/etc/sudoers.d/` | 5 min | SSH access |
| **Total** | | **~2 hours** | |

---

## Socket Event Summary (Complete After Implementation)

| Event | Direction | Purpose |
|---|---|---|
| `getLcdStatus` | Client → Server | Request LCD state |
| `pushLcdStatus` | Server → All | `{isOn: bool}` |
| `lcdStandby` | Client → Server | Turn LCD off |
| `lcdWake` | Client → Server | Turn LCD on |
| `shutdown` | Client → Server | Safely power off Pi |
| `reboot` | Client → Server | Restart Pi |
| `pushShutdownNotice` | Server → All | `{action, message}` — 3s warning before execution |

---

## Risk Assessment

- **Shutdown is irreversible remotely** — Pi needs physical power cycle to come back. Confirmation dialog is essential.
- **LCD off without wake path = bricked UI** — Mobile wake button is mandatory before enabling LCD off in gallery Settings.
- **sudoers misconfiguration** — Could lock out shutdown. Test with `sudo -n shutdown --help` first.
- **DPMS vs wlr-randr** — wlr-randr `--off` disconnects the display from Cage compositor, which may crash Chromium kiosk. DRM DPMS is safer. The backend already prefers DPMS. ✅
