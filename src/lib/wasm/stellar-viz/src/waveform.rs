//! Waveform line visualisation.
//! Converts audio data into a series of (x, y) points for drawing
//! a smooth waveform line on canvas.

/// Compute waveform points from audio data.
///
/// Downsamples/averages audio data into `num_points` x,y pairs
/// distributed across the given width, with amplitudes mapped to height.
///
/// # Arguments
/// * `audio_data` - Raw audio samples (normalised 0.0-1.0)
/// * `num_points` - Number of output points for the polyline
/// * `width` - Canvas width in pixels
/// * `height` - Canvas height in pixels
///
/// # Returns
/// Flat Vec of [x, y] pairs. Length = num_points * 2.
pub fn compute_waveform_points(
    audio_data: &[f32],
    num_points: usize,
    width: f32,
    height: f32,
) -> Vec<f32> {
    if num_points == 0 || audio_data.is_empty() || width <= 0.0 || height <= 0.0 {
        return Vec::new();
    }

    let center_y = height / 2.0;
    let amplitude = height * 0.4; // 80% of half-height
    let samples_per_point = audio_data.len() as f32 / num_points as f32;

    let mut result = Vec::with_capacity(num_points * 2);

    for i in 0..num_points {
        let x = (i as f32 / (num_points - 1).max(1) as f32) * width;

        // Average samples for this point
        let start = (i as f32 * samples_per_point) as usize;
        let end = (((i + 1) as f32 * samples_per_point) as usize).min(audio_data.len());

        let value = if start < end {
            let sum: f32 = audio_data[start..end].iter().sum();
            sum / (end - start) as f32
        } else if start < audio_data.len() {
            audio_data[start]
        } else {
            0.5 // Default to center
        };

        // Map [0, 1] to waveform centered on canvas
        let y = center_y + (value - 0.5) * 2.0 * amplitude;

        result.push(x);
        result.push(y.clamp(0.0, height));
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_waveform() {
        let audio: Vec<f32> = (0..512).map(|i| i as f32 / 512.0).collect();
        let result = compute_waveform_points(&audio, 200, 1920.0, 440.0);
        assert_eq!(result.len(), 200 * 2);

        for chunk in result.chunks(2) {
            let (x, y) = (chunk[0], chunk[1]);
            assert!(x >= 0.0 && x <= 1920.0, "x={x} out of range");
            assert!(y >= 0.0 && y <= 440.0, "y={y} out of range");
        }
    }

    #[test]
    fn test_empty_audio() {
        let result = compute_waveform_points(&[], 100, 1920.0, 440.0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_zero_points() {
        let audio = vec![0.5; 128];
        let result = compute_waveform_points(&audio, 0, 1920.0, 440.0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_single_point() {
        let audio = vec![0.5; 128];
        let result = compute_waveform_points(&audio, 1, 1920.0, 440.0);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_center_line_for_half_amplitude() {
        // Audio at 0.5 should produce center y
        let audio = vec![0.5; 128];
        let result = compute_waveform_points(&audio, 50, 1920.0, 440.0);
        for chunk in result.chunks(2) {
            let y = chunk[1];
            assert!(
                (y - 220.0).abs() < 1.0,
                "0.5 audio should be at center (220), got {y}"
            );
        }
    }

    #[test]
    fn test_negative_dimensions() {
        let audio = vec![0.5; 64];
        assert!(compute_waveform_points(&audio, 10, -100.0, 440.0).is_empty());
        assert!(compute_waveform_points(&audio, 10, 1920.0, -1.0).is_empty());
    }

    #[test]
    fn test_first_and_last_x() {
        let audio = vec![0.5; 128];
        let result = compute_waveform_points(&audio, 100, 1920.0, 440.0);
        assert_eq!(result[0], 0.0, "First x should be 0");
        let last_x = result[result.len() - 2];
        assert!(
            (last_x - 1920.0).abs() < 0.1,
            "Last x should be ~1920, got {last_x}"
        );
    }
}
