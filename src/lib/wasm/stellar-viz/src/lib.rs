//! stellar-viz — High-performance WASM visualisation computations
//! for the Stellar Volumio LCD display (1920×440).
//!
//! This crate compiles to WebAssembly and provides the math layer
//! for spectrum, waveform, and radial visualisations. A thin Svelte
//! wrapper handles DOM/Canvas rendering.

pub mod color;
pub mod noise;
pub mod physics;
pub mod radial;
pub mod spectrum;
pub mod waveform;

use wasm_bindgen::prelude::*;

// Re-export the PhysicsState for WASM
/// Opaque handle to physics simulation state, exposed to JS via wasm_bindgen.
#[wasm_bindgen]
pub struct WasmPhysicsState {
    inner: physics::PhysicsState,
}

#[wasm_bindgen]
impl WasmPhysicsState {
    /// Create a new physics state for the given number of bars.
    #[wasm_bindgen(constructor)]
    pub fn new(num_bars: usize) -> Self {
        Self {
            inner: physics::PhysicsState::new(num_bars),
        }
    }

    /// Create with custom spring parameters.
    #[wasm_bindgen(js_name = "withParams")]
    pub fn with_params(num_bars: usize, stiffness: f32, damping: f32) -> Self {
        Self {
            inner: physics::PhysicsState::with_params(num_bars, stiffness, damping),
        }
    }

    /// Number of bars in this state.
    #[wasm_bindgen(getter)]
    pub fn len(&self) -> usize {
        self.inner.len()
    }

    /// Check if state has no bars.
    #[wasm_bindgen(getter, js_name = "isEmpty")]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }

    /// Update physics: spring each bar toward its target height.
    /// Returns current bar heights after simulation step.
    pub fn update(&mut self, targets: &[f32], delta_time: f32) -> Vec<f32> {
        self.inner.update(targets, delta_time)
    }

    /// Get current bar heights.
    #[wasm_bindgen(getter)]
    pub fn heights(&self) -> Vec<f32> {
        self.inner.heights.clone()
    }
}

/// Compute spectrum bar layout from audio data.
///
/// Returns a flat array of [x, y, width, height] quads per bar.
#[wasm_bindgen(js_name = "computeSpectrumBars")]
pub fn compute_spectrum_bars(
    audio_data: &[f32],
    num_bars: usize,
    width: f32,
    height: f32,
) -> Vec<f32> {
    spectrum::compute_spectrum_bars(audio_data, num_bars, width, height)
}

/// Compute waveform points from audio data.
///
/// Returns a flat array of [x, y] pairs.
#[wasm_bindgen(js_name = "computeWaveformPoints")]
pub fn compute_waveform_points(
    audio_data: &[f32],
    num_points: usize,
    width: f32,
    height: f32,
) -> Vec<f32> {
    waveform::compute_waveform_points(audio_data, num_points, width, height)
}

/// Compute radial spectrum bar positions.
///
/// Returns a flat array of [x1, y1, x2, y2] quads per bar.
#[wasm_bindgen(js_name = "computeRadialSpectrum")]
pub fn compute_radial_spectrum(
    audio_data: &[f32],
    num_bars: usize,
    center_x: f32,
    center_y: f32,
    radius: f32,
) -> Vec<f32> {
    radial::compute_radial_spectrum(audio_data, num_bars, center_x, center_y, radius)
}

/// Generate a colour palette from a seed hex colour.
///
/// Returns an array of hex colour strings.
#[wasm_bindgen(js_name = "generatePaletteFromSeed")]
pub fn generate_palette_from_seed(seed_hex: &str, num_colours: usize) -> Vec<String> {
    color::generate_palette_from_seed(seed_hex, num_colours)
}

/// Interpolate a colour from the palette based on normalised value [0, 1].
#[wasm_bindgen(js_name = "interpolateBarColour")]
pub fn interpolate_bar_colour(value: f32, palette: Vec<String>) -> String {
    color::interpolate_bar_colour(value, &palette)
}

/// Generate a frame of fake audio data using layered noise.
///
/// Returns `num_samples` values in [0, 1] suitable for feeding into
/// the visualisation functions.
#[wasm_bindgen(js_name = "generateFakeAudioFrame")]
pub fn generate_fake_audio_frame(time: f64, num_samples: usize) -> Vec<f32> {
    noise::generate_fake_audio_frame(time, num_samples)
}
