use stellar_viz::color;
use stellar_viz::noise;
use stellar_viz::physics::PhysicsState;
use stellar_viz::spectrum;

/// Full pipeline test: generate fake audio → compute spectrum → apply physics → get bar heights.
#[test]
fn test_full_pipeline() {
    // 1. Generate fake audio
    let audio = noise::generate_fake_audio_frame(0.0, 256);
    assert_eq!(audio.len(), 256);

    // 2. Compute spectrum bars
    let bars = spectrum::compute_spectrum_bars(&audio, 64, 1920.0, 440.0);
    assert_eq!(bars.len(), 64 * 4);

    // 3. Extract bar heights as physics targets
    let targets: Vec<f32> = bars.chunks(4).map(|c| c[3]).collect();
    assert_eq!(targets.len(), 64);

    // 4. Apply physics
    let mut physics = PhysicsState::new(64);
    let mut heights = vec![0.0f32; 64];
    for _ in 0..60 {
        heights = physics.update(&targets, 1.0 / 60.0);
    }

    // 5. Verify outputs are reasonable
    assert_eq!(heights.len(), 64);
    for &h in &heights {
        assert!(h >= 0.0 && h.is_finite(), "Invalid height: {h}");
    }
}

/// Pipeline with colour: generate palette, interpolate colours for each bar.
#[test]
fn test_pipeline_with_colour() {
    let audio = noise::generate_fake_audio_frame(1.5, 128);
    let bars = spectrum::compute_spectrum_bars(&audio, 32, 1920.0, 440.0);
    let palette = color::generate_palette_from_seed("#e63946", 5);

    assert_eq!(palette.len(), 5);

    // Colour each bar based on its height
    let max_height: f32 = bars.chunks(4).map(|c| c[3]).fold(0.0, f32::max);

    for chunk in bars.chunks(4) {
        let bar_height = chunk[3];
        let normalised = if max_height > 0.0 {
            bar_height / max_height
        } else {
            0.0
        };
        let colour = color::interpolate_bar_colour(normalised, &palette);
        assert!(colour.starts_with('#'));
        assert_eq!(colour.len(), 7);
    }
}

/// Multi-frame pipeline simulating animation loop.
#[test]
fn test_animated_pipeline() {
    let mut physics = PhysicsState::new(64);
    let mut prev_heights = vec![0.0f32; 64];

    for frame in 0..120 {
        let time = frame as f64 / 60.0;
        let audio = noise::generate_fake_audio_frame(time, 256);
        let bars = spectrum::compute_spectrum_bars(&audio, 64, 1920.0, 440.0);
        let targets: Vec<f32> = bars.chunks(4).map(|c| c[3]).collect();
        let heights = physics.update(&targets, 1.0 / 60.0);

        // Physics should produce smooth changes (no huge jumps after frame 1)
        if frame > 1 {
            for i in 0..64 {
                let diff = (heights[i] - prev_heights[i]).abs();
                assert!(
                    diff < 100.0,
                    "Frame {frame}, bar {i}: jump of {diff} too large"
                );
            }
        }
        prev_heights = heights;
    }
}
