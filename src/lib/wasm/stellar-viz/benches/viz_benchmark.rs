use criterion::{black_box, criterion_group, criterion_main, Criterion};
use stellar_viz::color;
use stellar_viz::noise;
use stellar_viz::physics::PhysicsState;
use stellar_viz::radial;
use stellar_viz::spectrum;
use stellar_viz::waveform;

fn bench_spectrum(c: &mut Criterion) {
    let audio: Vec<f32> = noise::generate_fake_audio_frame(0.0, 1024);

    c.bench_function("spectrum_64_bars", |b| {
        b.iter(|| spectrum::compute_spectrum_bars(black_box(&audio), 64, 1920.0, 440.0))
    });

    c.bench_function("spectrum_128_bars", |b| {
        b.iter(|| spectrum::compute_spectrum_bars(black_box(&audio), 128, 1920.0, 440.0))
    });

    c.bench_function("spectrum_256_bars", |b| {
        b.iter(|| spectrum::compute_spectrum_bars(black_box(&audio), 256, 1920.0, 440.0))
    });
}

fn bench_waveform(c: &mut Criterion) {
    let audio: Vec<f32> = noise::generate_fake_audio_frame(0.0, 1024);

    c.bench_function("waveform_200_points", |b| {
        b.iter(|| waveform::compute_waveform_points(black_box(&audio), 200, 1920.0, 440.0))
    });

    c.bench_function("waveform_500_points", |b| {
        b.iter(|| waveform::compute_waveform_points(black_box(&audio), 500, 1920.0, 440.0))
    });
}

fn bench_radial(c: &mut Criterion) {
    let audio: Vec<f32> = noise::generate_fake_audio_frame(0.0, 512);

    c.bench_function("radial_64_bars", |b| {
        b.iter(|| {
            radial::compute_radial_spectrum(black_box(&audio), 64, 960.0, 220.0, 100.0)
        })
    });

    c.bench_function("radial_128_bars", |b| {
        b.iter(|| {
            radial::compute_radial_spectrum(black_box(&audio), 128, 960.0, 220.0, 100.0)
        })
    });
}

fn bench_physics(c: &mut Criterion) {
    let targets_64: Vec<f32> = (0..64).map(|i| (i as f32 / 64.0) * 440.0).collect();
    let targets_128: Vec<f32> = (0..128).map(|i| (i as f32 / 128.0) * 440.0).collect();

    c.bench_function("physics_64_bars_step", |b| {
        let mut state = PhysicsState::new(64);
        b.iter(|| state.update(black_box(&targets_64), 1.0 / 60.0))
    });

    c.bench_function("physics_128_bars_step", |b| {
        let mut state = PhysicsState::new(128);
        b.iter(|| state.update(black_box(&targets_128), 1.0 / 60.0))
    });
}

fn bench_noise(c: &mut Criterion) {
    c.bench_function("noise_256_samples", |b| {
        b.iter(|| noise::generate_fake_audio_frame(black_box(0.0), 256))
    });

    c.bench_function("noise_1024_samples", |b| {
        b.iter(|| noise::generate_fake_audio_frame(black_box(0.0), 1024))
    });
}

fn bench_colour(c: &mut Criterion) {
    c.bench_function("palette_8_colours", |b| {
        b.iter(|| color::generate_palette_from_seed(black_box("#ff6600"), 8))
    });

    let palette: Vec<String> = color::generate_palette_from_seed("#ff6600", 8);
    c.bench_function("interpolate_colour", |b| {
        b.iter(|| color::interpolate_bar_colour(black_box(0.5), &palette))
    });
}

fn bench_full_pipeline(c: &mut Criterion) {
    c.bench_function("full_pipeline_64_bars", |b| {
        let mut physics = PhysicsState::new(64);
        b.iter(|| {
            let audio = noise::generate_fake_audio_frame(0.0, 256);
            let bars = spectrum::compute_spectrum_bars(&audio, 64, 1920.0, 440.0);
            let targets: Vec<f32> = bars.chunks(4).map(|c| c[3]).collect();
            physics.update(black_box(&targets), 1.0 / 60.0)
        })
    });
}

criterion_group!(
    benches,
    bench_spectrum,
    bench_waveform,
    bench_radial,
    bench_physics,
    bench_noise,
    bench_colour,
    bench_full_pipeline
);
criterion_main!(benches);
