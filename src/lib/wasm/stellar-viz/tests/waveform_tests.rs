use stellar_viz::waveform::compute_waveform_points;

#[test]
fn test_waveform_200_points() {
    let audio: Vec<f32> = (0..1024)
        .map(|i| ((i as f32 * 0.05).sin() + 1.0) / 2.0)
        .collect();
    let result = compute_waveform_points(&audio, 200, 1920.0, 440.0);
    assert_eq!(result.len(), 400); // 200 * 2
}

#[test]
fn test_waveform_x_monotonic() {
    let audio: Vec<f32> = vec![0.5; 256];
    let result = compute_waveform_points(&audio, 100, 1920.0, 440.0);
    for i in 1..100 {
        let prev_x = result[(i - 1) * 2];
        let curr_x = result[i * 2];
        assert!(curr_x >= prev_x, "X coordinates should be monotonically increasing");
    }
}

#[test]
fn test_waveform_y_within_bounds() {
    let audio: Vec<f32> = (0..512).map(|i| if i % 2 == 0 { 0.0 } else { 1.0 }).collect();
    let result = compute_waveform_points(&audio, 256, 1920.0, 440.0);
    for chunk in result.chunks(2) {
        assert!(chunk[1] >= 0.0 && chunk[1] <= 440.0, "y={} out of bounds", chunk[1]);
    }
}
