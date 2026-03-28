use stellar_viz::spectrum::compute_spectrum_bars;

#[test]
fn test_standard_64_bars() {
    let audio: Vec<f32> = (0..512).map(|i| (i as f32 / 512.0).sin().abs()).collect();
    let result = compute_spectrum_bars(&audio, 64, 1920.0, 440.0);
    assert_eq!(result.len(), 256); // 64 * 4
}

#[test]
fn test_standard_128_bars() {
    let audio: Vec<f32> = vec![0.7; 1024];
    let result = compute_spectrum_bars(&audio, 128, 1920.0, 440.0);
    assert_eq!(result.len(), 512); // 128 * 4
    // All bars should have the same height (uniform input)
    let first_height = result[3];
    for chunk in result.chunks(4) {
        assert!((chunk[3] - first_height).abs() < 0.01);
    }
}

#[test]
fn test_bars_ordered_left_to_right() {
    let audio: Vec<f32> = vec![0.5; 128];
    let result = compute_spectrum_bars(&audio, 32, 1920.0, 440.0);
    for i in 1..32 {
        let prev_x = result[(i - 1) * 4];
        let curr_x = result[i * 4];
        assert!(curr_x > prev_x, "Bars should be ordered left to right");
    }
}
