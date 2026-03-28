//! Perlin/simplex-inspired noise for fake audio data generation.
//! Used for demo mode when no real audio input is available.

/// Simple hash-based noise (deterministic, no external crate needed).
/// Returns a value in [-1.0, 1.0].
fn hash_noise(x: i32) -> f64 {
    let mut n = x.wrapping_mul(374761393);
    n = (n ^ (n >> 13)).wrapping_mul(1103515245);
    n = n ^ (n >> 16);
    (n as f64) / (i32::MAX as f64)
}

/// Smooth interpolation (cubic hermite).
fn smoothstep(t: f64) -> f64 {
    t * t * (3.0 - 2.0 * t)
}

/// 1D value noise with smooth interpolation.
fn value_noise_1d(x: f64) -> f64 {
    let x0 = x.floor() as i32;
    let x1 = x0 + 1;
    let t = smoothstep(x - x.floor());
    let v0 = hash_noise(x0);
    let v1 = hash_noise(x1);
    v0 + (v1 - v0) * t
}

/// Layered noise (octaves) for richer texture.
fn layered_noise(x: f64, octaves: usize) -> f64 {
    let mut value = 0.0;
    let mut amplitude = 1.0;
    let mut frequency = 1.0;
    let mut max_amp = 0.0;

    for _ in 0..octaves {
        value += value_noise_1d(x * frequency) * amplitude;
        max_amp += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    value / max_amp
}

/// Generate a single frame of fake audio data using layered noise.
///
/// Returns `num_samples` values in [0.0, 1.0] representing simulated
/// frequency magnitudes. The `time` parameter advances the animation.
///
/// # Arguments
/// * `time` - Current time in seconds (drives animation)
/// * `num_samples` - Number of samples to generate
///
/// # Returns
/// Vec of f32 values in [0.0, 1.0]
pub fn generate_fake_audio_frame(time: f64, num_samples: usize) -> Vec<f32> {
    if num_samples == 0 {
        return Vec::new();
    }

    let mut result = Vec::with_capacity(num_samples);

    for i in 0..num_samples {
        let x = i as f64 / num_samples as f64;

        // Base noise layer — slow movement
        let base = layered_noise(x * 4.0 + time * 0.8, 4);

        // Mid layer — medium speed, gives rhythm feel
        let mid = layered_noise(x * 8.0 + time * 1.5, 3) * 0.5;

        // High frequency detail
        let detail = layered_noise(x * 16.0 + time * 3.0, 2) * 0.25;

        // Bass emphasis: lower indices get more energy
        let bass_boost = (1.0 - x).powi(2) * 0.3;

        // Combine and normalise to [0, 1]
        let combined = (base + mid + detail + bass_boost + 1.0) / 3.0;
        let clamped = combined.clamp(0.0, 1.0) as f32;

        result.push(clamped);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_normal_frame() {
        let frame = generate_fake_audio_frame(0.0, 128);
        assert_eq!(frame.len(), 128);
        for &v in &frame {
            assert!(v >= 0.0 && v <= 1.0, "Value {v} out of range [0,1]");
        }
    }

    #[test]
    fn test_generate_empty() {
        let frame = generate_fake_audio_frame(1.0, 0);
        assert!(frame.is_empty());
    }

    #[test]
    fn test_frames_differ_over_time() {
        let frame_a = generate_fake_audio_frame(0.0, 64);
        let frame_b = generate_fake_audio_frame(1.0, 64);
        // Frames at different times should not be identical
        let different = frame_a.iter().zip(frame_b.iter()).any(|(a, b)| (a - b).abs() > 0.001);
        assert!(different, "Frames at t=0 and t=1 should differ");
    }

    #[test]
    fn test_deterministic() {
        let a = generate_fake_audio_frame(2.5, 32);
        let b = generate_fake_audio_frame(2.5, 32);
        assert_eq!(a, b, "Same time should produce identical output");
    }

    #[test]
    fn test_single_sample() {
        let frame = generate_fake_audio_frame(0.0, 1);
        assert_eq!(frame.len(), 1);
        assert!(frame[0] >= 0.0 && frame[0] <= 1.0);
    }
}
