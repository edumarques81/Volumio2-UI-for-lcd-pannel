//! Frequency spectrum bar visualisation.
//! Converts raw audio magnitude data into bar heights and positions
//! suitable for canvas rendering.

/// Compute spectrum bar heights from audio frequency data.
///
/// Takes raw audio magnitude data and bins it into `num_bars` frequency
/// bars, scaled to fit within the given dimensions.
///
/// # Arguments
/// * `audio_data` - Raw audio magnitudes (normalised 0.0-1.0)
/// * `num_bars` - Number of output bars (typically 64-128)
/// * `width` - Canvas width in pixels (e.g., 1920.0)
/// * `height` - Canvas height in pixels (e.g., 440.0)
///
/// # Returns
/// Flat Vec of [x, y, bar_width, bar_height] quads for each bar.
/// Length = num_bars * 4.
pub fn compute_spectrum_bars(
    audio_data: &[f32],
    num_bars: usize,
    width: f32,
    height: f32,
) -> Vec<f32> {
    if num_bars == 0 || audio_data.is_empty() || width <= 0.0 || height <= 0.0 {
        return Vec::new();
    }

    let gap_ratio = 0.2; // 20% gap between bars
    let total_bar_width = width / num_bars as f32;
    let bar_width = total_bar_width * (1.0 - gap_ratio);
    let gap = total_bar_width * gap_ratio;

    let samples_per_bar = (audio_data.len() as f32 / num_bars as f32).max(1.0);
    let mut result = Vec::with_capacity(num_bars * 4);

    for i in 0..num_bars {
        // Average the audio samples for this bar's frequency bin
        let start = (i as f32 * samples_per_bar) as usize;
        let end = ((i + 1) as f32 * samples_per_bar) as usize;
        let end = end.min(audio_data.len());

        let magnitude = if start < end {
            let sum: f32 = audio_data[start..end].iter().sum();
            (sum / (end - start) as f32).clamp(0.0, 1.0)
        } else if start < audio_data.len() {
            audio_data[start].clamp(0.0, 1.0)
        } else {
            0.0
        };

        // Apply logarithmic scaling for perceptually even distribution
        let scaled = if magnitude > 0.0 {
            (magnitude.ln() + 4.0) / 4.0 // Shift log curve to [0, ~1]
        } else {
            0.0
        }
        .clamp(0.0, 1.0);

        let bar_height = scaled * height * 0.9; // 90% max height
        let x = i as f32 * total_bar_width + gap / 2.0;
        let y = height - bar_height; // Bars grow upward from bottom

        result.push(x);
        result.push(y);
        result.push(bar_width);
        result.push(bar_height);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_spectrum() {
        let audio: Vec<f32> = (0..256).map(|i| i as f32 / 256.0).collect();
        let result = compute_spectrum_bars(&audio, 64, 1920.0, 440.0);
        assert_eq!(result.len(), 64 * 4);

        // Check all values are finite and reasonable
        for chunk in result.chunks(4) {
            let (x, y, w, h) = (chunk[0], chunk[1], chunk[2], chunk[3]);
            assert!(x >= 0.0 && x <= 1920.0, "x={x} out of range");
            assert!(y >= 0.0 && y <= 440.0, "y={y} out of range");
            assert!(w > 0.0, "width should be positive");
            assert!(h >= 0.0, "height should be non-negative");
        }
    }

    #[test]
    fn test_empty_audio() {
        let result = compute_spectrum_bars(&[], 64, 1920.0, 440.0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_zero_bars() {
        let audio = vec![0.5; 128];
        let result = compute_spectrum_bars(&audio, 0, 1920.0, 440.0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_zero_dimensions() {
        let audio = vec![0.5; 128];
        assert!(compute_spectrum_bars(&audio, 64, 0.0, 440.0).is_empty());
        assert!(compute_spectrum_bars(&audio, 64, 1920.0, 0.0).is_empty());
        assert!(compute_spectrum_bars(&audio, 64, -10.0, 440.0).is_empty());
    }

    #[test]
    fn test_more_bars_than_samples() {
        let audio = vec![0.8; 4];
        let result = compute_spectrum_bars(&audio, 64, 1920.0, 440.0);
        assert_eq!(result.len(), 64 * 4);
    }

    #[test]
    fn test_single_bar() {
        let audio = vec![1.0; 128];
        let result = compute_spectrum_bars(&audio, 1, 1920.0, 440.0);
        assert_eq!(result.len(), 4);
        assert!(result[3] > 0.0, "Full amplitude should produce visible bar");
    }

    #[test]
    fn test_silent_audio() {
        let audio = vec![0.0; 128];
        let result = compute_spectrum_bars(&audio, 32, 1920.0, 440.0);
        assert_eq!(result.len(), 32 * 4);
        // All bar heights should be zero for silent audio
        for chunk in result.chunks(4) {
            assert_eq!(chunk[3], 0.0, "Silent audio should have zero bar height");
        }
    }

    #[test]
    fn test_bars_fill_width() {
        let audio = vec![0.5; 128];
        let result = compute_spectrum_bars(&audio, 64, 1920.0, 440.0);
        // Last bar should start before width
        let last_x = result[result.len() - 4];
        let last_w = result[result.len() - 2];
        assert!(last_x + last_w <= 1920.0 + 1.0, "Bars should fit within width");
    }
}
