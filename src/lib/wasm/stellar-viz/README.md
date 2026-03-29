# stellar-viz 🎨

High-performance WebAssembly visualisation computations for the Stellar Volumio LCD display (1920×440).

## Architecture

This Rust crate compiles to WASM and provides the compute layer for audio visualisations. The WASM module handles all the heavy math; a thin Svelte wrapper (`WasmVisualiser.svelte`) handles DOM/Canvas rendering.

### Modules

| Module | Purpose |
|--------|---------|
| `spectrum` | Frequency bar visualisation (64–256 bars) |
| `waveform` | Waveform polyline visualisation |
| `radial` | Circular/radial spectrum analyser |
| `color` | MD3-inspired colour palette generation |
| `physics` | Spring-damper animation for smooth bar transitions |
| `noise` | Perlin-style noise for simulated audio data |

## Building

```bash
# Quick build (tests + clippy + wasm-pack)
./build.sh

# Or manually:
cargo test          # Run all tests
cargo bench         # Run benchmarks
cargo clippy        # Lint check
wasm-pack build --target web  # Build WASM
```

## WASM API

```javascript
import init, {
  computeSpectrumBars,
  computeWaveformPoints,
  computeRadialSpectrum,
  generatePaletteFromSeed,
  interpolateBarColour,
  generateFakeAudioFrame,
  WasmPhysicsState,
} from './pkg/stellar_viz.js';

await init();

// Generate fake audio for demo
const audio = generateFakeAudioFrame(performance.now() / 1000, 256);

// Compute spectrum bars: returns [x, y, width, height, ...]
const bars = computeSpectrumBars(audio, 64, 1920, 440);

// Physics for smooth animation
const physics = new WasmPhysicsState(64);
const heights = physics.update(targetHeights, deltaTime);

// Colour palette from album art seed
const palette = generatePaletteFromSeed('#ff6600', 8);
const colour = interpolateBarColour(0.75, palette);
```

## Integration

The Svelte component `WasmVisualiser.svelte` wraps this module with:
- Dynamic WASM import with JS fallback
- `<canvas>` at 1920×440
- `requestAnimationFrame` render loop
- Spectrum / waveform / radial mode switching
- Props: `mode`, `seedColour`, `isPlaying`

## Performance

Benchmarks are run via `cargo bench` using Criterion. The crate targets sub-millisecond computation per frame for 64–128 bars at 1920px width, well within the 16ms budget for 60fps rendering.
