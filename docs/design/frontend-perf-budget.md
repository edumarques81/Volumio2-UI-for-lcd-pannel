# Frontend performance budget

**Audience:** Anyone adding features to Volumio2-UI from 2026-05-09 onward.
**Hard constraint:** The frontend MUST NOT degrade audio playback on the Pi.
**Status:** Living doc. Update when rules change, when measurements shift the picture, or when the kiosk topology changes.

## §1 Headline (2026-05-09)

The current frontend is **not** the cause of any audio degradation. Everything observed in this audit is conservative.

Evidence (file paths are anchors for future audits, not invitations to change):

| Concern | Status | Where |
|---|---|---|
| Active RAF render loops | None. FPS sampler is opt-in only. | `stores/performance.ts:100,142,159` (gated by `fpsEnabled`) |
| Polling intervals | Two, both bounded. | `App.svelte:138-147` (30 s heartbeat, gated by `document.hidden`); `stores/player.ts:251` (1 s seek-position tick, only while playing) |
| CSS continuous animation | None. All redesign visual effects are static paint-once. | `PlayerLayout.svelte:23-26,38-40` (bloom + sheen); `NavColumn.svelte:59-66`, `TransportColumn.svelte:51-61,82-91` (gradient separators) |
| Album-swap transition | Bounded. `|local`-scoped, 220 ms in / 180 ms out. | `LibraryView.svelte:7,79-80` |
| `backdrop-filter` use | Modal-only. | `Toast.svelte:235-236` (blur 16px), `StatusDrawer.svelte:204-205` (blur 20px) |
| Box-shadow glows | Two small, always-visible. | `TransportColumn.svelte:66`, `ProgressBar.svelte:136` |
| Spectrum frontend subscription | Dead. Backend emits at 30 FPS but frontend has no consumer. | `stores/spectrum.ts` orphaned (deletion-listed in `docs/superpowers/plans/2026-05-04-DELETION-LIST.md`) |
| Bundle | Minimal. Only runtime dep is `socket.io-client@^4.8.3`. | `package.json` |
| Kiosk GPU | Vulkan + accelerated decode + GPU compositing. | Pi `/usr/local/bin/stellar-kiosk.sh` (cage + chromium with `--use-vulkan`, `--use-angle=vulkan`, `--enable-gpu-rasterization`, `--enable-zero-copy`, `--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,VaapiVideoDecoder,CanvasOopRasterization`) |

The "Pi 5 / Chromium / PipeWire 50% CPU idle on Bookworm vs 1.5% headless" architectural concern is **Chromium overhead from running with GPU compositor at all** — not from this frontend's render workload. The frontend has headroom; the constraint is to not *spend* it.

## §2 Budget rules (load-bearing for every PR)

These rules govern Settings v1 and every feature after it. Violations need an explicit measurement-backed exception.

### Rule 1 — No new continuous animations.

No new `requestAnimationFrame` loops. No new CSS keyframes on always-visible elements. No new polling intervals < 1 Hz on the kiosk surface. Transient transitions on user-driven nav are fine if they're ≤300 ms total and `|local`-scoped.

**Why it matters:** the Pi's GPU and one CPU core are already taxed by Chromium itself; an idle continuous animation steals headroom that MPD might need at xrun-edge moments.

### Rule 2 — `backdrop-filter` is modal-only.

Toast and StatusDrawer use it because they're transient. Do not spread `backdrop-filter` to PlayerLayout, NavColumn, TransportColumn, SettingsView, AlbumPage, or any always-visible surface. On the Pi VideoCore VII, `backdrop-filter` is a recompose tax on every paint behind it.

### Rule 3 — Don't re-enable the spectrum frontend subscription without three things.

The backend has shipped 30 FPS spectrum events for a long time. The frontend has not consumed them since the visualization views were deletion-listed. If this changes:

1. **FPS-cap target ≤20 FPS** at the consumer (the backend can keep emitting at 30; the consumer must drop frames). Reference: original design budget cited 20 FPS as the target where bar-graph perception is unaffected.
2. **A "disable on Pi kiosk" toggle exposed in Settings** — kiosk users must be able to turn it off without redeploy.
3. **Measured FPS regression** captured before and after the change using §3 below. The number must be reported in the PR description.

### Rule 4 — Sliders & continuous inputs MUST debounce socket emits (≥150 ms).

A naive `on:input` emit during a brightness drag becomes 60+ events/sec. The Settings v1 brightness slider is the immediate test of this rule — it must debounce, and tests must verify.

Pattern: `lodash.debounce` is already overkill for the bundle; use a small inline `setTimeout`/`clearTimeout` debounce (5 lines) to keep dependencies flat.

### Rule 5 — Single-source background pipeline.

`PlayerLayout.svelte` owns the unified background (bloom + sheen). LibraryView, PlayerView, AlbumPage, and any future view (SettingsView, …) inherit. Children must declare `background: transparent` (or no background at all). Do **not** declare a new background-image, gradient, or solid color on a child.

**Why it matters:** layered painted backgrounds compose at composite time; a child that sets its own bg forces an extra texture and recompositing. Single-source keeps this cheap.

### Rule 6 — Box-shadow glows are budgeted.

Today: `TransportColumn.svelte:66` (Play button) and `ProgressBar.svelte:136`. Adding a third always-visible glow requires:

- A measurement step (§3) showing FPS does not regress from baseline.
- A note in the PR description stating which existing glow could be removed if FPS drops on a future change.

`box-shadow` is cheaper than `backdrop-filter` but not free. Keeping the count tight makes the cost predictable.

## §3 Measurement protocol

Use this when adding a feature that touches the always-visible surface, when re-enabling spectrum, or when investigating any audio complaint.

### Setup

1. Pi kiosk has Chromium remote-debug already enabled — `--remote-debugging-port=9222` is in `/usr/local/bin/stellar-kiosk.sh` (confirmed 2026-05-09).
2. From the dev Mac, open `http://<pi-ip>:9222` in Chrome — pick the kiosk's tab and attach DevTools. (Pi-ip = `192.168.86.25` in the current setup.)
3. Alternative: open the same dev URL on a desktop browser at LCD viewport (DevTools device toolbar → custom 1920×440). This loses the Pi GPU profile but is faster for iterating.

### Capture protocol

1. In the Chromium console: `window.__performance.toggle()` to enable the FPS overlay.
2. Capture two 5-minute baselines:
   - **Idle.** Library view, no playback, no interaction.
   - **Active.** Playback running, periodic `next` / `prev` / `seek` every 30 s.
3. Record from `performanceMetrics`: avg FPS, p5 FPS, `droppedFrames`, count of `isJanky` flips.
4. Cross-reference MPD audio: `journalctl -u mpd --since '5 min ago' | grep -iE '(underrun|xrun|alsa)'`. Any non-empty result is a red flag.
5. Pi-side process load: `top -bn1 | grep -E '(chromium|mpd|stellar)'`. Sample three times, 2 s apart.

### Pass criteria

- ≥55 FPS average in both baselines.
- No `isJanky` flips in idle baseline; ≤2 in active baseline (allows for nav-triggered dips).
- Zero MPD xruns/underruns in either baseline.
- Chromium main process < 30% on a single core in idle baseline.

If any criterion fails, the suspects (in priority order):

1. New box-shadow glow on always-visible element.
2. New `backdrop-filter` somewhere that's not modal.
3. A continuous animation that crept in (CSS keyframe, RAF loop, or `setInterval` < 1 Hz).
4. A socket subscription firing more than once per second.

Narrow with the FPS overlay (toggle visibility, watch for the dip).

## §4 Failure modes — what would degrade audio

A non-exhaustive enumeration so future-you doesn't have to re-derive the failure space.

| Anti-pattern | Symptom | Fix |
|---|---|---|
| Re-enable `pushSpectrum` subscription with no FPS cap | Chromium pegs one core at 100%; MPD starts xrunning under load | Add a 20 FPS frame-throttle in the consumer, plus a "disable on kiosk" toggle. |
| Add `backdrop-filter` to NavColumn or PlayerLayout | Constant recomposite tax; FPS drops 10–20 in idle baseline | Don't. Use a flat or pseudo-element gradient if visual richness is needed. |
| Add a CSS keyframe animation to PlayerLayout's bg | GPU compositor never goes idle | Use a pseudo-element with a one-shot transition tied to a state change, not a loop. |
| Naive slider on:input emit | Socket event storm; backend BroadcastDebouncer can't fully absorb at slider scrubbing rates | Debounce ≥150 ms (Rule 4). |
| Subscribe to a high-frequency backend event without coalescing | Event handler fires faster than the render budget | Throttle the handler to a kiosk-friendly rate. |
| Import a heavy lib (chart kit, three.js, chroma.js) | Bundle balloons; first-paint slows; dev iteration tanks | Hand-roll the small subset you need; almost always practical for this codebase. |
| Add a third always-visible box-shadow glow without measurement | Possible silent FPS regression on Pi | Apply Rule 6 — measure or don't ship. |

## §5 What changed about this in 2026-05-09

- This doc came into being. Prior to this, the rules existed implicitly in commits and reviewer memory; codifying them makes Settings v1 (and beyond) reviewable against a written contract.
- The Pi kiosk launcher was located at `/usr/local/bin/stellar-kiosk.sh` (autologin → bash_profile → cage). It uses Vulkan + ANGLE-Vulkan; that's relevant when reading FPS numbers because Vulkan's shader recompile costs are hidden behind the first frame.
- Power-command auth gate gained an env-var allowlist (`STELLAR_POWER_TRUSTED_REMOTES`) for dev-mode frontends running off-Pi. This is **not** a perf-budget concern, but knowing why a LAN client can now hit `system:shutdown` is part of the threat model.

## §6 How to evolve this doc

- When a rule changes, edit it in place and add a one-line note in §5 with the date and reason.
- When a measurement reveals new headroom (or a new sink), update §1's table.
- Don't grow the rules without a real failure that motivates the rule. Every rule should be traceable to a concrete near-miss or measured regression.
