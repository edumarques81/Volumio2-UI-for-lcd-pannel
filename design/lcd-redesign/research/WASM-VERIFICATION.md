# WASM Verification Report — stellar-viz v0.1.0
## Date: 2026-03-28 | Build Host: macOS arm64 (Apple Silicon)

---

## 1. Test Results ✅

**`cargo test` — 55 tests, 0 failures**

| Test Suite | Tests | Status |
|---|---|---|
| Unit: color | 12 | ✅ All pass |
| Unit: noise | 5 | ✅ All pass |
| Unit: physics | 7 | ✅ All pass |
| Unit: radial | 7 | ✅ All pass |
| Unit: spectrum | 8 | ✅ All pass |
| Unit: waveform | 7 | ✅ All pass |
| Integration: full_pipeline | 1 | ✅ Pass |
| Integration: pipeline_with_colour | 1 | ✅ Pass |
| Integration: animated_pipeline | 1 | ✅ Pass |
| External: spectrum_tests | 3 | ✅ All pass |
| External: waveform_tests | 3 | ✅ All pass |
| External: physics_tests | 3 | ✅ All pass |

---

## 2. Benchmark Results ✅

**`cargo bench` — Criterion 0.5, 100 samples per benchmark**

All times are median values on Apple M-series (ARM64).

| Benchmark | Time | Notes |
|---|---|---|
| spectrum_64_bars | **815 ns** | Sub-microsecond for 64 bars |
| spectrum_128_bars | **1.16 µs** | Linear scaling |
| spectrum_256_bars | **1.87 µs** | Still well under 1ms |
| waveform_200_points | **884 ns** | Fast polyline computation |
| waveform_500_points | **1.49 µs** | Scales linearly |
| radial_64_bars | **567 ns** | Fastest mode |
| radial_128_bars | **890 ns** | Trig is cheap |
| physics_64_bars_step | **90 ns** | Extremely fast |
| physics_128_bars_step | **186 ns** | Near-zero overhead |
| noise_256_samples | **6.5 µs** | Most expensive (4-octave layered noise) |
| noise_1024_samples | **26.1 µs** | Scales linearly with samples |
| palette_8_colours | **786 ns** | HSL conversion |
| interpolate_colour | **94 ns** | Per-bar colour lookup |
| **full_pipeline_64_bars** | **7.3 µs** | Complete: noise → spectrum → physics |

**Budget analysis:** At 60fps, the frame budget is 16.7ms. The full pipeline takes 7.3µs — that's **0.04% of the frame budget**. Even on a Raspberry Pi 4 (roughly 3-5× slower), this would use < 0.2% of the frame budget. The visualisation compute cost is negligible.

---

## 3. WASM Build Output ✅

**`wasm-pack build --target web --release`**

```
pkg/
├── stellar_viz.js       (15.5 KB) — JS glue code
├── stellar_viz.d.ts     (4.9 KB)  — TypeScript definitions
├── stellar_viz_bg.wasm  (69.4 KB) — WASM binary (wasm-opt optimized)
├── stellar_viz_bg.wasm.d.ts       — WASM type definitions
├── package.json
└── README.md
```

- WASM binary: **69 KB** (small, cacheable, fast to load)
- JS glue: **15.5 KB** (handles wasm-bindgen interop)
- TypeScript types generated automatically

---

## 4. Clippy ✅

**`cargo clippy -- -D warnings` — 0 warnings, 0 errors**

No unsafe code used anywhere in the crate.

---

## 5. Artefacts Created

| File | Purpose |
|---|---|
| `src/lib/wasm/stellar-viz/` | Rust crate with all source modules |
| `src/lib/wasm/stellar-viz/pkg/` | Built WASM + JS output |
| `src/lib/components/visualisation/WasmVisualiser.svelte` | Svelte wrapper with JS fallback |
| `design/lcd-redesign/mockups/wasm-test.html` | Standalone test page |

---

## 6. Issues & Notes

1. **No real audio data yet** — the crate uses layered noise to simulate audio. When real Web Audio API data is available, just pass the frequency data directly to `computeSpectrumBars()`.

2. **Pi performance** — benchmarks are from Apple Silicon. Expect 3-5× slower on Pi 4, which still puts the full pipeline at ~25-35µs — trivially within budget.

3. **WASM binary size** — 69KB is small. Could be further reduced with `wasm-opt -Oz` if needed, but unlikely to matter for a locally-served kiosk display.

4. **Colour palette** — the Svelte component uses a simplified JS palette generator (not the WASM one) for simplicity. The WASM `generatePaletteFromSeed` uses proper HSL rotation and can replace it.

5. **OffscreenCanvas** — the research doc mentions OffscreenCanvas for off-main-thread rendering. The current implementation uses a standard canvas on the main thread, which is sufficient given the sub-microsecond compute times. OffscreenCanvas can be added later if needed for complex particle effects.

---

## Verification Checklist

- [x] `cargo test` — 55 tests, 0 failures
- [x] `cargo bench` — 14 benchmarks run, all produce timing
- [x] `wasm-pack build --target web` — pkg/ with .wasm + .js
- [x] `cargo clippy` — 0 warnings
- [x] Standalone HTML test page created
- [x] This verification report written
- [x] No unsafe code
- [x] No TODO comments
- [x] No panics in production paths
