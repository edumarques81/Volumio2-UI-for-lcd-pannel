//! Radial/circular spectrum visualisation.
//! Converts audio frequency data into polar coordinates for drawing
//! a circular spectrum analyser.

use std::f32::consts::PI;

/// Compute radial spectrum bar positions and lengths.
///
/// Each bar radiates outward from the center point, distributed evenly
/// around the circle. Output can be drawn as lines from (x1,y1) to (x2,y2).
///
/// # Arguments
/// * `audio_data` - Raw audio magnitudes (normalised 0.0-1.0)
/// * `num_bars` - Number of bars around the circle
/// * `center_x` - Center X coordinate
/// * `center_y` - Center Y coordinate
/// * `radius` - Base radius of the circle
///
/// # Returns
/// Flat Vec of [x1, y1, x2, y2] quads per bar. Length = num_bars * 4.
/// (x1,y1) is inner point on base circle, (x2,y2) is outer tip.
pub fn compute_radial_spectrum(
    audio_data: &[f32],
    num_bars: usize,
    center_x: f32,
    center_y: f32,
    radius: f32,
) -> Vec<f32> {
    if num_bars == 0 || audio_data.is_empty() || radius <= 0.0 {
        return Vec::new();
    }

    let max_extension = radius * 0.8; // Bars extend up to 80% of radius outward
    let samples_per_bar = (audio_data.len() as f32 / num_bars as f32).max(1.0);

    let mut result = Vec::with_capacity(num_bars * 4);

    for i in 0..num_bars {
        let angle = (i as f32 / num_bars as f32) * 2.0 * PI - PI / 2.0; // Start from top

        // Average audio samples for this bar
        let start = (i as f32 * samples_per_bar) as usize;
        let end = (((i + 1) as f32 * samples_per_bar) as usize).min(audio_data.len());

        let magnitude = if start < end {
            let sum: f32 = audio_data[start..end].iter().sum();
            (sum / (end - start) as f32).clamp(0.0, 1.0)
        } else if start < audio_data.len() {
            audio_data[start].clamp(0.0, 1.0)
        } else {
            0.0
        };

        let bar_length = magnitude * max_extension;
        let cos_a = angle.cos();
        let sin_a = angle.sin();

        // Inner point (on base circle)
        let x1 = center_x + radius * cos_a;
        let y1 = center_y + radius * sin_a;

        // Outer point (tip of bar)
        let x2 = center_x + (radius + bar_length) * cos_a;
        let y2 = center_y + (radius + bar_length) * sin_a;

        result.push(x1);
        result.push(y1);
        result.push(x2);
        result.push(y2);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_radial() {
        let audio: Vec<f32> = (0..128).map(|i| i as f32 / 128.0).collect();
        let result = compute_radial_spectrum(&audio, 64, 960.0, 220.0, 100.0);
        assert_eq!(result.len(), 64 * 4);

        for chunk in result.chunks(4) {
            for &v in chunk {
                assert!(v.is_finite(), "All coordinates should be finite");
            }
        }
    }

    #[test]
    fn test_empty_audio() {
        let result = compute_radial_spectrum(&[], 32, 960.0, 220.0, 100.0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_zero_bars() {
        let audio = vec![0.5; 64];
        let result = compute_radial_spectrum(&audio, 0, 960.0, 220.0, 100.0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_zero_radius() {
        let audio = vec![0.5; 64];
        let result = compute_radial_spectrum(&audio, 32, 960.0, 220.0, 0.0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_silent_bars_on_circle() {
        let audio = vec![0.0; 64];
        let result = compute_radial_spectrum(&audio, 32, 100.0, 100.0, 50.0);
        assert_eq!(result.len(), 32 * 4);
        // With zero magnitude, inner and outer points should be the same
        for chunk in result.chunks(4) {
            let (x1, y1, x2, y2) = (chunk[0], chunk[1], chunk[2], chunk[3]);
            assert!(
                (x1 - x2).abs() < 0.01 && (y1 - y2).abs() < 0.01,
                "Silent bars should have zero length"
            );
        }
    }

    #[test]
    fn test_first_bar_points_up() {
        let audio = vec![1.0; 32];
        let result = compute_radial_spectrum(&audio, 32, 100.0, 100.0, 50.0);
        // First bar angle is -PI/2 (pointing up), so x1 ≈ center_x, y1 < center_y
        let (x1, y1, _x2, y2) = (result[0], result[1], result[2], result[3]);
        assert!(
            (x1 - 100.0).abs() < 0.1,
            "First bar x should be at center"
        );
        assert!(y1 < 100.0, "First bar should point upward (y1 < center_y)");
        assert!(y2 < y1, "Outer point should be further up");
    }

    #[test]
    fn test_more_bars_than_samples() {
        let audio = vec![0.5; 4];
        let result = compute_radial_spectrum(&audio, 64, 960.0, 220.0, 100.0);
        assert_eq!(result.len(), 64 * 4);
    }
}
